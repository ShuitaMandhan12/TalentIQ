import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/authorization";
import { requireOrganizationAccess } from "@/lib/auth/organization-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOrganizationRoles } from "@/lib/organization/access-data";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { user, context } = await requireOrganizationAccess(organizationSlug);
  if (!hasPermission(context, PERMISSIONS.ROLES_VIEW)) notFound();
  const canManage = hasPermission(context, PERMISSIONS.ROLES_MANAGE);
  const roles = await getOrganizationRoles(context.organization.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <WorkspaceHeader user={user} />

      <main className="flex-1 py-6">
        <Link
          href={`/app/${organizationSlug}`}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {context.organization.name}
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Roles bundle permissions; members may hold several.
            </p>
          </div>
          {canManage && (
            <Link
              href={`/app/${organizationSlug}/roles/new`}
              className="inline-flex h-9 items-center rounded bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Create role
            </Link>
          )}
        </div>

        <ul className="mt-8 divide-y divide-border border-y border-border">
          {roles.map((role) => (
            <li key={role.id}>
              <Link
                href={`/app/${organizationSlug}/roles/${role.id}`}
                className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 transition-colors hover:text-accent"
              >
                <span className="min-w-0">
                  <span className="font-medium">{role.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {role.is_system ? "System role" : "Custom"}
                  </span>
                  {role.description && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">{role.description}</span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {role.permission_keys.length} permission{role.permission_keys.length === 1 ? "" : "s"}
                  {" · "}
                  {role.member_count} member{role.member_count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
