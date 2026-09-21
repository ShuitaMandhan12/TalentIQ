import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@/lib/auth/authorization";
import { requireOrganizationAccess } from "@/lib/auth/organization-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusDot } from "@/components/ui/status-dot";

export const metadata: Metadata = { title: "Workspace" };

export default async function OrganizationWorkspacePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { user, context } = await requireOrganizationAccess(organizationSlug);

  // Link visibility is convenience only; each page enforces its own permission.
  const accessLinks = [
    hasPermission(context, PERMISSIONS.MEMBERS_VIEW) && {
      href: `/app/${organizationSlug}/members`,
      title: "Members",
      detail: "Manage who can access this workspace and which roles they hold.",
    },
    hasPermission(context, PERMISSIONS.ROLES_VIEW) && {
      href: `/app/${organizationSlug}/roles`,
      title: "Roles",
      detail: "Create permission bundles for your organization.",
    },
  ].filter((link) => link !== false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <WorkspaceHeader user={user} />

      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="flex animate-rise items-center gap-3 text-sm font-medium text-accent motion-reduce:animate-none">
          <StatusDot />
          Workspace ready
        </p>
        <h1
          style={{ animationDelay: "80ms" }}
          className="mt-4 animate-rise text-3xl font-semibold tracking-tight text-balance motion-reduce:animate-none sm:text-4xl"
        >
          {context.organization.name}
        </h1>

        <dl
          style={{ animationDelay: "160ms" }}
          className="mt-8 grid max-w-2xl animate-rise gap-6 border-t border-border pt-6 text-sm motion-reduce:animate-none sm:grid-cols-3"
        >
          <div>
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="mt-1 font-mono break-all">{user.email ?? user.userId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Platform admin</dt>
            <dd className="mt-1 font-mono">{user.isPlatformAdmin ? "yes" : "no"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Access</dt>
            <dd className="mt-1 font-mono">
              {context.permissions.length} permission{context.permissions.length === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>

        {accessLinks.length > 0 && (
          <section
            style={{ animationDelay: "240ms" }}
            className="mt-10 animate-rise motion-reduce:animate-none"
          >
            <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Organization access
            </h2>
            <ul className="mt-3 max-w-2xl divide-y divide-border border-y border-border">
              {accessLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center justify-between gap-6 py-4 transition-colors hover:text-accent"
                  >
                    <span>
                      <span className="block font-medium">{link.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{link.detail}</span>
                    </span>
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          style={{ animationDelay: "320ms" }}
          className="mt-10 animate-rise motion-reduce:animate-none"
        >
          <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Effective permissions
          </h2>
          {context.permissions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No roles are assigned to your membership yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {context.permissions.map((permission) => (
                <li
                  key={permission}
                  className="rounded border border-border bg-surface px-2.5 py-1 font-mono text-xs"
                >
                  {permission}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
