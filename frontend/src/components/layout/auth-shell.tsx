import { Brand } from "@/components/layout/brand";
import { Pipeline } from "@/components/pipeline";

export function AuthShell({ children }: { children: React.ReactNode }) {
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
          <div className="w-full max-w-sm animate-rise motion-reduce:animate-none">{children}</div>
        </div>
      </main>
    </div>
  );
}
