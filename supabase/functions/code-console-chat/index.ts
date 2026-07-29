// Code Console — multi-agent shared chat
// Routes one prompt to a chosen agent (chatgpt | codex | perplexity | custom),
// runs a Sentinel scan for destructive code, persists both user + assistant messages.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Agent = "chatgpt" | "codex" | "perplexity" | "custom" | "kimi";
const ALLOWED_AGENTS: Agent[] = ["chatgpt", "codex", "perplexity", "custom", "kimi"];
const MAX_PROMPT_CHARS = 12000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONSOLE_ALLOWED_EMAIL = (Deno.env.get("CONSOLE_ALLOWED_EMAIL") || "joaooz123@gmail.com").trim().toLowerCase();

function getRequiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} ausente no ambiente da Edge Function`);
  return value;
}

function normalizeAgent(value: unknown): Agent | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "moonshot" || raw === "kimi-k2" || raw === "kimi_k2") return "kimi";
  return ALLOWED_AGENTS.includes(raw as Agent) ? (raw as Agent) : null;
}

// Sentinel — destructive-code heuristics. Returns warning text or null.
function sentinelScan(text: string): string | null {
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /\brm\s+-rf?\s+\/(?:\s|$)/i, label: "rm -rf /" },
    { re: /\brm\s+-rf?\s+~(?:\/|\s|$)/i, label: "rm -rf ~" },
    { re: /\b:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, label: "fork bomb" },
    { re: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, label: "DROP TABLE/DATABASE/SCHEMA" },
    { re: /\bTRUNCATE\s+TABLE\b/i, label: "TRUNCATE TABLE" },
    { re: /\bDELETE\s+FROM\s+\w+\s*(;|$)/i, label: "DELETE FROM ... sem WHERE" },
    { re: /\bUPDATE\s+\w+\s+SET\b[^;]*?(;|$)(?![^]*\bWHERE\b)/i, label: "UPDATE ... sem WHERE" },
    { re: /git\s+push\s+(-f|--force)/i, label: "git push --force" },
    { re: /git\s+reset\s+--hard/i, label: "git reset --hard" },
    { re: /\bchmod\s+-R\s+777\b/i, label: "chmod -R 777" },
    { re: /\bmkfs(\.\w+)?\b/i, label: "mkfs" },
    { re: /\bdd\s+if=.+of=\/dev\//i, label: "dd para /dev/" },
    { re: /process\.env\.\w*KEY\w*/i, label: "exposição de chave em código cliente" },
  ];
  const hits = patterns.filter((p) => p.re.test(text)).map((p) => p.label);
  return hits.length ? `⚠ Padrões destrutivos detectados: ${hits.join(", ")}` : null;
}

async function callLovableGateway(model: string, system: string, user: string): Promise<string> {
  const LOVABLE_API_KEY = getRequiredSecret("LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "code-console-edge",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido (429).");
    if (res.status === 402) throw new Error("Créditos esgotados (402). Adicione créditos no workspace.");
    throw new Error(`Gateway erro ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function hasLovableGatewayKey(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY")?.trim());
}

async function callPerplexity(prompt: string): Promise<{ content: string; citations: unknown }> {
  const PERPLEXITY_API_KEY = getRequiredSecret("PERPLEXITY_API_KEY");
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "Você é engenheiro pesquisador. Cite fontes e seja preciso." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Perplexity erro ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    citations: data?.citations ?? null,
  };
}

async function callCustom(system: string, user: string): Promise<string> {
  const CUSTOM_AI_API_KEY = Deno.env.get("CUSTOM_AI_API_KEY")?.trim();
  const CUSTOM_AI_BASE_URL = Deno.env.get("CUSTOM_AI_BASE_URL")?.trim();
  const CUSTOM_AI_MODEL = Deno.env.get("CUSTOM_AI_MODEL")?.trim();
  if (!CUSTOM_AI_API_KEY || !CUSTOM_AI_BASE_URL || !CUSTOM_AI_MODEL) {
    throw new Error("CUSTOM_AI_API_KEY / CUSTOM_AI_BASE_URL / CUSTOM_AI_MODEL não configurados");
  }
  const base = CUSTOM_AI_BASE_URL.replace(/\/+$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CUSTOM_AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CUSTOM_AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Custom AI erro ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callKimi(system: string, user: string): Promise<string> {
  const KIMI_API_KEY = getRequiredSecret("KIMI_API_KEY");
  const model = Deno.env.get("KIMI_MODEL")?.trim() || "kimi-k2-0905-preview";
  const baseUrl = Deno.env.get("KIMI_BASE_URL")?.trim() || "https://api.moonshot.ai/v1";
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIMI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Kimi: limite de requisições atingido (429).");
    if (res.status === 401) throw new Error("Kimi: KIMI_API_KEY inválida (401).");
    throw new Error(`Kimi erro ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function isConsoleAuthorized(
  // Supabase Edge runtime does not expose generated RPC types in this function.
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
  email?: string | null,
): Promise<boolean> {
  if (email?.toLowerCase() === CONSOLE_ALLOWED_EMAIL) return true;

  const { data: lockedUltimate, error: lockedError } = await admin.rpc("is_locked_ultimate_user", {
    target_user_id: userId,
  });
  if (lockedError) throw lockedError;
  if (lockedUltimate) return true;

  const { data: profileUltimate, error: profileError } = await admin.rpc("is_ultimate_user", {
    _user_id: userId,
  });
  if (profileError) throw profileError;

  return Boolean(profileUltimate);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "JWT inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!(await isConsoleAuthorized(admin, userId, userData.user.email))) {
      return new Response(JSON.stringify({ error: "Code Console restrito ao usuário ultimate autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const threadId: string | undefined = body?.threadId;
    const prompt: string = String(body?.prompt ?? "").trim();
    const agent = normalizeAgent(body?.agent);
    if (!threadId || !prompt || !agent) {
      return new Response(JSON.stringify({
        error: "Parâmetros inválidos",
        details: {
          threadId: Boolean(threadId),
          prompt: Boolean(prompt),
          agent: String(body?.agent ?? ""),
          allowedAgents: ALLOWED_AGENTS,
        },
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return new Response(JSON.stringify({ error: `Prompt muito longo. Limite: ${MAX_PROMPT_CHARS} caracteres.` }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_user_id: userId,
      p_endpoint: "code-console-chat",
      p_max_requests: 60,
      p_window_minutes: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Limite por hora atingido (60)." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify thread ownership
    const { data: thread, error: threadErr } = await admin
      .from("code_console_threads")
      .select("id, user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (threadErr || !thread || thread.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Thread não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await admin.from("code_console_messages").insert({
      thread_id: threadId,
      user_id: userId,
      agent: "user",
      content: prompt,
    });

    // Build context: last 12 messages from the thread for shared memory
    const { data: history } = await admin
      .from("code_console_messages")
      .select("agent, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(12);
    const historyText = (history ?? [])
      .reverse()
      .map((m) => `[${m.agent}] ${m.content}`)
      .join("\n\n");

    const systemBase =
      "Você é parte do Code Console multi-agente do UHS Health OS. " +
      "Outros agentes (ChatGPT, Codex, Perplexity, Custom) compartilham esta mesma thread. " +
      "Responda em PT-BR, foco em código TypeScript/React/Vite/Deno-Edge/SQL. " +
      "CRÍTICO: Para que o código seja aplicado ao repositório, SEMPRE use o formato de bloco de código com o caminho do arquivo, por exemplo:\n" +
      "```tsx file=src/components/MyComponent.tsx\n" +
      "// código aqui\n" +
      "```\n" +
      "Ou coloque na primeira linha do bloco: // file: src/path/to/file.ts\n" +
      "Nunca proponha apagar tabelas, dropar dados, force-push, rm -rf ou expor segredos. " +
      "Quando referenciar trabalho de outro agente, cite o tag dele.";

    let assistantContent = "";
    let modelUsed = "";
    let citations: unknown = null;

    let providerError: string | null = null;
    try {
      if (agent === "chatgpt") {
        modelUsed = "openai/gpt-5";
        if (hasLovableGatewayKey()) {
          assistantContent = await callLovableGateway(modelUsed, systemBase, `Contexto da thread:\n${historyText}\n\nNova pergunta:\n${prompt}`);
        } else {
          modelUsed = Deno.env.get("KIMI_MODEL")?.trim() || "kimi-k2-0905-preview";
          assistantContent = await callKimi(
            systemBase + " Modo ChatGPT via Kimi fallback: preserve o escopo do agente e entregue resposta de código completa.",
            `Contexto:\n${historyText}\n\nNova pergunta:\n${prompt}`,
          );
        }
      } else if (agent === "codex") {
        modelUsed = "openai/gpt-5";
        if (hasLovableGatewayKey()) {
          assistantContent = await callLovableGateway(
            modelUsed,
            systemBase + " Modo Codex: priorize código completo, com tipos, tratamento de erro e testes mínimos.",
            `Contexto:\n${historyText}\n\nTarefa de código:\n${prompt}`,
          );
        } else {
          modelUsed = Deno.env.get("KIMI_MODEL")?.trim() || "kimi-k2-0905-preview";
          assistantContent = await callKimi(
            systemBase + " Modo Codex via Kimi fallback: priorize código completo, com tipos, tratamento de erro e testes mínimos.",
            `Contexto:\n${historyText}\n\nTarefa de código:\n${prompt}`,
          );
        }
      } else if (agent === "perplexity") {
        modelUsed = "sonar-pro";
        const r = await callPerplexity(`Contexto:\n${historyText}\n\nPergunta com fontes:\n${prompt}`);
        assistantContent = r.content;
        citations = r.citations;
      } else if (agent === "kimi") {
        modelUsed = Deno.env.get("KIMI_MODEL")?.trim() || "kimi-k2-0905-preview";
        assistantContent = await callKimi(
          systemBase + " Modo Kimi (Moonshot K2): motor de código open-weights, priorize código completo, correto e idiomático.",
          `Contexto:\n${historyText}\n\nTarefa:\n${prompt}`,
        );
      } else {
        modelUsed = Deno.env.get("CUSTOM_AI_MODEL")?.trim() ?? "custom";
        assistantContent = await callCustom(systemBase, `Contexto:\n${historyText}\n\n${prompt}`);
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message : String(error);
      assistantContent = [
        "Não consegui chamar o provedor configurado para este agente.",
        "",
        `Agente: ${agent}`,
        `Modelo: ${modelUsed || "não definido"}`,
        `Erro: ${providerError}`,
        "",
        "A thread foi preservada. Verifique secrets/modelo da Edge Function e tente novamente, ou escolha outro agente.",
      ].join("\n");
    }

    const warning = providerError
      ? `Falha operacional do provedor: ${providerError}`
      : sentinelScan(assistantContent);

    const { data: inserted, error: insErr } = await admin
      .from("code_console_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        agent,
        content: assistantContent,
        destructive_warning: warning,
        model: modelUsed,
        citations,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    await admin
      .from("code_console_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return new Response(JSON.stringify({ message: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
