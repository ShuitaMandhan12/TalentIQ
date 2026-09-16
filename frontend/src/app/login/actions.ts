"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_PATTERN } from "@/lib/validation";

export type LoginState = { error?: string; email?: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address.", email };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter your password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately generic: never reveal whether the account exists or why sign-in failed.
    return { error: "Email or password is incorrect.", email };
  }

  redirect("/app");
}
