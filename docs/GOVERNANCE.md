# Governance — UHS Health OS

Promovido e adaptado de `docs/legacy/AGENTS.md` (snapshot rhema-care-flow) à arquitetura atual.

A regra de ouro do snapshot original permanece válida: **um agente, uma issue, uma branch, um PR**. Mas o fluxo TMR/Vercel/GitHub Actions descrito no legado **não é mais canônico** — o pipeline atual é Lovable + Lovable Cloud + Solana devnet.

---

## Domínio canônico

- **Produção:** `rhema-care-flow.lovable.app` (publicado pelo Lovable)
- **Preview:** `id-preview--<id>.lovable.app`
- **Backend:** Lovable Cloud (Supabase managed) — projeto `rqaqdhmdeyzyjglhxrne`
- **Custom domains:** gerenciados em Lovable → Publish → Custom Domain

> Os domínios `reumatismos.com` / `orientanovvs.org` e a infra Vercel descritos no AGENTS legado pertencem a um estágio anterior. Não usar como fonte da verdade.

---

## Agentes & escopos (adaptado)

| Agente | Escopo principal |
|---|---|
| **Lovable** | UI, design system, shadcn, animações, integração entre features |
| **Claude / Codex** | Componentes React, hooks, edge functions, refactor TS |
| **Perplexity / Sentinel** | Mineração de literatura, AI Knowledge QA (Judge/Sentinel) |
| **Grok** | Solana program (`urv_privacy`), Anchor, scripts Rust |
| **AI Guardian** | Manutenção autônoma do site, scheduler 24/7 |
| **DevOps** | Segredos, custom domains, RLS RESTRITIVA, auditoria |

---

## Regras invioláveis

1. **Nunca** editar `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env` — são auto-gerados.
2. **Nunca** colocar PHI/PII on-chain. Solana só recebe `[u8;32]` + enums + URIs.
3. **Nunca** checar role admin no cliente. Sempre `has_role()` em SECURITY DEFINER.
4. **Nunca** dois agentes editam o mesmo arquivo em paralelo.
5. **Toda** edge function sensível: JWT verify + rate limit + Zod.
6. **Toda** tabela com dado clínico: RLS RESTRITIVA + audit log imutável.

---

## Arquivos protegidos (revisão obrigatória)

- `supabase/migrations/*` (qualquer migration nova)
- `supabase/functions/hardware-custody-auth/`
- `supabase/functions/audit-data-export/`
- `anchor/programs/urv_privacy/src/lib.rs`
- `src/contexts/AuthContext.tsx`, `AccountTypeContext.tsx`
- `src/lib/crypto.ts`, `solana.ts`, `patientChainAnchor.ts`
- `vercel.json` (security headers)
- `docs/SECURITY.md`

---

## Pré-PR (mínimo universal)

- [ ] Sem segredos, tokens ou chaves privadas no diff
- [ ] Sem PHI em logs ou em colunas não criptografadas
- [ ] RLS habilitada e testada em qualquer tabela nova
- [ ] Componentes usam tokens semânticos (sem cor hard-coded)
- [ ] i18n: chaves novas adicionadas aos 7 locales (ar, en, es, fr, pt, ru, zh)
- [ ] Edge function nova: JWT + Zod + rate limit + invokeEdgeFn no cliente

---

## Snapshot legado preservado

O AGENTS.md / SECRETS.md / TMR_AUDITOR.md originais foram preservados em `docs/legacy/` como contexto histórico. **Não restaurar configs daqui sem revisão.**
