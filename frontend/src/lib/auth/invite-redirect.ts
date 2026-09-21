// Validation for the `redirect_to` value the invitation email forwards from Supabase. It is an
// absolute URL, so it is checked against trusted deployment configuration (never the request) and
// only its pathname is ever used as a redirect target.

const INVITE_PATH = /^\/invite\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the local path to continue to, or null. The URL must sit on the `trustedAppUrl` origin
 * exactly (scheme, host and port), carry no credentials, query or fragment, and address exactly
 * one invitation.
 */
export function inviteDestination(raw: string | null, trustedAppUrl: string | undefined): string | null {
  if (!raw || !trustedAppUrl) return null;

  let trusted: URL;
  let target: URL;
  try {
    trusted = new URL(trustedAppUrl);
    target = new URL(raw);
  } catch {
    return null;
  }

  if (target.origin !== trusted.origin) return null;
  if (target.username || target.password) return null;
  if (target.search || target.hash) return null;
  if (!INVITE_PATH.test(target.pathname)) return null;
  return target.pathname;
}
