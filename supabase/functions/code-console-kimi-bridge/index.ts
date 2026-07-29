import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const functionCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PROMPT_CHARS = 12000;
const CONSOLE_ALLOWED_EMAIL = (Deno.env.get("CONSOLE_ALLOWED_EMAIL") || "joaooz123@gmail.com").trim().toLowerCase();

const BodySchema = z.object({
  threadId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  backendApiKey: z.string().trim().min(16).max(512),
  backendUrl: z.string().trim().url().optional(),
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...functionCorsHeaders, "Content-Type": "application/json" },
  });
}

function pick(...names: string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function getExternalBackendUrl(): string {
  const url = pick("SUPABASIS_URL", "SUPABASES_URL", "SUPABASE_URL");
  if (!url) throw new Error("Backend externo não configurado para o Code Console");
  return url.replace(/\/+$/, "");
}

function getKimiKey(): string {
  const key = Deno.env.get("KIMI_API_KEY")?.trim();
  if (!key) throw new Error("KIMI_API_KEY ausente no ambiente da função");
  return key;
}

function sentinelScan(text: string): string | null {
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /\brm\s+-rf?\s+\/(?:\s|$)/i, label: "rm -rf /" },
    { re: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, label: "DROP TABLE/DATABASE/SCHEMA" },
    { re: /\bTRUNCATE\s+TABLE\b/i, label: "TRUNCATE TABLE" },
    { re: /git\s+push\s+(-f|--force)/i, label: "git push --force" },
    { re: /process\.env\.\w*KEY\w*/i, label: "exposição de chave em código cliente" },
  ];
  const hits = patterns.filter((pattern) => pattern.re.test(text)).map((pattern) => pattern.label);
  return hits.length ? `⚠ Padrões destrutivos detectados: ${hits.join(", ")}` : null;
}

async function callKimi(system: string, user: string): Promise<{ content: string; model: string }> {
  const model = Deno.env.get("KIMI_MODEL")?.trim() || "kimi-k2-0905-preview";
  const baseUrl = Deno.env.get("KIMI_BASE_URL")?.trim() || "https://api.moonshot.ai/v1";
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKimiKey()}`,
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

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) throw new Error("Kimi: limite de requisições atingido (429).");
    if (response.status === 401) throw new Error("Kimi: KIMI_API_KEY inválida (401).");
    throw new Error(`Kimi erro ${response.status}: ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  return { content: data?.choices?.[0]?.message?.content ?? "", model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: functionCorsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Parâmetros inválidos", details: parsed.error.flatten().fieldErrors }, 400);

    const { threadId, prompt, backendApiKey, backendUrl: bodyBackendUrl } = parsed.data;
    const backendUrl = (bodyBackendUrl ?? getExternalBackendUrl()).replace(/\/+$/, "");
    const userClient = createClient(backendUrl, backendApiKey, {
      global: { headers: { Authorization: authHeader, apikey: backendApiKey } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "JWT inválido", detail: userError?.message, backendUrl }, 401);
    }

    const userId = userData.user.id;
    const email = userData.user.email?.toLowerCase();
    let authorized = email === CONSOLE_ALLOWED_EMAIL;
    if (!authorized) {
      const { data: ultimate } = await userClient.rpc("is_ultimate_user", { _user_id: userId });
      authorized = Boolean(ultimate);
    }
    if (!authorized) return json({ error: "Code Console restrito ao usuário ultimate autorizado" }, 403);

    const { data: thread, error: threadError } = await userClient
      .from("code_console_threads")
      .select("id, user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (threadError || !thread || thread.user_id !== userId) return json({ error: "Thread não encontrada" }, 404);

    const userInsert = await userClient.from("code_console_messages").insert({
      thread_id: threadId,
      user_id: userId,
      agent: "user",
      content: prompt,
    });
    if (userInsert.error) throw userInsert.error;

    const { data: history } = await userClient
      .from("code_console_messages")
      .select("agent, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(12);

    const historyText = (history ?? [])
      .reverse()
      .map((message) => `[${message.agent}] ${message.content}`)
      .join("\n\n");

    const system = [
      "Você é o motor Kimi K2 dentro do Code Console multi-agente do UHS Health OS.",
      "Responda em PT-BR, de forma objetiva, com código TypeScript/React/Vite/Deno-Edge/SQL completo quando aplicável.",
      "Para código aplicável ao repositório, use sempre blocos com caminho: ```tsx file=src/components/Exemplo.tsx.",
      "Nunca exponha segredos, force-push, rm -rf, DROP/TRUNCATE ou operações destrutivas sem salvaguardas explícitas.",
    ].join(" ");

    const { content, model } = await callKimi(system, `Contexto da thread:\n${historyText}\n\nTarefa:\n${prompt}`);
    const warning = sentinelScan(content);

    let assistantInsert = await userClient
      .from("code_console_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        agent: "kimi",
        content,
        destructive_warning: warning,
        model,
      })
      .select()
      .single();

    if (assistantInsert.error && /code_console_agent|invalid input value for enum/i.test(assistantInsert.error.message)) {
      assistantInsert = await userClient
        .from("code_console_messages")
        .insert({
          thread_id: threadId,
          user_id: userId,
          agent: "chatgpt",
          content,
          destructive_warning: warning,
          model,
        })
        .select()
        .single();
    }

    if (assistantInsert.error) throw assistantInsert.error;

    await userClient.from("code_console_threads").update({ deploy_agent: assistantInsert.data.agent }).eq("id", threadId);
    return json({ message: assistantInsert.data, agentStored: assistantInsert.data.agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message || "Falha ao executar Kimi" }, 500);
  }
});