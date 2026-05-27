// code-console-deploy: faz commit direto no GitHub a partir de uma mensagem
// do Code Console. Cada commit dispara o deploy automático (Vercel/Lovable).
//
// Auth: JWT do Supabase + e-mail autorizado.
// Parsing: extrai blocos de código que tenham um cabeçalho de caminho:
//   ```tsx file=src/foo.tsx
//   ```ts path=src/lib/bar.ts
//   ```css src/index.css
// OU primeira linha do bloco:
//   // file: src/foo.tsx
//   /* file: src/index.css */
//   <!-- file: index.html -->
//   # file: README.md

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_EMAIL = "joaooz123@gmail.com";
const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const GH = "https://api.github.com";
const ghHeaders = {
  Authorization: `Bearer ${GITHUB_PAT}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "code-console-deploy",
};

function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function safePath(p: string): string | null {
  const t = p.trim().replace(/^\.\/+/, "");
  if (!t || t.includes("..") || t.startsWith("/") || t.startsWith("\\")) return null;
  // bloqueia caminhos perigosos
  const blocked = [
    ".env",
    "src/integrations/supabase/client.ts",
    "src/integrations/supabase/types.ts",
    "supabase/config.toml",
  ];
  if (blocked.includes(t)) return null;
  return t;
}

interface FileEdit {
  path: string;
  content: string;
}

/**
 * Extrai pares (path, content) de um markdown contendo fences ``` ... ```.
 * Suporta cabeçalho no info string (file=... | path=... | bare path)
 * OU primeira linha do bloco com `// file: ...` etc.
 */
function extractFiles(md: string): FileEdit[] {
  const out: FileEdit[] = [];
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(md)) !== null) {
    const info = m[1].trim();
    let body = m[2];
    let path: string | null = null;

    // 1) info string: file=... | path=...
    const kv = info.match(/(?:file|path)\s*=\s*([^\s]+)/i);
    if (kv) path = kv[1];

    // 2) info string: "<lang> <path>"
    if (!path) {
      const parts = info.split(/\s+/).filter(Boolean);
      const cand = parts.find((p) => p.includes("/") || p.includes("."));
      if (cand && cand !== parts[0]) path = cand;
    }

    // 3) primeira linha do bloco: // file: ... | /* file: ... */ | <!-- file: ... --> | # file: ...
    if (!path) {
      const firstLine = body.split("\n")[0] ?? "";
      const fl = firstLine.match(
        /(?:\/\/|\/\*|<!--|#)\s*file\s*:\s*([^\s*\->]+)/i,
      );
      if (fl) {
        path = fl[1];
        body = body.split("\n").slice(1).join("\n");
      }
    }

    if (!path) continue;
    const safe = safePath(path);
    if (!safe) continue;
    out.push({ path: safe, content: body.replace(/\n$/, "") });
  }
  return out;
}

async function ghGetSha(path: string): Promise<string | undefined> {
  const url = `${GH}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders });
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.sha as string;
}

async function ghPut(path: string, content: string, message: string) {
  const sha = await ghGetSha(path);
  const url = `${GH}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}`;
  const body: Record<string, unknown> = {
    message,
    content: b64encode(content),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${path}: ${r.status} ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    // Valida usuário
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) return json({ error: "invalid session" }, 401);
    if (u.user.email?.toLowerCase() !== ALLOWED_EMAIL) {
      return json({ error: "forbidden" }, 403);
    }

    const { messageId, dryRun } = await req.json().catch(() => ({}));
    if (!messageId) return json({ error: "messageId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: msg, error: mErr } = await admin
      .from("code_console_messages")
      .select("id, thread_id, content, agent")
      .eq("id", messageId)
      .single();
    if (mErr || !msg) return json({ error: "message not found" }, 404);

    const files = extractFiles(msg.content as string);
    if (files.length === 0) {
      return json({
        error:
          "Nenhum arquivo encontrado. A mensagem precisa conter blocos ```lang file=caminho/arquivo.ext ou primeira linha com // file: caminho.",
      }, 422);
    }

    if (dryRun) {
      return json({ files: files.map((f) => ({ path: f.path, bytes: f.content.length })), dryRun: true });
    }

    const commitMessage = `code-console(${msg.agent}): deploy from message ${messageId.slice(0, 8)}`;
    const results: Array<{ path: string; sha?: string; error?: string }> = [];
    for (const f of files) {
      try {
        const r = await ghPut(f.path, f.content, commitMessage);
        results.push({ path: f.path, sha: r.commit?.sha });
      } catch (e) {
        results.push({ path: f.path, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // marca mensagem como deploy
    await admin
      .from("code_console_messages")
      .update({ promoted_for_deploy: true })
      .eq("id", messageId);
    await admin
      .from("code_console_threads")
      .update({ deploy_agent: msg.agent })
      .eq("id", msg.thread_id);

    const ok = results.filter((r) => !r.error).length;
    return json({
      branch: GITHUB_BRANCH,
      repo: GITHUB_REPO,
      committed: ok,
      total: results.length,
      results,
    });
  } catch (e) {
    console.error("deploy error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
