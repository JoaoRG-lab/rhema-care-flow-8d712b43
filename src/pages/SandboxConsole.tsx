import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, FileText, Trash2, List, Eye, Lock, Unlock } from "lucide-react";

type Op = "read" | "write" | "list" | "delete";

interface Entry {
  id: string;
  at: string;
  op: Op;
  path: string;
  status: "ok" | "error";
  detail: string;
}

const BRIDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-bridge`;
const TOKEN_KEY = "agent_bridge_token";

export default function SandboxConsole() {
  const [token, setToken] = useState<string>("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [op, setOp] = useState<Op>("read");
  const [path, setPath] = useState("sandbox/");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      setTokenSaved(true);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const saveToken = () => {
    if (!token.trim()) return;
    sessionStorage.setItem(TOKEN_KEY, token.trim());
    setTokenSaved(true);
    toast.success("Token salvo na sessão");
  };

  const clearToken = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenSaved(false);
  };

  const send = async () => {
    if (!tokenSaved) return toast.error("Configure o AGENT_BRIDGE_TOKEN primeiro");
    if (!path.trim()) return toast.error("Path é obrigatório");
    if (op === "write" && !content) return toast.error("Conteúdo vazio");
    if (!path.startsWith("sandbox/") && op !== "read" && op !== "list") {
      const ok = confirm(`Você vai ${op.toUpperCase()} fora de sandbox/. Continuar?`);
      if (!ok) return;
    }

    setBusy(true);
    const body: Record<string, unknown> = { op, path: path.trim(), agent: "console" };
    if (op === "write") body.content = content;
    if (op === "write" || op === "delete") body.message = message || `console: ${op} ${path}`;

    try {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agent-Token": token },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const entry: Entry = {
        id: crypto.randomUUID(),
        at: new Date().toLocaleTimeString(),
        op,
        path: path.trim(),
        status: res.ok ? "ok" : "error",
        detail: res.ok
          ? op === "read"
            ? json.content ?? ""
            : op === "list"
            ? (json.items ?? []).map((i: { path: string; type: string }) => `${i.type === "dir" ? "📁" : "📄"} ${i.path}`).join("\n")
            : `commit ${json.commit_sha?.slice(0, 7) ?? "?"} on ${json.branch}`
          : json.error ?? `HTTP ${res.status}`,
      };
      setEntries((prev) => [...prev, entry]);
      if (res.ok) {
        if (op === "read" && typeof json.content === "string") setContent(json.content);
        if (op === "write" || op === "delete") {
          setContent("");
          setMessage("");
          toast.success(`${op} ok`);
        }
      } else {
        toast.error(entry.detail);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "network error";
      setEntries((prev) => [...prev, { id: crypto.randomUUID(), at: new Date().toLocaleTimeString(), op, path, status: "error", detail: msg }]);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const opIcon = (o: Op) =>
    o === "read" ? <Eye className="h-3 w-3" /> : o === "write" ? <FileText className="h-3 w-3" /> : o === "delete" ? <Trash2 className="h-3 w-3" /> : <List className="h-3 w-3" />;

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Sandbox Console</h1>
        <p className="text-sm text-muted-foreground">
          Interface chat-style para editar arquivos via <code className="text-xs">agent-bridge</code>. Escopo recomendado:{" "}
          <code className="text-xs">sandbox/</code>.
        </p>
      </header>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {tokenSaved ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4 text-destructive" />}
          AGENT_BRIDGE_TOKEN
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="cole o token compartilhado"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={tokenSaved}
          />
          {tokenSaved ? (
            <Button variant="outline" onClick={clearToken}>Trocar</Button>
          ) : (
            <Button onClick={saveToken}>Salvar (sessão)</Button>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col h-[420px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center pt-16">
              Nenhuma operação ainda. Tente <code>list</code> em <code>sandbox</code>.
            </p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={e.status === "ok" ? "default" : "destructive"} className="gap-1">
                  {opIcon(e.op)} {e.op}
                </Badge>
                <span className="font-mono">{e.path}</span>
                <span className="ml-auto">{e.at}</span>
              </div>
              <pre className="text-xs bg-background border rounded p-2 whitespace-pre-wrap max-h-64 overflow-auto font-mono">
                {e.detail || "(vazio)"}
              </pre>
            </div>
          ))}
        </div>

        <div className="border-t p-3 space-y-2 bg-background">
          <div className="flex gap-2">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="read">read</SelectItem>
                <SelectItem value="list">list</SelectItem>
                <SelectItem value="write">write</SelectItem>
                <SelectItem value="delete">delete</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="sandbox/path/to/file.ts"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="font-mono text-sm"
            />
            <Button onClick={send} disabled={busy || !tokenSaved} className="gap-1">
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </div>
          {op === "write" && (
            <>
              <Textarea
                placeholder="conteúdo do arquivo"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs min-h-[120px]"
              />
              <Input
                placeholder="commit message (opcional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </>
          )}
          {op === "delete" && (
            <Input
              placeholder="commit message (opcional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Toda operação é auditada em <code>agent_edits</code>. Arquivos em <code>sandbox/</code> não são incluídos no build.
      </p>
    </div>
  );
}
