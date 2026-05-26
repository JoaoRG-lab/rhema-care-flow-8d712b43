# Sandbox — Área Isolada para Agentes Externos

Este diretório é uma **zona franca**. Tudo que estiver aqui:

- **NÃO é importado** por `src/` (zero impacto no build de produção)
- **NÃO é deployado** pelo Lovable/Vercel
- Pode ser editado livremente por ChatGPT, Codex, Perplexity, Claude, Grok via o endpoint `agent-bridge`
- Serve como **rascunho** antes de promover algo para `src/`

## Como agentes externos escrevem aqui

```bash
curl -X POST https://rqaqdhmdeyzyjglhxrne.supabase.co/functions/v1/agent-bridge \
  -H "X-Agent-Token: $AGENT_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "write",
    "path": "sandbox/experiments/foo.ts",
    "content": "export const foo = 42;",
    "message": "chatgpt: experiment foo",
    "agent": "chatgpt"
  }'
```

## Promover para produção

Quando um arquivo estiver pronto, mova-o de `sandbox/` para `src/` via:
- Lovable (peça "mover sandbox/experiments/foo.ts para src/lib/foo.ts")
- ou via `agent-bridge` com `op: "write"` no path final + `op: "delete"` no path do sandbox

## Branch dedicada (opcional, recomendado)

Para isolar ainda mais, configure o secret `GITHUB_BRANCH=agent-sandbox` no Vault.
Aí todos os commits do `agent-bridge` vão para a branch `agent-sandbox` em vez de `main`.
Lovable continua puxando `main` — você faz merge manual quando quiser promover.

Para criar a branch (uma única vez, no GitHub):
```bash
git checkout main && git pull
git checkout -b agent-sandbox
git push -u origin agent-sandbox
```

## Codespace

Um `.devcontainer/` está configurado na raiz do repo. Abra um Codespace em
`agent-sandbox` e você terá Node, Deno, Supabase CLI e MCP servers prontos.
