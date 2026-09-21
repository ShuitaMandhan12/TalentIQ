"use client";

import { useActionState } from "react";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";
import { PERMISSION_LABELS } from "@/lib/organization/permission-labels";
import type { RoleFormState } from "./actions";

type Props = {
  action: (previous: RoleFormState, formData: FormData) => Promise<RoleFormState>;
  organizationSlug: string;
  roleId?: string;
  initial: { name: string; description: string; permissions: PermissionKey[] };
  submitLabel: string;
};

const inputClass =
  "w-full rounded border border-border bg-surface px-3.5 text-sm transition-colors hover:border-foreground/30 focus:border-accent";

export function RoleForm({ action, organizationSlug, roleId, initial, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState<RoleFormState, FormData>(action, initial);
  // After a rejected submit the form re-renders from the returned state so nothing typed is lost.
  const name = state.name ?? initial.name;
  const description = state.description ?? initial.description;
  const permissions = state.permissions ?? initial.permissions;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      {roleId && <input type="hidden" name="roleId" value={roleId} />}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Role name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={name}
          className={`${inputClass} h-11`}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={description}
          className={`${inputClass} py-2.5`}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Permissions</legend>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {Object.values(PERMISSIONS).map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <input
                  type="checkbox"
                  name="permissions"
                  value={key}
                  defaultChecked={permissions.includes(key)}
                  className="mt-1 size-4 accent-accent"
                />
                <span>
                  <span className="font-medium">{PERMISSION_LABELS[key].label}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{key}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {PERMISSION_LABELS[key].description}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          Changes saved.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-progress disabled:opacity-70"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
