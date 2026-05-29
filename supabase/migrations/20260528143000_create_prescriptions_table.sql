-- Create the prescriptions table used by the teleconsulta prescription panel.
-- This fixes Data API fetch failures caused by the frontend querying a table
-- that was not present in the schema migrations.

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'dispensed', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array'),
  notes TEXT NOT NULL DEFAULT '',
  cid10 TEXT NOT NULL DEFAULT '',
  signature_data_url TEXT,
  signature_hash TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_crm TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_user_created
  ON public.prescriptions(patient_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_status
  ON public.prescriptions(status);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;

CREATE POLICY "Users can view own prescriptions"
  ON public.prescriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prescriptions"
  ON public.prescriptions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.patient_cards pc
      WHERE pc.id = prescriptions.patient_id
        AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own prescriptions"
  ON public.prescriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.patient_cards pc
      WHERE pc.id = prescriptions.patient_id
        AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own prescriptions"
  ON public.prescriptions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
