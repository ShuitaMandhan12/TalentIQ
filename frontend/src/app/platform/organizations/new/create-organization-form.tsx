"use client";

import { useActionState, useState } from "react";
import { createOrganization, type CreateOrganizationState } from "../actions";

const inputClass =
  "h-11 w-full rounded border border-border bg-surface px-3.5 text-sm transition-colors hover:border-foreground/30 focus:border-accent";

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState<CreateOrganizationState, FormData>(
    createOrganization,
    {},
  );
  const [slug, setSlug] = useState(state.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(state.slug));

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Organization name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="organization"
          defaultValue={state.name}
          onChange={(event) => {
            if (!slugEdited) setSlug(suggestSlug(event.target.value));
          }}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-1.5 block text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          maxLength={63}
          pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
          autoComplete="off"
          spellCheck={false}
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
          aria-describedby="slug-help"
          className={`${inputClass} font-mono`}
        />
        <p id="slug-help" className="mt-1.5 text-xs text-muted-foreground">
          Lowercase letters, digits and hyphens. Becomes the workspace address:{" "}
          <span className="font-mono">/app/{slug || "…"}</span>
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-progress disabled:opacity-70"
      >
        {isPending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
