import Link from "next/link";
import { requirePlatformPageAccess } from "@/lib/platform/auth";
import { Brand } from "@/components/layout/brand";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { PlatformNav } from "./platform-nav";

// The shell checks access so non-admins never see it around a 404; each page checks again because
// layouts are not re-rendered on every navigation.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformPageAccess();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-5xl px-6 sm:px-10">
          <header className="flex items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <Brand />
              <span aria-hidden className="text-border">
                /
              </span>
              <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                Platform
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/app"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Workspace
              </Link>
              <SignOutButton />
            </div>
          </header>
          <PlatformNav />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10 sm:px-10">
        {children}
      </main>
    </div>
  );
}
