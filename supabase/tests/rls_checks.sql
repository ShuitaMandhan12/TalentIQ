-- Phase 2A tenant-isolation checks.
--
-- Runs against a THROWAWAY local PostgreSQL only (never the hosted project): it stubs the parts of
-- Supabase the migration depends on (auth.users, auth.uid(), the anon/authenticated/service_role
-- roles), applies the migration, seeds two organizations and asserts the isolation rules.
--
--   createdb talentiq_rls_test
--   psql -v ON_ERROR_STOP=1 -d talentiq_rls_test -f supabase/tests/rls_checks.sql
--
-- Any failed assertion aborts the script with a non-zero exit code.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------------------------
-- Supabase stub
-- ---------------------------------------------------------------------------------------------
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;

\ir ../migrations/20260916120000_saas_foundation.sql

-- ---------------------------------------------------------------------------------------------
-- test helpers
-- ---------------------------------------------------------------------------------------------
create schema test;
create function test.uid(name text) returns uuid language sql immutable as $$ select md5(name)::uuid $$;
create function test.login(name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', test.uid(name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function test.org(slug text) returns uuid language sql stable security definer as $$
  select id from public.organizations where organizations.slug = org.slug
$$;
create function test.role_id(slug text, role_name text) returns uuid language sql stable security definer as $$
  select r.id from public.roles r join public.organizations o on o.id = r.organization_id
  where o.slug = role_id.slug and r.name = role_name
$$;
create function test.membership(slug text, name text) returns uuid language sql stable security definer as $$
  select m.id from public.organization_memberships m join public.organizations o on o.id = m.organization_id
  where o.slug = membership.slug and m.user_id = test.uid(membership.name)
$$;

grant usage on schema test to authenticated, anon;
grant execute on all functions in schema test to authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- fixture (as the migration owner, bypassing RLS)
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  (test.uid('alice'),   'alice@acme.test',  '{"full_name": "Alice Admin"}'),
  (test.uid('bob'),     'bob@acme.test',    '{}'),
  (test.uid('carol'),   'carol@beta.test',  '{}'),
  (test.uid('dave'),    'dave@both.test',   '{}'),
  (test.uid('pat'),     'pat@talentiq.test','{}'),
  (test.uid('mallory'), 'mallory@else.test','{}');

insert into public.platform_admins (user_id) values (test.uid('pat'));

insert into public.organizations (name, slug) values ('Acme Recruiting', 'acme'), ('Beta Talent', 'beta');

insert into public.roles (organization_id, name, is_system) values
  (test.org('acme'), 'Organization Admin', true),
  (test.org('acme'), 'Recruiter', false),
  (test.org('beta'), 'HR Admin', true),
  (test.org('beta'), 'Recruiter', false);

insert into public.role_permissions (role_id, organization_id, permission_key)
select r.id, r.organization_id, p.key from public.roles r cross join public.permissions p
where r.name in ('Organization Admin', 'HR Admin');
insert into public.role_permissions (role_id, organization_id, permission_key) values
  (test.role_id('acme', 'Recruiter'), test.org('acme'), 'members.view'),
  (test.role_id('beta', 'Recruiter'), test.org('beta'), 'roles.view');

insert into public.organization_memberships (organization_id, user_id) values
  (test.org('acme'), test.uid('alice')),
  (test.org('acme'), test.uid('bob')),
  (test.org('acme'), test.uid('dave')),
  (test.org('beta'), test.uid('carol')),
  (test.org('beta'), test.uid('dave'));

insert into public.membership_roles (membership_id, role_id, organization_id) values
  (test.membership('acme', 'alice'), test.role_id('acme', 'Organization Admin'), test.org('acme')),
  (test.membership('acme', 'bob'),   test.role_id('acme', 'Recruiter'),          test.org('acme')),
  (test.membership('beta', 'carol'), test.role_id('beta', 'HR Admin'),           test.org('beta'));

insert into public.platform_services (key, name) values ('resume_screening', 'Resume screening');
insert into public.organization_service_entitlements (organization_id, service_key, enabled) values
  (test.org('acme'), 'resume_screening', true),
  (test.org('beta'), 'resume_screening', false);

-- ---------------------------------------------------------------------------------------------
-- assertions
-- ---------------------------------------------------------------------------------------------

-- profile trigger + backfill
do $$
begin
  assert (select count(*) from public.profiles) = 6, 'every auth user gets a profile';
  assert (select full_name from public.profiles where id = test.uid('alice')) = 'Alice Admin', 'full_name copied from metadata';
  insert into auth.users (id, email) values (test.uid('newcomer'), 'new@x.test');
  assert exists (select 1 from public.profiles where id = test.uid('newcomer')), 'trigger creates profile for new user';
end $$;

-- schema: role names are per organization, case-insensitive
do $$
begin
  begin
    insert into public.roles (organization_id, name) values (test.org('acme'), '  recruiter ');
    raise exception 'duplicate role name accepted';
  exception when unique_violation then null; end;
end $$;

-- schema: a role from org A can never be attached to a membership in org B, even bypassing RLS
do $$
begin
  begin
    insert into public.membership_roles (membership_id, role_id, organization_id)
    values (test.membership('beta', 'dave'), test.role_id('acme', 'Recruiter'), test.org('beta'));
    raise exception 'cross-organization role assignment accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.membership_roles (membership_id, role_id, organization_id)
    values (test.membership('beta', 'dave'), test.role_id('acme', 'Recruiter'), test.org('acme'));
    raise exception 'cross-organization role assignment accepted via organization_id mismatch';
  exception when foreign_key_violation then null; end;
end $$;

-- anon has no access at all
do $$
begin
  execute 'set local role anon';
  begin
    perform count(*) from public.organizations;
    raise exception 'anon could read organizations';
  exception when insufficient_privilege then null; end;
end $$;

-- tenant read isolation: a user in org A cannot read org B data
do $$
begin
  perform test.login('alice');
  assert (select count(*) from public.organizations) = 1, 'alice sees only her organization';
  assert (select slug from public.organizations) = 'acme', 'alice sees acme';
  assert (select count(*) from public.organization_memberships where organization_id = test.org('beta')) = 0, 'alice cannot read beta memberships';
  assert (select count(*) from public.roles where organization_id = test.org('beta')) = 0, 'alice cannot read beta roles';
  assert (select count(*) from public.organization_service_entitlements where organization_id = test.org('beta')) = 0, 'alice cannot read beta entitlements';
  assert (select count(*) from public.profiles) = 3, 'alice reads profiles of shared-organization members only (alice, bob, dave)';
  assert not exists (select 1 from public.profiles where id = test.uid('carol')), 'alice cannot read carol''s profile';
  assert (select count(*) from public.platform_admins) = 0, 'alice cannot list platform admins';
end $$;

-- a user may belong to multiple organizations
do $$
begin
  perform test.login('dave');
  assert (select count(*) from public.organizations) = 2, 'dave belongs to both organizations';
  assert (select count(*) from public.organization_memberships) = 2, 'dave sees his own memberships only';
end $$;

-- no membership: nothing visible except own profile
do $$
begin
  perform test.login('mallory');
  assert (select count(*) from public.organizations) = 0, 'mallory sees no organizations';
  assert (select count(*) from public.profiles) = 1, 'mallory sees only her own profile';
  assert (select count(*) from public.permissions) = 6, 'permission catalog is readable';
end $$;

-- authorization is permission-based, never role-name-based
do $$
begin
  perform test.login('bob'); -- role "Recruiter" with members.view only
  assert (select count(*) from public.organization_memberships) = 3, 'members.view lets bob read all acme memberships';
  assert (select count(*) from public.roles) = 1, 'without roles.view bob sees only his own assigned role';
  begin
    insert into public.roles (organization_id, name) values (test.org('acme'), 'Sneaky');
    raise exception 'bob created a role without roles.manage';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.membership_roles (membership_id, role_id, organization_id)
    values (test.membership('acme', 'dave'), test.role_id('acme', 'Recruiter'), test.org('acme'));
    raise exception 'bob assigned a role without members.manage';
  exception when insufficient_privilege then null; end;
end $$;

do $$
begin
  -- rename bob's role to "admin": the name must change nothing
  update public.roles set name = 'admin' where id = test.role_id('acme', 'Recruiter');
  perform test.login('bob');
  begin
    insert into public.roles (organization_id, name) values (test.org('acme'), 'Sneaky');
    raise exception 'a role named "admin" granted management rights';
  exception when insufficient_privilege then null; end;
end $$;
update public.roles set name = 'Recruiter' where name = 'admin';

-- tenant admin (all tenant permissions) can manage tenant things, but not platform things
do $$
declare new_role uuid;
begin
  perform test.login('alice');
  insert into public.roles (organization_id, name) values (test.org('acme'), 'Interview Panel') returning id into new_role;
  insert into public.role_permissions (role_id, organization_id, permission_key) values (new_role, test.org('acme'), 'members.view');
  insert into public.membership_roles (membership_id, role_id, organization_id)
  values (test.membership('acme', 'bob'), new_role, test.org('acme'));
  assert (select count(*) from public.membership_roles where membership_id = test.membership('acme', 'bob')) = 2, 'bob now has two roles';
  update public.organizations set name = 'Acme Recruiting Ltd' where id = test.org('acme');
  assert (select name from public.organizations where id = test.org('acme')) = 'Acme Recruiting Ltd', 'organization.update lets alice rename';

  begin
    insert into public.roles (organization_id, name) values (test.org('beta'), 'Intruder');
    raise exception 'alice created a role in another organization';
  exception when insufficient_privilege then null; end;

  begin
    update public.organizations set is_active = false where id = test.org('acme');
    raise exception 'tenant changed organization status';
  exception when insufficient_privilege then null; end;
  begin
    update public.organizations set slug = 'acme-corp' where id = test.org('acme');
    raise exception 'tenant changed organization slug';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.roles where id = test.role_id('acme', 'Organization Admin');
    raise exception 'tenant deleted a system role';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.organizations (name, slug) values ('Self Made', 'self-made');
    raise exception 'tenant created an organization';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.permissions (key, name, category) values ('jobs.create', 'x', 'x');
    raise exception 'tenant inserted a permission';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.platform_services (key, name) values ('free_stuff', 'x');
    raise exception 'tenant created a platform service';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.platform_admins (user_id) values (test.uid('alice'));
    raise exception 'tenant made herself platform admin';
  exception when insufficient_privilege then null; end;

  -- entitlements: readable, never writable by the tenant
  assert (select enabled from public.organization_service_entitlements where organization_id = test.org('acme')) = true, 'alice reads her entitlement';
  update public.organization_service_entitlements set enabled = false, limits = '{"seats": 999}' where organization_id = test.org('acme');
  assert (select limits from public.organization_service_entitlements where organization_id = test.org('acme')) = '{}'::jsonb, 'tenant update of entitlements silently affects zero rows';
  begin
    insert into public.organization_service_entitlements (organization_id, service_key) values (test.org('acme'), 'resume_screening');
    raise exception 'tenant inserted an entitlement';
  exception when insufficient_privilege then null; when unique_violation then raise exception 'tenant insert reached the table'; end;
end $$;

-- platform admin: control plane without being a tenant member
do $$
begin
  perform test.login('pat');
  assert (select count(*) from public.organizations) = 2, 'platform admin sees every organization';
  assert not private.is_organization_member(test.org('acme')), 'platform admin is not silently a member';
  assert (select count(*) from public.organization_memberships) = 5, 'platform admin sees all memberships';
  update public.organization_service_entitlements set enabled = true, limits = '{"seats": 25}' where organization_id = test.org('beta');
  assert (select enabled from public.organization_service_entitlements where organization_id = test.org('beta')) = true, 'platform admin enables a service';
  insert into public.organizations (name, slug) values ('Gamma Hiring', 'gamma');
  insert into public.platform_services (key, name) values ('job_posting', 'Job posting');
  update public.organizations set is_active = false where id = test.org('beta');
  assert (select is_active from public.organizations where id = test.org('beta')) = false, 'platform admin suspends an organization';
end $$;

-- entitlement helper and suspension semantics
do $$
begin
  perform test.login('carol'); -- HR Admin of the now-suspended beta
  assert private.organization_has_service(test.org('acme'), 'resume_screening'), 'acme entitled';
  assert not private.organization_has_service(test.org('beta'), 'resume_screening'), 'suspended organization has no services';
  assert (select count(*) from public.organizations) = 1, 'member of a suspended organization can still read it';
  update public.organizations set name = 'Beta Talent Ltd' where id = test.org('beta');
  assert (select name from public.organizations where id = test.org('beta')) = 'Beta Talent', 'no tenant actions while suspended';
  begin
    insert into public.roles (organization_id, name) values (test.org('beta'), 'Blocked');
    raise exception 'tenant acted inside a suspended organization';
  exception when insufficient_privilege then null; end;
end $$;
update public.organizations set is_active = true where slug = 'beta';
update public.platform_services set is_active = false where key = 'resume_screening';
do $$
begin
  assert not private.organization_has_service(test.org('acme'), 'resume_screening'), 'inactive platform service is not available';
end $$;
update public.platform_services set is_active = true where key = 'resume_screening';

-- cascades
do $$
begin
  delete from public.organizations where slug = 'gamma';
  delete from auth.users where id = test.uid('dave');
  assert not exists (select 1 from public.profiles where id = test.uid('dave')), 'deleting a user removes the profile';
  assert not exists (select 1 from public.organization_memberships where user_id = test.uid('dave')), 'deleting a user removes memberships';
  delete from public.roles where name = 'Interview Panel';
  assert not exists (select 1 from public.membership_roles where role_id not in (select id from public.roles)), 'deleting a role removes assignments';
  delete from public.organizations where slug = 'acme';
  assert not exists (select 1 from public.roles where organization_id = test.org('acme')), 'deleting an organization removes roles';
  assert not exists (select 1 from public.organization_service_entitlements where service_key = 'resume_screening' and organization_id is null), 'sanity';
  assert (select count(*) from public.organization_service_entitlements) = 1, 'deleting an organization removes its entitlements';
end $$;

select 'all Phase 2A RLS checks passed' as result;
