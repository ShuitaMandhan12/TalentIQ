/** State communicated by text and dot together, never by color alone. */
export function StatusBadge({ active, labels }: { active: boolean; labels: [string, string] }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`size-2 rounded-full ${active ? "bg-accent" : "border border-foreground/40"}`}
      />
      {active ? labels[0] : labels[1]}
    </span>
  );
}
