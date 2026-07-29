// Runtime target selector for Supabase project.
// Does NOT edit the auto-generated client. Wraps it and exposes an
// `activeSupabase` client based on VITE_SUPABASE_TARGET.
//
// Targets:
//   "cloud"    → Lovable Cloud project (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)
//   "external" → External project (VITE_SUPABASIS_URL / VITE_SUPABASIS_PUBLISHABLE_KEY)
//   "auto"     → external when VITE_SUPABASIS_URL is present, else cloud
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as canonicalSupabase, supabaseUrl as canonicalUrl } from "./client";

type Target = "cloud" | "external" | "auto";

function clean(v: string | undefined): string | undefined {
  return v?.trim().replace(/^["'`]+|["'`]+$/g, "") || undefined;
}

function projectIdFromUrl(url: string | undefined): string | undefined {
  return url?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1];
}

const env = import.meta.env as Record<string, string | undefined>;
const rawTarget = (clean(env.VITE_SUPABASE_TARGET) ?? "auto") as Target;

const cloudUrl = clean(env.VITE_SUPABASE_URL);
const cloudKey = clean(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY);
const extUrl = clean(env.VITE_SUPABASIS_URL);
const extKey = clean(env.VITE_SUPABASIS_PUBLISHABLE_KEY ?? env.VITE_SUPABASIS_ANON_KEY);

const resolvedTarget: "cloud" | "external" =
  rawTarget === "cloud"
    ? "cloud"
    : rawTarget === "external"
      ? "external"
      : extUrl
        ? "external"
        : "cloud";

function build(): { client: SupabaseClient<Database>; url: string; label: string } {
  // The auto-generated `canonicalSupabase` already points at the external
  // canonical project. Reuse it when target is "external" to keep a single
  // auth session; otherwise mint a dedicated client for the cloud project.
  if (resolvedTarget === "external") {
    if (extUrl && extKey) {
      return {
        client: createClient<Database>(extUrl, extKey, {
          auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
        url: extUrl,
        label: `External (${projectIdFromUrl(extUrl)})`,
      };
    }
    return { client: canonicalSupabase, url: canonicalUrl, label: `External (${projectIdFromUrl(canonicalUrl)})` };
  }
  if (cloudUrl && cloudKey) {
    return {
      client: createClient<Database>(cloudUrl, cloudKey, {
        auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
      url: cloudUrl,
      label: `Lovable Cloud (${projectIdFromUrl(cloudUrl)})`,
    };
  }
  // Fallback: canonical client
  return { client: canonicalSupabase, url: canonicalUrl, label: `Fallback (${projectIdFromUrl(canonicalUrl)})` };
}

const built = build();

export const activeSupabase: SupabaseClient<Database> = built.client;
export const activeProjectUrl = built.url;
export const activeProjectId = projectIdFromUrl(built.url) ?? "unknown";
export const activeProjectLabel = built.label;
export const activeSupabaseTarget: "cloud" | "external" = resolvedTarget;
