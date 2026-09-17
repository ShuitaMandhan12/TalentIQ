"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/organizations", label: "Organizations" },
  { href: "/platform/services", label: "Services" },
];

export function PlatformNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform" className="-mb-px flex gap-6 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = href === "/platform" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
