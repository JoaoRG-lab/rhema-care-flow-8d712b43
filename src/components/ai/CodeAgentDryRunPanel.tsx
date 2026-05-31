import { useState } from "react";
import { invokeEdgeFn } from "@/lib/invokeEdgeFn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ALLOWED_REPOS = [
  "JoaoRG-lab/rhema-care-flow",
  "JoaoRG-lab/rhema-care-flow-8d712b43",
] as const;

const CONFIRM_PHRASE = "CRIAR PR";

interface DryRunDiff {
  repo: string;
  path: string;
  mode: string;
  changed: boolean;
  bytes: number;
  previousBytes: number;
  baseBranch: string;
  existingSha: string | null;
}

interface AgentResponse {
  ok?: boolean;
  dryRun?: DryRunDiff;
  branch?: string;
  commitSha?: string;
  commitUrl?: string;
  pullRequest?: { number: number; url: string; draft: boolean };
  message?: string;
}

export default function CodeAgentDryRunPanel() {
  const [repo, setRepo] = useState<string>(ALLOWED_REPOS[0]);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState<"" | "dry" | "pr">("");
  const [result, setResult] = useState<AgentResponse | null>(null);

  async function run(mode: "dry-run" | "create-pr") {
    if (!path.trim()) {
      toast.error("Informe o caminho do arquivo");
      return;
    }
    if (mode === "create-pr" && confirmText.trim() !== CONFIRM_PHRASE) {
      toast.error(`Digite exatamente "${CONFIRM_PHRASE}" para confirmar`);
      return;
    }
    setLoading(mode === "dry-run" ? "dry" : "pr");
    const { data, error } = await invokeEdgeFn<AgentResponse>("code-editor-agent", {
      mode,
      repo,
      path: path.trim(),
      content,
      baseBranch: "main",
      ...(mode === "create-pr" ? { confirm: confirmText.trim() } : {}),
    });
    setLoading("");
    if (error) {
      toast.error(error);
      setResult(null);
      return;
    }
    setResult(data ?? null);
    toast.success(mode === "dry-run" ? "Dry-run concluído" : "Draft PR criado");
  }

  const diff = result?.dryRun;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Code Agent — Dry-run → PR</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Repositório autorizado</Label>
          <Select value={repo} onValueChange={setRepo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALLOWED_REPOS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Caminho do arquivo</Label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="src/components/Example.tsx"
          />
        </div>

        <div className="grid gap-2">
          <Label>Conteúdo</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">{new Blob([content]).size} bytes</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => run("dry-run")} disabled={!!loading} variant="outline">
            {loading === "dry" ? "Analisando..." : "Dry-run"}
          </Button>
        </div>

        {diff && (
          <div className="rounded-md border p-3 space-y-1 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">repo: {diff.repo}</Badge>
              <Badge variant="outline">arquivo: {diff.path}</Badge>
              <Badge variant="outline">modo: {diff.mode}</Badge>
              <Badge variant={diff.changed ? "default" : "secondary"}>
                {diff.changed ? "changed" : "unchanged"}
              </Badge>
              <Badge variant="outline">{diff.bytes} bytes</Badge>
              <Badge variant="outline">base: {diff.baseBranch}</Badge>
            </div>
            {result?.branch && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge>branch: {result.branch}</Badge>
                {result.commitSha && <Badge variant="outline">commit: {result.commitSha.slice(0, 7)}</Badge>}
                {result.pullRequest && (
                  <a
                    className="text-primary underline"
                    href={result.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PR #{result.pullRequest.number} {result.pullRequest.draft ? "(draft)" : ""}
                  </a>
                )}
              </div>
            )}
            {result?.message && <p className="text-muted-foreground">{result.message}</p>}
          </div>
        )}

        {diff?.changed && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Label>Confirmação obrigatória — digite exatamente "{CONFIRM_PHRASE}"</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
            <Button
              onClick={() => run("create-pr")}
              disabled={!!loading || confirmText.trim() !== CONFIRM_PHRASE}
            >
              {loading === "pr" ? "Criando draft PR..." : "Criar draft PR"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Cria branch <code>agent/code-editor/*</code> e abre PR em modo draft contra <code>main</code>.
              Sem auto-merge, sem push direto em branches protegidas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
