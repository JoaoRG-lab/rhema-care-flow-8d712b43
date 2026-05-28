// Multi-AI rotating scheduler: every 5 min one provider audits the site
// and proposes improvements. Safe content-only patches auto-apply via
// content_overrides; structural patches queue as needs_review.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeCronOrAdmin } from "../_shared/cronAuth.ts";

type Agent =
  | "perplexity" | "gemini" | "openai" | "anthropic"
  | "grok" | "deepseek" | "groq" | "openrouter" | "replit" | "huggingface";

const ROTATION: Agent[] = [
  "perplexity", "gemini", "openai", "anthropic",
  "grok", "deepseek", "groq", "openrouter", "replit", "huggingface",
];

const SYSTEM_PROMPT = `You are one of several rotating AI auditors continuously improving the UHS Health OS website.
Return STRICT JSON only, matching:
{
  "audit_summary": string,
  "proposals": [{
    "severity": "auto" | "review" | "blocked",
    "area": "a11y" | "seo" | "copy" | "performance" | "security" | "i18n" | "content",
    "title": string,
    "rationale": string,
    "patch": { "scope": "microcopy"|"seo"|"llms_txt", "key": string, "value": object }
  }]
}
Rules:
- "auto" is ONLY for microcopy/seo/llms_txt content overrides — never code, never DB.
- "review" for anything that needs human approval (component, route, schema).
- "blocked" for destructive or unsafe ideas (drop tables, rm -rf, secrets, force pushes).
- Generate at most 5 proposals per run; prefer high-impact a11y / SEO / clinical clarity.
- Never include PII, never include patient data.`;

const DESTRUCTIVE_REGEX = /\b(rm\s+-rf|drop\s+table|drop\s+database|truncate|delete\s+from|--force|chmod\s+777|git\s+push\s+--force|\.env|service_role|private[_-]?key|secret[_-]?key)\b/i;
const MAX_REPLIT_CONTEXT_CHARS = 12000;
const MAX_HF_CONTEXT_CHARS = 16000;

function sanitize(proposals: any[]): any[] {
  if (!Array.isArray(proposals)) return [];
  return proposals.slice(0, 5).map((p) => {
    const blob = JSON.stringify(p);
    if (DESTRUCTIVE_REGEX.test(blob)) return { ...p, severity: "blocked" };
    if (p.severity === "auto" && p.patch?.scope &&
        !["microcopy", "seo", "llms_txt"].includes(p.patch.scope)) {
      return { ...p, severity: "review" };
    }
    return p;
  });
}

async function callPerplexity(prompt: string): Promise<string | null> {
  const key = Deno.env.get("PERPLEXITY_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? null;
}

async function callOpenAICompat(url: string, model: string, keyName: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get(keyName);
  if (!key) return null;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? null;
}

async function callLovableAI(model: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? null;
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "rhema-replit-improvement-agent/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) return `Replit URL returned HTTP ${response.status}.`;
    return await response.text();
  } catch (error) {
    return `Replit URL fetch failed: ${error instanceof Error ? error.message : "unknown_error"}.`;
  } finally {
    clearTimeout(timer);
  }
}

async function buildReplitContext(): Promise<string> {
  const siteUrl = Deno.env.get("REPLIT_SITE_URL")?.trim();
  const manualContext = Deno.env.get("REPLIT_CONTEXT")?.trim();

  const chunks: string[] = [
    "This run absorbs a stalled Replit site as an internal improvement source for Rhema Flow.",
    "Treat it as legacy/reference material only. Do not propose deploys, secrets, migrations, or writes back to Replit.",
    "Convert useful UX, copy, clinical workflow, accessibility, and architecture ideas into Rhema improvement tasks.",
  ];

  if (siteUrl) {
    chunks.push(`Configured Replit site URL: ${siteUrl}`);
    const html = await fetchWithTimeout(siteUrl);
    if (html) chunks.push(`Fetched Replit public snapshot: ${stripHtml(html).slice(0, MAX_REPLIT_CONTEXT_CHARS)}`);
  } else {
    chunks.push("REPLIT_SITE_URL is not configured yet. Produce a review task describing what URL/export is needed.");
  }

  if (manualContext) {
    chunks.push(`Manual Replit context: ${manualContext.slice(0, MAX_REPLIT_CONTEXT_CHARS)}`);
  }

  return chunks.join("\n\n");
}

async function fetchJsonWithTimeout(url: string, ms = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "rhema-huggingface-improvement-agent/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "unknown_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function buildHuggingFaceContext(): Promise<string> {
  const jobContextUrl = Deno.env.get("HF_CLINICAL_JOB_CONTEXT_URL")?.trim();
  const datasetId = Deno.env.get("HF_CLINICAL_DATASET_ID")?.trim();
  const spaceUrl = Deno.env.get("HF_CLINICAL_SPACE_URL")?.trim();
  const manualContext = Deno.env.get("HF_CLINICAL_CONTEXT")?.trim();

  const chunks: string[] = [
    "This run uses Hugging Face as an external clinical-improvement workbench.",
    "Treat HF Jobs, datasets, and Spaces as read-only evidence/proposal sources unless a human approves a specific deployment path.",
    "Convert outputs into Rhema tasks for clinical instruments, patient interface improvements, accessibility, education content, and safety review.",
    "Never include PHI or patient-identifying information.",
  ];

  if (jobContextUrl) {
    const data = await fetchJsonWithTimeout(jobContextUrl);
    chunks.push(`HF job context URL: ${jobContextUrl}`);
    chunks.push(`HF job context JSON: ${JSON.stringify(data).slice(0, MAX_HF_CONTEXT_CHARS)}`);
  } else {
    chunks.push("HF_CLINICAL_JOB_CONTEXT_URL is not configured yet. Queue a review task to connect a persisted HF Jobs output.");
  }

  if (datasetId) chunks.push(`Candidate HF dataset: https://huggingface.co/datasets/${datasetId}`);
  if (spaceUrl) chunks.push(`Candidate HF Space/workbench: ${spaceUrl}`);
  if (manualContext) chunks.push(`Manual HF context: ${manualContext.slice(0, MAX_HF_CONTEXT_CHARS)}`);

  return chunks.join("\n\n");
}

async function callAgent(agent: Agent, prompt: string): Promise<string | null> {
  switch (agent) {
    case "perplexity": return callPerplexity(prompt);
    case "gemini":     return callLovableAI("google/gemini-3-flash-preview", prompt);
    case "openai":     return callLovableAI("openai/gpt-5-mini", prompt);
    case "anthropic":  return callOpenAICompat("https://api.anthropic.com/v1/messages", "claude-3-5-sonnet-latest", "ANTHROPIC_API_KEY", prompt);
    case "grok":       return callOpenAICompat("https://api.x.ai/v1/chat/completions", "grok-2-latest", "GROKKEY", prompt);
    case "deepseek":   return callOpenAICompat("https://api.deepseek.com/v1/chat/completions", "deepseek-chat", "DEEPSEEK_API_KEY", prompt);
    case "groq":       return callOpenAICompat("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", "groq", prompt);
    case "openrouter": return callOpenAICompat("https://openrouter.ai/api/v1/chat/completions", "openai/gpt-4o-mini", "openrouter", prompt);
    case "replit": {
      const replitContext = await buildReplitContext();
      return callLovableAI(
        "openai/gpt-5-mini",
        `${prompt}\n\nAdditional stalled Replit source:\n${replitContext}`,
      );
    }
    case "huggingface": {
      const hfContext = await buildHuggingFaceContext();
      return callLovableAI(
        "openai/gpt-5-mini",
        `${prompt}\n\nAdditional Hugging Face workbench source:\n${hfContext}`,
      );
    }
  }
}

function safeJSON(s: string | null): any | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // round-robin: pick next agent
  const { data: last } = await supa
    .from("ai_improvement_runs")
    .select("agent")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const idx = last ? (ROTATION.indexOf(last.agent as Agent) + 1) % ROTATION.length : 0;
  const agent = ROTATION[idx];

  const { data: run, error: runErr } = await supa
    .from("ai_improvement_runs")
    .insert({ agent, status: "running" })
    .select()
    .single();
  if (runErr || !run) {
    return new Response(JSON.stringify({ error: runErr?.message ?? "run_insert_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // build short context
  // PostgrestBuilder não é uma Promise real (sem .catch). Envolvemos manualmente.
  let routes: unknown = null;
  try {
    const r = await supa.rpc("noop");
    routes = r?.data ?? null;
  } catch {
    routes = null;
  }
  const prompt = `Audit UHS Health OS (rheumatology + multi-specialty clinical platform).
Existing public routes: /, /learn, /scores, /landing, /about.
Canonical deploy: https://rhema-care-flow.lovable.app/
GitHub source: JoaoRG-lab/rhema-care-flow-8d712b43.
Last 3 audit summaries: ignore for now.
Return up to 5 actionable proposals as JSON.`;

  try {
    const raw = await callAgent(agent, prompt);
    const parsed = safeJSON(raw);
    if (!parsed) {
      await supa.from("ai_improvement_runs").update({
        status: "error", finished_at: new Date().toISOString(),
        error: "no_parseable_json", audit_summary: raw?.slice(0, 500) ?? null,
      }).eq("id", run.id);
      return new Response(JSON.stringify({ ok: false, agent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const proposals = sanitize(parsed.proposals ?? []);
    let applied = 0;
    let queued = 0;

    for (const p of proposals) {
      const { data: task } = await supa.from("ai_improvement_tasks").insert({
        run_id: run.id,
        agent,
        severity: p.severity,
        area: p.area,
        title: p.title?.slice(0, 200) ?? "untitled",
        rationale: p.rationale?.slice(0, 2000) ?? null,
        patch: p.patch ?? {},
        status: p.severity === "auto" ? "applied" : (p.severity === "blocked" ? "skipped" : "needs_review"),
      }).select().single();

      if (p.severity === "auto" && p.patch?.scope && p.patch?.key && p.patch?.value !== undefined) {
        await supa.from("content_overrides").upsert({
          scope: p.patch.scope,
          key: p.patch.key,
          value: p.patch.value,
          source_task_id: task?.id ?? null,
        }, { onConflict: "scope,key" });
        applied += 1;
      } else if (p.severity === "review") {
        queued += 1;
      }
    }

    await supa.from("ai_improvement_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      audit_summary: parsed.audit_summary?.slice(0, 1000) ?? null,
      proposals: proposals as any,
      applied_count: applied,
      queued_count: queued,
    }).eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, agent, applied, queued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supa.from("ai_improvement_runs").update({
      status: "error", finished_at: new Date().toISOString(),
      error: (e as Error).message?.slice(0, 1000) ?? "unknown",
    }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: false, agent, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
