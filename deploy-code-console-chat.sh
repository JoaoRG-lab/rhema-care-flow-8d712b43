#!/usr/bin/env bash
# Deploy da Edge Function code-console-chat no projeto Supabase externo
# rfsaxstpfpigrjyiochi.
#
# Pré-requisitos:
#   - Supabase CLI instalado (https://supabase.com/docs/guides/cli)
#   - Estar logado na conta dona do projeto: `supabase login`
#   - Rodar a partir da raiz do repositório (onde existe a pasta supabase/)
#
# Uso:
#   chmod +x deploy-code-console-chat.sh
#   ./deploy-code-console-chat.sh

set -euo pipefail

PROJECT_REF="rfsaxstpfpigrjyiochi"
FUNCTION_NAME="code-console-chat"

command -v supabase >/dev/null 2>&1 || {
  echo "❌ Supabase CLI não encontrado. Instale: https://supabase.com/docs/guides/cli"
  exit 1
}

if [ ! -d "supabase/functions/${FUNCTION_NAME}" ]; then
  echo "❌ Rode a partir da raiz do repo (não achei supabase/functions/${FUNCTION_NAME})."
  exit 1
fi

echo "🔗 Linkando ao projeto ${PROJECT_REF}..."
supabase link --project-ref "${PROJECT_REF}"

echo "🚀 Deployando ${FUNCTION_NAME}..."
supabase functions deploy "${FUNCTION_NAME}" --project-ref "${PROJECT_REF}"

cat <<'EOF'

✅ Deploy concluído.

Confira os secrets no projeto (Dashboard → Edge Functions → Secrets):
  - LOVABLE_API_KEY
  - KIMI_API_KEY
  - CONSOLE_ALLOWED_EMAIL   (joaooz123@gmail.com)
  - SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY (padrão)

Se o enum ainda não tiver 'kimi', rode no SQL Editor:
  ALTER TYPE code_console_agent ADD VALUE IF NOT EXISTS 'kimi';

Depois recarregue /code-console (Ctrl+Shift+R) e teste com o agente Kimi.
EOF
