import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/authorization";
import { requireOrganizationAccess } from "@/lib/auth/organization-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { createRole } from "../actions";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Create role" };

export default async function NewRolePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { user, context } = await requireOrganizationAccess(organizationSlug);
  if (!hasPermission(context, PERMISSIONS.ROLES_MANAGE)) notFound();

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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Create role</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name the role the way your organization talks about it, then choose what it can do.
        </p>
        <div className="mt-8">
          <RoleForm
            action={createRole}
            organizationSlug={organizationSlug}
            initial={{ name: "", description: "", permissions: [] }}
            submitLabel="Create role"
          />
        </div>
      </main>
    </div>
  );
}
