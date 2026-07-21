import { describe, it, expect, beforeEach } from "vitest";
import {
  getRegisteredTool,
  isInvocable,
  isSafeOperationalTool,
  listRegisteredTools,
} from "@/lib/mcp/registry";
import { getEvents, clearEvents, recordEvent } from "@/lib/mcp/eventLog";

describe("mcp registry", () => {
  it("marks whoami as safe and invocable", () => {
    expect(isSafeOperationalTool("whoami")).toBe(true);
    expect(isInvocable("whoami")).toBe(true);
  });

  it("keeps clinical tools disabled", () => {
    const t = getRegisteredTool("list_patients");
    expect(t?.category).toBe("clinical-restricted");
    expect(t?.enabled).toBe(false);
    expect(isInvocable("list_patients")).toBe(false);
    expect(isSafeOperationalTool("list_patients")).toBe(false);
  });

  it("defaults unknown tools to disabled", () => {
    expect(isInvocable("some_new_tool")).toBe(false);
    expect(isSafeOperationalTool("some_new_tool")).toBe(false);
  });

  it("exposes a stable list of registered tools", () => {
    const list = listRegisteredTools();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => typeof t.name === "string")).toBe(true);
  });
});

describe("mcp event log", () => {
  beforeEach(() => clearEvents());

  it("records sanitized events", () => {
    recordEvent({ type: "test", success: true, latencyMs: 42 });
    const evs = getEvents();
    expect(evs).toHaveLength(1);
    expect(evs[0].type).toBe("test");
    expect(evs[0].success).toBe(true);
  });

  it("caps history length", () => {
    for (let i = 0; i < 40; i++) recordEvent({ type: "ping" as never, success: true });
    expect(getEvents().length).toBeLessThanOrEqual(25);
  });
});
