import Link from "next/link";
import type { UserContext } from "@/lib/auth/organization-context";
import { Brand } from "@/components/layout/brand";
import { SignOutButton } from "@/components/layout/sign-out-button";

const linkClass =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

export function WorkspaceHeader({ user }: { user: UserContext }) {
  return (
    <header className="flex items-center justify-between gap-4 py-8">
      <Brand />
      <div className="flex items-center gap-4">
        {user.isPlatformAdmin && (
          <Link href="/platform" className={linkClass}>
            Platform
          </Link>
        )}
        {user.organizations.length > 1 && (
          <Link href="/app" className={linkClass}>
            Switch workspace
          </Link>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
