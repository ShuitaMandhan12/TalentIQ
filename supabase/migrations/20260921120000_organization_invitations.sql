-- Phase 2F.1 — member invitations & account onboarding.
--
-- An organization administrator enters one email. If a TalentIQ account already exists it is added
-- immediately (Phase 2F behaviour); otherwise a pending invitation row is created here and the
-- application sends a Supabase Auth invite email. The recipient authenticates through that email,
-- chooses their own password and accepts, which creates their membership with zero roles.
--
-- This table is the source of truth for the invitation lifecycle: the invite email's metadata is
-- context only and never authorizes anything. There is still no public self-signup.
--
-- Admin side is permission-based (members.view to see, members.manage to create/revoke). The
-- recipient side cannot require membership - they are not a member yet - so it is gated on the
-- caller's own verified Auth email matching the invitation, read inside these functions and never
-- supplied by the caller.
--
-- inviteUserByEmail creates an UNCONFIRMED auth.users row before the person accepts. Such a row is
-- not a usable account: it must never be turned into a membership directly, not even after its
-- invitation is revoked, so both entry points below require email_confirmed_at before treating an
-- address as an existing account.
--
-- SQLSTATEs follow the Phase 2F convention:
--   42501 insufficient_privilege   P0002 not found   22023 invalid identifiers

-- =============================================================================================
-- table
-- =============================================================================================

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Stored normalized so lookups and the pending-uniqueness index cannot be defeated by casing or
  -- padding; 255 matches the auth.users email column rather than an invented application limit.
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 255),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

-- At most one live invitation per organization and address; other organizations may invite the
-- same person independently, and accepted/revoked history is kept.
create unique index organization_invitations_pending_key
  on public.organization_invitations (organization_id, email)
  where status = 'pending';

create index organization_invitations_email_idx
  on public.organization_invitations (email)
  where status = 'pending';

-- Reads and writes go exclusively through the RPCs below, so the table itself is unreachable
-- through the Data API: RLS is enabled with no policies and no table grants.
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon, authenticated;

-- =============================================================================================
-- administrator side
-- =============================================================================================

-- Records a pending invitation for an address that has no TalentIQ account yet. Returns the state
-- the caller must act on: 'already_invited', 'account_exists' (a confirmed account the caller
-- should add instead), 'unconfirmed_account' (an invited account that never finished onboarding)
-- or 'invite_ready' with the new invitation id. Never creates a membership or a role.
create or replace function public.prepare_organization_invitation(
  target_organization_id uuid,
  target_email text
)
returns table (status text, invitation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
  existing_user record;
  new_invitation_id uuid;
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.organization_invitations i
    where i.organization_id = target_organization_id
      and i.email = normalized_email
      and i.status = 'pending'
  ) then
    return query select 'already_invited'::text, null::uuid;
    return;
  end if;

  select u.id, u.email_confirmed_at into existing_user
  from auth.users u where lower(u.email) = normalized_email limit 1;
  if existing_user.id is not null then
    -- A second invitation would collide with the unconfirmed account Supabase already created.
    return query
      select case when existing_user.email_confirmed_at is null then 'unconfirmed_account'
                  else 'account_exists' end::text,
             null::uuid;
    return;
  end if;

  -- The check above is a fast path; this insert is the authority. Inferring the partial unique
  -- index makes concurrent callers resolve to one winner instead of one of them seeing a 23505,
  -- and it leaves every other constraint violation to surface normally.
  insert into public.organization_invitations (organization_id, email, invited_by)
  values (target_organization_id, normalized_email, auth.uid())
  on conflict (organization_id, email) where organization_invitations.status = 'pending' do nothing
  returning id into new_invitation_id;

  if new_invitation_id is null then
    return query select 'already_invited'::text, null::uuid;
    return;
  end if;
  return query select 'invite_ready'::text, new_invitation_id;
end;
$$;

-- Extends the Phase 2F function: an account that exists only because TalentIQ invited it must go
-- through acceptance, so a pending invitation short-circuits the add and an unconfirmed account is
-- refused outright (which still holds once the invitation has been revoked). Every previous outcome
-- (not_found / already_member / reactivated / added) is unchanged for confirmed accounts.
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
  target_user record;
  target_user_id uuid;
  existing_id uuid;
  existing_active boolean;
  new_membership_id uuid;
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.organization_invitations i
    where i.organization_id = target_organization_id
      and i.email = normalized_email
      and i.status = 'pending'
  ) then
    return query select 'already_invited'::text, null::uuid;
    return;
  end if;

  select u.id, u.email_confirmed_at into target_user
  from auth.users u where lower(u.email) = normalized_email limit 1;
  if target_user.id is null then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;
  if target_user.email_confirmed_at is null then
    return query select 'unconfirmed_account'::text, null::uuid;
    return;
  end if;
  target_user_id := target_user.id;

  select m.id, m.is_active into existing_id, existing_active
  from public.organization_memberships m
  where m.organization_id = target_organization_id and m.user_id = target_user_id;

  if existing_id is not null then
    if existing_active then
      return query select 'already_member'::text, existing_id;
      return;
    end if;
    update public.organization_memberships m set is_active = true where m.id = existing_id;
    return query select 'reactivated'::text, existing_id;
    return;
  end if;

  insert into public.organization_memberships (organization_id, user_id)
  values (target_organization_id, target_user_id)
  returning organization_memberships.id into new_membership_id;
  return query select 'added'::text, new_membership_id;
end;
$$;

-- Pending invitations for the members screen. The inviter's address is already visible to
-- members.view holders through the member directory, so showing it here exposes nothing new.
create or replace function public.get_organization_invitations(target_organization_id uuid)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  invited_by_email text,
  invited_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.email,
    i.created_at,
    u.email::text,
    p.full_name
  from public.organization_invitations i
  left join auth.users u on u.id = i.invited_by
  left join public.profiles p on p.id = i.invited_by
  where i.organization_id = target_organization_id
    and i.status = 'pending'
    and private.has_organization_permission(target_organization_id, 'members.view')
  order by i.created_at;
$$;

-- Withdraws a pending invitation. The row is kept as history; only 'pending' may transition.
create or replace function public.revoke_organization_invitation(
  target_organization_id uuid,
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not private.has_organization_permission(target_organization_id, 'members.manage') then
    raise exception 'members.manage is required' using errcode = 'insufficient_privilege';
  end if;

  select i.status into current_status
  from public.organization_invitations i
  where i.id = target_invitation_id and i.organization_id = target_organization_id
  for update;

  if current_status is null then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;
  if current_status <> 'pending' then
    raise exception 'only pending invitations can be revoked' using errcode = 'invalid_parameter_value';
  end if;

  update public.organization_invitations i
  set status = 'revoked', revoked_at = now()
  where i.id = target_invitation_id;
end;
$$;

-- =============================================================================================
-- recipient side (no membership required)
-- =============================================================================================

-- The onboarding page's only read. Returns the invitation solely to the authenticated account
-- whose own Auth email is confirmed and matches it, and only while it is pending. An unconfirmed
-- or mismatched caller gets zero rows, exactly like a missing invitation.
create or replace function public.get_my_organization_invitation(target_invitation_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.id, o.name, o.slug, i.email, i.created_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.id = target_invitation_id
    and i.status = 'pending'
    and i.email = (
      select lower(btrim(u.email)) from auth.users u
      where u.id = auth.uid() and u.email_confirmed_at is not null
    );
$$;

-- Accepts an invitation addressed to the caller's own CONFIRMED Auth email - the UI verifies the
-- emailed token first, but this function enforces the invariant independently. The organization is
-- never supplied by the caller: it comes from the locked invitation row. Membership is created
-- active with zero roles, or an existing one is reactivated with its role assignments intact.
-- Re-acceptance by the same account is a no-op that returns the same destination.
create or replace function public.accept_organization_invitation(target_invitation_id uuid)
returns table (organization_id uuid, organization_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_confirmed_at timestamptz;
  invitation public.organization_invitations;
  organization public.organizations;
  existing_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required' using errcode = 'insufficient_privilege';
  end if;
  select lower(btrim(u.email)), u.email_confirmed_at into caller_email, caller_confirmed_at
  from auth.users u where u.id = caller_id;

  select * into invitation
  from public.organization_invitations i
  where i.id = target_invitation_id
  for update;

  -- A missing Auth row, an unconfirmed address and a mismatched address are all reported exactly
  -- like a missing invitation, so nothing here reveals which condition failed or whether the
  -- invitation exists.
  if invitation.id is null
     or caller_email is null
     or caller_confirmed_at is null
     or invitation.email is distinct from caller_email then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;

  select * into organization from public.organizations o where o.id = invitation.organization_id;
  if not organization.is_active then
    raise exception 'organization is unavailable' using errcode = 'insufficient_privilege';
  end if;

  if invitation.status = 'accepted' and invitation.accepted_user_id = caller_id then
    return query select organization.id, organization.slug;
    return;
  end if;
  if invitation.status <> 'pending' then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;

  select m.id into existing_id
  from public.organization_memberships m
  where m.organization_id = invitation.organization_id and m.user_id = caller_id;

  if existing_id is null then
    insert into public.organization_memberships (organization_id, user_id)
    values (invitation.organization_id, caller_id);
  else
    update public.organization_memberships m set is_active = true where m.id = existing_id;
  end if;

  update public.organization_invitations i
  set status = 'accepted', accepted_at = now(), accepted_user_id = caller_id
  where i.id = invitation.id;

  return query select organization.id, organization.slug;
end;
$$;

-- =============================================================================================
-- privileges
-- =============================================================================================

revoke execute on function
  public.prepare_organization_invitation(uuid, text),
  public.get_organization_invitations(uuid),
  public.revoke_organization_invitation(uuid, uuid),
  public.get_my_organization_invitation(uuid),
  public.accept_organization_invitation(uuid)
from public, anon;

grant execute on function
  public.prepare_organization_invitation(uuid, text),
  public.get_organization_invitations(uuid),
  public.revoke_organization_invitation(uuid, uuid),
  public.get_my_organization_invitation(uuid),
  public.accept_organization_invitation(uuid)
to authenticated, service_role;
