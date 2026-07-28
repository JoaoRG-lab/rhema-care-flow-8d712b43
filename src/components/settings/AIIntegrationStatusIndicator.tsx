import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { isUltimateUserEmail } from "@/lib/ultimateUser";
import { supabase } from "@/integrations/supabase/client";
import { testConnection, type MCPConnectionState } from "@/lib/mcp/client";
import { onMcpStatus, emitMcpStatus } from "@/lib/mcp/statusBus";

const CACHE_KEY = "mcp:last-status";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REFRESH_DEBOUNCE_MS = 400;

type CachedStatus = { state: MCPConnectionState; at: number };

function readCache(): CachedStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStatus;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(state: MCPConnectionState) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ state, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Discreet AI integration status indicator. Event-driven refresh:
 *  - Uses a session cache (5 min TTL) to avoid polling.
 *  - Re-probes on Supabase auth SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
 *  - Re-probes when the MCP client emits `unauthorized` via the status bus.
 *  - Re-probes when the tab becomes visible after being hidden > TTL.
 */
export function AIIntegrationStatusIndicator({ className }: { className?: string }) {
  const { user, session } = useAuth();
  const { isAdmin } = useUserRole();
  const canSee = isAdmin || isUltimateUserEmail(user?.email);

  const [state, setState] = useState<MCPConnectionState>(() => readCache()?.state ?? "idle");
  const inflightRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canSee) return;

    // Coalesce bursts of triggers (auth change + status-bus invalidate) into one probe.
    function scheduleProbe(force: boolean) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runProbe(force), REFRESH_DEBOUNCE_MS);
    }

    async function runProbe(force: boolean) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        clearCache();
        setState("unauthorized");
        return;
      }
      if (!force) {
        const cached = readCache();
        if (cached) {
          setState(cached.state);
          return;
        }
      }
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      setState("connecting");
      try {
        const r = await testConnection(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setState(r.state);
        writeCache(r.state);
      } catch {
        if (ctrl.signal.aborted) return;
        setState("error");
        writeCache("error");
      }
    }

    // Initial probe (uses cache when warm).
    scheduleProbe(false);

    // React to Supabase auth transitions.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearCache();
        inflightRef.current?.abort();
        setState("unauthorized");
        emitMcpStatus({ type: "state", state: "unauthorized" });
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        clearCache();
        scheduleProbe(true);
      }
    });

    // React to unauthorized RPCs bubbling from the client.
    const offBus = onMcpStatus((e) => {
      if (e.type === "invalidate") {
        clearCache();
        scheduleProbe(true);
      }
    });

    // Re-probe on tab visibility if cache is stale.
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (!readCache()) scheduleProbe(false);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      authSub.subscription.unsubscribe();
      offBus();
      document.removeEventListener("visibilitychange", onVisibility);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inflightRef.current?.abort();
    };
  }, [canSee]);

  // Track session identity: if the access token changes underneath us (e.g.
  // another tab refreshed the session), invalidate the cached status.
  useEffect(() => {
    if (!canSee) return;
    if (session?.access_token) {
      // Auth listener above already handles SIGNED_IN; nothing to do here.
      return;
    }
    clearCache();
    setState("unauthorized");
  }, [canSee, session?.access_token]);

  if (!canSee) return null;

  const { label, color } = describe(state);
  return (
    <Link
      to="/settings"
      title={label}
      aria-label={`Integração de IA: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40 transition-colors",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", color)} aria-hidden="true" />
      <PlugZap className="h-3 w-3" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function describe(state: MCPConnectionState): { label: string; color: string } {
  switch (state) {
    case "connected":
      return { label: "IA conectada", color: "bg-emerald-500" };
    case "connecting":
      return { label: "Conectando…", color: "bg-amber-500 animate-pulse" };
    case "unauthorized":
      return { label: "Autenticação necessária", color: "bg-amber-500" };
    case "unavailable":
      return { label: "IA indisponível", color: "bg-red-500" };
    case "error":
      return { label: "Configuração incompleta", color: "bg-red-500" };
    default:
      return { label: "IA ociosa", color: "bg-muted-foreground/50" };
  }
}
