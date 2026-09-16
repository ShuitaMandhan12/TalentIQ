const stages = [
  { name: "Resume", detail: "Parsed into structured, traceable content." },
  { name: "Evidence", detail: "Every claim linked to its source text." },
  { name: "Match", detail: "Scored against the role, with reasons." },
  { name: "Human Review", detail: "Recruiters make the final call." },
];

export function Pipeline() {
  return (
    <ol
      aria-label="How the platform works"
      className="relative grid gap-10 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border sm:grid-cols-4 sm:gap-8 sm:before:inset-x-0 sm:before:inset-y-auto sm:before:top-0 sm:before:h-px sm:before:w-auto"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 hidden h-px overflow-hidden sm:block motion-reduce:hidden"
      >
        <span className="block h-full w-1/4 animate-sweep bg-linear-to-r from-transparent via-accent to-transparent" />
      </span>

      {stages.map((stage, index) => {
        const isHumanReview = index === stages.length - 1;
        return (
          <li
            key={stage.name}
            style={{ animationDelay: `${index * 120}ms` }}
            className="group relative animate-rise pl-7 motion-reduce:animate-none sm:pt-7 sm:pr-4 sm:pl-0"
          >
            <span
              aria-hidden
              className={`absolute top-1.5 left-0 size-2 -translate-x-1/2 rounded-full border transition-colors duration-300 sm:top-0 sm:translate-x-0 sm:-translate-y-1/2 ${
                isHumanReview
                  ? "border-accent bg-accent"
                  : "border-foreground/40 bg-background group-hover:border-accent group-hover:bg-accent"
              }`}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-2 font-medium tracking-tight">{stage.name}</p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{stage.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
