"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const backToSignIn = (
  <Link
    href="/login"
    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
  >
    ← Back to sign in
  </Link>
);

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <div role="status">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          If an account exists for that email, a password reset link has been sent.
        </p>
        <div className="mt-8">{backToSignIn}</div>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Enter your work email and we&apos;ll send you a link to choose a new password.
      </p>
      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 w-full rounded border border-border bg-surface px-3.5 text-sm transition-colors hover:border-foreground/30 focus:border-accent"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-11 w-full rounded bg-accent text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-progress disabled:opacity-70"
        >
          {isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <div className="mt-6">{backToSignIn}</div>
    </>
  );
}
