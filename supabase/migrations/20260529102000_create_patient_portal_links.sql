-- Patient Portal must map to one existing patient card.
-- No patient is created from the patient-facing portal.

CREATE TABLE IF NOT EXISTS public.patient_portal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_card_id UUID NOT NULL REFERENCES public.patient_cards(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (patient_card_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_portal_links_patient
  ON public.patient_portal_links(patient_card_id);

ALTER TABLE public.patient_portal_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.patient_portal_links TO authenticated;

CREATE POLICY "Patients can view own portal link"
  ON public.patient_portal_links
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_my_patient_portal(
  p_patient_code TEXT,
  p_mrn_last4 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_existing public.patient_portal_links%ROWTYPE;
  v_patient public.patient_cards%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT *
  INTO v_existing
  FROM public.patient_portal_links
  WHERE user_id = v_user;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'already_linked',
      'patient_card_id', v_existing.patient_card_id
    );
  END IF;

  IF trim(coalesce(p_patient_code, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patient_code_required');
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.patient_cards pc
  WHERE lower(pc.patient_code) = lower(trim(p_patient_code))
    AND (
      pc.mrn_last4 IS NULL
      OR pc.mrn_last4 = trim(coalesce(p_mrn_last4, ''))
    );

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patient_not_found');
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patient_match_not_unique');
  END IF;

  SELECT *
  INTO v_patient
  FROM public.patient_cards pc
  WHERE lower(pc.patient_code) = lower(trim(p_patient_code))
    AND (
      pc.mrn_last4 IS NULL
      OR pc.mrn_last4 = trim(coalesce(p_mrn_last4, ''))
    )
  LIMIT 1;

  BEGIN
    INSERT INTO public.patient_portal_links (user_id, patient_card_id)
    VALUES (v_user, v_patient.id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patient_already_linked');
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'linked',
    'patient_card_id', v_patient.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_patient_portal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_link public.patient_portal_links%ROWTYPE;
  v_patient public.patient_cards%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT *
  INTO v_link
  FROM public.patient_portal_links
  WHERE user_id = v_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_linked');
  END IF;

  SELECT *
  INTO v_patient
  FROM public.patient_cards
  WHERE id = v_link.patient_card_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patient_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'link', jsonb_build_object(
      'claimed_at', v_link.claimed_at
    ),
    'patient', jsonb_build_object(
      'id', v_patient.id,
      'patient_code', v_patient.patient_code,
      'mrn_last4', v_patient.mrn_last4,
      'diagnosis_tags', coalesce(to_jsonb(v_patient.diagnosis_tags), '[]'::jsonb),
      'therapy_tags', coalesce(to_jsonb(v_patient.therapy_tags), '[]'::jsonb),
      'risk_flags', coalesce(to_jsonb(v_patient.risk_flags), '[]'::jsonb),
      'last_visit_date', v_patient.last_visit_date,
      'next_followup_date', v_patient.next_followup_date
    ),
    'scores', coalesce((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.created_at)
      FROM (
        SELECT score_type, calculated_score, created_at
        FROM public.score_entries
        WHERE patient_card_id = v_patient.id
        ORDER BY created_at DESC
        LIMIT 12
      ) s
    ), '[]'::jsonb),
    'monitoring', coalesce((
      SELECT jsonb_agg(row_to_json(m) ORDER BY m.due_date)
      FROM (
        SELECT id, event_type, due_date, status, completed_at, notes
        FROM public.monitoring_events
        WHERE patient_card_id = v_patient.id
        ORDER BY due_date ASC
        LIMIT 12
      ) m
    ), '[]'::jsonb),
    'prescriptions', coalesce((
      SELECT jsonb_agg(row_to_json(p) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, status, items, notes, cid10, signed_at, created_at
        FROM public.prescriptions
        WHERE patient_id = v_patient.id
        ORDER BY created_at DESC
        LIMIT 8
      ) p
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_my_patient_portal(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_patient_portal() TO authenticated;
