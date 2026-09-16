import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPermissionKey, type PermissionKey } from "./permissions";

export type AccessibleOrganization = {
  id: string;
  name: string;
  slug: string;
  membershipId: string;
};

export type UserContext = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  /** Active memberships in active organizations: the workspaces this user may enter. */
  organizations: AccessibleOrganization[];
};

export type OrganizationContext = {
  organization: AccessibleOrganization;
  membershipId: string;
  /** Union of the permissions of every role assigned to this membership. */
  permissions: PermissionKey[];
};

type MembershipRow = {
  id: string;
  organizations: { id: string; name: string; slug: string };
};

/** Resolves the signed-in user, or null when there is no verified session. Never cached. */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const userId = data.claims.sub;

  // Every query runs under RLS as the user: own platform_admins row, own memberships and the
  // organizations those memberships grant access to.
  const [admin, memberships] = await Promise.all([
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("id, organizations!inner(id, name, slug)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("organizations.is_active", true),
  ]);
  if (admin.error || memberships.error) {
    throw new Error("Unable to load the user's organization context");
  }

  return {
    userId,
    email: data.claims.email ?? null,
    isPlatformAdmin: admin.data !== null,
    // organization_id is a many-to-one FK, so PostgREST embeds one object; without generated
    // database types supabase-js cannot know the cardinality and types it as an array.
    organizations: (memberships.data as unknown as MembershipRow[])
      .map(({ id, organizations }) => ({ ...organizations, membershipId: id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Tenant context for a workspace slug, or null when the user has no active access to it. */
export async function getOrganizationContext(
  user: UserContext,
  slug: string,
): Promise<OrganizationContext | null> {
  const organization = user.organizations.find((candidate) => candidate.slug === slug);
  if (!organization) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_organization_permissions", {
    target_organization_id: organization.id,
  });
  if (error) throw new Error("Unable to load organization permissions");

  return {
    organization,
    membershipId: organization.membershipId,
    permissions: (data as unknown[]).filter(isPermissionKey),
  };
}

/**
 * Page/action entry for a tenant workspace: signed in, active member of the organization.
 * Entry is membership-based; specific actions inside then use requirePermission. Unknown and
 * inaccessible slugs are both simply not found, so other tenants cannot be enumerated.
 */
export async function requireOrganizationAccess(slug: string) {
  const user = await getUserContext();
  if (!user) redirect("/login");
  const context = await getOrganizationContext(user, slug);
  if (!context) notFound();
  return { user, context };
}
