## Objetivo

Permitir alternar de forma segura entre o projeto **Lovable Cloud** (`rqaqdhmdeyzyjglhxrne`) e o projeto **externo** (`rfsaxstpfpigrjyiochi`) via variáveis de ambiente, usando o prefixo `SUPABASIS_*` que você já cadastrou nos secrets — sem editar o cliente auto-gerado.

## Contexto verificado

- `src/integrations/supabase/client.ts` é **auto-gerado** e hoje trava no projeto canônico `rfsaxstpfpigrjyiochi`, ignorando `.env` se o project id não bater. Não posso editá-lo.
- O `.env` local aponta para o projeto Lovable Cloud (`rqaqdhmdeyzyjglhxrne`), causando o desalinhamento observado no Code Console.
- Secrets já configurados com prefixo `SUPABASIS_*` (ex.: `SUPABASIS_URL`, `SUPABASIS_JWKS_URL`, `SUPABASES_PUBLI_TOKEN`, `SUPABASES_ACCESS_TOKEN`).

## O que vou fazer (código)

### 1. Novo módulo `src/integrations/supabase/runtime.ts`
Wrapper de runtime que escolhe o projeto ativo sem tocar no arquivo auto-gerado:

- Lê `VITE_SUPABASE_TARGET` (`"cloud"` | `"external"` | `"auto"`, default `auto`).
- Perfil `cloud` → usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (Lovable Cloud).
- Perfil `external` → usa `VITE_SUPABASIS_URL` + `VITE_SUPABASIS_PUBLISHABLE_KEY` (projeto externo).
- Perfil `auto` → detecta pela presença dos `VITE_SUPABASIS_*`.
- Exporta:
  - `activeSupabase` (cliente para o alvo escolhido — reusa `supabase` do arquivo auto-gerado quando o alvo é `external`, ou cria um novo cliente para `cloud`).
  - `activeProjectId`, `activeProjectLabel` para telemetria/UI.

### 2. Adicionar chaves ao `.env` (as `VITE_*` não são secrets)
```
VITE_SUPABASE_TARGET=auto
VITE_SUPABASIS_URL=https://rfsaxstpfpigrjyiochi.supabase.co
VITE_SUPABASIS_PUBLISHABLE_KEY=sb_publishable_J8dthJB66ld8lhRIg4e8SA_ro6sr_na
```
(As `SUPABASIS_*` server-side já existem nos secrets e ficam disponíveis nas Edge Functions.)

### 3. Helper `supabase/functions/_shared/supabasisClient.ts`
Para Edge Functions: lê `SUPABASIS_URL` / `SUPABASE_URL` na ordem correta e retorna o client server-side apropriado, evitando funções deployadas em um projeto chamarem o outro.

### 4. UI mínima em `AIIntegrationPanel.tsx`
Badge mostrando `Projeto ativo: Lovable Cloud` ou `External (rfsaxst…)` a partir de `activeProjectLabel`, para você conferir a olho antes de operar.

### 5. Documentação `docs/SUPABASE_TARGET.md`
Como alternar entre projetos, quais secrets/env correspondem a cada perfil, e o cuidado ao deployar Edge Functions para o alvo certo.

## Sobre os dois comandos que você citou

- `npm install @supabase/server` — **este pacote não existe** no registry npm. O ecossistema oficial expõe `@supabase/supabase-js` (já instalado) e `@supabase/ssr` (usado quando há renderização server-side, o que não é o caso deste app SPA/Vite). Se você quis dizer `@supabase/ssr`, posso adicioná-lo — mas não é necessário para o objetivo acima. Confirme qual pacote você tinha em mente.
- `npx skills add supabase/server` — comando de outro CLI (Claude Code / Cursor). O sandbox da Lovable não roda skills externas assim; skills aqui são gerenciadas em Settings → Skills, e a skill relevante já ativa é `supabase-integration`. Nada a fazer no repositório.

## O que fica de fora

- Não vou editar `src/integrations/supabase/client.ts` (auto-gerado).
- Não vou trocar o alvo padrão sem sua confirmação — o default de `auto` respeita seu `.env` atual (Lovable Cloud) até você setar `VITE_SUPABASE_TARGET=external`.
