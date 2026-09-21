import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMyInvitation } from "@/lib/organization/invitation";
import { createClient } from "@/lib/supabase/server";
import { FinishAccountForm } from "./finish-account-form";

export const metadata: Metadata = { title: "Accept invitation" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Onboarding, not a tenant page: the visitor is signed in through their invitation email but is
// not a member of anything yet, so there is no organization context to resolve here.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?error=invalid-link");

  const invitation = UUID_PATTERN.test(invitationId) ? await getMyInvitation(invitationId) : null;

  if (!invitation) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          This invitation is invalid, has already been used, or was withdrawn. Ask the person who
          invited you to send a new one.
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Continue to TalentIQ →
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        You&apos;ve been invited to {invitation.organization_name}
      </h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Choose a password to finish setting up{" "}
        <span className="font-mono break-all">{invitation.email}</span>. Your administrator assigns
        your roles once you join.
      </p>
      <div className="mt-8">
        <FinishAccountForm invitationId={invitation.id} />
      </div>
    </AuthShell>
  );
}
