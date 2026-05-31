import CodeAgentDryRunPanel from "@/components/ai/CodeAgentDryRunPanel";

export default function AIIntegrationPage() {
  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">AI Integration — Code Editor Agent</h1>
        <p className="text-sm text-muted-foreground">
          Fluxo seguro: dry-run → revisão → confirmação "CRIAR PR" → draft PR.
        </p>
      </header>
      <CodeAgentDryRunPanel />
    </div>
  );
}
