import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/hooks/useAuth';
import { isUltimateUserEmail } from "@/lib/ultimateUser";
import {
  Activity,
  Bot,
  BrainCircuit,
  Cloud,
  Code2,
  DatabaseZap,
  ExternalLink,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

const engines = [
  {
    id: "local",
    title: "Local WSL",
    status: "ativo",
    icon: TerminalSquare,
    tone: "text-emerald-600",
    description: "Motor principal de codificação, testes, build, ADR e handoff local.",
    command: "npm run engine:local && npm run quality:gate",
  },
  {
    id: "hf",
    title: "Hugging Face Jobs",
    status: "bancada",
    icon: BrainCircuit,
    tone: "text-amber-600",
    description: "Auditoria pública/de-identificada para propostas clínicas e UX.",
    command: "hf jobs uv run scripts/hf_clinical_improvement_job.py",
  },
  {
    id: "replit",
    title: "Replit",
    status: "preview",
    icon: Code2,
    tone: "text-sky-600",
    description: "Espelho interativo para prototipagem e recuperação de ideias.",
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
  },
  {
    id: "netlify",
    title: "Netlify",
    status: "preview",
    icon: Cloud,
    tone: "text-teal-600",
    description: "Preview estático e artifact mirror, sem substituir o deploy canônico.",
    command: "npm ci && npm run build",
  },
  {
    id: "hex",
    title: "Hex",
    status: "analytics",
    icon: DatabaseZap,
    tone: "text-violet-600",
    description: "Notebooks com métricas de qualidade, bioestatística e cobertura clínica.",
    command: "import rhema-continuous-engine JSON",
  },
];

export default function EngineOps() {
  const { user } = useAuth();
  const allowed = isUltimateUserEmail(user?.email) || user?.app_metadata?.ultimate_user === true;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-destructive" />
              Engine Ops restrito
            </CardTitle>
            <CardDescription>Este painel é reservado ao usuário ultimate.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/dashboard">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              Rhema AI Engine Mesh
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Motor de melhoria contínua</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Ambientes locais e cloud para propor, auditar e validar melhorias sem depender de uma única IA ou de deploy automático.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/code-console">
                <Code2 className="mr-2 h-4 w-4" />
                Code Console
              </Link>
            </Button>
            <Button asChild>
              <Link to="/quality-test">
                <Activity className="mr-2 h-4 w-4" />
                ADR Gate
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Modo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">proposal-first</p>
              <p className="text-xs text-muted-foreground">Sem deploy automático</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ADR mínimo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">0.90</p>
              <p className="text-xs text-muted-foreground">Bloqueia produção abaixo disso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Privacidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">No PHI</p>
              <p className="text-xs text-muted-foreground">Só dados públicos ou sintéticos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Destino</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">GitHub PR</p>
              <p className="text-xs text-muted-foreground">Rastro antes de merge</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {engines.map((engine) => {
            const Icon = engine.icon;
            return (
              <Card key={engine.id} className="overflow-hidden">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                      <Icon className={`h-5 w-5 ${engine.tone}`} />
                    </div>
                    <Badge variant="secondary">{engine.status}</Badge>
                  </div>
                  <div>
                    <CardTitle className="text-base">{engine.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{engine.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <code className="block rounded-md bg-muted px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    {engine.command}
                  </code>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Trava operacional
            </CardTitle>
            <CardDescription>O motor pode pensar e preparar código, mas a produção continua protegida.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <GitBranch className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Branch antes de main</p>
              <p className="mt-1 text-xs text-muted-foreground">Toda melhoria sai por branch/PR com logs.</p>
            </div>
            <div className="rounded-lg border p-3">
              <Activity className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-medium">ADR antes de deploy</p>
              <p className="mt-1 text-xs text-muted-foreground">Typecheck, lint, tests, build, Deno e secret scan.</p>
            </div>
            <div className="rounded-lg border p-3">
              <ExternalLink className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Clouds como bancada</p>
              <p className="mt-1 text-xs text-muted-foreground">HF, Replit, Netlify e Hex geram propostas, não substituem o canônico.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
