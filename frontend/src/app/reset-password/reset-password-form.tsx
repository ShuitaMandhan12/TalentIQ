"use client";

import { useActionState, useState } from "react";
import { updatePassword, type ResetPasswordState } from "./actions";

const inputClass =
  "h-11 w-full rounded border border-border bg-surface px-3.5 text-sm transition-colors hover:border-foreground/30 focus:border-accent";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(
    updatePassword,
    {},
  );
  const [showPasswords, setShowPasswords] = useState(false);
  const type = showPasswords ? "text" : "password";

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type={type}
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={type}
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(event) => setShowPasswords(event.target.checked)}
          className="size-4 accent-accent"
        />
        Show passwords
      </label>

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
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
