// Multi-AI rotating scheduler: every 5 min one provider audits the site
// and proposes improvements. Safe content-only patches auto-apply via
// content_overrides; structural patches queue as needs_review.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Agent =
  | "perplexity" | "gemini" | "openai" | "anthropic"
  | "grok" | "deepseek" | "groq" | "openrouter";

const ROTATION: Agent[] = [
  "perplexity", "gemini", "openai", "anthropic",
  "grok", "deepseek", "groq", "openrouter",
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
  const { data: routes } = await supa.rpc("noop").catch(() => ({ data: null }));
  const prompt = `Audit UHS Health OS (rheumatology + multi-specialty clinical platform).
Existing public routes: /, /learn, /scores, /landing, /about.
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
