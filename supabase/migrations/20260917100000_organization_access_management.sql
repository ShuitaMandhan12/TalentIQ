-- Phase 2F — organization users & roles management.
--
-- 1. System-role hardening: tenants can only define custom roles. The "Organization Admin" system
--    role (created by the platform provisioning trigger) can be assigned but never created,
--    renamed, redescribed, demoted, deleted or have its permission bundle changed by a tenant.
-- 2. Narrow RPCs for the tenant administration screens: a member directory that may read auth
--    emails, adding an existing account by exact email, atomic role assignment and membership
--    status, a role catalog with counts, and atomic custom-role create/update/delete.
--
-- Every function derives the caller from auth.uid(), checks the tenant permission through
-- private.has_organization_permission (active membership in an active organization) and rejects
-- identifiers from other organizations. Expected failures raise dedicated SQLSTATEs so the
-- application can map them to messages without parsing text:
--   42501  insufficient_privilege     P0002  not found            22023  invalid identifiers
--   TQ001  system role is immutable   TQ002  role still assigned  TQ003  self-deactivation

-- =============================================================================================
-- system-role hardening
-- =============================================================================================

-- Replaces the Phase 2A guard: tenants cannot insert system roles, delete them, change is_system in
-- either direction, or UPDATE an existing system role at all. The UPDATE rejection is
-- unconditional rather than a row comparison: a nominal no-op would still persist a new updated_at
-- through the set_updated_at trigger, and tenant code has no legitimate reason to update a
-- product-owned role. Operators (no JWT) and platform admins are exempt, so Phase 2E provisioning
-- and platform maintenance continue to work.
create or replace function private.guard_system_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_platform_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' and new.is_system then
    raise exception 'system roles are created by TalentIQ' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'system roles cannot be deleted' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' then
    if old.is_system then
      raise exception 'system roles are managed by TalentIQ' using errcode = 'insufficient_privilege';
    end if;
    if new.is_system is distinct from old.is_system then
      raise exception 'only platform admins can change the system flag of a role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_system_role_insert before insert on public.roles
  for each row execute function private.guard_system_role();

-- Security definer so the role lookup does not depend on what the caller may read. On UPDATE both
-- the previous and the new role are checked, so a row can neither leave nor join a system role.
create or replace function private.guard_system_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_platform_admin() then
    return coalesce(new, old);
  end if;
  if exists (
    select 1 from public.roles
    where is_system and id in (new.role_id, old.role_id)
  ) then
    raise exception 'permissions of system roles are managed by TalentIQ'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.guard_system_role_permissions() from public;

create trigger guard_system_role_permissions
  before insert or update or delete on public.role_permissions
  for each row execute function private.guard_system_role_permissions();

-- =============================================================================================
-- members
-- =============================================================================================

-- Member directory. Reads auth.users for emails, so it is security definer and returns rows only
-- when the caller holds members.view in the target organization.
create or replace function public.get_organization_members(target_organization_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  is_active boolean,
  created_at timestamptz,
  role_ids uuid[],
  role_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.user_id,
    u.email::text,
    p.full_name,
    m.is_active,
    m.created_at,
    coalesce(array_agg(r.id order by r.name) filter (where r.id is not null), '{}'),
    coalesce(array_agg(r.name order by r.name) filter (where r.id is not null), '{}')
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  left join public.membership_roles mr on mr.membership_id = m.id
  left join public.roles r on r.id = mr.role_id
  where m.organization_id = target_organization_id
    and private.has_organization_permission(target_organization_id, 'members.view')
  group by m.id, u.email, p.full_name
  order by m.created_at;
$$;

-- Adds an EXISTING account to the organization by exact (case-insensitive) email. Never creates
-- auth users, never assigns roles, never reveals more than whether that exact address has an
-- account. An inactive membership is reactivated with its role assignments intact.
create or replace function public.add_organization_member_by_email(
  target_organization_id uuid,
  target_email text
)
returns table (status text, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
  target_user_id uuid;
  existing_id uuid;
  existing_active boolean;
  new_membership_id uuid;
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;

  select id into target_user_id from auth.users where lower(email) = normalized_email limit 1;
  if target_user_id is null then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  select id, is_active into existing_id, existing_active
  from public.organization_memberships
  where organization_id = target_organization_id and user_id = target_user_id;

  if existing_id is not null then
    if existing_active then
      return query select 'already_member'::text, existing_id;
      return;
    end if;
    update public.organization_memberships set is_active = true where id = existing_id;
    return query select 'reactivated'::text, existing_id;
    return;
  end if;

  insert into public.organization_memberships (organization_id, user_id)
  values (target_organization_id, target_user_id)
  returning id into new_membership_id;
  return query select 'added'::text, new_membership_id;
end;
$$;

-- Activates or deactivates a membership. Deactivation keeps the row and its role assignments.
-- Callers cannot deactivate themselves (first lockout safeguard).
create or replace function public.set_organization_member_status(
  target_organization_id uuid,
  target_membership_id uuid,
  active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;

  select user_id into target_user_id
  from public.organization_memberships
  where id = target_membership_id and organization_id = target_organization_id;
  if target_user_id is null then
    raise exception 'member not found' using errcode = 'no_data_found';
  end if;
  if not active and target_user_id = auth.uid() then
    raise exception 'callers cannot deactivate their own membership' using errcode = 'TQ003';
  end if;

  update public.organization_memberships set is_active = active where id = target_membership_id;
end;
$$;

-- Atomically replaces a member's role set. Every role must belong to the same organization as the
-- membership (the composite foreign keys enforce it too); an empty set is valid.
create or replace function public.set_organization_member_roles(
  target_organization_id uuid,
  target_membership_id uuid,
  target_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  distinct_role_ids uuid[] := (
    select coalesce(array_agg(distinct id), '{}') from unnest(target_role_ids) as t(id)
  );
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where id = target_membership_id and organization_id = target_organization_id
  ) then
    raise exception 'member not found' using errcode = 'no_data_found';
  end if;
  if (
    select count(*) from public.roles
    where organization_id = target_organization_id and id = any (distinct_role_ids)
  ) <> cardinality(distinct_role_ids) then
    raise exception 'roles must belong to the organization' using errcode = 'invalid_parameter_value';
  end if;

  delete from public.membership_roles where membership_id = target_membership_id;
  insert into public.membership_roles (membership_id, role_id, organization_id)
  select target_membership_id, id, target_organization_id from unnest(distinct_role_ids) as t(id);
end;
$$;

-- =============================================================================================
-- roles
-- =============================================================================================

-- Role catalog with permission bundle and assignment count, for roles.view holders.
create or replace function public.get_organization_roles(target_organization_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_system boolean,
  permission_keys text[],
  member_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.description,
    r.is_system,
    coalesce((
      select array_agg(rp.permission_key order by rp.permission_key)
      from public.role_permissions rp where rp.role_id = r.id
    ), '{}'),
    (select count(*) from public.membership_roles mr where mr.role_id = r.id)::integer,
    r.created_at
  from public.roles r
  where r.organization_id = target_organization_id
    and private.has_organization_permission(target_organization_id, 'roles.view')
  order by r.is_system desc, r.name;
$$;

-- Creates a CUSTOM role with its permission bundle atomically. is_system is never caller-chosen.
create or replace function public.create_organization_role(
  target_organization_id uuid,
  role_name text,
  role_description text,
  permission_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  distinct_keys text[] := (
    select coalesce(array_agg(distinct k), '{}') from unnest(permission_keys) as t(k)
  );
  new_role_id uuid;
begin
  if not private.has_organization_permission(target_organization_id, 'roles.manage') then
    raise exception 'roles.manage is required' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.permissions where key = any (distinct_keys))
     <> cardinality(distinct_keys) then
    raise exception 'unknown permission' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.roles (organization_id, name, description, is_system)
  values (target_organization_id, btrim(role_name), nullif(btrim(role_description), ''), false)
  returning id into new_role_id;

  insert into public.role_permissions (role_id, organization_id, permission_key)
  select new_role_id, target_organization_id, k from unnest(distinct_keys) as t(k);

  return new_role_id;
end;
$$;

-- Updates a CUSTOM role's definition and replaces its permission bundle atomically.
create or replace function public.update_organization_role(
  target_organization_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text,
  permission_keys text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  distinct_keys text[] := (
    select coalesce(array_agg(distinct k), '{}') from unnest(permission_keys) as t(k)
  );
  target_is_system boolean;
begin
  if not private.has_organization_permission(target_organization_id, 'roles.manage') then
    raise exception 'roles.manage is required' using errcode = 'insufficient_privilege';
  end if;

  select is_system into target_is_system
  from public.roles where id = target_role_id and organization_id = target_organization_id;
  if target_is_system is null then
    raise exception 'role not found' using errcode = 'no_data_found';
  end if;
  if target_is_system then
    raise exception 'system roles are managed by TalentIQ' using errcode = 'TQ001';
  end if;
  if (select count(*) from public.permissions where key = any (distinct_keys))
     <> cardinality(distinct_keys) then
    raise exception 'unknown permission' using errcode = 'invalid_parameter_value';
  end if;

  update public.roles
  set name = btrim(role_name), description = nullif(btrim(role_description), '')
  where id = target_role_id;

  delete from public.role_permissions where role_id = target_role_id;
  insert into public.role_permissions (role_id, organization_id, permission_key)
  select target_role_id, target_organization_id, k from unnest(distinct_keys) as t(k);
end;
$$;

-- Deletes a CUSTOM role that is not assigned to anyone. Assignments are never removed implicitly.
-- The role row is locked FOR UPDATE first: a concurrent assignment holds a KEY SHARE lock on the
-- role through its foreign key, so whichever transaction comes second waits and then either sees
-- the assignment (TQ002) or fails its foreign key check (role gone). Nothing is cascaded away.
create or replace function public.delete_organization_role(
  target_organization_id uuid,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_is_system boolean;
begin
  if not private.has_organization_permission(target_organization_id, 'roles.manage') then
    raise exception 'roles.manage is required' using errcode = 'insufficient_privilege';
  end if;

  select is_system into target_is_system
  from public.roles
  where id = target_role_id and organization_id = target_organization_id
  for update;
  if target_is_system is null then
    raise exception 'role not found' using errcode = 'no_data_found';
  end if;
  if target_is_system then
    raise exception 'system roles are managed by TalentIQ' using errcode = 'TQ001';
  end if;
  if exists (select 1 from public.membership_roles where role_id = target_role_id) then
    raise exception 'role is still assigned to members' using errcode = 'TQ002';
  end if;

  delete from public.roles where id = target_role_id;
end;
$$;

-- =============================================================================================
-- privileges
-- =============================================================================================

revoke execute on function
  public.get_organization_members(uuid),
  public.add_organization_member_by_email(uuid, text),
  public.set_organization_member_status(uuid, uuid, boolean),
  public.set_organization_member_roles(uuid, uuid, uuid[]),
  public.get_organization_roles(uuid),
  public.create_organization_role(uuid, text, text, text[]),
  public.update_organization_role(uuid, uuid, text, text, text[]),
  public.delete_organization_role(uuid, uuid)
from public, anon;

grant execute on function
  public.get_organization_members(uuid),
  public.add_organization_member_by_email(uuid, text),
  public.set_organization_member_status(uuid, uuid, boolean),
  public.set_organization_member_roles(uuid, uuid, uuid[]),
  public.get_organization_roles(uuid),
  public.create_organization_role(uuid, text, text, text[]),
  public.update_organization_role(uuid, uuid, text, text, text[]),
  public.delete_organization_role(uuid, uuid)
to authenticated, service_role;
