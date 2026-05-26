import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bot, CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface Run {
  id: string;
  agent: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  audit_summary: string | null;
  applied_count: number;
  queued_count: number;
  error: string | null;
}
interface Task {
  id: string;
  agent: string;
  severity: string;
  area: string;
  title: string;
  rationale: string | null;
  status: string;
  created_at: string;
  patch: any;
}

const statusIcon = (s: string) =>
  s === "success" || s === "applied" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
  s === "running" ? <Clock className="h-4 w-4 text-amber-600 animate-pulse" /> :
  s === "error" || s === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> :
  <AlertTriangle className="h-4 w-4 text-muted-foreground" />;

export default function AiRedundancy() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("ai_improvement_runs").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("ai_improvement_tasks").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setRuns((r ?? []) as Run[]);
    setTasks((t ?? []) as Task[]);
  }

  useEffect(() => { void load(); }, []);

  async function trigger() {
    setBusy(true);
    const { error } = await supabase.functions.invoke("ai-improvement-cycle");
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Ciclo disparado"); await load(); }
  }

  async function updateTask(id: string, status: string) {
    const { error } = await supabase.from("ai_improvement_tasks")
      .update({ status, applied_at: status === "applied" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tarefa atualizada"); await load(); }
  }

  if (!user) return null;

  const lastByAgent = new Map<string, Run>();
  for (const r of runs) if (!lastByAgent.has(r.agent)) lastByAgent.set(r.agent, r);
  const agents = ["perplexity","gemini","openai","anthropic","grok","deepseek","groq","openrouter"];

  return (
    <div className="min-h-dvh bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Redundância Multi-IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Rotação a cada 5 min · Sentinel filtra patches destrutivos · Auto-aplica só conteúdo
            </p>
          </div>
          <Button onClick={trigger} disabled={busy} aria-label="Disparar ciclo agora">
            <RefreshCw className={busy ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
            Rodar agora
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {agents.map((a) => {
            const r = lastByAgent.get(a);
            return (
              <Card key={a} className="border">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{a}</span>
                    {r ? statusIcon(r.status) : <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r ? new Date(r.started_at).toLocaleString("pt-BR") : "Nunca executou"}
                  </p>
                  {r && (
                    <p className="text-xs">
                      <Badge variant="outline" className="mr-1">aplicadas: {r.applied_count}</Badge>
                      <Badge variant="outline">fila: {r.queued_count}</Badge>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Propostas ({tasks.length})</TabsTrigger>
            <TabsTrigger value="runs">Execuções ({runs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card>
              <CardHeader><CardTitle>Fila de melhorias</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-3">
                  <div className="space-y-2">
                    {tasks.map((t) => (
                      <div key={t.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={t.severity === "auto" ? "default" : t.severity === "blocked" ? "destructive" : "secondary"}>
                            {t.severity}
                          </Badge>
                          <Badge variant="outline">{t.area}</Badge>
                          <Badge variant="outline" className="capitalize">{t.agent}</Badge>
                          {statusIcon(t.status)}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(t.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="font-medium text-sm">{t.title}</p>
                        {t.rationale && <p className="text-xs text-muted-foreground">{t.rationale}</p>}
                        {t.status === "needs_review" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => updateTask(t.id, "applied")}>Aprovar</Button>
                            <Button size="sm" variant="outline" onClick={() => updateTask(t.id, "skipped")}>Rejeitar</Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        Nenhuma proposta ainda. O scheduler roda a cada 5 minutos.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs">
            <Card>
              <CardHeader><CardTitle>Histórico de execuções</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-3">
                  <div className="space-y-2">
                    {runs.map((r) => (
                      <div key={r.id} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {statusIcon(r.status)}
                          <span className="font-medium capitalize">{r.agent}</span>
                          <Badge variant="outline">aplicadas: {r.applied_count}</Badge>
                          <Badge variant="outline">fila: {r.queued_count}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(r.started_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {r.audit_summary && <p className="text-xs text-muted-foreground">{r.audit_summary}</p>}
                        {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
