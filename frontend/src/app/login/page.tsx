import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { Pipeline } from "@/components/pipeline";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="hidden border-r border-border bg-surface p-12 lg:flex lg:w-1/2 lg:flex-col xl:p-16">
        <Brand />
        <div className="my-auto max-w-md py-16">
          <p className="animate-rise text-3xl font-semibold tracking-tight text-balance motion-reduce:animate-none xl:text-4xl">
            Recruitment decisions backed by evidence.
          </p>
          <p
            style={{ animationDelay: "80ms" }}
            className="mt-4 animate-rise text-pretty text-muted-foreground motion-reduce:animate-none"
          >
            Resumes become structured, verifiable evidence. Every match is explained. Every
            decision stays with the recruiter.
          </p>
          <div className="mt-12">
            <Pipeline />
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="px-6 py-6 lg:hidden">
          <Brand />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm animate-rise motion-reduce:animate-none">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              Sign in with your team credentials. Access is limited to authorized recruitment team
              members.
            </p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
