
-- POMR core tables: problems, goals, followups, safety checklists, clinical timeline

-- 1) problem_instances
CREATE TABLE IF NOT EXISTS public.problem_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_card_id UUID,
  specialty TEXT NOT NULL DEFAULT 'general',
  problem_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  severity TEXT,
  onset_date DATE,
  resolved_date DATE,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problem_instances_user ON public.problem_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_instances_patient ON public.problem_instances(patient_card_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_instances TO authenticated;
GRANT ALL ON public.problem_instances TO service_role;
ALTER TABLE public.problem_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own problems" ON public.problem_instances
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) problem_goals
CREATE TABLE IF NOT EXISTS public.problem_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  problem_id UUID NOT NULL REFERENCES public.problem_instances(id) ON DELETE CASCADE,
  patient_card_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problem_goals_problem ON public.problem_goals(problem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_goals TO authenticated;
GRANT ALL ON public.problem_goals TO service_role;
ALTER TABLE public.problem_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON public.problem_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) problem_followups
CREATE TABLE IF NOT EXISTS public.problem_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  problem_id UUID NOT NULL REFERENCES public.problem_instances(id) ON DELETE CASCADE,
  patient_card_id UUID,
  note TEXT NOT NULL,
  next_steps TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  followup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problem_followups_problem ON public.problem_followups(problem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_followups TO authenticated;
GRANT ALL ON public.problem_followups TO service_role;
ALTER TABLE public.problem_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own followups" ON public.problem_followups
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) therapy_safety_checklists
CREATE TABLE IF NOT EXISTS public.therapy_safety_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_card_id UUID,
  problem_id UUID REFERENCES public.problem_instances(id) ON DELETE SET NULL,
  therapy TEXT NOT NULL,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_therapy_safety_patient ON public.therapy_safety_checklists(patient_card_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapy_safety_checklists TO authenticated;
GRANT ALL ON public.therapy_safety_checklists TO service_role;
ALTER TABLE public.therapy_safety_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own safety checklists" ON public.therapy_safety_checklists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) clinical_timeline_events
CREATE TABLE IF NOT EXISTS public.clinical_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_card_id UUID,
  problem_id UUID REFERENCES public.problem_instances(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  specialty TEXT,
  reference_table TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_patient ON public.clinical_timeline_events(patient_card_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_problem ON public.clinical_timeline_events(problem_id, event_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_timeline_events TO authenticated;
GRANT ALL ON public.clinical_timeline_events TO service_role;
ALTER TABLE public.clinical_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own timeline" ON public.clinical_timeline_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER trg_problem_instances_updated BEFORE UPDATE ON public.problem_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_problem_goals_updated BEFORE UPDATE ON public.problem_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_therapy_safety_updated BEFORE UPDATE ON public.therapy_safety_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
