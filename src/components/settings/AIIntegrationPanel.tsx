import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlugZap, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  MCPError,
  type MCPConnectionState,
  type MCPTool,
  type MCPWhoami,
  getMcpEndpoint,
  testConnection,
} from "@/lib/mcp/client";

interface Snapshot {
  identity?: MCPWhoami;
  tools: MCPTool[];
  message: string;
}

export default function AIIntegrationPanel() {
  const { user, session } = useAuth();
  const [state, setState] = useState<MCPConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const endpoint = getMcpEndpoint();

  const run = useCallback(async () => {
    setState("connecting");
    setError(null);
    try {
      const result = await testConnection();
      setSnapshot({ identity: result.identity, tools: result.tools, message: result.message });
      setState("connected");
    } catch (err) {
      const message =
        err instanceof MCPError ? err.message : err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (session?.access_token && state === "disconnected") {
      run();
    }
  }, [session?.access_token, state, run]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PlugZap className="h-4 w-4" />
          Integração de IA (MCP)
        </CardTitle>
        <CardDescription>
          Conecta assistentes (ChatGPT, Codex, etc.) ao servidor MCP autenticado deste app.
          Usa sua sessão OAuth atual — nenhum token é armazenado no frontend.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <StatusBadge state={state} />
          {user?.email && (
            <span className="text-muted-foreground truncate">· {user.email}</span>
          )}
        </div>

        <div className="text-xs text-muted-foreground break-all">
          Endpoint: <span className="font-mono">{endpoint}</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {state === "connected" && snapshot && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <div className="font-medium">{snapshot.message}</div>
                {snapshot.identity?.email && (
                  <div className="text-xs text-muted-foreground">
                    Identidade MCP: {snapshot.identity.email}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Ferramentas operacionais seguras
              </div>
              {snapshot.tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ferramenta operacional segura habilitada. Ferramentas clínicas permanecem
                  desativadas até que consentimento e auditoria estejam configurados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {snapshot.tools.map((tool) => (
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
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={run} disabled={state === "connecting"} size="sm">
            {state === "connecting" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {state === "connected" ? "Testar novamente" : "Conectar & testar"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Dados clínicos (pacientes, prontuários, prescrições) nunca trafegam por este teste.
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
    case "error":
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">Desconectado</Badge>;
  }
}
