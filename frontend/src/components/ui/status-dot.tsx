export function StatusDot() {
  return (
    <span aria-hidden className="relative flex size-2">
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent motion-reduce:hidden" />
      <span className="relative size-2 rounded-full bg-accent" />
    </span>
  );
}
