/**
 * MCP status bus
 * --------------
 * Tiny pub/sub used to invalidate the cached status and trigger a fresh
 * probe without polling. Emitters:
 *  - `client.ts` when an RPC returns `unauthorized`.
 *  - `AIIntegrationStatusIndicator` on Supabase auth state changes.
 *  - Any caller that wants an on-demand refresh.
 */
export type MCPStatusEvent =
  | { type: "invalidate"; reason: "unauthorized" | "signed-in" | "signed-out" | "manual" }
  | { type: "state"; state: string };

type Listener = (e: MCPStatusEvent) => void;

const listeners = new Set<Listener>();

export function onMcpStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitMcpStatus(event: MCPStatusEvent): void {
  for (const l of Array.from(listeners)) {
    try {
      l(event);
    } catch {
      /* ignore listener errors */
    }
  }
}
