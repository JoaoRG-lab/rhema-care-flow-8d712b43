
-- 1. Profile privilege escalation: prevent users from self-promoting verification_tier
CREATE OR REPLACE FUNCTION public.prevent_self_tier_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_tier IS DISTINCT FROM OLD.verification_tier
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change verification_tier';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_tier_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_tier_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_tier_escalation();

-- 2. newsletter_digests: remove public read of recipient emails
DROP POLICY IF EXISTS "Anyone can view sent digests" ON public.newsletter_digests;
CREATE POLICY "Admins can view digests"
ON public.newsletter_digests FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 3. agent_run_log: restrict to admins only
DROP POLICY IF EXISTS "Anyone authenticated can view agent logs" ON public.agent_run_log;
CREATE POLICY "Admins can view agent logs"
ON public.agent_run_log FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 4. site_activity_log: restrict to admins
DROP POLICY IF EXISTS "System can read activity" ON public.site_activity_log;
CREATE POLICY "Admins can read activity"
ON public.site_activity_log FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 5. Convert PERMISSIVE auth gates to RESTRICTIVE
DROP POLICY IF EXISTS "Require authentication for ai_research_pipeline" ON public.ai_research_pipeline;
CREATE POLICY "Require authentication for ai_research_pipeline"
ON public.ai_research_pipeline AS RESTRICTIVE
FOR ALL TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Require authentication for consultation_sessions" ON public.consultation_sessions;
CREATE POLICY "Require authentication for consultation_sessions"
ON public.consultation_sessions AS RESTRICTIVE
FOR ALL TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Require authentication for knowledge_contributions" ON public.knowledge_contributions;
CREATE POLICY "Require authentication for knowledge_contributions"
ON public.knowledge_contributions AS RESTRICTIVE
FOR ALL TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Require authentication for outreach_campaigns" ON public.outreach_campaigns;
CREATE POLICY "Require authentication for outreach_campaigns"
ON public.outreach_campaigns AS RESTRICTIVE
FOR ALL TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Require authentication for sms_templates" ON public.sms_templates;
CREATE POLICY "Require authentication for sms_templates"
ON public.sms_templates AS RESTRICTIVE
FOR ALL TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 6. payment_transactions: explicit deny for non-service-role writes
CREATE POLICY "Deny client inserts on payment_transactions"
ON public.payment_transactions FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny client updates on payment_transactions"
ON public.payment_transactions FOR UPDATE
TO anon, authenticated
USING (false);

CREATE POLICY "Deny client deletes on payment_transactions"
ON public.payment_transactions FOR DELETE
TO anon, authenticated
USING (false);

-- 7. education-images storage: enforce per-user folder on upload
DROP POLICY IF EXISTS "Authenticated users can upload education images" ON storage.objects;
CREATE POLICY "Users can upload to own education-images folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'education-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
