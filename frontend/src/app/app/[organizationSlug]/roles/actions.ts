"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/action-form";
import { requirePermission } from "@/lib/auth/authorization";
import { requireOrganizationActionAccess } from "@/lib/auth/organization-context";
import { isPermissionKey, PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";
import { accessErrorMessage } from "@/lib/organization/access-errors";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICATE_NAME = "That role name is already in use.";

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export type RoleFormState = ActionState & {
  name?: string;
  description?: string;
  permissions?: PermissionKey[];
  saved?: boolean;
};

// Mirrors the roles table constraint (1–80 characters after trimming); permissions are narrowed to
// the catalog so unknown keys can never be submitted.
function readRoleDefinition(formData: FormData): { state: RoleFormState; error?: string } {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const permissions = formData.getAll("permissions").filter(isPermissionKey);
  const state = { name, description, permissions };
  if (name.length === 0 || name.length > 80) {
    return { state, error: "Enter a role name (up to 80 characters)." };
  }
  return { state };
}

export async function createRole(_previous: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.ROLES_MANAGE);

  const { state, error: validationError } = readRoleDefinition(formData);
  if (validationError) return { ...state, error: validationError };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization_role", {
    target_organization_id: context.organization.id,
    role_name: state.name,
    role_description: state.description,
    permission_keys: state.permissions,
  });
  if (error) return { ...state, error: accessErrorMessage(error, { duplicate: DUPLICATE_NAME }) };

  revalidatePath(`/app/${slug}/roles`);
  redirect(`/app/${slug}/roles/${data as string}`);
}

export async function updateRole(_previous: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.ROLES_MANAGE);

  const roleId = text(formData, "roleId");
  const { state, error: validationError } = readRoleDefinition(formData);
  if (!UUID_PATTERN.test(roleId)) return { ...state, error: "Invalid request." };
  if (validationError) return { ...state, error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_role", {
    target_organization_id: context.organization.id,
    target_role_id: roleId,
    role_name: state.name,
    role_description: state.description,
    permission_keys: state.permissions,
  });
  if (error) {
    return {
      ...state,
      error: accessErrorMessage(error, { notFound: "Role not found.", duplicate: DUPLICATE_NAME }),
    };
  }

  revalidatePath(`/app/${slug}/roles`);
  revalidatePath(`/app/${slug}/roles/${roleId}`);
  revalidatePath(`/app/${slug}/members`);
  return { ...state, saved: true };
}

export async function deleteRole(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "organizationSlug");
  const { context } = await requireOrganizationActionAccess(slug);
  requirePermission(context, PERMISSIONS.ROLES_MANAGE);

  const roleId = text(formData, "roleId");
  if (!UUID_PATTERN.test(roleId)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_organization_role", {
    target_organization_id: context.organization.id,
    target_role_id: roleId,
  });
  if (error) return { error: accessErrorMessage(error, { notFound: "Role not found." }) };

  revalidatePath(`/app/${slug}/roles`);
  redirect(`/app/${slug}/roles`);
}
