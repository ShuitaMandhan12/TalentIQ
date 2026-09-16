import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { StatusDot } from "@/components/ui/status-dot";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace" };

export default async function AppPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <Brand />
        <p className="font-mono text-xs text-muted-foreground">Phase 1</p>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="flex animate-rise items-center gap-3 text-sm font-medium text-accent motion-reduce:animate-none">
          <StatusDot />
          Session verified
        </p>
        <h1
          style={{ animationDelay: "80ms" }}
          className="mt-4 animate-rise text-3xl font-semibold tracking-tight motion-reduce:animate-none sm:text-4xl"
        >
          Authentication ready
        </h1>
        <dl
          style={{ animationDelay: "160ms" }}
          className="mt-8 animate-rise border-t border-border pt-6 motion-reduce:animate-none"
        >
          <dt className="text-sm text-muted-foreground">Signed in as</dt>
          <dd className="mt-1 font-mono text-sm break-all">{data.claims.email ?? data.claims.sub}</dd>
        </dl>
      </main>
    </div>
  );
}
