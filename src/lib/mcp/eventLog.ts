/**
 * In-memory MCP integration event log.
 * Privacy-safe: stores only sanitized metadata, never payloads, tokens,
 * headers or clinical content.
 */

export type MCPEventType =
  | "connect"
  | "test"
  | "list_tools"
  | "call_tool"
  | "error";

export interface MCPEvent {
  id: string;
  type: MCPEventType;
  timestamp: number;
  success: boolean;
  toolName?: string;
  errorCategory?: string;
  latencyMs?: number;
  role?: string;
}

const MAX_EVENTS = 25;
let events: MCPEvent[] = [];
const listeners = new Set<() => void>();

export function recordEvent(event: Omit<MCPEvent, "id" | "timestamp"> & { timestamp?: number }): MCPEvent {
  const record: MCPEvent = {
    id: crypto.randomUUID(),
    timestamp: event.timestamp ?? Date.now(),
    ...event,
  };
  events = [record, ...events].slice(0, MAX_EVENTS);
  listeners.forEach((l) => l());
  return record;
}

export function getEvents(): MCPEvent[] {
  return events;
}

export function clearEvents() {
  events = [];
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
