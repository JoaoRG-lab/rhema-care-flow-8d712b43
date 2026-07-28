/**
 * MCP Client Service
 * ------------------
 * Centralized, typed layer for talking to the app's MCP endpoint over
 * JSON-RPC 2.0. Preserves the existing Supabase OAuth/session flow — the
 * caller's Supabase access token is forwarded as a bearer credential. No
 * secrets, service-role keys, or API keys are embedded in frontend code.
 *
 * Read-only and operational by design. Clinical tools (patient enumeration,
 * records, prescriptions) are gated by the frontend registry and remain
 * disabled until explicit consent + audit + access-control rules land.
 */

import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { isInvocable, isSafeOperationalTool } from "./registry";
import { recordEvent } from "./eventLog";

export type MCPConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "unauthorized"
  | "unavailable"
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

export type MCPErrorCategory =
  | "no_session"
  | "unauthorized"
  | "timeout"
  | "network"
  | "invalid_response"
  | "rpc_error"
  | "http_error"
  | "aborted"
  | "duplicate"
  | "tool_disabled"
  | "unknown";

export class MCPError extends Error {
  constructor(
    message: string,
    public category: MCPErrorCategory = "unknown",
    public status?: number,
  ) {
    super(message);
    this.name = "MCPError";
  }
}

const DEFAULT_ENDPOINT = `${supabaseUrl}/functions/v1/mcp`;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

export function getMcpEndpoint(): string {
  const override = (import.meta.env.VITE_MCP_ENDPOINT as string | undefined)?.trim();
  return override && /^https:\/\//.test(override) ? override : DEFAULT_ENDPOINT;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new MCPError(error.message, "unauthorized");
  const token = data.session?.access_token;
  if (!token) throw new MCPError("Sessão expirada. Faça login novamente.", "no_session", 401);
  return token;
}

let rpcId = 0;
const inflight = new Map<string, Promise<unknown>>();

interface RpcOpts {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  dedupeKey?: string;
}

function isTransient(err: unknown): boolean {
  if (err instanceof MCPError) {
    return err.category === "network" || err.category === "timeout" ||
      (err.category === "http_error" && (err.status === 502 || err.status === 503 || err.status === 504));
  }
  return false;
}

async function jsonRpc<T>(method: string, params?: Record<string, unknown>, opts: RpcOpts = {}): Promise<T> {
  const dedupeKey = opts.dedupeKey ?? `${method}:${JSON.stringify(params ?? {})}`;
  const existing = inflight.get(dedupeKey);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = opts.retries ?? MAX_RETRIES;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener("abort", onAbort);
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const token = await getAccessToken();
        const endpoint = getMcpEndpoint();
        const body = { jsonrpc: "2.0", id: ++rpcId, method, params: params ?? {} };

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") {
            throw new MCPError(
              opts.signal?.aborted ? "Requisição cancelada." : "Tempo esgotado ao contatar MCP.",
              opts.signal?.aborted ? "aborted" : "timeout",
            );
          }
          throw new MCPError(
            err instanceof Error ? `Falha de rede: ${err.message}` : "Falha de rede",
            "network",
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
          throw new MCPError(`Resposta MCP inválida (HTTP ${response.status})`, "invalid_response", response.status);
        }

        if (!response.ok) {
          const msg = (payload as { error?: { message?: string } })?.error?.message ?? `Erro HTTP ${response.status}`;
          throw new MCPError(msg, "http_error", response.status);
        }

        const rpc = payload as { error?: { code?: number; message?: string }; result?: T };
        if (rpc.error) throw new MCPError(rpc.error.message ?? "Erro MCP", "rpc_error");
        if (rpc.result === undefined) throw new MCPError("Resposta MCP sem campo result.", "invalid_response");
        return rpc.result;
      } catch (err) {
        lastErr = err;
        if (attempt < retries && isTransient(err)) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastErr;
  })();

  inflight.set(dedupeKey, promise);
  try {
    return (await promise) as T;
  } finally {
    inflight.delete(dedupeKey);
  }
}

async function initialize(signal?: AbortSignal): Promise<void> {
  await jsonRpc(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "rhema-care-flow-web", version: "0.1.0" },
    },
    { signal, dedupeKey: "initialize" },
  );
}

export async function listTools(signal?: AbortSignal): Promise<MCPTool[]> {
  const res = await jsonRpc<{ tools: MCPTool[] }>("tools/list", undefined, { signal, dedupeKey: "tools/list" });
  return res.tools ?? [];
}

export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
  opts: { signal?: AbortSignal } = {},
): Promise<MCPCallResult> {
  if (!isInvocable(name)) {
    throw new MCPError(`Ferramenta "${name}" desabilitada pela política do frontend.`, "tool_disabled");
  }
  const started = performance.now();
  try {
    const result = await jsonRpc<MCPCallResult>("tools/call", { name, arguments: args }, { signal: opts.signal });
    recordEvent({
      type: "call_tool",
      toolName: name,
      success: !result.isError,
      latencyMs: Math.round(performance.now() - started),
      errorCategory: result.isError ? "rpc_error" : undefined,
    });
    return result;
  } catch (err) {
    recordEvent({
      type: "call_tool",
      toolName: name,
      success: false,
      latencyMs: Math.round(performance.now() - started),
      errorCategory: err instanceof MCPError ? err.category : "unknown",
    });
    throw err;
  }
}

export function parseToolJson<T>(result: MCPCallResult): T | null {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export interface MCPHealthMetrics {
  status?: string;
  version?: string;
  uptimeMs?: number;
  handlerLatencyMs?: number;
  timestamp?: string;
  database?: { reachable?: boolean; latencyMs?: number | null; error?: string | null };
}

export interface DiagnosticResult {
  state: Extract<MCPConnectionState, "connected" | "unauthorized" | "unavailable" | "error">;
  message: string;
  endpoint: string;
  identity?: MCPWhoami;
  health?: MCPHealthMetrics;
  discoveredTools: MCPTool[];
  safeTools: MCPTool[];
  latencyMs: number;
  errorCategory?: MCPErrorCategory;
}

/** Safe non-PHI diagnostic. Prefers whoami + health; falls back to tools/list. */
export async function testConnection(signal?: AbortSignal): Promise<DiagnosticResult> {
  const endpoint = getMcpEndpoint();
  const started = performance.now();
  try {
    await initialize(signal);
    const discoveredTools = await listTools(signal);
    const safeTools = discoveredTools.filter((t) => isSafeOperationalTool(t.name));

    let identity: MCPWhoami | undefined;
    let health: MCPHealthMetrics | undefined;
    let message = "Nenhuma ferramenta operacional segura disponível.";

    if (safeTools.some((t) => t.name === "whoami")) {
      const res = await callTool("whoami", {}, { signal });
      if (res.isError) throw new MCPError(res.content?.[0]?.text ?? "whoami retornou erro", "rpc_error");
      identity = parseToolJson<MCPWhoami>(res) ?? undefined;
      message = "Conexão MCP validada via whoami (sem PHI).";
    } else if (discoveredTools.length > 0) {
      message = "Conexão MCP validada via tools/list (sem PHI).";
    }

    if (safeTools.some((t) => t.name === "health")) {
      try {
        const res = await callTool("health", {}, { signal });
        if (!res.isError) {
          health = parseToolJson<MCPHealthMetrics>(res) ?? undefined;
          if (health?.status) {
            message = `Conexão MCP OK — servidor ${health.status}${
              health.database?.reachable ? ", DB alcançável" : ""
            }.`;
          }
        }
      } catch {
        // Health metrics are optional; don't fail the diagnostic if only health errors.
      }
    }

    const latencyMs = Math.round(performance.now() - started);
    recordEvent({ type: "test", success: true, latencyMs });
    return {
      state: safeTools.length === 0 && discoveredTools.length === 0 ? "unavailable" : "connected",
      message,
      endpoint,
      identity,
      health,
      discoveredTools,
      safeTools,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const category = err instanceof MCPError ? err.category : "unknown";
    recordEvent({ type: "test", success: false, latencyMs, errorCategory: category });

    const humanMessage = mapDiagnosticMessage(category, err);
    const state: DiagnosticResult["state"] =
      category === "unauthorized" || category === "no_session" ? "unauthorized" :
      category === "network" || category === "timeout" || category === "http_error" ? "unavailable" :
      "error";
    return {
      state,
      message: humanMessage,
      endpoint,
      discoveredTools: [],
      safeTools: [],
      latencyMs,
      errorCategory: category,
    };
  }
}


function mapDiagnosticMessage(category: MCPErrorCategory, err: unknown): string {
  switch (category) {
    case "no_session": return "Autenticação necessária.";
    case "unauthorized": return "Sessão expirada ou não autorizada.";
    case "timeout": return "Servidor MCP não respondeu a tempo.";
    case "network": return "Servidor MCP indisponível.";
    case "invalid_response": return "Resposta MCP inválida.";
    case "http_error": return "Servidor MCP retornou erro.";
    case "tool_disabled": return "Ferramenta desabilitada pela política.";
    default: return err instanceof Error ? err.message : "Erro desconhecido.";
  }
}
