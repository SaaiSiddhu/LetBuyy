-- Pre-use rollback only. Never reopen merchant writes over recorded KYC evidence.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.merchant_kyc_documents LIMIT 1) THEN
    RAISE EXCEPTION 'KYC evidence exists; keep the server-write guard and use a reviewed forward change' USING ERRCODE = '55000';
  END IF;
END $guard$;

DROP TRIGGER IF EXISTS merchant_kyc_server_write_v1 ON public.merchant_kyc_documents;
DROP FUNCTION IF EXISTS public.guard_merchant_kyc_server_write_v1();
DROP POLICY IF EXISTS merchant_kyc_documents_site_owner_select ON public.merchant_kyc_documents;
CREATE POLICY merchant_kyc_documents_site_owner_all ON public.merchant_kyc_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
ALTER TABLE public.merchant_kyc_documents NO FORCE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
COMMIT;
