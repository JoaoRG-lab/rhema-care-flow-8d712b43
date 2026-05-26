# Security — UHS Health OS

Documento canônico de postura de segurança. Promovido e adaptado de `docs/legacy/SECURITY.md` (snapshot rhema-care-flow) à arquitetura atual: Lovable Cloud + Solana devnet + AES-256 + RLS RESTRITIVA + Edge Functions com JWT.

Para reportar vulnerabilidade: abrir issue privada ou contatar o mantenedor diretamente. **Nunca** divulgar exploit publicamente antes de patch.

---

## 1. Princípios não-negociáveis

1. **Zero PHI/PII on-chain.** Solana armazena apenas SHA-256, URIs e enums. Qualquer payload que pareça identificador direto é rejeitado.
2. **Codes-only.** Pacientes são referenciados por Patient Code ou últimos 4 dígitos do MRN. Nunca nome, CPF, e-mail ou telefone em colunas indexáveis sem AES-256.
3. **RLS RESTRITIVA em toda tabela com dado clínico.** Default deny. Acesso via `has_role(auth.uid(), 'role')` em SECURITY DEFINER.
4. **Audit logs imutáveis.** Triggers negam `UPDATE` e `DELETE` em tabelas de auditoria.
5. **Hardware-bound admin.** Ultimate Persona exige Ledger + Blind Signing. Sem fallback por senha.
6. **Edge Functions sempre verificam JWT, rate-limit e validam input com Zod.**

---

## 2. Cabeçalhos HTTP (`vercel.json`)

| Header | Valor | Propósito |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; …` (ver `vercel.json`) | Bloqueia XSS / injeção |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS 2 anos |
| `X-Frame-Options` | `DENY` | Impede clickjacking |
| `X-Content-Type-Options` | `nosniff` | Impede MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limita vazamento de URL |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=()` | Menor privilégio (mic só p/ teleconsulta) |
| `X-XSS-Protection` | `1; mode=block` | Defesa legada |

Headers de assets recebem `Cache-Control: public, max-age=31536000, immutable`.

---

## 3. Autenticação

- **Lovable Cloud Auth** (Supabase Auth managed) — JWT RS256.
- Provedores: email/password + Google. SAML SSO disponível para enterprise.
- **Leaked Password Protection (HIBP)** habilitado.
- `AuthContext.tsx` é o único provider; nunca ler `localStorage` diretamente para checar identidade.
- **NUNCA** checar admin via `localStorage`, `sessionStorage` ou comparação hard-coded de UID. Sempre `has_role()` server-side.
- Roles armazenadas em `user_roles` (tabela separada) — nunca em `profiles`.

---

## 4. Criptografia

- **AES-256-GCM** para qualquer coluna com PII em repouso (nome legal, documento, contato).
- Secure views com `security_invoker=on` para garantir que RLS da tabela base seja avaliada com o JWT do chamador.
- Chave de criptografia em secret do backend (`AES_ENCRYPTION_KEY`), nunca em `.env` do cliente.
- Export administrativo de auditoria via função `audit-data-export` empacota PII em manifests AES-256-GCM antes de entregar.

---

## 5. Blockchain (Solana devnet — URV Privacy Anchor)

- Apenas `[u8;32]` (SHA-256), URIs públicos e enums fechados (`PurposeCode`, `LegalBasisCode`, `EventType`).
- Heurística "no-PII" rejeita: e-mails, sequências longas de dígitos, espaços em scope codes.
- Toda operação sensível assinada com Ed25519 do ator. `BREAK_GLASS` exige justificativa codificada e é auditada.
- Veja `anchor/programs/urv_privacy/src/lib.rs` para invariantes do programa.

---

## 6. Edge Functions

Padrão obrigatório (memória `architecture/edge-function-standards`):

1. `Authorization: Bearer <jwt>` verificado no início de toda função sensível.
2. Rate limit por `user_id` ou IP.
3. Validação de payload com **Zod** antes de qualquer side-effect.
4. Cliente sempre invoca via `invokeEdgeFn` (helper em `src/lib/invokeEdgeFn.ts`).
5. Helpers de referência arquivados em `docs/legacy/edge-helpers-reference/` — **não importar** em funções vivas; padrão atual é canônico.

---

## 7. Acesso público intencional

Apenas estas rotas bypassam autenticação:

- `/learn` — biblioteca educacional de pacientes
- `/scores` — calculadoras clínicas
- `/about`, `/case-studies`, `/quality-test`, `/chain-demo`, `/tell-us`, `/style-guide`, `/article-builder`, `/urv`, `/especialidades`, `/specialty/:id`, portais de especialidade

Tudo mais exige login (`ProtectedRoute` / `ClinicianRoute` / `PatientRoute`).

---

## 8. Secrets

- Frontend: apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (publishable/anon, OK em código).
- Backend (Edge Function secrets): `RESEND_API_KEY`, `LOVABLE_API_KEY`, `MEMED_*`, `SUMSUB_*`, `MERCADOPAGO_*`, `AES_ENCRYPTION_KEY`, `GUARDIAN_*`, etc.
- **Nunca** colocar chave privada / token de API no cliente.
- Rotação documentada em `docs/legacy/github/SECRETS.md` (referência histórica).

---

## 9. Vulnerabilidades & Auditoria

- `npm audit` rodado periodicamente; vulns `high`/`critical` bloqueiam deploy.
- Linter Supabase rodado em toda migration.
- Audit logs (`audit_events`) imutáveis e exportáveis apenas pela Ultimate Persona.

---

## 10. O que **nunca** deve acontecer

- PHI em coluna não criptografada acessível por RLS permissiva
- Role de admin checada client-side
- Edge function sensível sem `verify_jwt`
- Hash de paciente reusado entre instituições sem salt
- Solana program aceitando string com e-mail ou sequência longa de dígitos
- Audit log alterado ou deletado
- Ledger admin contornado por senha
