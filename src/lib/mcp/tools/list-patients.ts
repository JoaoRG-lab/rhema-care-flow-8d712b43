import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ALLOWED_EMAIL = "joaooz123@gmail.com";

function ensureAllowed(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) return "Not authenticated";
  const email = ctx.getUserEmail()?.toLowerCase();
  if (email !== ALLOWED_EMAIL) return `Access denied for ${email ?? "unknown user"}.`;
  return null;
}

function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_patients",
  title: "List patients",
  description:
    "List the signed-in clinician's patient cards from the Rhema Care Flow database (respects Row Level Security).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum number of patient cards to return (1-100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const denied = ensureAllowed(ctx);
    if (denied) return { content: [{ type: "text", text: denied }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("patient_cards")
      .select("id, patient_code, diagnosis_tags, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: `Query failed: ${error.message}` }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, rows: data }, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
