"use client";

import { useActionState } from "react";
import type { ActionState } from "@/components/ui/action-form";
import type { OrganizationRole } from "@/lib/organization/access-data";
import { setMemberRoles } from "../actions";

type Props = {
  organizationSlug: string;
  membershipId: string;
  roles: OrganizationRole[];
  assignedRoleIds: string[];
};

export function MemberRolesForm({ organizationSlug, membershipId, roles, assignedRoleIds }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(setMemberRoles, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <fieldset>
        <legend className="text-sm text-muted-foreground">
          A member may hold any number of roles; their permissions are combined.
        </legend>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {roles.map((role) => (
            <li key={role.id}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <input
                  type="checkbox"
                  name="roleIds"
                  value={role.id}
                  defaultChecked={assignedRoleIds.includes(role.id)}
                  className="mt-1 size-4 accent-accent"
                />
                <span>
                  <span className="font-medium">{role.name}</span>
                  {role.is_system && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">System role</span>
                  )}
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {role.description ?? `${role.permission_keys.length} permission${role.permission_keys.length === 1 ? "" : "s"}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="mt-5 h-10 rounded bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-progress disabled:opacity-70"
      >
        {isPending ? "Saving…" : "Save roles"}
      </button>
    </form>
  );
}
