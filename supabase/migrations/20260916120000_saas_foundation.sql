-- Phase 2A — multi-tenant SaaS foundation.
--
-- Global profiles, customer organizations, platform (SaaS operator) admins, organization
-- memberships, a system-defined permission catalog, organization-defined roles with multi-role
-- assignment, a platform service catalog and per-organization service entitlements.
-- Row Level Security is enabled on every table; tenant isolation is enforced by the schema
-- (composite foreign keys) and by policies built on the helpers in the private schema.

-- =============================================================================================
-- private schema: security helpers that must never be exposed through the API
-- =============================================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================================
-- tables
-- =============================================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  -- Lets junction tables reference a membership together with its organization.
  unique (id, organization_id)
);

create index organization_memberships_user_id_idx on public.organization_memberships (user_id);

-- System capability catalog. Keys are referenced by application code and only change through
-- migrations; tenants never insert here.
create table public.permissions (
  key text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  name text not null,
  description text,
  category text not null,
  created_at timestamptz not null default now()
);

-- Organization-defined role names; authorization only ever looks at the permissions behind them.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index roles_organization_id_name_key
  on public.roles (organization_id, lower(btrim(name)));

create table public.role_permissions (
  role_id uuid not null,
  organization_id uuid not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (role_id, organization_id)
    references public.roles (id, organization_id) on delete cascade
);

create index role_permissions_organization_id_idx on public.role_permissions (organization_id);

-- organization_id is carried so both composite foreign keys must agree: a role from one
-- organization can never be attached to a membership in another.
create table public.membership_roles (
  membership_id uuid not null,
  role_id uuid not null,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id),
  foreign key (membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete cascade,
  foreign key (role_id, organization_id)
    references public.roles (id, organization_id) on delete cascade
);

create index membership_roles_role_id_idx on public.membership_roles (role_id);

-- Catalog of sellable product modules. Keys map to real application functionality.
create table public.platform_services (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Platform-controlled entitlements. Payment/subscriptions will later write here; tenants never do.
create table public.organization_service_entitlements (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_key text not null references public.platform_services (key) on delete cascade,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, service_key)
);

create index organization_service_entitlements_service_key_idx
  on public.organization_service_entitlements (service_key);

-- =============================================================================================
-- updated_at triggers
-- =============================================================================================

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organization_memberships
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.roles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.platform_services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organization_service_entitlements
  for each row execute function private.set_updated_at();

-- =============================================================================================
-- profile lifecycle: every auth user has exactly one profile
-- =============================================================================================

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

insert into public.profiles (id, full_name)
select id, nullif(btrim(raw_user_meta_data ->> 'full_name'), '') from auth.users
on conflict (id) do nothing;

-- =============================================================================================
-- authorization helpers (security definer: they read tables without re-entering RLS)
-- =============================================================================================

create or replace function private.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = uid);
$$;

-- Active membership in the organization. The organization itself may be suspended: members can
-- still see it (so the UI can explain), but has_organization_permission refuses every action.
create or replace function private.is_organization_member(org_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships
    where organization_id = org_id and user_id = uid and is_active
  );
$$;

-- Permission-based, never role-name-based: true when any role on the user's active membership in
-- an active organization carries the permission.
create or replace function private.has_organization_permission(
  org_id uuid,
  perm_key text,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    where m.organization_id = org_id
      and m.user_id = uid
      and m.is_active
      and o.is_active
      and rp.permission_key = perm_key
  );
$$;

create or replace function private.shares_organization_with(other_uid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = uid and mine.is_active
      and theirs.user_id = other_uid and theirs.is_active
  );
$$;

create or replace function private.organization_has_service(org_id uuid, svc_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_service_entitlements e
    join public.organizations o on o.id = e.organization_id
    join public.platform_services s on s.key = e.service_key
    where e.organization_id = org_id
      and e.service_key = svc_key
      and e.enabled
      and o.is_active
      and s.is_active
  );
$$;

revoke execute on function
  private.is_platform_admin(uuid),
  private.is_organization_member(uuid, uuid),
  private.has_organization_permission(uuid, text, uuid),
  private.shares_organization_with(uuid, uuid),
  private.organization_has_service(uuid, text)
from public;

grant execute on function
  private.is_platform_admin(uuid),
  private.is_organization_member(uuid, uuid),
  private.has_organization_permission(uuid, text, uuid),
  private.shares_organization_with(uuid, uuid),
  private.organization_has_service(uuid, text)
to authenticated, service_role;

-- =============================================================================================
-- guards for rules RLS cannot express (old vs new row comparisons)
-- They apply to authenticated API users only: with no JWT subject (SQL editor, service role) the
-- caller is an operator, not a tenant.
-- =============================================================================================

-- Tenants with organization.update may rename their organization but never re-activate a
-- suspended one or change its slug: those are platform decisions.
create or replace function private.guard_organization_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not private.is_platform_admin()
     and (new.is_active is distinct from old.is_active or new.slug is distinct from old.slug) then
    raise exception 'only platform admins can change organization status or slug'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger guard_organization_update before update on public.organizations
  for each row execute function private.guard_organization_update();

-- System roles (e.g. a provisioned "Organization Admin") cannot be deleted or demoted by tenants,
-- which prevents an organization from locking itself out of its own management.
create or replace function private.guard_system_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_platform_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'system roles cannot be deleted' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and new.is_system is distinct from old.is_system then
    raise exception 'only platform admins can change the system flag of a role'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_system_role before update or delete on public.roles
  for each row execute function private.guard_system_role();

-- =============================================================================================
-- privileges: anon never touches these tables; authenticated goes through RLS
-- =============================================================================================

revoke all on
  public.profiles, public.organizations, public.platform_admins, public.organization_memberships,
  public.permissions, public.roles, public.role_permissions, public.membership_roles,
  public.platform_services, public.organization_service_entitlements
from anon;

-- Supabase's default privileges grant writes on new tables; profiles are created by trigger and
-- the permission catalog only changes through migrations, so take those grants away explicitly.
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.permissions from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.organizations, public.platform_admins, public.organization_memberships,
  public.roles, public.role_permissions, public.membership_roles,
  public.platform_services, public.organization_service_entitlements
to authenticated;
grant select on public.permissions to authenticated;

-- =============================================================================================
-- row level security
-- =============================================================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.platform_services enable row level security;
alter table public.organization_service_entitlements enable row level security;

-- profiles ------------------------------------------------------------------------------------
create policy "profiles: own, shared organization or platform admin can read"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.shares_organization_with(id)
    or private.is_platform_admin()
  );

create policy "profiles: own or platform admin can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_platform_admin())
  with check (id = (select auth.uid()) or private.is_platform_admin());

-- organizations -------------------------------------------------------------------------------
create policy "organizations: members and platform admins can read"
  on public.organizations for select to authenticated
  using (private.is_organization_member(id) or private.is_platform_admin());

create policy "organizations: platform admins can create"
  on public.organizations for insert to authenticated
  with check (private.is_platform_admin());

create policy "organizations: platform admin or organization.update can update"
  on public.organizations for update to authenticated
  using (private.is_platform_admin() or private.has_organization_permission(id, 'organization.update'))
  with check (private.is_platform_admin() or private.has_organization_permission(id, 'organization.update'));

create policy "organizations: platform admins can delete"
  on public.organizations for delete to authenticated
  using (private.is_platform_admin());

-- platform_admins -----------------------------------------------------------------------------
create policy "platform_admins: own row or platform admin can read"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

create policy "platform_admins: platform admins can manage"
  on public.platform_admins for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- organization_memberships --------------------------------------------------------------------
create policy "memberships: own, members.view or platform admin can read"
  on public.organization_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'members.view')
    or private.is_platform_admin()
  );

create policy "memberships: members.manage or platform admin can create"
  on public.organization_memberships for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  );

create policy "memberships: members.manage or platform admin can update"
  on public.organization_memberships for update to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  )
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  );

create policy "memberships: members.manage or platform admin can delete"
  on public.organization_memberships for delete to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  );

-- permissions (system catalog: readable, never writable through the API) ----------------------
create policy "permissions: authenticated can read"
  on public.permissions for select to authenticated
  using (true);

-- roles ---------------------------------------------------------------------------------------
create policy "roles: roles.view, own roles or platform admin can read"
  on public.roles for select to authenticated
  using (
    private.has_organization_permission(organization_id, 'roles.view')
    or private.is_platform_admin()
    or exists (
      select 1
      from public.membership_roles mr
      join public.organization_memberships m on m.id = mr.membership_id
      where mr.role_id = roles.id and m.user_id = (select auth.uid())
    )
  );

create policy "roles: roles.manage or platform admin can create"
  on public.roles for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  );

create policy "roles: roles.manage or platform admin can update"
  on public.roles for update to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  )
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  );

create policy "roles: roles.manage or platform admin can delete"
  on public.roles for delete to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  );

-- role_permissions ----------------------------------------------------------------------------
create policy "role_permissions: readable with the role"
  on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_permissions.role_id));

create policy "role_permissions: roles.manage or platform admin can add"
  on public.role_permissions for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  );

create policy "role_permissions: roles.manage or platform admin can remove"
  on public.role_permissions for delete to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'roles.manage')
  );

-- membership_roles ----------------------------------------------------------------------------
create policy "membership_roles: own, members.view or platform admin can read"
  on public.membership_roles for select to authenticated
  using (
    private.has_organization_permission(organization_id, 'members.view')
    or private.is_platform_admin()
    or exists (
      select 1 from public.organization_memberships m
      where m.id = membership_roles.membership_id and m.user_id = (select auth.uid())
    )
  );

create policy "membership_roles: members.manage or platform admin can assign"
  on public.membership_roles for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  );

create policy "membership_roles: members.manage or platform admin can unassign"
  on public.membership_roles for delete to authenticated
  using (
    private.is_platform_admin()
    or private.has_organization_permission(organization_id, 'members.manage')
  );

-- platform_services ---------------------------------------------------------------------------
create policy "platform_services: authenticated can read"
  on public.platform_services for select to authenticated
  using (true);

create policy "platform_services: platform admins can manage"
  on public.platform_services for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- organization_service_entitlements -----------------------------------------------------------
create policy "entitlements: members and platform admins can read"
  on public.organization_service_entitlements for select to authenticated
  using (private.is_organization_member(organization_id) or private.is_platform_admin());

create policy "entitlements: platform admins can manage"
  on public.organization_service_entitlements for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- =============================================================================================
-- seed: the permissions that exist today (tenant self-management only)
-- =============================================================================================

insert into public.permissions (key, name, description, category) values
  ('organization.view',   'View organization',   'See organization details and settings.',               'organization'),
  ('organization.update', 'Update organization', 'Edit organization details.',                           'organization'),
  ('members.view',        'View members',        'See who belongs to the organization and their roles.', 'members'),
  ('members.manage',      'Manage members',      'Add, deactivate and remove members; assign roles.',    'members'),
  ('roles.view',          'View roles',          'See roles and the permissions they grant.',            'roles'),
  ('roles.manage',        'Manage roles',        'Create, edit and delete roles and their permissions.', 'roles');
