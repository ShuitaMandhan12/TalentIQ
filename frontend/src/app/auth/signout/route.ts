import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    // Local scope ends only this browser's session; other devices stay signed in.
    // A failure here still clears the local session, so the redirect is safe either way.
    await supabase.auth.signOut({ scope: "local" });
    revalidatePath("/", "layout");
  }

  // 303 turns the follow-up request into a GET so the browser never re-POSTs to /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
