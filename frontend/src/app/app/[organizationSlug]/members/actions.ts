"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/action-form";
import { requirePermission } from "@/lib/auth/authorization";
import { requireOrganizationActionAccess } from "@/lib/auth/organization-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { EMAIL_PATTERN } from "@/lib/validation";
import { accessErrorMessage, GENERIC_FAILURE } from "@/lib/organization/access-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Every action authenticates, resolves the tenant, requires the permission and then calls a
// database function that enforces the same rules again. The organization slug travels with the
// form; identifiers are validated before use and re-scoped to that organization by the database.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export type AddMemberState = ActionState & { email?: string; sent?: string };

const ALREADY_INVITED = "An invitation is already pending for this email.";
const UNCONFIRMED_ACCOUNT = "This account has not finished its invitation yet.";

export async function addMember(_previous: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.MEMBERS_MANAGE);

  const email = text(formData, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email };

  const organizationId = context.organization.id;
  const supabase = await createClient();

  const added = await addExistingAccount(supabase, organizationId, email);
  if (added.error) return { error: added.error, email };
  if (added.membershipId) {
    revalidatePath(`/app/${slug}/members`);
    redirect(`/app/${slug}/members/${added.membershipId}`);
  }

  // No account yet: record the invitation first, so the database stays the source of truth even if
  // the email fails, then ask Supabase Auth to send it.
  const prepared = await supabase
    .rpc("prepare_organization_invitation", {
      target_organization_id: organizationId,
      target_email: email,
    })
    .single();
  if (prepared.error) return { error: accessErrorMessage(prepared.error), email };

  const { status, invitation_id: invitationId } = prepared.data as {
    status: string;
    invitation_id: string | null;
  };
  if (status === "already_invited") return { error: ALREADY_INVITED, email };
  if (status === "unconfirmed_account") return { error: UNCONFIRMED_ACCOUNT, email };
  if (status === "account_exists") {
    // The account appeared between the two calls; fall back to the direct add.
    const retried = await addExistingAccount(supabase, organizationId, email);
    if (retried.error) return { error: retried.error, email };
    if (retried.membershipId) {
      revalidatePath(`/app/${slug}/members`);
      redirect(`/app/${slug}/members/${retried.membershipId}`);
    }
    return { error: GENERIC_FAILURE, email };
  }
  if (!invitationId) return { error: GENERIC_FAILURE, email };

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    await revokePrepared(supabase, organizationId, invitationId);
    return { error: GENERIC_FAILURE, email };
  }

  // Built from trusted deployment configuration only - never from the request. Supabase hands this
  // absolute URL to the email template as .RedirectTo; /auth/confirm re-validates it against
  // APP_URL and continues to its pathname alone.
  const { error: inviteError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/invite/${invitationId}`,
    data: { invitation_id: invitationId, organization_name: context.organization.name },
  });
  if (inviteError) {
    // Leave no invitation that the UI would show as pending when no email was sent.
    await revokePrepared(supabase, organizationId, invitationId);
    return { error: "Unable to send the invitation right now. Please try again.", email };
  }

  revalidatePath(`/app/${slug}/members`);
  return { sent: email };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Adds or reactivates an existing account; returns a membership id only when one now exists. */
async function addExistingAccount(
  supabase: SupabaseServerClient,
  organizationId: string,
  email: string,
): Promise<{ membershipId?: string; error?: string }> {
  const { data, error } = await supabase
    .rpc("add_organization_member_by_email", {
      target_organization_id: organizationId,
      target_email: email,
    })
    .single();
  if (error) return { error: accessErrorMessage(error) };

  const result = data as { status: string; membership_id: string | null };
  switch (result.status) {
    case "added":
    case "reactivated":
      return { membershipId: result.membership_id ?? undefined };
    case "already_member":
      return { error: "This user is already a member." };
    case "already_invited":
      return { error: ALREADY_INVITED };
    case "unconfirmed_account":
      return { error: UNCONFIRMED_ACCOUNT };
    default:
      return {};
  }
}

async function revokePrepared(
  supabase: SupabaseServerClient,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  await supabase.rpc("revoke_organization_invitation", {
    target_organization_id: organizationId,
    target_invitation_id: invitationId,
  });
}

export async function revokeInvitation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.MEMBERS_MANAGE);

  const invitationId = text(formData, "invitationId");
  if (!UUID_PATTERN.test(invitationId)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_organization_invitation", {
    target_organization_id: context.organization.id,
    target_invitation_id: invitationId,
  });
  if (error) return { error: accessErrorMessage(error, { notFound: "Invitation not found." }) };

  revalidatePath(`/app/${slug}/members`);
  return {};
}

export async function setMemberStatus(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.MEMBERS_MANAGE);

  const membershipId = text(formData, "membershipId");
  const active = text(formData, "active") === "true";
  if (!UUID_PATTERN.test(membershipId)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_member_status", {
    target_organization_id: context.organization.id,
    target_membership_id: membershipId,
    active,
  });
  if (error) return { error: accessErrorMessage(error, { notFound: "Member not found." }) };

  revalidatePath(`/app/${slug}/members`);
  revalidatePath(`/app/${slug}/members/${membershipId}`);
  return {};
}

export async function setMemberRoles(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.MEMBERS_MANAGE);

  const membershipId = text(formData, "membershipId");
  const roleIds = formData.getAll("roleIds").filter((value): value is string => typeof value === "string");
  if (!UUID_PATTERN.test(membershipId) || !roleIds.every((id) => UUID_PATTERN.test(id))) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_member_roles", {
    target_organization_id: context.organization.id,
    target_membership_id: membershipId,
    target_role_ids: roleIds,
  });
  if (error) return { error: accessErrorMessage(error, { notFound: "Member not found." }) };

  revalidatePath(`/app/${slug}/members`);
  revalidatePath(`/app/${slug}/members/${membershipId}`);
  revalidatePath(`/app/${slug}/roles`);
  return {};
}
