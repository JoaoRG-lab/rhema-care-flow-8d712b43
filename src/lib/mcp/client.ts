/**
 * MCP Client Service
 * ------------------
 * Centralized, typed layer for talking to the app's MCP endpoint over
 * JSON-RPC 2.0 (Streamable HTTP transport). Preserves the existing Supabase
 * OAuth/session flow — the caller's Supabase access token is forwarded as a
 * bearer credential; no secrets or API keys are embedded in frontend code.
 *
 * Intentionally read-only and operational: we do NOT expose or accept clinical
 * database identifiers here. Clinical tools remain gated on the server side.
 */

import { supabase, supabaseUrl } from "@/integrations/supabase/client";

export type MCPConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface MCPTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
}

export interface MCPCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

export interface MCPWhoami {
  userId?: string;
  email?: string;
}

export class MCPError extends Error {
  constructor(message: string, public code?: number | string, public status?: number) {
    super(message);
    this.name = "MCPError";
  }
}

const DEFAULT_ENDPOINT = `${supabaseUrl}/functions/v1/mcp`;

/**
 * Resolves the MCP endpoint. Prefer a build-time override via
 * `VITE_MCP_ENDPOINT` so the URL can be swapped per environment without
 * shipping code changes. Falls back to the canonical Supabase functions URL.
 */
export function getMcpEndpoint(): string {
  const override = (import.meta.env.VITE_MCP_ENDPOINT as string | undefined)?.trim();
  return override && /^https:\/\//.test(override) ? override : DEFAULT_ENDPOINT;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new MCPError(error.message, "auth_error");
  const token = data.session?.access_token;
  if (!token) throw new MCPError("Sessão expirada. Faça login novamente.", "no_session", 401);
  return token;
}

let rpcId = 0;

async function jsonRpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  const endpoint = getMcpEndpoint();
  const body = { jsonrpc: "2.0", id: ++rpcId, method, params: params ?? {} };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new MCPError(
      err instanceof Error ? `Falha de rede: ${err.message}` : "Falha de rede ao contatar MCP",
      "network_error",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new MCPError("Autenticação MCP inválida ou expirada.", "unauthorized", response.status);
  }

  const rawText = await response.text();
  let payload: unknown;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new MCPError(
      `Resposta MCP inválida (HTTP ${response.status})`,
      "invalid_response",
      response.status,
    );
  }

  if (!response.ok) {
    const msg =
      (payload as { error?: { message?: string } })?.error?.message ??
      `Erro HTTP ${response.status}`;
    throw new MCPError(msg, "http_error", response.status);
  }

  const rpc = payload as {
    error?: { code?: number; message?: string };
    result?: T;
  };
  if (rpc.error) {
    throw new MCPError(rpc.error.message ?? "Erro MCP", rpc.error.code);
  }
  if (rpc.result === undefined) {
    throw new MCPError("Resposta MCP sem campo result.", "empty_result");
  }
  return rpc.result;
}

async function initialize(): Promise<void> {
  await jsonRpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "rhema-care-flow-web", version: "0.1.0" },
  });
}

export async function listTools(): Promise<MCPTool[]> {
  const res = await jsonRpc<{ tools: MCPTool[] }>("tools/list");
  return res.tools ?? [];
}

export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPCallResult> {
  return jsonRpc<MCPCallResult>("tools/call", { name, arguments: args });
}

/** Extracts a JSON payload from a tool result whose first content block is text. */
export function parseToolJson<T>(result: MCPCallResult): T | null {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Runs a safe non-PHI operational probe against the MCP endpoint.
 * Uses `whoami` if available; otherwise just confirms tools/list responds.
 */
export async function testConnection(): Promise<{
  ok: boolean;
  identity?: MCPWhoami;
  tools: MCPTool[];
  endpoint: string;
  message: string;
}> {
  const endpoint = getMcpEndpoint();
  await initialize();
  const tools = await listTools();
  const safe = tools.filter((t) => isSafeOperationalTool(t.name));
  const whoami = safe.find((t) => t.name === "whoami");

  let identity: MCPWhoami | undefined;
  if (whoami) {
    const res = await callTool("whoami");
    if (res.isError) {
      throw new MCPError(res.content?.[0]?.text ?? "whoami retornou erro", "whoami_failed");
    }
    identity = parseToolJson<MCPWhoami>(res) ?? undefined;
  }

  return {
    ok: true,
    identity,
    tools: safe,
    endpoint,
    message: whoami
      ? "Conexão MCP validada via whoami (sem PHI)."
      : "Conexão MCP validada via tools/list (sem PHI).",
  };
}

/**
 * Whitelist of tools the frontend is allowed to expose in operational UIs.
 * Clinical/PHI-bearing tools (e.g. list_patients) are intentionally excluded
 * until explicit consent + audit logging + access-control rules are in place.
 */
export const SAFE_OPERATIONAL_TOOLS = new Set<string>([
  "whoami",
  "health",
  "healthcheck",
  "ping",
  "app_status",
  "open_module",
  "navigation_command",
  "integration_health",
  "get_public_config",
]);

export function isSafeOperationalTool(name: string): boolean {
  return SAFE_OPERATIONAL_TOOLS.has(name);
}
