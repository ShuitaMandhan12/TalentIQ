import { Pipeline } from "@/components/pipeline";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <p className="flex items-center gap-2.5 text-sm font-medium tracking-tight">
          <span aria-hidden className="size-2 rounded-[2px] bg-accent" />
          Resume Intelligence
        </p>
        <p className="font-mono text-xs text-muted-foreground">Phase 0</p>
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
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent motion-reduce:hidden" />
            <span className="relative size-2 rounded-full bg-accent" />
          </span>
          Platform foundation ready
        </p>
        <p className="font-mono text-xs text-muted-foreground">web · api</p>
      </footer>
    </div>
  );
}
