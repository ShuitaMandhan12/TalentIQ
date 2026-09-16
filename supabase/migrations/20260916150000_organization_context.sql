-- Phase 2C — organization context.
--
-- One narrowly scoped RPC so the application can load the caller's effective permissions for an
-- organization in a single call, with exactly the semantics of private.has_organization_permission:
-- the caller's own active membership in an active organization, union of every assigned role.
-- The user is always auth.uid(); no argument can name another user.

create or replace function public.get_my_organization_permissions(target_organization_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct rp.permission_key
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  join public.membership_roles mr on mr.membership_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id
  where m.organization_id = target_organization_id
    and m.user_id = auth.uid()
    and m.is_active
    and o.is_active
  order by 1;
$$;

revoke execute on function public.get_my_organization_permissions(uuid) from public, anon;
grant execute on function public.get_my_organization_permissions(uuid) to authenticated, service_role;
