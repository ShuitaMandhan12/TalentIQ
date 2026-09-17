import { notFound, redirect } from "next/navigation";
import { PermissionDeniedError } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

// Platform (SaaS operator) authorization is a separate security domain from tenant membership and
// permissions: the only source of authority is the caller's own row in public.platform_admins.

export type PlatformContext = { userId: string; email: string | null };

type PlatformAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "granted"; context: PlatformContext };

async function getPlatformAccess(): Promise<PlatformAccess> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { status: "unauthenticated" };
  const userId = data.claims.sub;

  const admin = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (admin.error) throw new Error("Unable to verify platform access");
  if (!admin.data) return { status: "forbidden" };

  return { status: "granted", context: { userId, email: data.claims.email ?? null } };
}

/** Page boundary: sign-in required; non-admins get a 404 so the control plane stays invisible. */
export async function requirePlatformPageAccess(): Promise<PlatformContext> {
  const access = await getPlatformAccess();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  return access.context;
}

/** Server Action boundary: every platform mutation calls this itself before touching data. */
export async function requirePlatformActionAccess(): Promise<PlatformContext> {
  const access = await getPlatformAccess();
  if (access.status !== "granted") throw new PermissionDeniedError();
  return access.context;
}
