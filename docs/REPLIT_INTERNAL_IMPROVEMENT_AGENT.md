# Replit Internal Improvement Agent

## Purpose

The stalled Replit site is treated as a reference source for Rhema Flow, not as a second production target. Its useful ideas are absorbed by the existing `ai-improvement-cycle` and converted into safe improvement tasks.

## Runtime

- Supabase Edge Function: `ai-improvement-cycle`
- Scheduler entrypoint: `ai-agent-scheduler`
- Canonical deploy remains: `https://rhema-care-flow.lovable.app/`
- Canonical repo remains: `JoaoRG-lab/rhema-care-flow-8d712b43`

## Configuration

Set these Supabase secrets when the Replit source is ready:

```bash
supabase secrets set REPLIT_SITE_URL="https://your-replit-site.example"
supabase secrets set REPLIT_CONTEXT="Short notes about what should be recovered from the Replit app"
```

`REPLIT_SITE_URL` is optional. If it is missing, the agent creates a review task asking for the URL/export instead of failing the cycle.

## Safety Contract

- The Replit source is read-only.
- The agent must not deploy to Replit.
- The agent must not write secrets, migrations, DNS, Supabase config, or production branches.
- Only `microcopy`, `seo`, and `llms_txt` overrides may be auto-applied.
- Structural changes remain queued as `needs_review` in `ai_improvement_tasks`.

## How It Runs

The scheduler now includes `ai-improvement-cycle` when called with:

```json
{ "agents": ["improvement"] }
```

or as part of:

```json
{ "agents": ["all"] }
```

The `replit` auditor participates in the same rotation as the other auditors. When selected, it fetches the configured public Replit snapshot, strips HTML, truncates the context, and asks the model to convert reusable UX, content, accessibility, and clinical workflow ideas into Rhema improvement proposals.
