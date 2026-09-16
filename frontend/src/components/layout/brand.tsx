import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-sm font-medium tracking-tight transition-colors hover:text-accent"
    >
      <span aria-hidden className="size-2 rounded-[2px] bg-accent" />
      Resume Intelligence
    </Link>
  );
}
