# Alvo do Supabase (Lovable Cloud × Externo)

Este projeto pode apontar para dois back-ends Supabase:

| Perfil     | Project ID              | Uso                                                  |
| ---------- | ----------------------- | ---------------------------------------------------- |
| `cloud`    | `rqaqdhmdeyzyjglhxrne`  | Instância Lovable Cloud (gerenciada pela plataforma) |
| `external` | `rfsaxstpfpigrjyiochi`  | Projeto Supabase externo (canônico do code console)  |

## Frontend

O arquivo `src/integrations/supabase/client.ts` é **auto-gerado** e sempre resolve para o
projeto canônico. Para escolher o alvo em runtime **sem editar esse arquivo**, use
`src/integrations/supabase/runtime.ts`:

```ts
import { activeSupabase, activeProjectLabel } from "@/integrations/supabase/runtime";
```

Variáveis (Vite — vão para `.env`, não são secrets):

```
VITE_SUPABASE_TARGET=auto        # "cloud" | "external" | "auto"
VITE_SUPABASIS_URL=https://rfsaxstpfpigrjyiochi.supabase.co
VITE_SUPABASIS_PUBLISHABLE_KEY=sb_publishable_...
```

- `auto` (default): usa `external` quando `VITE_SUPABASIS_URL` está definida.
- `cloud`: força `VITE_SUPABASE_URL` (Lovable Cloud).
- `external`: força `VITE_SUPABASIS_URL`.

## Edge Functions

Use `supabase/functions/_shared/supabasisClient.ts`:

```ts
import { createAnonSupabasisClient, createServiceSupabasisClient } from "../_shared/supabasisClient.ts";
```

Ordem de resolução:

- URL: `SUPABASIS_URL` → `SUPABASE_URL`
- Anon: `SUPABASIS_PUBLISHABLE_KEY` → `SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_ANON_KEY`
- Service: `SUPABASIS_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

Cada projeto Supabase tem seu próprio conjunto de Edge Functions. Deployar do sandbox
Lovable atinge apenas o projeto Lovable Cloud. Para o projeto externo, rode o CLI
localmente (`supabase link --project-ref rfsaxstpfpigrjyiochi && supabase functions deploy ...`).
