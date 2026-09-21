import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import {
  getOrganizationServiceEntitlements,
  getPlatformOrganization,
  getPlatformServices,
} from "@/lib/platform/data";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { setOrganizationStatus, setServiceEntitlement } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

export const metadata: Metadata = { title: "Organization" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlatformOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await requirePlatformPageAccess();
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const organization = await getPlatformOrganization(organizationId);
  if (!organization) notFound();

  const [services, entitlements] = await Promise.all([
    getPlatformServices(),
    getOrganizationServiceEntitlements(organization.id),
  ]);
  const enabledByKey = new Map(entitlements.map((e) => [e.service_key, e.enabled]));

  return (
    <>
      <Link
        href="/platform/organizations"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Organizations
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{organization.name}</h1>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono">{organization.slug}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-mono">{formatDate(organization.created_at)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge active={organization.is_active} labels={["Active", "Suspended"]} />
              </dd>
            </div>
          </dl>
        </div>

        <ActionForm
          action={setOrganizationStatus}
          fields={{ organizationId: organization.id, active: organization.is_active ? "false" : "true" }}
          label={organization.is_active ? "Suspend organization" : "Reactivate organization"}
        />
      </div>

      {!organization.is_active && (
        <p className="mt-6 max-w-xl border-l-2 border-border pl-3 text-sm text-muted-foreground">
          Suspended: members cannot use the workspace and no service is available. Memberships,
          roles and data are kept, and everything resumes on reactivation.
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">Services</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Which TalentIQ services this organization is entitled to use.
        </p>

        {services.length === 0 ? (
          <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
            No services are registered yet. Entitlements can be managed here once TalentIQ modules
            are introduced.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {services.map((service) => {
              const enabled = enabledByKey.get(service.key) ?? false;
              return (
                <li
                  key={service.key}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {service.name}
                      {!service.is_active && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          inactive service
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{service.key}</p>
                    {service.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-5">
                    <StatusBadge active={enabled} labels={["Enabled", "Disabled"]} />
                    <ActionForm
                      action={setServiceEntitlement}
                      fields={{
                        organizationId: organization.id,
                        serviceKey: service.key,
                        enabled: enabled ? "false" : "true",
                      }}
                      label={enabled ? "Disable" : "Enable"}
                      ariaLabel={`${enabled ? "Disable" : "Enable"} ${service.name}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
