// Shared helper for Edge Functions to build a Supabase client that respects
// the SUPABASIS_* naming scheme, falling back to standard SUPABASE_* envs.
//
// Priority order (first defined wins):
//   URL:          SUPABASIS_URL → SUPABASE_URL
//   ANON KEY:     SUPABASIS_PUBLISHABLE_KEY → SUPABASE_PUBLISHABLE_KEY → SUPABASE_ANON_KEY
//   SERVICE KEY:  SUPABASIS_SERVICE_ROLE_KEY → SUPABASE_SERVICE_ROLE_KEY
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function pick(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function getSupabasisUrl(): string {
  const url = pick("SUPABASIS_URL", "SUPABASE_URL");
  if (!url) throw new Error("SUPABASIS_URL/SUPABASE_URL não configurada");
  return url;
}

export function getSupabasisAnonKey(): string {
  const k = pick("SUPABASIS_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  if (!k) throw new Error("SUPABASIS anon/publishable key ausente");
  return k;
}

export function getSupabasisServiceKey(): string {
  const k = pick("SUPABASIS_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return k;
}

/** Client anônimo — use com Authorization header do usuário para respeitar RLS. */
export function createAnonSupabasisClient(authHeader?: string): SupabaseClient {
  return createClient(getSupabasisUrl(), getSupabasisAnonKey(), {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client de service role — bypassa RLS. Use apenas em contextos administrativos. */
export function createServiceSupabasisClient(): SupabaseClient {
  return createClient(getSupabasisUrl(), getSupabasisServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
