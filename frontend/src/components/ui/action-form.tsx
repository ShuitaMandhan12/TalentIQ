"use client";

import { useActionState } from "react";

export type ActionState = { error?: string };

type Props = {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  ariaLabel?: string;
};

/** A one-button mutation with hidden inputs, pending state and an inline sanitized error. */
export function ActionForm({ action, fields, label, ariaLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={isPending}
        aria-label={ariaLabel}
        className="h-9 rounded border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-background disabled:cursor-progress disabled:opacity-70"
      >
        {isPending ? "Saving…" : label}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
