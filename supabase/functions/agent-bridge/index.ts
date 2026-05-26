// agent-bridge: ponte segura entre LLMs externos (ChatGPT/Claude/Perplexity)
// e o repositório GitHub conectado ao Lovable.
//
// Auth: header `X-Agent-Token` == AGENT_BRIDGE_TOKEN (secret no Vault).
// Auditoria: toda chamada é registrada em `public.agent_edits`.
//
// Endpoints (POST JSON):
//   { "op": "read",  "path": "src/App.tsx" }
//   { "op": "list",  "path": "src/components" }
//   { "op": "write", "path": "src/foo.ts", "content": "...", "message": "agent: edit foo", "agent": "chatgpt" }
//   { "op": "delete","path": "src/foo.ts", "message": "agent: remove foo", "agent": "chatgpt" }
//
// O `agent` é livre (string) só pra rastreio na auditoria.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!; // formato "owner/repo"
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";
const AGENT_BRIDGE_TOKEN = Deno.env.get("AGENT_BRIDGE_TOKEN")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsAll = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-token",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

type AuditRow = {
  agent_name: string;
  operation: "read" | "write" | "delete" | "list";
  file_path: string | null;
  commit_message: string | null;
  commit_sha: string | null;
  branch: string | null;
  ip_address: string | null;
  success: boolean;
  error_message: string | null;
  bytes_written: number | null;
};

async function audit(row: AuditRow) {
  try {
    await admin.from("agent_edits").insert(row);
  } catch (e) {
    console.error("audit insert failed", e);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsAll, "Content-Type": "application/json" },
  });
}

const GH_BASE = "https://api.github.com";
const ghHeaders = {
  Authorization: `Bearer ${GITHUB_PAT}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "lovable-agent-bridge",
};

function safePath(p: string): string | null {
  // bloqueia path traversal e caminhos absolutos
  if (!p || typeof p !== "string") return null;
  if (p.includes("..") || p.startsWith("/") || p.startsWith("\\")) return null;
  return p.replace(/^\.\/+/, "");
}

async function ghGetContent(path: string) {
  const url = `${GH_BASE}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders });
  if (r.status === 404) return { exists: false as const };
  if (!r.ok) throw new Error(`GitHub GET ${r.status}: ${await r.text()}`);
  return { exists: true as const, data: await r.json() };
}

async function ghPutContent(path: string, contentB64: string, message: string, sha?: string) {
  const url = `${GH_BASE}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}`;
  const body: Record<string, unknown> = {
    message,
    content: contentB64,
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function ghDeleteContent(path: string, message: string, sha: string) {
  const url = `${GH_BASE}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch: GITHUB_BRANCH }),
  });
  if (!r.ok) throw new Error(`GitHub DELETE ${r.status}: ${await r.text()}`);
  return await r.json();
}

function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAll });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;

  // Auth via shared token
  const token = req.headers.get("x-agent-token");
  if (!token || token !== AGENT_BRIDGE_TOKEN) {
    await audit({
      agent_name: "unknown",
      operation: "read",
      file_path: null,
      commit_message: null,
      commit_sha: null,
      branch: GITHUB_BRANCH,
      ip_address: ip,
      success: false,
      error_message: "invalid or missing X-Agent-Token",
      bytes_written: null,
    });
    return json({ error: "unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const agent = (body.agent || "unknown").toString().slice(0, 64);
  const op = body.op;
  const rawPath = body.path ?? "";
  const path = safePath(rawPath);

  if (!["read", "write", "delete", "list"].includes(op)) {
    return json({ error: "op must be read|write|delete|list" }, 400);
  }
  if (path === null) {
    return json({ error: "invalid path" }, 400);
  }

  try {
    if (op === "read") {
      const r = await ghGetContent(path);
      if (!r.exists) {
        await audit({
          agent_name: agent, operation: "read", file_path: path,
          commit_message: null, commit_sha: null, branch: GITHUB_BRANCH,
          ip_address: ip, success: false, error_message: "not found", bytes_written: null,
        });
        return json({ error: "not found" }, 404);
      }
      const data = r.data;
      const content = data.encoding === "base64" ? b64decode(data.content) : data.content;
      await audit({
        agent_name: agent, operation: "read", file_path: path,
        commit_message: null, commit_sha: data.sha, branch: GITHUB_BRANCH,
        ip_address: ip, success: true, error_message: null, bytes_written: null,
      });
      return json({ path, sha: data.sha, size: data.size, content });
    }

    if (op === "list") {
      const r = await ghGetContent(path || "");
      if (!r.exists) return json({ error: "not found" }, 404);
      const items = Array.isArray(r.data)
        ? r.data.map((x: any) => ({ name: x.name, path: x.path, type: x.type, size: x.size }))
        : [{ name: r.data.name, path: r.data.path, type: r.data.type, size: r.data.size }];
      await audit({
        agent_name: agent, operation: "list", file_path: path,
        commit_message: null, commit_sha: null, branch: GITHUB_BRANCH,
        ip_address: ip, success: true, error_message: null, bytes_written: null,
      });
      return json({ path, items });
    }

    if (op === "write") {
      const content = body.content;
      const message = (body.message || `agent(${agent}): update ${path}`).toString().slice(0, 256);
      if (typeof content !== "string") return json({ error: "content must be a string" }, 400);

      const existing = await ghGetContent(path);
      const sha = existing.exists ? existing.data.sha : undefined;
      const result = await ghPutContent(path, b64encode(content), message, sha);

      await audit({
        agent_name: agent, operation: "write", file_path: path,
        commit_message: message, commit_sha: result.commit?.sha ?? null,
        branch: GITHUB_BRANCH, ip_address: ip, success: true,
        error_message: null, bytes_written: new Blob([content]).size,
      });
      return json({
        path, commit_sha: result.commit?.sha, commit_url: result.commit?.html_url, branch: GITHUB_BRANCH,
      });
    }

    if (op === "delete") {
      const message = (body.message || `agent(${agent}): delete ${path}`).toString().slice(0, 256);
      const existing = await ghGetContent(path);
      if (!existing.exists) return json({ error: "not found" }, 404);
      const result = await ghDeleteContent(path, message, existing.data.sha);
      await audit({
        agent_name: agent, operation: "delete", file_path: path,
        commit_message: message, commit_sha: result.commit?.sha ?? null,
        branch: GITHUB_BRANCH, ip_address: ip, success: true,
        error_message: null, bytes_written: null,
      });
      return json({ path, commit_sha: result.commit?.sha, branch: GITHUB_BRANCH });
    }

    return json({ error: "unhandled op" }, 400);
  } catch (e: any) {
    const msg = e?.message || String(e);
    await audit({
      agent_name: agent, operation: op, file_path: path,
      commit_message: body.message ?? null, commit_sha: null, branch: GITHUB_BRANCH,
      ip_address: ip, success: false, error_message: msg.slice(0, 1000), bytes_written: null,
    });
    console.error("agent-bridge error", msg);
    return json({ error: msg }, 500);
  }
});
