import type { Metadata } from "next";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import { getPlatformServices } from "@/lib/platform/data";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Services" };

export default async function PlatformServicesPage() {
  await requirePlatformPageAccess();
  const services = await getPlatformServices();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
      <p className="mt-2 max-w-xl text-sm text-pretty text-muted-foreground">
        Service definitions are system-managed and arrive with TalentIQ modules. Customer access is
        controlled per organization from its detail page.
      </p>

      {services.length === 0 ? (
        <p className="mt-8 border-t border-border pt-8 text-sm text-muted-foreground">
          No platform services are registered yet. They will appear here as TalentIQ modules are
          introduced.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {services.map((service) => (
            <li
              key={service.key}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
            >
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{service.key}</p>
                {service.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                )}
              </div>
              <StatusBadge active={service.is_active} labels={["Active", "Inactive"]} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
