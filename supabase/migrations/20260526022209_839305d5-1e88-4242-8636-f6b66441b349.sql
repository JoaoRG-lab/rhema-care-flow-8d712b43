-- Code Console — multi-agent shared workspace
CREATE TYPE public.code_console_agent AS ENUM ('user', 'chatgpt', 'codex', 'perplexity', 'custom', 'sentinel');

CREATE TABLE public.code_console_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova sessão',
  deploy_agent public.code_console_agent,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.code_console_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.code_console_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  agent public.code_console_agent NOT NULL,
  content TEXT NOT NULL,
  destructive_warning TEXT,
  promoted_for_deploy BOOLEAN NOT NULL DEFAULT false,
  model TEXT,
  citations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_threads_user ON public.code_console_threads(user_id, updated_at DESC);
CREATE INDEX idx_cc_messages_thread ON public.code_console_messages(thread_id, created_at);

ALTER TABLE public.code_console_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_console_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_threads_owner_all"
  ON public.code_console_threads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cc_messages_owner_all"
  ON public.code_console_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER cc_threads_updated_at
  BEFORE UPDATE ON public.code_console_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();