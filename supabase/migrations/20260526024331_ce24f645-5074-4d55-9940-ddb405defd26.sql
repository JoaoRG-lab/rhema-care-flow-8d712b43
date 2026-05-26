-- AI Improvement Scheduler (multi-agent rotation, every 5 min)

CREATE TYPE public.ai_agent AS ENUM (
  'perplexity', 'gemini', 'openai', 'anthropic', 'grok', 'deepseek', 'groq', 'openrouter'
);

CREATE TYPE public.ai_run_status AS ENUM ('running', 'success', 'error', 'skipped');
CREATE TYPE public.ai_task_severity AS ENUM ('auto', 'review', 'blocked');
CREATE TYPE public.ai_task_area AS ENUM ('a11y', 'seo', 'copy', 'performance', 'security', 'i18n', 'content');
CREATE TYPE public.ai_task_status AS ENUM ('pending', 'applied', 'skipped', 'failed', 'needs_review');

-- Runs (one per scheduler tick)
CREATE TABLE public.ai_improvement_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent public.ai_agent NOT NULL,
  status public.ai_run_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  audit_summary text,
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_count int NOT NULL DEFAULT 0,
  queued_count int NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX idx_ai_runs_started ON public.ai_improvement_runs (started_at DESC);
CREATE INDEX idx_ai_runs_agent ON public.ai_improvement_runs (agent, started_at DESC);

-- Tasks (proposals from runs)
CREATE TABLE public.ai_improvement_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.ai_improvement_runs(id) ON DELETE CASCADE NOT NULL,
  agent public.ai_agent NOT NULL,
  severity public.ai_task_severity NOT NULL DEFAULT 'review',
  area public.ai_task_area NOT NULL,
  title text NOT NULL,
  rationale text,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.ai_task_status NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_tasks_status ON public.ai_improvement_tasks (status, created_at DESC);
CREATE INDEX idx_ai_tasks_area ON public.ai_improvement_tasks (area, status);

-- Dynamic content overrides (auto-apply target)
CREATE TABLE public.content_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,            -- 'microcopy' | 'seo' | 'llms_txt'
  key text NOT NULL,              -- e.g. 'home.hero.title' or 'route:/learn'
  value jsonb NOT NULL,
  source_task_id uuid REFERENCES public.ai_improvement_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope, key)
);
CREATE INDEX idx_content_overrides_scope ON public.content_overrides (scope, key);

-- RLS
ALTER TABLE public.ai_improvement_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_improvement_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_overrides ENABLE ROW LEVEL SECURITY;

-- Admins read everything
CREATE POLICY "Admins read runs" ON public.ai_improvement_runs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins read tasks" ON public.ai_improvement_tasks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update tasks" ON public.ai_improvement_tasks
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Content overrides are publicly readable (used by frontend SSR/CSR)
CREATE POLICY "Public read overrides" ON public.content_overrides
  FOR SELECT TO anon, authenticated USING (true);

-- Writes happen via edge function with service role (bypasses RLS).
-- No INSERT/UPDATE/DELETE policies for authenticated users on runs/overrides.

-- Trigger to bump updated_at on overrides
CREATE TRIGGER trg_content_overrides_updated
  BEFORE UPDATE ON public.content_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();