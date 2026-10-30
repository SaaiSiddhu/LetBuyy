-- Pre-use rollback only: restoring the old row policy after evidence exists
-- would expose private object keys and upload digests to direct merchant reads.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.merchant_kyc_documents LIMIT 1) THEN
    RAISE EXCEPTION 'KYC evidence exists; retain Gateway-only private metadata access' USING ERRCODE = '55000';
  END IF;
END $guard$;

DROP POLICY IF EXISTS merchant_kyc_documents_site_owner_select
  ON public.merchant_kyc_documents;
CREATE POLICY merchant_kyc_documents_site_owner_select
  ON public.merchant_kyc_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
NOTIFY pgrst, 'reload schema';
COMMIT;
