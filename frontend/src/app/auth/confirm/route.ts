import { NextResponse } from "next/server";
import { inviteDestination } from "@/lib/auth/invite-redirect";
import { createClient } from "@/lib/supabase/server";

// SSR verification for the invitation email (Supabase's documented token_hash pattern). The
// template forwards Supabase's own `redirect_to`, which is the absolute URL the application passed
// to inviteUserByEmail, so it is validated against trusted deployment configuration rather than
// treated as an opaque destination. Password recovery keeps its separate PKCE callback.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const destination = inviteDestination(searchParams.get("redirect_to"), process.env.APP_URL);
  let next = "/login?error=invalid-link";

  if (tokenHash && searchParams.get("type") === "invite" && destination) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
    // Redirecting drops token_hash from the address bar; only the session cookies survive.
    if (!error) next = destination;
  }

  return NextResponse.redirect(new URL(next, origin), {
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
