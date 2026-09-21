"use client";

import { useActionState } from "react";
import { addMember, type AddMemberState } from "./actions";

export function AddMemberForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, isPending] = useActionState<AddMemberState, FormData>(addMember, {});

  return (
    <form action={formAction} className="max-w-md">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
        Email address
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          required
          defaultValue={state.email}
          aria-describedby="add-member-help"
          className="h-11 min-w-0 flex-1 rounded border border-border bg-surface px-3.5 text-sm transition-colors hover:border-foreground/30 focus:border-accent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-progress disabled:opacity-70"
        >
          {isPending ? "Working…" : "Add or invite"}
        </button>
      </div>
      <p id="add-member-help" className="mt-1.5 text-xs text-muted-foreground">
        Existing TalentIQ accounts are added immediately. New users receive an email invitation to
        create their account. Roles are assigned afterwards.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.sent && !state.error && (
        <p role="status" className="mt-3 text-sm text-accent">
          Invitation sent to {state.sent}.
        </p>
      )}
    </form>
  );
}
