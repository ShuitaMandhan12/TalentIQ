import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Pipeline } from "@/components/pipeline";
import { StatusDot } from "@/components/ui/status-dot";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <Brand />
        <Link
          href="/login"
          className="group inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-accent"
        >
          Sign in
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <p className="animate-rise text-sm font-medium text-accent motion-reduce:animate-none">
          Recruitment intelligence platform
        </p>
        <h1
          style={{ animationDelay: "80ms" }}
          className="mt-4 max-w-3xl animate-rise text-4xl font-semibold tracking-tight text-balance motion-reduce:animate-none sm:text-5xl lg:text-6xl"
        >
          Recruitment decisions backed by evidence.
        </h1>
        <p
          style={{ animationDelay: "160ms" }}
          className="mt-6 max-w-xl animate-rise text-lg text-pretty text-muted-foreground motion-reduce:animate-none"
        >
          Resumes become structured, verifiable evidence. Every match is explained. Every decision
          stays with the recruiter.
        </p>

        <section className="mt-20 sm:mt-28">
          <h2 className="mb-8 font-mono text-xs tracking-wide text-muted-foreground uppercase">
            How it works
          </h2>
          <Pipeline />
        </section>
      </main>

      <footer className="flex items-center justify-between gap-4 border-t border-border py-6 text-sm">
        <p className="flex items-center gap-3">
          <StatusDot />
          Platform foundation ready
        </p>
        <p className="font-mono text-xs text-muted-foreground">web · api</p>
      </footer>
    </div>
  );
}
