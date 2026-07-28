import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

/**
 * Non-PHI operational health probe. Safe for any authenticated caller —
 * returns server build metadata, uptime, and a lightweight DB reachability
 * check (SELECT 1 via PostgREST). No clinical data is touched.
 */
const BOOT_TIME = Date.now();
const VERSION = "0.1.0";

export default defineTool({
  name: "health",
  title: "Health check",
  description:
    "Returns non-PHI operational metrics for the Rhema Care Flow MCP server: version, uptime, timestamp, and database reachability.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const startedAt = performance.now();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

    let dbReachable = false;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;

    if (url && key) {
      try {
        const t0 = performance.now();
        const res = await fetch(`${url}/rest/v1/`, {
          method: "GET",
          headers: { apikey: key, Authorization: `Bearer ${ctx.getToken()}` },
        });
        dbLatencyMs = Math.round(performance.now() - t0);
        dbReachable = res.ok || res.status === 404; // root returns 200/404 when reachable
        if (!dbReachable) dbError = `HTTP ${res.status}`;
      } catch (err) {
        dbError = err instanceof Error ? err.message : "unknown";
      }
    } else {
      dbError = "Supabase env not configured";
    }

    const payload = {
      status: dbReachable ? "ok" : "degraded",
      version: VERSION,
      server: "rhema-care-flow-mcp",
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - BOOT_TIME,
      handlerLatencyMs: Math.round(performance.now() - startedAt),
      database: {
        reachable: dbReachable,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      auth: {
        authenticated: true,
        clientId: ctx.getClientId() ?? null,
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
