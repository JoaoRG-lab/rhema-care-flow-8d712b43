# Plano de Migração — JoaoRG-lab/rhema-care-flow → projeto atual

## Observação importante sobre o repositório de origem

Não consigo acessar `https://github.com/JoaoRG-lab/rhema-care-flow` diretamente daqui (sem credenciais Git nem fetch autenticado para esse repo privado/org). Este plano define **a estratégia e a classificação por categoria de arquivo**, para que você cole os arquivos do GitHub em lotes e eu aplique a regra correta a cada um, sem quebrar o app.

Se o repo for público, posso tentar buscar via fetch — me confirme e eu testo. Caso contrário, seguimos pelo fluxo de colagem por lotes descrito abaixo.

---

## 1. Princípios da migração (não-negociáveis)

1. **Nunca sobrescrever arquivos auto-gerados**: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, `supabase/config.toml` (chave `project_id`).
2. **Nunca expor secrets**: se vier algo com chave/token no código colado, substituo por `import.meta.env.*` ou movo para secret do backend.
3. **Preservar arquitetura já criada** no projeto atual (carrossel de codificação, rotas, contexts, hooks, edge functions, componentes de specialty, blockchain, etc).
4. **Edits cirúrgicos** (search-replace) em vez de rewrites, sempre que possível.
5. **Sem mudanças destrutivas sem justificativa** explícita registrada na resposta.

---

## 2. Classificação por categoria de arquivo

Cada arquivo que você colar entra em uma destas 5 buckets:

### A. MANTER (não tocar no atual, ignorar versão do GitHub)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`, `.env.example` (a menos que falte uma chave nova)
- `supabase/config.toml` (apenas adicionar blocos `[functions.*]` se necessário; nunca trocar `project_id`)
- `package-lock.json` / `bun.lockb`
- `src/main.tsx` (já configurado para Lovable)

### B. MERGE (combinar atual + GitHub, preservando o que já existe)
- `src/App.tsx` — adicionar rotas que faltam, manter as existentes
- `src/index.css` / `tailwind.config.ts` — unir design tokens; nunca sobrescrever paleta Teal/Sage/Forest/Gold já definida
- `src/i18n/locales/*.json` — merge profundo de chaves
- `src/contexts/*.tsx` — comparar API pública; preservar campos já consumidos
- `src/config/specialties.ts` — unir specialties dos dois lados
- `README.md`, `CONTRIBUTING.md`, `SYNC.md`, `docs/*.md`

### C. SUBSTITUIR (versão do GitHub é a canônica, atual está defasada)
- Componentes/páginas que existem nos dois mas a versão do GitHub é mais nova → substituir após eu confirmar diff
- Edge functions que existem nos dois → substituir somente após validar que assinatura (`req`/`res`, secrets usados) é compatível
- `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/*`, `.github/mirror-targets.json`

### D. ADICIONAR (não existe no atual, criar novo)
- Arquivos do GitHub sem equivalente local → criar exatamente no mesmo path
- Novas migrations `supabase/migrations/*.sql` → adicionar via tool de migration (nunca escrever direto)
- Novas edge functions → criar em `supabase/functions/<nome>/index.ts`

### E. REJEITAR (não trazer para cá)
- Arquivos com secrets hardcoded
- Configurações que conflitam com Lovable Cloud (ex: outro `SUPABASE_URL`)
- Workflows GitHub Actions que tentem mexer em deploy do Lovable
- `node_modules/`, `dist/`, `build/`, `.next/`

---

## 3. Ordem recomendada de colagem (lotes)

Para minimizar quebra, cole nesta ordem:

```text
Lote 1 — Fundação
  package.json, tsconfig*.json, vite.config.ts, tailwind.config.ts,
  postcss.config.js, eslint.config.js, components.json, index.html

Lote 2 — Design system
  src/index.css, src/App.css, docs/design-tokens.json

Lote 3 — Roteamento e contexts
  src/App.tsx, src/main.tsx (apenas comparar),
  src/contexts/*.tsx

Lote 4 — Config e tipos
  src/config/*.ts, src/types/*.ts, src/i18n/**

Lote 5 — Hooks e libs
  src/hooks/*.ts, src/lib/*.ts

Lote 6 — Componentes (por subpasta)
  src/components/layout/**, depois auth, brand, dashboard, clinical,
  scores, education, knowledge, manuscript, prescriptions, teleconsulta,
  blockchain, ai, verification, billing, calendar, outreach, quality-test

Lote 7 — Páginas
  src/pages/*.tsx

Lote 8 — Backend
  supabase/functions/**, supabase/migrations/** (via tool de migration)

Lote 9 — Anchor / Solana
  anchor/**, src/idl/*.json, src/lib/solana.ts

Lote 10 — Infra / docs
  .github/**, docs/**, *.md, vercel.json, deploy-anchor.sh
```

A cada lote eu:
1. Identifico bucket (A–E) por arquivo.
2. Mostro o que vai mudar **antes** de editar.
3. Aplico edits cirúrgicos.
4. Sigo para o próximo lote só após sua confirmação.

---

## 4. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebra de rotas existentes | Merge em `App.tsx`, nunca substituir cego |
| Conflito de schema Supabase | Migrations vão pela tool de migration, com revisão |
| Perda de design tokens da paleta Teal/Sage/Forest/Gold | `tailwind.config.ts` e `index.css` em modo MERGE |
| Tipos `Database` desalinhados | `types.ts` é regenerado automaticamente — nunca tocar |
| Edge functions com secrets diferentes | Listar secrets esperados antes de substituir |
| Versões de deps incompatíveis | `package.json` em MERGE; instalo deps faltantes uma a uma |
| Migrations duplicadas | Comparar timestamps; pular migrations já aplicadas |
| Quebra do carrossel de codificação | Páginas/components do carrossel ficam em bucket A (não tocar) até você marcar explicitamente |

---

## 5. O que eu preciso de você agora

Responda com **um destes**:

1. **"Lote 1"** + cole os arquivos do Lote 1 do repo GitHub (um por mensagem ou em bloco, com o path antes de cada).
2. **"Repo público, pode buscar"** — tento fetch direto e classifico os arquivos automaticamente.
3. **"Comece por X"** — se quiser priorizar uma área específica (ex: só `src/App.tsx` e rotas).

Sem isso, não posso começar a editar — preciso ver o código de origem para classificar cada arquivo na bucket certa.