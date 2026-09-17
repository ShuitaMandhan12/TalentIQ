import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = { title: "Create organization" };

export default async function CreateOrganizationPage() {
  await requirePlatformPageAccess();

  return (
    <div className="max-w-md">
      <Link
        href="/platform/organizations"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Organizations
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Create organization</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        The organization starts active with a protected Organization Admin role. Members are added
        separately.
      </p>
      <div className="mt-8">
        <CreateOrganizationForm />
      </div>
    </div>
  );
}
