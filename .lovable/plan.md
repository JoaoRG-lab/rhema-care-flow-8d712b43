## Situação

O app aponta em `src/integrations/supabase/client.ts` para o projeto Supabase **externo** `rfsaxstpfpigrjyiochi.supabase.co`. As ferramentas de deploy que eu tenho aqui só alcançam o projeto Lovable Cloud desta workspace (outro ref). Por isso todos os redeploys que fiz da `code-console-chat` foram para o projeto errado, e a versão em produção ainda rejeita `agent: "kimi"` com `{"error":"Parâmetros inválidos"}`.

Não consigo fazer o deploy no `rfsaxstpfpigrjyiochi` a partir daqui — não tenho credenciais desse projeto externo. Preciso da sua ajuda em um dos dois caminhos abaixo.

## Caminho A (rápido) — você roda o deploy no projeto externo

1. Em uma máquina com Supabase CLI logada na conta dona do `rfsaxstpfpigrjyiochi`:
   ```
   supabase link --project-ref rfsaxstpfpigrjyiochi
   supabase functions deploy code-console-chat
   ```
2. Confira que os secrets abaixo existem nesse projeto (Dashboard → Edge Functions → Secrets):
   - `LOVABLE_API_KEY`
   - `KIMI_API_KEY`
   - `CONSOLE_ALLOWED_EMAIL` = `joaooz123@gmail.com`
   - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (padrão do projeto)
3. Confira que o enum tem `kimi`:
   ```sql
   SELECT unnest(enum_range(NULL::code_console_agent));
   ```
   Se faltar: `ALTER TYPE code_console_agent ADD VALUE IF NOT EXISTS 'kimi';`
4. Recarregue `/code-console` e teste com o agente Kimi.

Após isso o erro `"Parâmetros inválidos"` some.

## Caminho B — migrar o app para o Lovable Cloud desta workspace

Aponto o cliente para o projeto Lovable Cloud (que eu consigo administrar) e passo a deployar tudo daqui automaticamente. Custo: migração de schema/dados do `rfsaxstpfpigrjyiochi` (pacientes, threads, prontuários, tudo) para o novo projeto — trabalho considerável e sem sincronização retroativa.

## Recomendação

Caminho A resolve o problema hoje sem migração. Me diga qual você prefere; se for A e você quiser, eu preparo um script `deploy-code-console-chat.sh` com os comandos exatos para você rodar.
