# AI Integration (MCP)

Centralized integration layer that lets authorized AI clients (ChatGPT, Claude,
Codex, etc.) talk to the RheumaFlow / Rhema Care Flow app through the app's
existing MCP endpoint.

## Endpoint

Default: `${SUPABASE_URL}/functions/v1/mcp`

Override at build time with:

```
VITE_MCP_ENDPOINT=https://<host>/functions/v1/mcp
```

Only `https://` URLs are accepted.

## Architecture

- `src/lib/mcp/client.ts` — typed JSON-RPC client (initialize, tools/list,
  tools/call), timeouts, retry for transient errors, dedupe of concurrent
  requests, normalized `MCPError`, and a `testConnection` diagnostic.
- `src/lib/mcp/registry.ts` — frontend allowlist of tools with categories
  (`public`, `authenticated`, `administrative`, `clinical-restricted`,
  `disabled`). Unknown tools default to disabled.
- `src/lib/mcp/eventLog.ts` — in-memory, privacy-safe event log
  (type/success/latency/category only, no payloads).
- `src/components/settings/AIIntegrationPanel.tsx` — administration UI in
  `/settings`.
- `src/components/settings/AIIntegrationStatusIndicator.tsx` — discreet status
  indicator; session-cached to avoid polling.

## Authentication flow

1. User signs in via the existing Supabase auth flow.
2. Client reads `supabase.auth.getSession()`.
3. Each MCP JSON-RPC request is sent with
   `Authorization: Bearer <supabase-access-token>`.
4. The MCP edge function validates the OAuth token and enforces its own
   per-tool authorization.

No tokens, service-role keys, or API keys are stored in the frontend,
localStorage, or committed files.

## Connection states

`idle`, `connecting`, `connected`, `unauthorized`, `unavailable`, `error`.

## Safe operational tools (invocable)

`whoami`, `health`, `ping`, `app_status`, `integration_health`, `open_module`,
`navigation_command`, `get_public_config`.

## Restricted (never callable from the UI)

`list_patients` and any other clinical/PHI-bearing tool. Kept in the registry
as `clinical-restricted` and disabled until consent, audit logging, and
access-control policies land.

## Role gating

`AIIntegrationPanel` and `AIIntegrationStatusIndicator` are rendered only for:

- users with the `admin` role in `user_roles`, or
- the project owner email (`ULTIMATE_USER_EMAIL`).

Non-admin clinicians see a short "restricted controls" card. Server-side
authorization on the MCP function remains the final security boundary.

## Diagnostic (`testConnection`)

Runs, in order:

1. `initialize`
2. `tools/list`
3. `whoami` (if the server advertises it)

Verifies reachability, auth, protocol parsing, tool discovery, and latency.
Never requests patient data. Returns a mapped human-readable message:

- `Conexão MCP validada via whoami (sem PHI).`
- `Autenticação necessária.`
- `Sessão expirada ou não autorizada.`
- `Servidor MCP indisponível.`
- `Servidor MCP não respondeu a tempo.`
- `Resposta MCP inválida.`

## Local testing

```
npm run test -- mcpRegistry
```

## Production validation

1. Sign in as an admin user.
2. Open `/settings` → "Integração de IA (MCP)".
3. Click "Conectar & testar". Expect `Conectado` badge and identity block.
4. Click "Atualizar ferramentas" — the discovered list refreshes.

## Adding a new safe operational tool

1. Ship the tool in the MCP edge function.
2. Register it in `src/lib/mcp/registry.ts` with `enabled: true` and the
   correct `category` / `sensitivity` (never `clinical`).
3. If it needs custom UI, invoke it via `callTool(name, args)` from
   `@/lib/mcp/client`.

## Known limitations

- Discovery only surfaces tools that appear in both the MCP server output and
  the frontend registry.
- The status indicator uses a 5-minute session cache to avoid polling; use the
  "Reconectar & testar" button for a fresh probe.
- Clinical tools remain disabled by policy pending consent/audit work.
