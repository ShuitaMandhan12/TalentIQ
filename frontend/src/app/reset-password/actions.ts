"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = { error?: string };

export async function updatePassword(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (confirmPassword !== password) {
    return { error: "Passwords do not match." };
  }

  // Server Actions are independent entrypoints, so the recovery session is verified here too.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/forgot-password?error=invalid-link");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Unable to update the password. Choose a different password and try again." };
  }

  // A recovery may follow a compromise: revoke every session, not just this browser's.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=success");
}
