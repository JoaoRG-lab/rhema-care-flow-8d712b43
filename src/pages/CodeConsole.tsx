import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Github, Plus, Rocket, Send, Sparkles, Trash2, Bot, Code2, Search, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Agent = "user" | "chatgpt" | "codex" | "perplexity" | "custom" | "sentinel";

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

const AGENT_META: Record<Exclude<Agent, "user" | "sentinel">, { label: string; icon: typeof Bot; hint: string }> = {
  chatgpt: { label: "ChatGPT", icon: Sparkles, hint: "GPT-5 — generalista" },
  codex: { label: "Codex", icon: Code2, hint: "GPT-5.4 — código profundo" },
  perplexity: { label: "Perplexity", icon: Search, hint: "Sonar Pro — com fontes" },
  custom: { label: "Custom API", icon: KeyRound, hint: "Sua chave / endpoint OpenAI-compat." },
};

export default function CodeConsole() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agent, setAgent] = useState<Exclude<Agent, "user" | "sentinel">>("chatgpt");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [githubUrl, setGithubUrl] = useState(localStorage.getItem("cc.githubUrl") ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load threads
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error } = await supabase
        .from("code_console_threads")
        .select("id, title, deploy_agent, updated_at")
        .order("updated_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        return;
      }
      setThreads(data as Thread[]);
      if (!activeId && data && data.length > 0) setActiveId(data[0].id);
      if (data && data.length === 0) await createThread();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        toast.error(error.message);
        return;
      }
      setMessages(data as Message[]);
    })();
  }, [activeId]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, [messages, busy]);

  async function createThread() {
    const { data, error } = await supabase
      .from("code_console_threads")
      .insert({ title: "Nova sessão", user_id: user!.id })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setThreads((t) => [data as Thread, ...t]);
    setActiveId((data as Thread).id);
    setMessages([]);
  }

  async function deleteThread(id: string) {
    if (!confirm("Apagar esta sessão e todas as mensagens?")) return;
    const { error } = await supabase.from("code_console_threads").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
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

    const { data, error } = await supabase.functions.invoke("code-console-chat", {
      body: { threadId: activeId, prompt: text, agent },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
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
    await supabase.from("code_console_messages").update({ promoted_for_deploy: false }).eq("thread_id", activeId!);
    await supabase.from("code_console_messages").update({ promoted_for_deploy: true }).eq("id", messageId);
    await supabase.from("code_console_threads").update({ deploy_agent: target.agent }).eq("id", activeId!);
    toast.success(`Promovido para deploy: ${target.agent}`);
    const { data: refreshed } = await supabase
      .from("code_console_messages")
      .select("*")
      .eq("thread_id", activeId!)
      .order("created_at", { ascending: true });
    if (refreshed) setMessages(refreshed as Message[]);
    setThreads((t) => t.map((x) => (x.id === activeId ? { ...x, deploy_agent: target.agent } : x)));
  }

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  function saveGithubUrl(v: string) {
    setGithubUrl(v);
    localStorage.setItem("cc.githubUrl", v);
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
                          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
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
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => promote(m.id)}>
                            <Rocket className="mr-1 h-3 w-3" /> Promover p/ deploy
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(m.content);
                              toast.success("Copiado");
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
