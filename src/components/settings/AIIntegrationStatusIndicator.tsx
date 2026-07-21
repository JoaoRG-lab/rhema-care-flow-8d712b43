import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { isUltimateUserEmail } from "@/lib/ultimateUser";
import { testConnection, type MCPConnectionState } from "@/lib/mcp/client";

const CACHE_KEY = "mcp:last-status";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

/**
 * Discreet AI integration status indicator. Uses a session-cached status
 * to avoid polling the endpoint on every render. Only rendered for users
 * authorized to see integration state.
 */
export function AIIntegrationStatusIndicator({ className }: { className?: string }) {
  const { user, session } = useAuth();
  const { isAdmin } = useUserRole();
  const canSee = isAdmin || isUltimateUserEmail(user?.email);

  const [state, setState] = useState<MCPConnectionState>(() => readCache()?.state ?? "idle");

  useEffect(() => {
    if (!canSee || !session?.access_token) return;
    const cached = readCache();
    if (cached) {
      setState(cached.state);
      return;
    }
    let cancelled = false;
    testConnection()
      .then((r) => {
        if (cancelled) return;
        setState(r.state);
        writeCache(r.state);
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        writeCache("error");
      });
    return () => {
      cancelled = true;
    };
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
