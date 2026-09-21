import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase Auth Admin client. It holds the project's secret key, so importing it from a "use
// client" module is a build error (server-only) and it must never be used for ordinary data
// access: organization reads and writes stay on the signed-in user's client, under RLS and the
// permission-checking RPCs. Its one purpose is inviting an account that does not exist yet.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase admin credentials are not configured");

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
