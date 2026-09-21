import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import { getPlatformOrganizations } from "@/lib/platform/data";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Organizations" };

export default async function PlatformOrganizationsPage() {
  await requirePlatformPageAccess();
  const organizations = await getPlatformOrganizations();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <Link
          href="/platform/organizations/new"
          className="inline-flex h-9 items-center rounded bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Create organization
        </Link>
      </div>

      {organizations.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No organizations yet. Create the first customer organization to get started.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="py-2.5 pr-6 font-medium">
                  Name
                </th>
                <th scope="col" className="py-2.5 pr-6 font-medium">
                  Slug
                </th>
                <th scope="col" className="py-2.5 pr-6 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2.5 font-medium">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {organizations.map((organization) => (
                <tr key={organization.id} className="group">
                  <td className="py-3.5 pr-6 font-medium">
                    <Link
                      href={`/platform/organizations/${organization.id}`}
                      className="transition-colors group-hover:text-accent"
                    >
                      {organization.name}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-6 font-mono text-xs text-muted-foreground">
                    {organization.slug}
                  </td>
                  <td className="py-3.5 pr-6">
                    <StatusBadge active={organization.is_active} labels={["Active", "Suspended"]} />
                  </td>
                  <td className="py-3.5 font-mono text-xs text-muted-foreground">
                    {formatDate(organization.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
