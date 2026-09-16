import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Sign in with your team credentials. Access is limited to authorized recruitment team
        members.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </AuthShell>
  );
}
