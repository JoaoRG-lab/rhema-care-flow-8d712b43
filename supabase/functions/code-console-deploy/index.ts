// code-console-deploy: applies generated Code Console files to a non-production
// agent branch with optimistic SHA checks and a single atomic Git commit.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") || "JoaoRG-lab/rhema-care-flow-8d712b43";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") || "agent-sandbox";
const CONSOLE_ALLOWED_EMAIL = Deno.env.get("CONSOLE_ALLOWED_EMAIL")?.trim().toLowerCase();

const GH = "https://api.github.com";
const PROTECTED_BRANCHES = new Set(["main", "master"]);
const MAX_FILES = 20;
const MAX_FILE_BYTES = 1_000_000;

interface FileEdit {
  path: string;
  content: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function githubHeaders() {
  if (!GITHUB_PAT) throw new Error("GITHUB_PAT ausente");
  return {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rhema-code-console-deploy",
  };
}

function safePath(path: string): string | null {
  const clean = path.trim().replace(/^\.\/+/, "");
  const lower = clean.toLowerCase();
  if (!clean || clean.includes("..") || clean.startsWith("/") || clean.startsWith("\\")) return null;
  const blockedPrefixes = [".env", ".git", ".github/", "supabase/", "src/integrations/supabase/"];
  if (blockedPrefixes.some((prefix) => lower === prefix || lower.startsWith(prefix))) return null;
  return clean;
}

function extractFiles(markdown: string): FileEdit[] {
  const edits = new Map<string, string>();
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(markdown)) !== null) {
    const info = match[1].trim();
    let body = match[2];
    let path: string | null = null;
    const kv = info.match(/(?:file|path)\s*=\s*([^\s]+)/i);
    if (kv) path = kv[1];

    if (!path) {
      const parts = info.split(/\s+/).filter(Boolean);
      const candidate = parts.find((part) => part.includes("/") || part.includes("."));
      if (candidate && candidate !== parts[0]) path = candidate;
    }

    if (!path) {
      const firstLine = body.split("\n")[0] ?? "";
      path = firstLine.match(/(?:\/\/|\/\*|<!--|#)\s*file\s*:\s*([^\s*>-]+)/i)?.[1] ?? null;
      if (path) body = body.split("\n").slice(1).join("\n");
    }

    const safe = path ? safePath(path) : null;
    if (!safe) continue;
    const content = body.replace(/\n$/, "");
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) continue;
    edits.set(safe, content);
  }

  return Array.from(edits, ([path, content]) => ({ path, content })).slice(0, MAX_FILES);
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      ...githubHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return await response.json() as T;
}

async function getBranchHead(): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`,
  );
  return ref.object.sha;
}

async function getFileSha(path: string, ref: string): Promise<string | null> {
  const response = await fetch(
    `${GH}/repos/${GITHUB_REPO}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders() },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? null : data.sha ?? null;
}

async function createBlob(content: string): Promise<string> {
  const blob = await gh<{ sha: string }>(`/repos/${GITHUB_REPO}/git/blobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  return blob.sha;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GITHUB_REPO || !GITHUB_PAT || !CONSOLE_ALLOWED_EMAIL) {
      return json({ error: "code-console-deploy não configurado" }, 503);
    }
    if (PROTECTED_BRANCHES.has(GITHUB_BRANCH)) {
      return json({ error: `Branch protegida recusada: ${GITHUB_BRANCH}` }, 409);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid session" }, 401);
    if (userData.user.email?.toLowerCase() !== CONSOLE_ALLOWED_EMAIL) {
      return json({ error: "forbidden" }, 403);
    }

    const { messageId, dryRun, expectedShas = {} } = await req.json().catch(() => ({}));
    if (!messageId) return json({ error: "messageId required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: message, error: messageErr } = await admin
      .from("code_console_messages")
      .select("id, thread_id, user_id, content, agent")
      .eq("id", messageId)
      .single();
    if (messageErr || !message) return json({ error: "message not found" }, 404);
    if (message.user_id !== userData.user.id || message.agent === "user") {
      return json({ error: "message not deployable" }, 403);
    }

    const files = extractFiles(String(message.content ?? ""));
    if (!files.length) {
      return json({
        error: "Nenhum arquivo encontrado. Use blocos ```lang file=src/path.ext ou primeira linha // file: src/path.ext.",
      }, 422);
    }

    const parentSha = await getBranchHead();
    const filePlans = await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        bytes: new TextEncoder().encode(file.content).byteLength,
        expectedSha: await getFileSha(file.path, parentSha),
      })),
    );

    if (dryRun) {
      return json({ branch: GITHUB_BRANCH, repo: GITHUB_REPO, parentSha, files: filePlans, dryRun: true });
    }

    for (const file of filePlans) {
      const supplied = expectedShas[file.path] ?? null;
      if (supplied !== file.expectedSha) {
        return json({ error: `SHA mudou ou não foi pré-visualizado: ${file.path}` }, 409);
      }
    }

    const baseCommit = await gh<{ tree: { sha: string } }>(`/repos/${GITHUB_REPO}/git/commits/${parentSha}`);
    const tree = [];
    for (const file of files) {
      tree.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: await createBlob(file.content),
      });
    }

    const newTree = await gh<{ sha: string }>(`/repos/${GITHUB_REPO}/git/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
    });

    const commit = await gh<{ sha: string }>(`/repos/${GITHUB_REPO}/git/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `code-console(${message.agent}): apply generated files`,
        tree: newTree.sha,
        parents: [parentSha],
      }),
    });

    await gh(`/repos/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    await admin.from("code_console_messages").update({ promoted_for_deploy: true }).eq("id", messageId);
    await admin.from("code_console_threads").update({ deploy_agent: message.agent }).eq("id", message.thread_id);

    return json({
      branch: GITHUB_BRANCH,
      repo: GITHUB_REPO,
      parentSha,
      commitSha: commit.sha,
      files: filePlans,
    });
  } catch (error) {
    console.error("code-console-deploy error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
