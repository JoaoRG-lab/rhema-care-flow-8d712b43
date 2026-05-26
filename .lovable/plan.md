# Plano: A11y → Cron Multi-IA → Memed

## Frente 1 — Acessibilidade (app inteiro)

**Auditoria automatizada + correções em lote.**

1. Rodar varredura estática (ripgrep) sobre `src/` para os padrões da skill `accessibility`:
   - `<img>` sem `alt`
   - `<Button size="icon">` / `IconButton` sem `aria-label`
   - `onClick` em `<div>`/`<span>` sem `role`+`tabIndex`+keyboard handler
   - `h-screen` (trocar por `h-dvh`)
   - `text-gray-*`, `text-white`, `bg-black` (trocar por tokens semânticos)
   - `<input>` sem `<label>` associado nem `aria-label`
   - `autoFocus` fora de Dialog/Sheet
   - múltiplos `<main>` por rota
2. Gerar relatório agrupado por severidade (Critical / Warning / Info), com arquivo:linha.
3. Aplicar correções em ondas:
   - Onda A — Critical (alt, aria-label, semantic roles)
   - Onda B — Warning (h-dvh, headings, focus-visible)
   - Onda C — Info (lang, decorative alt="", lists semânticas)
4. Adicionar `lang="pt-BR"` em `index.html` (se ainda não estiver) e garantir um único `<main>` no layout raiz.

Entregável: PR único com fixes + comentário-resumo no chat.

---

## Frente 2 — Scheduler Multi-IA (rotação + auto-implementação)

**Objetivo:** a cada 5 min uma IA diferente audita o site, propõe melhorias **e** aplica as seguras automaticamente; as arriscadas viram tarefas para revisão.

### 2.1 Esquema de banco

Tabela `ai_improvement_runs`:
- `id`, `agent` (`perplexity|gemini|openai|anthropic|grok|deepseek|groq|openrouter`)
- `started_at`, `finished_at`, `status` (`running|success|error|skipped`)
- `audit_summary` (text), `proposals` (jsonb), `applied_count`, `queued_count`, `error`

Tabela `ai_improvement_tasks`:
- `id`, `run_id`, `agent`, `severity` (`auto|review|blocked`)
- `area` (`a11y|seo|copy|performance|security|i18n|content`)
- `title`, `rationale`, `patch` (jsonb — `{file, find, replace}` ou `{file, content}`)
- `status` (`pending|applied|skipped|failed|needs_review`)
- `applied_at`, `error`
- RLS: leitura para admin, escrita só edge function (service role)

### 2.2 Edge Function `ai-improvement-cycle`

- Lê fila de agentes (round-robin pela `agent` do último run).
- Carrega contexto resumido: lista de rotas, últimos audit logs, `site_visits` recentes, último relatório a11y.
- Chama a IA da vez (cada provider numa branch — tudo via secrets já existentes: `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `GROKKEY`, `DEEPSEEK_API_KEY`, `groq`, `openrouter`).
- IA retorna JSON estrito com `proposals[]` (severity, area, patch).
- **Sentinel filter** (idêntico ao já feito no Code Console): bloqueia patches com `rm -rf`, `DROP`, mudanças em `supabase/migrations`, `src/integrations/supabase/*`, `.env`, workflows, `client.ts`, `types.ts`.
- `severity=auto` + patch text-only em `src/content/**` ou `public/llms.txt` ou microcopy em componentes whitelisted → aplica via Supabase Storage de patches (não temos GitHub aqui, então **as alterações aplicadas viram registros**, não commits — o "deploy" continua sendo via Lovable).
- Demais propostas viram `needs_review` na fila.

> Observação importante: o sandbox Lovable não permite que uma edge function modifique o código-fonte do repositório em runtime. Então "auto-implementar" significa: registrar a proposta + persistir em tabelas de conteúdo dinâmico (`content_overrides`, `llms_txt_overrides`, `seo_meta_overrides`) que o frontend lê em tempo de execução. Mudanças estruturais ficam como tarefa de revisão para o Code Console aplicar.

### 2.3 Agendador `pg_cron`

`*/5 * * * *` chamando a edge function via `net.http_post` (padrão já usado no projeto).

### 2.4 Dashboard `/ai-redundancy`

Página admin com:
- Última execução por agente
- Tabela de propostas (filtro por status/area/severity)
- Botão "Aplicar" / "Rejeitar" para itens `needs_review`
- Heatmap de quem produziu o quê

### 2.5 Conteúdo dinâmico aplicável

Criar tabelas `content_overrides`, `seo_meta_overrides`, `llms_txt_overrides` (key/value, com history) — e hooks no frontend que mesclam esses overrides quando existem.

---

## Frente 3 — Memed (integração completa segundo docs oficiais)

Conforme `mem://integrations/memed`: contratos oficiais, chaves de **homologação**, endpoint `/sinapse-prescricao`, `setPaciente` com campos PT-BR, evento `core:moduleInit`.

### 3.1 Pré-requisito (bloqueia a frente 3)

Precisamos das credenciais oficiais Memed:
- `MEMED_API_KEY` (homologação)
- `MEMED_SECRET_KEY` (homologação)
- `MEMED_ENV` (`homologacao` | `producao`)
- URL oficial da Sinapse (`https://sandbox.api.memed.com.br` em homologação)

Sem essas chaves o módulo carrega mas o `setPaciente` falha com 401. Vou solicitar via `add_secret` antes de codar.

### 3.2 Implementação

- **Edge Function `memed-token`**: emite token de prescritor assinado (server-side), recebe `crm`, `uf`, `cpf_prescritor`, devolve `token` JWT do Memed.
- **Componente `MemedPrescription.tsx`**:
  - Carrega script oficial `https://sandbox.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js`
  - Escuta `core:moduleInit` antes de chamar `MdSinapsePrescricao.event.add`
  - Chama `MdHub.command.send('plataforma.prescricao', 'setPaciente', { ... })` com campos PT-BR (`idExterno`, `nome`, `cpf`, `data_nascimento`, `endereco`, `cidade`, `telefone`)
  - Botão `MdHub.module.show('plataforma.prescricao')`
  - Listener `prescricaoSalva` → persiste em `prescriptions` (tabela nova) e fecha modal
- **Tabela `prescriptions`**: `id`, `user_id` (médico), `patient_card_id`, `memed_prescription_id`, `pdf_url`, `created_at`, RLS por médico.
- **Página `/patient/:id/prescribe`**: render do componente + binding do paciente atual.
- **Documentação**: `docs/integrations/memed.md` com fluxo completo, troubleshooting (CSP, blind‑signing, callbacks), e checklist homologação→produção.

### 3.3 Hardening

- CSP: liberar `sandbox.memed.com.br` e `api.memed.com.br` em `vercel.json`/meta CSP.
- Sanitizar todos campos antes de mandar (CPF só dígitos, telefone E.164, data ISO).
- Logar emissões em `audit_events` (imutável) sem PHI — só `event_type=PRESCRIPTION_ISSUED`, `subject_did_hash`, `actor_did`.

---

## Ordem de execução

1. **A11y** — varredura + correções (sem novas dependências, baixo risco).
2. **Cron multi-IA** — migration de tabelas + edge function + dashboard + pg_cron.
3. **Memed** — solicito secrets, depois edge function + componente + tabela + CSP.

## Riscos / decisões pendentes

- "Auto‑implementar" no Lovable só funciona para conteúdo dinâmico (tabelas/overrides). Mudanças de código continuam exigindo o agente humano/Code Console — vou deixar isso explícito no dashboard.
- Memed exige credenciais reais para sair do "carrega mas não prescreve". Se você não tem ainda, a frente 3 fica como skeleton funcional + doc, pronto para ativar quando as chaves chegarem.

Confirma e eu começo pela Frente 1.