export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="h-9 rounded border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-background"
      >
        Sign out
      </button>
    </form>
  );
}
