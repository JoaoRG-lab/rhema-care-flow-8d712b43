import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlugZap, RefreshCw, ShieldCheck, XCircle, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { isUltimateUserEmail } from "@/lib/ultimateUser";
import {
  type DiagnosticResult,
  type MCPConnectionState,
  type MCPTool,
  getMcpEndpoint,
  listTools,
  testConnection,
} from "@/lib/mcp/client";
import { listRegisteredTools } from "@/lib/mcp/registry";
import { getEvents, subscribe, type MCPEvent } from "@/lib/mcp/eventLog";

function useEventLog(): MCPEvent[] {
  return useSyncExternalStore(subscribe, getEvents, getEvents);
}

export default function AIIntegrationPanel() {
  const { user, session } = useAuth();
  const { isAdmin } = useUserRole();
  const canAdminister = isAdmin || isUltimateUserEmail(user?.email);

  const [state, setState] = useState<MCPConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagnosticResult | null>(null);
  const [refreshingTools, setRefreshingTools] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<number | null>(null);
  const events = useEventLog();
  const endpoint = getMcpEndpoint();
  const registeredTools = listRegisteredTools();

  const busy = state === "connecting" || refreshingTools;

  const run = useCallback(async () => {
    setState("connecting");
    setError(null);
    const result = await testConnection();
    setDiag(result);
    setState(result.state);
    setLastTestedAt(Date.now());
    if (result.state !== "connected") setError(result.message);
  }, []);

  const refreshTools = useCallback(async () => {
    setRefreshingTools(true);
    try {
      const tools = await listTools();
      setDiag((prev) => (prev ? { ...prev, discoveredTools: tools } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar ferramentas.");
    } finally {
      setRefreshingTools(false);
    }
  }, []);

  useEffect(() => {
    if (session?.access_token && state === "idle" && canAdminister) run();
  }, [session?.access_token, state, canAdminister, run]);

  if (!canAdminister) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            Integração de IA (MCP)
          </CardTitle>
          <CardDescription>
            Controles administrativos restritos. Fale com um administrador para gerenciar a integração.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PlugZap className="h-4 w-4" />
          Integração de IA (MCP)
        </CardTitle>
        <CardDescription>
          Conecta assistentes autorizados (ex.: ChatGPT) ao servidor MCP deste app usando sua sessão
          OAuth atual. Nenhum token é armazenado no frontend.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <StatusBadge state={state} />
          {user?.email && <span className="text-muted-foreground truncate">· {user.email}</span>}
          {lastTestedAt && (
            <span className="text-xs text-muted-foreground">
              · testado {new Date(lastTestedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground break-all" aria-label="MCP endpoint">
          Endpoint: <span className="font-mono">{endpoint}</span>
        </div>

        {error && state !== "connected" && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {diag && state === "connected" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <div className="font-medium">{diag.message}</div>
                <div className="text-xs text-muted-foreground">
                  Latência: {diag.latencyMs} ms · Descobertas: {diag.discoveredTools.length} ·
                  Seguras: {diag.safeTools.length}
                </div>
                {diag.identity?.email && (
                  <div className="text-xs text-muted-foreground">
                    Identidade MCP: {diag.identity.email}
                  </div>
                )}
                {diag.health && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-primary/20 mt-1">
                    <div>
                      Servidor: <span className="font-mono">{diag.health.status ?? "?"}</span>
                      {diag.health.version && <> · v{diag.health.version}</>}
                      {typeof diag.health.uptimeMs === "number" && (
                        <> · uptime {Math.round(diag.health.uptimeMs / 1000)}s</>
                      )}
                    </div>
                    {diag.health.database && (
                      <div>
                        DB: {diag.health.database.reachable ? "alcançável" : "indisponível"}
                        {typeof diag.health.database.latencyMs === "number" && (
                          <> · {diag.health.database.latencyMs} ms</>
                        )}
                        {diag.health.database.error && <> · {diag.health.database.error}</>}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            <ToolLists discovered={diag.discoveredTools} safe={diag.safeTools} />
          </div>
        )}

        <RegisteredToolsList tools={registeredTools} />

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={run} disabled={busy} size="sm" aria-label="Testar conexão MCP">
            {state === "connecting" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {state === "connected" ? "Reconectar & testar" : "Conectar & testar"}
          </Button>
          <Button
            onClick={refreshTools}
            disabled={busy || state !== "connected"}
            size="sm"
            variant="outline"
            aria-label="Atualizar lista de ferramentas"
          >
            {refreshingTools ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ListChecks className="h-4 w-4 mr-2" />
            )}
            Atualizar ferramentas
          </Button>
        </div>

        <EventLog events={events} />

        <p className="text-xs text-muted-foreground">
          Dados clínicos (pacientes, prontuários, prescrições) nunca trafegam por este diagnóstico.
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ state }: { state: MCPConnectionState }) {
  switch (state) {
    case "connected":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>;
    case "connecting":
      return <Badge variant="secondary">Conectando…</Badge>;
    case "unauthorized":
      return <Badge variant="destructive">Autenticação necessária</Badge>;
    case "unavailable":
      return <Badge variant="destructive">Indisponível</Badge>;
    case "error":
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">Ocioso</Badge>;
  }
}

function ToolLists({ discovered, safe }: { discovered: MCPTool[]; safe: MCPTool[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        Ferramentas seguras habilitadas ({safe.length}/{discovered.length})
      </div>
      {safe.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma ferramenta operacional segura habilitada.
        </p>
      ) : (
        <ul className="space-y-2">
          {safe.map((tool) => (
            <li key={tool.name} className="rounded-md border p-2 text-sm">
              <div className="font-medium">{tool.title ?? tool.name}</div>
              {tool.description && (
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RegisteredToolsList({ tools }: { tools: ReturnType<typeof listRegisteredTools> }) {
  return (
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">
        Registro de ferramentas do frontend ({tools.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {tools.map((t) => (
          <li key={t.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono">{t.name}</span>
            <span
              className={
                t.enabled && t.category !== "clinical-restricted"
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              }
            >
              {t.category}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function EventLog({ events }: { events: MCPEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">Nenhum evento de integração ainda.</div>
    );
  }
  return (
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">
        Eventos recentes ({events.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {events.map((e) => (
          <li key={e.id} className="text-xs flex flex-wrap justify-between gap-2">
            <span>
              <span className="font-mono">{e.type}</span>
              {e.toolName && <span className="text-muted-foreground"> · {e.toolName}</span>}
            </span>
            <span className={e.success ? "text-emerald-600" : "text-destructive"}>
              {e.success ? "ok" : e.errorCategory ?? "erro"}
              {typeof e.latencyMs === "number" && ` · ${e.latencyMs}ms`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
