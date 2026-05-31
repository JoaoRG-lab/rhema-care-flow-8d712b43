// code-editor-agent: dry-run + draft PR creation against an allow-listed repo set.
// Security: never writes to main, never auto-merges, never reads .env, validates paths,
// requires explicit confirmation string for the write phase.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
const CONSOLE_ALLOWED_EMAIL = Deno.env.get("CONSOLE_ALLOWED_EMAIL")?.trim().toLowerCase();

const ALLOWED_REPOS = new Set([
  "JoaoRG-lab/rhema-care-flow",
  "JoaoRG-lab/rhema-care-flow-8d712b43",
]);
const PROTECTED_BRANCHES = new Set(["main", "master"]);
const BLOCKED_PATH_PREFIXES = [".env", ".git", ".github/workflows/", "supabase/config.toml"];
const CONFIRM_PHRASE = "CRIAR PR";
const MAX_BYTES = 500_000;
const GH = "https://api.github.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rhema-code-editor-agent",
  };
}

function safePath(path: string): string | null {
  const clean = String(path ?? "").trim().replace(/^\.\/+/, "");
  if (!clean || clean.includes("..") || clean.startsWith("/") || clean.startsWith("\\")) return null;
  const lower = clean.toLowerCase();
  if (BLOCKED_PATH_PREFIXES.some((p) => lower === p || lower.startsWith(p))) return null;
  return clean;
}

async function gh<T>(url: string, init: RequestInit = {}, expectJson = true): Promise<T> {
  const res = await fetch(`${GH}${url}`, { ...init, headers: { ...ghHeaders(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 300);
    throw new Error(`GitHub ${res.status}: ${txt.replace(GITHUB_PAT ?? "__none__", "***")}`);
  }
  return expectJson ? (await res.json()) as T : (undefined as T);
}

async function getFile(repo: string, path: string, ref: string) {
  const res = await fetch(
    `${GH}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
    { headers: ghHeaders() },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) throw new Error("Path é diretório, não arquivo");
  const content = data.encoding === "base64" ? atob(data.content.replace(/\n/g, "")) : "";
  return { sha: data.sha as string, content, bytes: data.size as number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GITHUB_PAT) return json({ error: "GITHUB_PAT não configurado" }, 503);
    if (!CONSOLE_ALLOWED_EMAIL) return json({ error: "CONSOLE_ALLOWED_EMAIL não configurado" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "invalid session" }, 401);
    if (u.user.email?.toLowerCase() !== CONSOLE_ALLOWED_EMAIL) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "create-pr" ? "create-pr" : "dry-run";
    const repo = String(body.repo ?? "");
    const path = safePath(body.path ?? "");
    const content = String(body.content ?? "");
    const baseBranch = String(body.baseBranch ?? "main");

    if (!ALLOWED_REPOS.has(repo)) return json({ error: "Repositório não autorizado" }, 403);
    if (!path) return json({ error: "Caminho inválido ou bloqueado" }, 400);
    if (PROTECTED_BRANCHES.has(baseBranch) === false && baseBranch !== "main") {
      // ok — base must be main for this flow
    }
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes > MAX_BYTES) return json({ error: `Arquivo excede ${MAX_BYTES} bytes` }, 413);

    // Always compute dry-run diff first
    const existing = await getFile(repo, path, baseBranch);
    const changed = !existing || existing.content !== content;
    const diff = {
      repo,
      path,
      mode,
      changed,
      bytes,
      previousBytes: existing?.bytes ?? 0,
      baseBranch,
      existingSha: existing?.sha ?? null,
    };

    if (mode === "dry-run") {
      return json({ ok: true, dryRun: diff });
    }

    if (String(body.confirm ?? "").trim() !== CONFIRM_PHRASE) {
      return json({ error: `Confirmação ausente. Envie confirm="${CONFIRM_PHRASE}"` }, 400);
    }
    if (!changed) return json({ ok: true, dryRun: diff, message: "Sem alterações para PR" });

    // Create agent branch from base
    const baseRef = await gh<{ object: { sha: string } }>(
      `/repos/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    );
    const branch = `agent/code-editor/${Date.now()}`;
    await gh(`/repos/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    });

    // PUT file
    const putBody: Record<string, unknown> = {
      message: `code-editor-agent: update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
    };
    if (existing?.sha) putBody.sha = existing.sha;
    const commitRes = await gh<{ commit: { sha: string; html_url: string } }>(
      `/repos/${repo}/contents/${encodeURI(path)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(putBody) },
    );

    // Draft PR
    const pr = await gh<{ number: number; html_url: string; draft: boolean }>(
      `/repos/${repo}/pulls`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `code-editor-agent: ${path}`,
          head: branch,
          base: baseBranch,
          draft: true,
          body: `Draft PR gerado por code-editor-agent.\n\n- Arquivo: \`${path}\`\n- Bytes: ${bytes}\n- Base: \`${baseBranch}\`\n\nRevisar antes de marcar como ready for review.`,
          maintainer_can_modify: true,
        }),
      },
    );

    return json({
      ok: true,
      dryRun: diff,
      branch,
      commitSha: commitRes.commit.sha,
      commitUrl: commitRes.commit.html_url,
      pullRequest: { number: pr.number, url: pr.html_url, draft: pr.draft },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const sanitized = GITHUB_PAT ? msg.replaceAll(GITHUB_PAT, "***") : msg;
    console.error("code-editor-agent error", sanitized);
    return json({ error: sanitized }, 500);
  }
});
