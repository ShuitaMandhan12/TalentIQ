import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrganizationContext, getUserContext } from "@/lib/auth/organization-context";
import { Brand } from "@/components/layout/brand";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { StatusDot } from "@/components/ui/status-dot";

export const metadata: Metadata = { title: "Workspace" };

export default async function OrganizationWorkspacePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const user = await getUserContext();
  if (!user) redirect("/login");

  // Resolved through the user's own active memberships, so an unknown slug and another tenant's
  // slug are indistinguishable: both are simply not found.
  const context = await getOrganizationContext(user, organizationSlug);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between gap-4 py-8">
        <Brand />
        <div className="flex items-center gap-4">
          {user.organizations.length > 1 && (
            <Link
              href="/app"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Switch workspace
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

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

        <section
          style={{ animationDelay: "240ms" }}
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
