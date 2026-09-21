import { createClient } from "@/lib/supabase/server";

// Recipient-side read for onboarding. The caller is not a member yet, so this is deliberately
// separate from the tenant-administration helpers: the database returns the invitation only to the
// signed-in account whose own Auth email matches it, and only while it is still pending.

export type MyInvitation = {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  email: string;
  created_at: string;
};

export async function getMyInvitation(invitationId: string): Promise<MyInvitation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_my_organization_invitation", { target_invitation_id: invitationId })
    .maybeSingle();
  if (error) throw new Error("Unable to load the invitation");
  return data as MyInvitation | null;
}
