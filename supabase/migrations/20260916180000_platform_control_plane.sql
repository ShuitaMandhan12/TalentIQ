create or replace function private.provision_organization_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_role_id uuid;
  permission_count integer;
begin
  insert into public.roles (
    organization_id,
    name,
    description,
    is_system
  )
  values (
    new.id,
    'Organization Admin',
    'Manages the organization, its members and its roles.',
    true
  )
  returning id into admin_role_id;

  insert into public.role_permissions (
    role_id,
    organization_id,
    permission_key
  )
  select
    admin_role_id,
    new.id,
    key
  from public.permissions
  where key in (
    'organization.view',
    'organization.update',
    'members.view',
    'members.manage',
    'roles.view',
    'roles.manage'
  );

  get diagnostics permission_count = row_count;

  if permission_count <> 6 then
    raise exception 'Organization default permission catalog is incomplete';
  end if;

  return new;
end;
$$;

revoke execute
on function private.provision_organization_defaults()
from public, anon, authenticated, service_role;

create trigger provision_organization_defaults
after insert on public.organizations
for each row
execute function private.provision_organization_defaults();