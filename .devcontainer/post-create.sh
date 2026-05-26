#!/usr/bin/env bash
set -euo pipefail

echo "→ Instalando Supabase CLI..."
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | tar -xz -C /tmp && sudo mv /tmp/supabase /usr/local/bin/

echo "→ Instalando dependências do projeto..."
npm install -g bun
bun install || npm install

echo "→ Helper de bridge instalado em ~/bin/bridge"
mkdir -p ~/bin
cat > ~/bin/bridge <<'SH'
#!/usr/bin/env bash
# uso: bridge read|write|delete|list <path> [<file-com-conteudo>] [-m "msg"]
set -euo pipefail
OP="$1"; PATH_ARG="$2"; shift 2
URL="${AGENT_BRIDGE_URL:?defina AGENT_BRIDGE_URL}"
TOKEN="${AGENT_BRIDGE_TOKEN:?defina AGENT_BRIDGE_TOKEN}"
BODY="{\"op\":\"$OP\",\"path\":\"$PATH_ARG\",\"agent\":\"codespace\""
if [ "$OP" = "write" ] && [ -n "${1:-}" ]; then
  CONTENT=$(jq -Rs . < "$1")
  BODY="$BODY,\"content\":$CONTENT"
  shift || true
fi
if [ "${1:-}" = "-m" ]; then BODY="$BODY,\"message\":\"$2\""; fi
BODY="$BODY}"
curl -sS -X POST "$URL" \
  -H "X-Agent-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" | jq .
SH
chmod +x ~/bin/bridge
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc

echo "✓ Codespace pronto. Use: bridge write sandbox/foo.ts ./local.ts -m 'codespace: foo'"
