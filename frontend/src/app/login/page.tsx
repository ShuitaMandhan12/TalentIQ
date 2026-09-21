import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  const { reset, error } = await searchParams;

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Sign in with your team credentials. Access is limited to authorized recruitment team
        members.
      </p>
      {error === "invalid-link" && (
        <p role="alert" className="mt-6 border-l-2 border-destructive pl-3 text-sm">
          That link is invalid or has expired. Ask your administrator to send a new invitation.
        </p>
      )}
      {reset === "success" && (
        <p role="status" className="mt-6 border-l-2 border-accent pl-3 text-sm">
          Password updated. Sign in with your new password.
        </p>
      )}
      <div className="mt-8">
        <LoginForm />
      </div>
    </AuthShell>
  );
}
