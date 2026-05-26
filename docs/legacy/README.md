# Legacy Documentation — rhema-care-flow snapshot

Documentação histórica importada do snapshot público `JoaoRG-lab/rhema-care-flow@main` como **referência arquivada**.

> **Docs vivos** (canônicos, adaptados à arquitetura atual):
> - [`docs/SECURITY.md`](../SECURITY.md) — postura de segurança (promovido daqui)
> - [`docs/GOVERNANCE.md`](../GOVERNANCE.md) — governança multi-agente (promovido daqui)
> - [`docs/SUPABASE_SETUP.md`](../SUPABASE_SETUP.md), [`docs/STYLE_GUIDE.md`](../STYLE_GUIDE.md), [`docs/VERIFICATION.md`](../VERIFICATION.md)

## Status

**Não-canônica.** A fonte da verdade viva é o projeto atual (UHS Health OS universal, 17 especialidades, blockchain Solana, AI Guardian, Hardware Custody, i18n 7 línguas, Memed, Sumsub, Manuscript Foundry, Peer Review, Epidemiological Matrix).

Estes documentos descrevem um estágio anterior focado em reumatologia. Foram preservados por valor de:

- **Governança multi-agente** (`AGENTS.md`, `ai-ecosystem/AGENTS.md`)
- **Comportamento de IA** (`AI_BEHAVIOR.md`)
- **Segurança HTTP/cabeçalhos** (`SECURITY.md`)
- **TMR Deployment Auditor** — Triple Modular Redundancy / BFT (`TMR_AUDITOR.md`)
- **ADRs** — decisões arquiteturais base (`adr/`)
- **Hosting & Scale Layer** (`architecture/HOSTING_SCALE_LAYER.md`)
- **Orquestração** (`orchestration/README.md`)
- **Referência de secrets do GitHub Actions** (`GITHUB_SECRETS_REFERENCE.md`, `github/SECRETS.md`)
- **Backup GitHub Pages** (`github/GITHUB_PAGES_BACKUP.md`)
- **Docs raiz do snapshot** (`root-docs/` — AGENTS, DEPLOY, DEPLOY_INSTRUCTIONS, SETUP, LOVABLE_REPOSITORY_SKILL, `.rhema-canonical.json`)
- **Auditoria PR12** (`docs-extra/AUDIT_REPORT_PR12.md`)
- **Deploy Ubuntu VPS + Cloudflare** (`docs-extra/deploy/ubuntu-vps-cloudflare.md`)
- **Mirror Playbook** (`docs-extra/deployment/MIRROR_PLAYBOOK.md`)
- **Edge helpers de referência** (`edge-helpers-reference/` — auth.ts, cors.ts, rateLimit.ts — NÃO ativos; padrão atual usa `invokeEdgeFn` + Zod)
- **Audit Lab notebook** (`tools/Rhema_Care_Flow_Audit_Lab.ipynb`)

## Política

- ❌ Não consultar como verdade operacional
- ❌ Não restaurar configs daqui sem revisão
- ❌ Edge helpers em `edge-helpers-reference/` são snapshot histórico — não importar em funções vivas
- ✅ Usar como inspiração / contexto histórico
- ✅ Promover trechos para a doc viva (raiz `docs/`) apenas após validação contra arquitetura atual

## Itens do zip rejeitados (regressão / conflito)

Snapshot continha 164 arquivos novos. Importados apenas docs/refs. **Rejeitados:**

- `apps/api/**` — backend Python (stack atual é Deno Edge); viola memória `Technology Stack`
- `apps/web/**` — Vite app paralelo (regressão arquitetural)
- `src/router.tsx`, `src/pages/*Page.tsx`, `src/pages/reumatismos/**` — rotas antigas só-reumato; atual usa 17 specialties
- `src/services/**` — camada de serviço legada; atual usa hooks + edge functions
- `src/lib/{supabase,clinicalScores,healthCycleEngine,medicalKnowledgeBase,aiCycleEngine,codeCycleEngine}.ts` — duplica/conflita com libs atuais
- Componentes legados (`AIAssistant`, `AIDashboard`, `ErrorBoundary`, `AIIntegrationPanel`, `ChatWidget`, `calculadoras/**`, `reumatismos/**`, `seo/SEOHead`, `storage/**`, `Toast*`, `FeedbackWidget`, `NotificationsPanel`, `PatientForm`, `AppShell`) — duplicam shadcn/componentes atuais
- Hooks legados (`useAIStateMachine`, `useCodeAuditor`, `useCodeBuilder`, `useInternalAI`, `useNotifications`, `useProntuario`, `useScores`, `useSupabaseRealtime`, `useSupabaseStorage`, `useToast`) — sobrepõem hooks atuais
- `src/data/{calculadoras,reumatismosGuides}` — substituído por `src/config/specialties.ts`
- `supabase/migrations/**` (12 arquivos) — incompatíveis com 50+ migrations atuais; aplicar quebraria schema
- `supabase/functions/{ai-assistant,ai-chat,create-github-issue}` — substituídos por funções vivas
- Workflows de deploy (`deploy.yml`, `deploy-pages.yml`, `tmr-deploy.yml`, `emergency-deploy.yml`, `preview.yml`, `static.yml`, `main.yml`, `ai-reporter.yml`, `audit-sentinel.yml`, `*.disabled`) — conflitam com pipeline Lovable
- Configs de outras plataformas (`wrangler.toml`, `netlify.toml`, `_headers`, `_redirects`, `public/_redirects`, `public/health.html`, `.vercelignore`, `.replit`, `replit.nix`, `.npmrc`, `.nvmrc`, `.vercel-deploy-trigger`, `.github/tmr-trigger.txt`)
- `tailwind.config.js` — projeto usa `tailwind.config.ts` (TS)
- `.lovable/project.json` — gerenciado pelo Lovable
- Testes do código rejeitado (`src/test/{scores,utils}.test.ts`, `src/tests/**`, `src/lib/__tests__/calculators_v2.test.ts`)

Cherry-pick autorizado em: **Caminho B + cherry-pick aditivo não-destrutivo**, conforme decisão do mantenedor.
