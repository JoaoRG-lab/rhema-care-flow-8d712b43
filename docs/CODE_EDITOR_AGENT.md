# Code Editor Agent

Fluxo seguro de edição de arquivo único em repositórios autorizados, com
**dry-run obrigatório**, confirmação textual e criação de **draft PR**.
Sem auto-merge, sem push direto em `main`.

## Repositórios autorizados

Hardcoded no edge function e no painel (allow-list, não aceita repo arbitrário):

- `JoaoRG-lab/rhema-care-flow`
- `JoaoRG-lab/rhema-care-flow-8d712b43`

## Secrets necessários (Supabase Edge Function Secrets)

| Secret | Uso |
|---|---|
| `GITHUB_PAT` | Token GitHub com escopo `repo` para criar branch, commit e PR |
| `CONSOLE_ALLOWED_EMAIL` | Email do operador autorizado (Supabase Auth) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Injetados automaticamente |

## Fluxo

1. Usuário abre `/ai-integration` (ou onde o painel for montado).
2. Seleciona repo da lista, informa caminho e conteúdo.
3. Clica **Dry-run** → função retorna `{ changed, bytes, baseBranch, existingSha }`.
4. Se `changed === true`, aparece o campo de confirmação.
5. Usuário digita exatamente **`CRIAR PR`** e clica **Criar draft PR**.
6. Função cria branch `agent/code-editor/<timestamp>` a partir de `main`,
   faz commit do arquivo e abre PR em modo **draft**.

## Restrições de segurança

- Repos fora da allow-list → `403 Repositório não autorizado`.
- Paths bloqueados: `.env*`, `.git*`, `.github/workflows/`, `supabase/config.toml`,
  paths com `..`, `/` inicial ou `\` inicial.
- Tamanho máximo do arquivo: **500 000 bytes**.
- Branches protegidas (`main`, `master`) nunca recebem commit direto.
- PR sempre criado como **draft** — merge é manual.
- Mensagens de erro removem o `GITHUB_PAT` antes de responder.

## Teste manual

```bash
SUPABASE_URL=https://rqaqdhmdeyzyjglhxrne.supabase.co
TOKEN="<access_token do usuário autorizado>"

# 1) Dry-run
curl -s "$SUPABASE_URL/functions/v1/code-editor-agent" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"dry-run","repo":"JoaoRG-lab/rhema-care-flow","path":"docs/PING.md","content":"ping\n"}'

# 2) Criar draft PR (após revisão do dry-run)
curl -s "$SUPABASE_URL/functions/v1/code-editor-agent" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"create-pr","confirm":"CRIAR PR","repo":"JoaoRG-lab/rhema-care-flow","path":"docs/PING.md","content":"ping\n"}'
```

Resposta esperada do create-pr inclui `branch`, `commitSha`, `pullRequest.url`
e `pullRequest.draft: true`.

## Função relacionada

`verify-mirror-access` continua disponível para validar que um PAT tem push
nos repos da allow-list antes de configurar `GITHUB_PAT`.
