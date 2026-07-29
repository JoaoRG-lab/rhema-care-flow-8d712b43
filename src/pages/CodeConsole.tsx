import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase, supabasePublishableKey, supabaseUrl } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Github, Plus, Rocket, Send, Sparkles, Trash2, Bot, Code2, Search, KeyRound, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { invokeEdgeFn } from "@/lib/invokeEdgeFn";
import { useUltimateAccess } from "@/hooks/useUltimateAccess";
import { copyText } from "@/lib/clipboard";

type Agent = "user" | "chatgpt" | "codex" | "perplexity" | "custom" | "kimi" | "sentinel";

interface Thread {
  id: string;
  title: string;
  deploy_agent: Agent | null;
  updated_at: string;
}
interface Message {
  id: string;
  agent: Agent;
  content: string;
  destructive_warning: string | null;
  promoted_for_deploy: boolean;
  model: string | null;
  citations: unknown;
  created_at: string;
}
interface DeploymentFile {
  path: string;
  bytes: number;
  expectedSha: string | null;
}
interface DeploymentPlan {
  branch: string;
  baseBranch?: string;
  repo?: string;
  parentSha: string;
  files: DeploymentFile[];
}
interface DeploymentResult {
  branch: string;
  commitSha: string;
  pullRequest?: {
    number: number;
    html_url: string;
    state: string;
  } | null;
}

const AGENT_META: Record<
  Exclude<Agent, "user" | "sentinel">,
  {
    label: string;
    icon: typeof Bot;
    hint: string;
    scope: string;
    paths: string[];
    starters: string[];
  }
> = {
  chatgpt: {
    label: "ChatGPT",
    icon: Sparkles,
    hint: "GPT-5 — generalista, novos componentes e Edge Functions",
    scope: "Novos componentes React, Edge Functions, integrações Supabase",
    paths: ["src/components/**", "src/pages/**", "supabase/functions/**", "src/hooks/**"],
    starters: [
      "Crie um componente React em src/components/<area>/<Nome>.tsx que ...",
      "Implemente uma Edge Function em supabase/functions/<nome>/index.ts que ...",
    ],
  },
  codex: {
    label: "Codex",
    icon: Code2,
    hint: "GPT-5.4 — refator profundo, tipos completos, testes",
    scope: "Refatoração TS, tipagem estrita, testes Vitest, acessibilidade",
    paths: ["src/lib/**", "src/hooks/**", "src/**/__tests__/**", "src/types/**"],
    starters: [
      "Refatore src/lib/<arquivo>.ts extraindo ... e adicione testes em __tests__/",
      "Adicione tipos estritos e testes Vitest cobrindo edge cases para ...",
    ],
  },
  perplexity: {
    label: "Perplexity",
    icon: Search,
    hint: "Sonar Pro — pesquisa clínica com fontes (ACR/EULAR/OARSI)",
    scope: "Calculadoras clínicas, scores, biblioteca médica, citações com DOI",
    paths: [
      "src/lib/calculators.ts",
      "src/components/scores/**",
      "src/pages/Scores.tsx",
      "src/pages/KnowledgeLibrary.tsx",
      "supabase/functions/ai-research-engine/index.ts",
    ],
    starters: [
      "Pesquise a diretriz ACR/EULAR mais recente sobre ... e cite fontes (DOI/PubMed)",
      "Implemente o score clínico ... em src/lib/calculators.ts com referência validada",
    ],
  },
  kimi: {
    label: "Kimi K2",
    icon: Code2,
    hint: "Moonshot Kimi K2 — motor open-weights de código",
    scope: "Geração e refator de código, open-weights, forte em TS/React/SQL",
    paths: ["src/**", "supabase/functions/**"],
    starters: [
      "Kimi, implemente ... com tipos completos e tratamento de erro.",
      "Kimi, refatore src/lib/<arquivo>.ts para ...",
    ],
  },
  custom: {
    label: "Custom API",
    icon: KeyRound,
    hint: "Sua chave / endpoint OpenAI-compat.",
    scope: "Endpoint próprio — escopo livre",
    paths: ["(livre)"],
    starters: ["Use o endpoint customizado para ..."],
  },
};

function edgeInvokeError(error: string | null, data: unknown): string | null {
  if (error) return formatConsoleRuntimeError(error);
  const payload = data as { error?: unknown } | null;
  if (payload?.error) return formatConsoleRuntimeError(String(payload.error));
  return null;
}

function formatConsoleRuntimeError(raw: string): string {
  if (/code_console_|relation .*does not exist|schema cache/i.test(raw)) {
    return 'Estrutura do Code Console não encontrada no Supabase. Aplique as tabelas/funções do console no projeto correto antes de usar este módulo.';
  }

  if (/não foi possível alcançar a edge function|failed to fetch|networkerror|load failed/i.test(raw)) {
    return raw;
  }

  if (/jwt|authorization|unauthorized|forbidden|not allowed/i.test(raw)) {
    return `Acesso negado pelo Supabase/Edge Function: ${raw}`;
  }

  return raw;
}

interface KimiBridgeResponse {
  message?: Message;
  agentStored?: Agent;
}

const KIMI_ENGINE_AGENTS = new Set<Exclude<Agent, "user" | "sentinel">>(["kimi", "chatgpt", "codex", "custom"]);

function cleanEnv(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim().replace(/^['"`]+|['"`]+$/g, "") || undefined : undefined;
}

function stripKimiCompatPrompt(content: string): string {
  if (!/^\[[A-Z_]+_MODE\]/.test(content)) return content;
  const separator = content.indexOf("\n\n");
  if (separator < 0) return content.replace(/^\[[A-Z_]+_MODE\]\s*/i, "").trim();
  return content.slice(separator + 2).trim() || content;
}

function renderConsoleMessageContent(message: Message): string {
  const content = stripKimiCompatPrompt(message.content);
  if (message.agent !== "user" && /LOVABLE_API_KEY ausente|Não consegui chamar o provedor configurado/i.test(content)) {
    return "O motor principal foi reconfigurado. Envie a próxima instrução nesta thread para continuar pelo Kimi bridge, sem depender da chave Lovable no Console.";
  }
  return content;
}

function providerConfigFailure(data: unknown): string | null {
  const message = (data as { message?: Partial<Message> } | null)?.message;
  const combined = [message?.content, message?.destructive_warning].filter(Boolean).join("\n");
  return /LOVABLE_API_KEY ausente|Falha operacional do provedor/i.test(combined) ? combined : null;
}

async function invokeKimiBridge(threadId: string, prompt: string): Promise<{ data: KimiBridgeResponse | null; error: string | null; status?: number }> {
  const cloudUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
  const cloudKey = cleanEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (!cloudUrl || !cloudKey) {
    return { data: null, error: "Backend Lovable Cloud não configurado para acionar o Kimi." };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { data: null, error: "Sessão expirada. Faça login novamente.", status: 401 };

    const response = await fetch(`${cloudUrl.replace(/\/+$/, "")}/functions/v1/code-console-kimi-bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cloudKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ threadId, prompt, backendApiKey: supabasePublishableKey, backendUrl: supabaseUrl }),
    });

    let payload: KimiBridgeResponse & { error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { data: payload, error: payload?.error ?? `Kimi retornou status ${response.status}.`, status: response.status };
    }
    return { data: payload, error: null, status: response.status };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Falha de rede ao chamar Kimi." };
  }
}

export default function CodeConsole() {
  const { user } = useAuth();
  const ultimateAccess = useUltimateAccess();
  const allowed = ultimateAccess.allowed;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agent, setAgent] = useState<Exclude<Agent, "user" | "sentinel">>("kimi");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [deploymentPlans, setDeploymentPlans] = useState<Record<string, DeploymentPlan>>({});
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState(localStorage.getItem("cc.githubUrl") ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  function reportConsoleError(raw: string) {
    const message = formatConsoleRuntimeError(raw);
    setConsoleError(message);
    toast.error(message);
  }

  // Load threads
  useEffect(() => {
    if (!user || !allowed) return;
    void (async () => {
      const { data, error } = await supabase
        .from("code_console_threads")
        .select("id, title, deploy_agent, updated_at")
        .order("updated_at", { ascending: false });
      if (error) {
        reportConsoleError(error.message);
        return;
      }
      setConsoleError(null);
      setThreads(data as Thread[]);
      if (!activeId && data && data.length > 0) setActiveId(data[0].id);
      if (data && data.length === 0) await createThread();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allowed]);

  // Load messages for active thread
  useEffect(() => {
    if (!activeId) return;
    void (async () => {
      const { data, error } = await supabase
        .from("code_console_messages")
        .select("*")
        .eq("thread_id", activeId)
        .order("created_at", { ascending: true });
      if (error) {
        reportConsoleError(error.message);
        return;
      }
      setConsoleError(null);
      setMessages(data as Message[]);
    })();
  }, [activeId]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, [messages, busy]);

  async function createThread() {
    if (!user) {
      toast.error("Faça login antes de criar uma sessão.");
      return;
    }
    const { data, error } = await supabase
      .from("code_console_threads")
      .insert({ title: "Nova sessão", user_id: user!.id })
      .select()
      .single();
    if (error) {
      reportConsoleError(error.message);
      return;
    }
    setConsoleError(null);
    setThreads((t) => [data as Thread, ...t]);
    setActiveId((data as Thread).id);
    setMessages([]);
  }

  async function deleteThread(id: string) {
    if (!confirm("Apagar esta sessão e todas as mensagens?")) return;
    const { error } = await supabase.from("code_console_threads").delete().eq("id", id);
    if (error) {
      reportConsoleError(error.message);
      return;
    }
    setConsoleError(null);
    setThreads((t) => t.filter((x) => x.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function send() {
    if (!activeId || !prompt.trim() || busy) return;
    const text = prompt.trim();
    setPrompt("");
    setBusy(true);
    // Optimistic
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      agent: "user",
      content: text,
      destructive_warning: null,
      promoted_for_deploy: false,
      model: null,
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    const useKimiEngine = KIMI_ENGINE_AGENTS.has(agent);
    let { data, error } = useKimiEngine
      ? await invokeKimiBridge(activeId, `[${agent.toUpperCase()}_MODE]\n\n${text}`)
      : await invokeEdgeFn("code-console-chat", {
        threadId: activeId,
        prompt: text,
        agent,
      });
    let invokeError = edgeInvokeError(error, data);

    if (!useKimiEngine && invokeError && /Parâmetros inválidos/i.test(invokeError)) {
      const details = (data as { details?: { allowedAgents?: string[] } } | null)?.details;
      const allowed = details?.allowedAgents ?? ["chatgpt", "codex", "perplexity", "custom"];
      const fallbackAgent = (allowed.includes("chatgpt") ? "chatgpt" : allowed.find((a) => a !== "user")) as string | undefined;
      if (fallbackAgent) {
        const retry = await invokeEdgeFn("code-console-chat", {
          threadId: activeId,
          prompt: text,
          agent: fallbackAgent,
        });
        data = retry.data;
        error = retry.error;
        invokeError = edgeInvokeError(error, data);
      }
    }

    if (!useKimiEngine && !invokeError && providerConfigFailure(data)) {
      const retry = await invokeKimiBridge(activeId, text);
      data = retry.data;
      error = retry.error;
      invokeError = edgeInvokeError(error, data);
    }
    setBusy(false);
    if (invokeError) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      reportConsoleError(invokeError);
      return;
    }
    setConsoleError(null);
    // Re-fetch (gets user msg + assistant msg in correct order)
    const { data: refreshed } = await supabase
      .from("code_console_messages")
      .select("*")
      .eq("thread_id", activeId)
      .order("created_at", { ascending: true });
    if (refreshed) setMessages(refreshed as Message[]);

    // Auto-title first message
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("code_console_threads").update({ title }).eq("id", activeId);
      setThreads((t) => t.map((x) => (x.id === activeId ? { ...x, title } : x)));
    }
  }

  async function promote(messageId: string) {
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.agent === "user") return;
    if (target.destructive_warning && !confirm("Esta resposta foi marcada como potencialmente destrutiva. Promover mesmo assim?")) return;
    // Unset previous promoted in this thread; set this one; set deploy_agent on thread
    const unset = await supabase.from("code_console_messages").update({ promoted_for_deploy: false }).eq("thread_id", activeId!);
    if (unset.error) {
      reportConsoleError(unset.error.message);
      return;
    }
    const promoteResult = await supabase.from("code_console_messages").update({ promoted_for_deploy: true }).eq("id", messageId);
    if (promoteResult.error) {
      reportConsoleError(promoteResult.error.message);
      return;
    }
    const threadResult = await supabase.from("code_console_threads").update({ deploy_agent: target.agent }).eq("id", activeId!);
    if (threadResult.error) {
      reportConsoleError(threadResult.error.message);
      return;
    }
    setConsoleError(null);
    toast.success(`Promovido para deploy: ${target.agent}`);
    const { data: refreshed } = await supabase
      .from("code_console_messages")
      .select("*")
      .eq("thread_id", activeId!)
      .order("created_at", { ascending: true });
    if (refreshed) setMessages(refreshed as Message[]);
    setThreads((t) => t.map((x) => (x.id === activeId ? { ...x, deploy_agent: target.agent } : x)));
  }

  async function previewFiles(messageId: string) {
    setDeployingId(messageId);
    const tid = toast.loading("Verificando arquivos…");
    const { data, error } = await invokeEdgeFn("code-console-deploy", {
      messageId,
      dryRun: true,
    });
    toast.dismiss(tid);
    setDeployingId(null);
    const invokeError = edgeInvokeError(error, data);
    if (invokeError) {
      reportConsoleError(invokeError);
      return;
    }
    setConsoleError(null);
    const planData = (data ?? {}) as Partial<DeploymentPlan> & { files?: DeploymentFile[] };
    const files = (planData.files ?? []) as DeploymentFile[];
    setDeploymentPlans((plans) => ({
      ...plans,
      [messageId]: {
        branch: String(planData.branch ?? "codex/code-console"),
        baseBranch: planData.baseBranch ? String(planData.baseBranch) : undefined,
        repo: planData.repo ? String(planData.repo) : undefined,
        parentSha: String(planData.parentSha ?? ""),
        files,
      },
    }));
    toast.success(`${files.length} arquivo(s) pronto(s) para aplicar em ${planData.branch ?? "branch"}.`);
  }

  async function applyFiles(messageId: string) {
    const plan = deploymentPlans[messageId];
    const files = plan?.files ?? [];
    if (!files.length) return toast.error("Pre-visualize os arquivos antes de aplicar.");
    if (!confirm(`Aplicar ${files.length} arquivo(s) em ${plan.branch} e abrir PR para ${plan.baseBranch ?? "main"}?`)) return;
    const expectedShas = Object.fromEntries(files.map((file) => [file.path, file.expectedSha]));
    setDeployingId(messageId);
    const tid = toast.loading("Aplicando na branch de agente…");
    const { data, error } = await invokeEdgeFn("code-console-deploy", {
      messageId,
      expectedShas,
      openPullRequest: true,
    });
    toast.dismiss(tid);
    setDeployingId(null);
    const invokeError = edgeInvokeError(error, data);
    if (invokeError) {
      reportConsoleError(invokeError);
      return;
    }
    setConsoleError(null);
    const result = data as DeploymentResult;
    const prText = result.pullRequest ? ` PR #${result.pullRequest.number} aberto.` : "";
    toast.success(`Commit ${result.commitSha.slice(0, 7)} criado em ${result.branch}.${prText}`);
    setDeploymentPlans((plans) => {
      const next = { ...plans };
      delete next[messageId];
      return next;
    });
    const { data: refreshed } = await supabase
      .from("code_console_messages")
      .select("*")
      .eq("thread_id", activeId!)
      .order("created_at", { ascending: true });
    if (refreshed) setMessages(refreshed as Message[]);
  }

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  function saveGithubUrl(v: string) {
    setGithubUrl(v);
    localStorage.setItem("cc.githubUrl", v);
  }

  if (ultimateAccess.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Verificando privilégios ultimate...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>O Code Console multi-agente está habilitado apenas para a conta autorizada.</p>
            <p>Faça login com a conta autorizada para continuar.</p>
            {user?.email && (
              <p className="pt-2">Sessão atual: <span className="font-mono">{user.email}</span></p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Code Console multi-agente</h1>
            <p className="text-sm text-muted-foreground">
              ChatGPT · Codex · Perplexity · Custom API — convergem na mesma thread. Sentinel marca código destrutivo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="URL do seu repositório GitHub"
              value={githubUrl}
              onChange={(e) => saveGithubUrl(e.target.value)}
              className="w-72"
            />
            <Button
              variant="outline"
              disabled={!githubUrl}
              onClick={() => window.open(githubUrl, "_blank", "noopener")}
            >
              <Github className="mr-2 h-4 w-4" /> Abrir
            </Button>
          </div>
        </div>

        {consoleError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{consoleError}</span>
            </div>
            <button
              type="button"
              className="text-xs font-medium underline underline-offset-2"
              onClick={() => setConsoleError(null)}
            >
              dispensar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Sidebar threads */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sessões</CardTitle>
                <Button size="sm" variant="ghost" onClick={createThread}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent",
                      activeId === t.id && "bg-accent",
                    )}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.deploy_agent && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Rocket className="mr-1 h-3 w-3" />
                        {t.deploy_agent}
                      </Badge>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteThread(t.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Apagar sessão"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {threads.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Nenhuma sessão. Crie uma com +.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main panel */}
          <Card className="flex flex-col min-h-[70vh]">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  {activeThread?.title ?? "Sem sessão"}
                  {activeThread?.deploy_agent && (
                    <Badge variant="default" className="ml-2">
                      <Rocket className="mr-1 h-3 w-3" /> deploy: {activeThread.deploy_agent}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(AGENT_META) as Array<keyof typeof AGENT_META>).map((k) => {
                    const Icon = AGENT_META[k].icon;
                    return (
                      <Button
                        key={k}
                        size="sm"
                        variant={agent === k ? "default" : "outline"}
                        onClick={() => setAgent(k)}
                        title={AGENT_META[k].hint}
                      >
                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                        {AGENT_META[k].label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-3">
              {/* Trilha do agente — sinaliza escopo + caminhos + prompts-modelo */}
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Trilha</Badge>
                  <span className="font-medium text-foreground">{AGENT_META[agent].label}</span>
                  <span className="text-muted-foreground">— {AGENT_META[agent].scope}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {AGENT_META[agent].paths.map((p) => (
                    <code
                      key={p}
                      className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border"
                    >
                      {p}
                    </code>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {AGENT_META[agent].starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPrompt(s)}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                      title="Inserir como prompt"
                    >
                      ▸ {s.length > 70 ? s.slice(0, 70) + "…" : s}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 max-h-[55vh] space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Selecione um agente acima e envie sua primeira instrução de código.
                  </div>
                )}
                {messages.map((m) => {
                  const isUser = m.agent === "user";
                  return (
                    <div key={m.id} className={cn("flex flex-col gap-1", isUser && "items-end")}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium uppercase">{m.agent}</span>
                        {m.model && <span>· {m.model}</span>}
                        {m.promoted_for_deploy && (
                          <Badge variant="default" className="text-[10px]">
                            <Rocket className="mr-1 h-3 w-3" /> deploy
                          </Badge>
                        )}
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 max-w-[90%]",
                          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm">{renderConsoleMessageContent(m)}</p>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{renderConsoleMessageContent(m)}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {m.destructive_warning && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive max-w-[90%]">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{m.destructive_warning}</span>
                        </div>
                      )}
                      {!isUser && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => promote(m.id)}>
                            <Rocket className="mr-1 h-3 w-3" /> Promover
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deployingId === m.id}
                            onClick={() => void previewFiles(m.id)}
                          >
                            Pré-visualizar arquivos
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!deploymentPlans[m.id]?.files.length || deployingId === m.id}
                            onClick={() => void applyFiles(m.id)}
                          >
                            <TerminalSquare className="mr-1 h-3 w-3" /> Aplicar na branch
                          </Button>
                          {deploymentPlans[m.id]?.repo && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://github.com/${deploymentPlans[m.id].repo}/compare/${deploymentPlans[m.id].baseBranch ?? "main"}...${deploymentPlans[m.id].branch}`, "_blank", "noopener")}
                            >
                              <Github className="mr-1 h-3 w-3" /> Comparar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const copied = await copyText(m.content);
                              if (copied) toast.success("Copiado");
                              else toast.error("Nao foi possivel copiar neste navegador");
                            }}
                          >
                            Copiar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {busy && (
                  <div className="text-xs text-muted-foreground animate-pulse">
                    {AGENT_META[agent].label} pensando…
                  </div>
                )}
              </div>

              <div className="border-t pt-3 flex gap-2">
                <Textarea
                  placeholder={`Pergunte ao ${AGENT_META[agent].label}…  (Ctrl/Cmd+Enter envia)`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  className="min-h-[80px]"
                  disabled={!activeId || busy}
                />
                <Button onClick={() => void send()} disabled={!activeId || busy || !prompt.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
