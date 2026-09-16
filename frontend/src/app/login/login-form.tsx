"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const inputClass =
  "h-11 w-full rounded border border-border bg-surface px-3.5 text-sm transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus:border-accent";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
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
          defaultValue={state.email}
          className={inputClass}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClass} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
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
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
