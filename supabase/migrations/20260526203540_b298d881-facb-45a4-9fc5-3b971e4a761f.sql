CREATE TABLE public.agent_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('read','write','delete','list')),
  file_path text,
  commit_message text,
  commit_sha text,
  branch text,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  bytes_written integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_edits TO authenticated;
GRANT ALL ON public.agent_edits TO service_role;

ALTER TABLE public.agent_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view agent edits"
ON public.agent_edits FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deny update on agent_edits"
ON public.agent_edits AS RESTRICTIVE FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY "Deny delete on agent_edits"
ON public.agent_edits AS RESTRICTIVE FOR DELETE
TO authenticated, anon
USING (false);

CREATE INDEX idx_agent_edits_created_at ON public.agent_edits (created_at DESC);
CREATE INDEX idx_agent_edits_agent_name ON public.agent_edits (agent_name);