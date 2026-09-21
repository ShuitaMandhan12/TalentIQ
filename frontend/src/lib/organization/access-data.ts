import { isPermissionKey, type PermissionKey } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

// Reads for tenant access administration. Both RPCs derive the caller from auth.uid() and return
// nothing unless the caller holds the relevant view permission in that organization.

export type OrganizationMember = {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  role_ids: string[];
  role_names: string[];
};

export type OrganizationRole = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_keys: PermissionKey[];
  member_count: number;
  created_at: string;
};

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_members", {
    target_organization_id: organizationId,
  });
  if (error) throw new Error("Unable to load organization members");
  return data;
}

export async function getOrganizationMember(
  organizationId: string,
  membershipId: string,
): Promise<OrganizationMember | null> {
  const members = await getOrganizationMembers(organizationId);
  return members.find((member) => member.membership_id === membershipId) ?? null;
}

export async function getOrganizationRoles(organizationId: string): Promise<OrganizationRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_roles", {
    target_organization_id: organizationId,
  });
  if (error) throw new Error("Unable to load organization roles");
  return (data as (Omit<OrganizationRole, "permission_keys"> & { permission_keys: unknown[] })[]).map(
    (role) => ({ ...role, permission_keys: role.permission_keys.filter(isPermissionKey) }),
  );
}

export async function getOrganizationRole(
  organizationId: string,
  roleId: string,
): Promise<OrganizationRole | null> {
  const roles = await getOrganizationRoles(organizationId);
  return roles.find((role) => role.id === roleId) ?? null;
}

export type PendingInvitation = {
  id: string;
  email: string;
  created_at: string;
  invited_by_email: string | null;
  invited_by_name: string | null;
};

export async function getOrganizationInvitations(
  organizationId: string,
): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_invitations", {
    target_organization_id: organizationId,
  });
  if (error) throw new Error("Unable to load pending invitations");
  return data;
}
