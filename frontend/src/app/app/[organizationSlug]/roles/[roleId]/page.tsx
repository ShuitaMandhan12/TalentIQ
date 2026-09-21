import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/authorization";
import { requireOrganizationAccess } from "@/lib/auth/organization-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOrganizationRole } from "@/lib/organization/access-data";
import { PERMISSION_LABELS } from "@/lib/organization/permission-labels";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ActionForm } from "@/components/ui/action-form";
import { deleteRole, updateRole } from "../actions";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; roleId: string }>;
}) {
  const { organizationSlug, roleId } = await params;
  const { user, context } = await requireOrganizationAccess(organizationSlug);
  if (!hasPermission(context, PERMISSIONS.ROLES_VIEW)) notFound();

  const role = await getOrganizationRole(context.organization.id, roleId);
  if (!role) notFound();
  const editable = !role.is_system && hasPermission(context, PERMISSIONS.ROLES_MANAGE);
  const memberLabel = `${role.member_count} member${role.member_count === 1 ? "" : "s"}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <WorkspaceHeader user={user} />

      <main className="max-w-xl flex-1 py-6">
        <Link
          href={`/app/${organizationSlug}/roles`}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Roles
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {role.name}
          <span className="ml-3 font-mono text-xs font-normal text-muted-foreground">
            {role.is_system ? "System role" : "Custom role"} · {memberLabel}
          </span>
        </h1>

        {role.is_system && (
          <p className="mt-4 border-l-2 border-border pl-3 text-sm text-muted-foreground">
            This role is managed by TalentIQ. It can be assigned to members, but its name and
            permissions are fixed so an organization can never lose its administrator role.
          </p>
        )}

        {editable ? (
          <>
            <div className="mt-8">
              <RoleForm
                action={updateRole}
                organizationSlug={organizationSlug}
                roleId={role.id}
                initial={{
                  name: role.name,
                  description: role.description ?? "",
                  permissions: role.permission_keys,
                }}
                submitLabel="Save changes"
              />
            </div>
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-lg font-semibold tracking-tight">Delete role</h2>
              {role.member_count > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Assigned to {memberLabel}. Remove this role from its members before deleting it.
                </p>
              ) : (
                <div className="mt-4 flex items-start">
                  <ActionForm
                    action={deleteRole}
                    fields={{ organizationSlug, roleId: role.id }}
                    label="Delete role"
                  />
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {role.description && <p className="mt-4 text-sm text-muted-foreground">{role.description}</p>}
            <section className="mt-8">
              <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                Permissions
              </h2>
              {role.permission_keys.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">This role grants no permissions.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {role.permission_keys.map((key) => (
                    <li key={key} className="py-3">
                      <span className="font-medium">{PERMISSION_LABELS[key].label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{key}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {PERMISSION_LABELS[key].description}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
