import type { PermissionKey } from "./permissions";

// Application-level guards complement RLS; they never replace it. Every protected mutation must
// authenticate, resolve tenant context and call requirePermission itself: Server Actions and Route
// Handlers are independent entrypoints and cannot rely on the page that rendered the form.

type Authorized = { permissions: readonly PermissionKey[] };

export class PermissionDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
  }
}

export function hasPermission(context: Authorized, permission: PermissionKey): boolean {
  return context.permissions.includes(permission);
}

export function requirePermission(context: Authorized, permission: PermissionKey): void {
  if (!hasPermission(context, permission)) throw new PermissionDeniedError();
}
