// Admin-only: grant/revoke an app role for a user identified by email.
// Requires caller to be authenticated AND have role 'admin' in public.user_roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "grant" | "revoke" | "list";
type AppRole = "admin" | "moderator" | "user";

const ALLOWED_ROLES: AppRole[] = ["admin", "moderator", "user"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    // Caller identity
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const callerId = userData.user.id;

    // Admin client
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verify caller is admin
    const { data: isAdminData, error: isAdminErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (isAdminErr) return json({ error: "Permission check failed" }, 500);
    if (!isAdminData) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const role = body.role as AppRole | undefined;

    if (action === "list") {
      const { data: roles, error } = await admin
        .from("user_roles")
        .select("id, user_id, role, created_at, granted_by")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: error.message }, 500);

      // Resolve emails via admin API
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      const emailMap: Record<string, string> = {};
      for (const id of ids) {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data.user?.email) emailMap[id] = data.user.email;
      }
      return json({
        rows: (roles ?? []).map((r) => ({ ...r, email: emailMap[r.user_id] ?? null })),
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return json({ error: "Invalid role" }, 400);
    }

    // Find target user by email (paginate listUsers)
    let targetId: string | null = null;
    for (let page = 1; page <= 20 && !targetId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: error.message }, 500);
      const found = data.users.find((u) => u.email?.toLowerCase() === email);
      if (found) targetId = found.id;
      if (data.users.length < 200) break;
    }
    if (!targetId) return json({ error: "User with that email not found" }, 404);

    if (action === "grant") {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: targetId, role, granted_by: callerId });
      if (error && !/duplicate/i.test(error.message)) return json({ error: error.message }, 500);
      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "admin_role_granted",
        resource_type: "user_role",
        resource_id: targetId,
        metadata: { role, target_email: email },
      });
      return json({ success: true });
    }

    if (action === "revoke") {
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", targetId)
        .eq("role", role);
      if (error) return json({ error: error.message }, 500);
      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "admin_role_revoked",
        resource_type: "user_role",
        resource_id: targetId,
        metadata: { role, target_email: email },
      });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
