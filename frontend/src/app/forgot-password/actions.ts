"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_PATTERN } from "@/lib/validation";

export type ForgotPasswordState = { error?: string; sent?: boolean };

const GENERIC_FAILURE = "Unable to send the reset email right now. Please try again.";

export async function requestPasswordReset(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  // Origin is browser-set and validated against Host by Next.js; APP_URL is trusted deployment
  // configuration for clients that strip it. Nothing else may supply the callback base URL.
  const origin = (await headers()).get("origin") ?? process.env.APP_URL?.replace(/\/$/, "");
  if (!origin) {
    return { error: GENERIC_FAILURE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return { error: GENERIC_FAILURE };
  }

  // Same outcome whether or not the account exists, so the form cannot be used to enumerate users.
  return { sent: true };
}
