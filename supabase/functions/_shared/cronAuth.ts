// Shared helper to gate "cron-style" or admin-only edge functions.
// Accepts either:
//   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  (used by pg_cron / internal calls)
//   - A valid admin JWT (auth.users with role 'admin' in user_roles)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function authorizeCronOrAdmin(req: Request): Promise<
  | { ok: true; mode: "service_role" | "admin"; userId?: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing Authorization" };

  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token === SERVICE_ROLE) return { ok: true, mode: "service_role" };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supa = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, status: 401, error: "Invalid token" };
  }
  const userId = data.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, mode: "admin", userId };
}
