"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformActionAccess } from "@/lib/platform/auth";
import { createClient } from "@/lib/supabase/server";

// Every action authorizes itself: the rendering page having passed the platform check is irrelevant.

export type CreateOrganizationState = { error?: string; name?: string; slug?: string };

// Mirrors the database constraints so invalid input is rejected before a round-trip.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function createOrganization(
  _previous: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  await requirePlatformActionAccess();

  const name = text(formData, "name");
  const slug = text(formData, "slug").toLowerCase();
  if (name.length === 0 || name.length > 120) {
    return { error: "Enter an organization name (up to 120 characters).", name, slug };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error: "Slug must be 1–63 lowercase letters, digits or hyphens, and cannot start or end with a hyphen.",
      name,
      slug,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error) {
    return {
      error:
        error.code === UNIQUE_VIOLATION
          ? "That slug is already in use."
          : "Unable to create the organization. Please try again.",
      name,
      slug,
    };
  }

  revalidatePath("/platform");
  revalidatePath("/platform/organizations");
  redirect(`/platform/organizations/${data.id}`);
}

export type PlatformActionState = { error?: string };

const GENERIC_FAILURE = "Unable to save the change. Please try again.";

export async function setOrganizationStatus(
  _previous: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  await requirePlatformActionAccess();

  const organizationId = text(formData, "organizationId");
  const active = text(formData, "active") === "true";
  if (!UUID_PATTERN.test(organizationId)) return { error: "Invalid request." };

  const supabase = await createClient();
  // The update returns the matched rows, which proves whether the organization exists.
  const { data, error } = await supabase
    .from("organizations")
    .update({ is_active: active })
    .eq("id", organizationId)
    .select("id");
  if (error) return { error: GENERIC_FAILURE };
  if (data.length === 0) return { error: "Organization not found." };

  revalidatePath("/platform");
  revalidatePath("/platform/organizations");
  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export async function setServiceEntitlement(
  _previous: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  await requirePlatformActionAccess();

  const organizationId = text(formData, "organizationId");
  const serviceKey = text(formData, "serviceKey");
  const enabled = text(formData, "enabled") === "true";
  if (!UUID_PATTERN.test(organizationId) || !/^[a-z][a-z0-9_]*$/.test(serviceKey)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const [organization, service] = await Promise.all([
    supabase.from("organizations").select("id").eq("id", organizationId).maybeSingle(),
    supabase.from("platform_services").select("key").eq("key", serviceKey).maybeSingle(),
  ]);
  if (organization.error || service.error) return { error: GENERIC_FAILURE };
  if (!organization.data) return { error: "Organization not found." };
  if (!service.data) return { error: "Service not found." };

  // Update first so an existing row keeps its limits; only insert when no entitlement exists yet.
  const updated = await supabase
    .from("organization_service_entitlements")
    .update({ enabled })
    .eq("organization_id", organizationId)
    .eq("service_key", serviceKey)
    .select("service_key");
  if (updated.error) return { error: GENERIC_FAILURE };
  if (updated.data.length === 0) {
    const inserted = await supabase
      .from("organization_service_entitlements")
      .insert({ organization_id: organizationId, service_key: serviceKey, enabled });
    if (inserted.error) return { error: GENERIC_FAILURE };
  }

  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}
