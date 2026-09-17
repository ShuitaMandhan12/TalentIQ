import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import { getPlatformOrganizations, getPlatformStats } from "@/lib/platform/data";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "./format";

export const metadata: Metadata = { title: "Platform" };

export default async function PlatformOverviewPage() {
  await requirePlatformPageAccess();
  const [stats, recent] = await Promise.all([getPlatformStats(), getPlatformOrganizations(5)]);

  const figures = [
    ["Organizations", stats.organizations],
    ["Active", stats.active],
    ["Suspended", stats.suspended],
    ["Services", stats.services],
  ] as const;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-border py-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {figures.map(([label, value]) => (
          <div key={label} className="sm:px-6 sm:first:pl-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent organizations</h2>
          <Link
            href="/platform/organizations"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No organizations yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {recent.map((organization) => (
              <li key={organization.id}>
                <Link
                  href={`/platform/organizations/${organization.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3.5 transition-colors hover:text-accent"
                >
                  <span className="font-medium">{organization.name}</span>
                  <span className="flex items-center gap-6 text-muted-foreground">
                    <span className="font-mono text-xs">{formatDate(organization.created_at)}</span>
                    <StatusBadge active={organization.is_active} labels={["Active", "Suspended"]} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
