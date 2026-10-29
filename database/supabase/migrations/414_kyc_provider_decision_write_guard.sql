-- Merchant evidence submissions flow through the Gateway. A merchant database
-- role may read its own KYC status but cannot manufacture provider approval.
BEGIN;

DROP POLICY IF EXISTS merchant_kyc_documents_site_owner_all ON public.merchant_kyc_documents;
CREATE POLICY merchant_kyc_documents_site_owner_select ON public.merchant_kyc_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

CREATE FUNCTION public.guard_merchant_kyc_server_write_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'KYC provider decisions are server managed' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER merchant_kyc_server_write_v1
  BEFORE INSERT OR UPDATE OR DELETE ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_merchant_kyc_server_write_v1();

ALTER TABLE public.merchant_kyc_documents FORCE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
COMMIT;
