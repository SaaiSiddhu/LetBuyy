-- A store closure must revoke every current private KYC object reference in
-- the same transaction as sites.deleted_at. The existing document replacement
-- trigger queues the old exact key for version-aware deletion.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD COLUMN closure_requested_at timestamptz,
  ADD CONSTRAINT kyc_india_closure_cleanup_receipt_check CHECK (
    closure_requested_at IS NULL OR
    (storage_provider = 'aws_s3_mumbai' AND purpose = 'replaced_object')
  );

CREATE FUNCTION public.guard_closed_kyc_private_attempt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF OLD.metadata->>'retention_reason' = 'account_closed'
    AND OLD.metadata->>'private_object_key' IS NULL
    AND NEW.metadata->>'private_object_key' IS NULL
    AND (NEW.metadata->>'retention_reason' IS DISTINCT FROM 'account_closed'
      OR NEW.status IS DISTINCT FROM 'needs_review'
      OR NEW.metadata->>'provider_verified' IS DISTINCT FROM 'false'
      OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Closed store KYC requires a new private upload'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_closed_kyc_private_attempt_v1() FROM PUBLIC;
CREATE TRIGGER merchant_kyc_closed_attempt_v1
  BEFORE UPDATE OF status, verified_at, rejected_at, metadata
  ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_kyc_private_attempt_v1();

CREATE FUNCTION public.close_site_kyc_private_evidence_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  d public.merchant_kyc_documents%ROWTYPE;
  old_key text;
BEGIN
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  FOR d IN
    SELECT * FROM public.merchant_kyc_documents
     WHERE site_id = NEW.id AND deleted_at IS NULL
       AND metadata->>'private_object_key' IS NOT NULL
     ORDER BY id FOR UPDATE
  LOOP
    old_key := d.metadata->>'private_object_key';
    UPDATE public.merchant_kyc_documents
       SET metadata = (d.metadata - ARRAY[
            'private_storage_provider', 'private_object_key',
            'private_object_version_id', 'private_upload_receipt_id',
            'sha256', 'byte_size', 'content_type', 'malware_scan_status',
            'scan_event_id', 'scan_completed_at', 'provider_unavailable'
          ]) || jsonb_build_object(
            'retention_reason', 'account_closed',
            'retention_closed_at', NEW.deleted_at,
            'retention_requires_resubmission', true,
            'retention_previous_status', d.status,
            'retention_previous_decision_at', coalesce(d.verified_at, d.rejected_at),
            'provider_verified', false),
           status = 'needs_review', verified_at = NULL, rejected_at = NULL,
           submitted_at = NULL, file_url = NULL, file_name = NULL,
           updated_at = now()
     WHERE id = d.id AND site_id = NEW.id;
    IF d.metadata->>'private_storage_provider' = 'aws_s3_mumbai' THEN
      UPDATE public.kyc_private_object_cleanup_jobs
         SET closure_requested_at = NEW.deleted_at
       WHERE site_id = NEW.id AND object_key = old_key
         AND storage_provider = 'aws_s3_mumbai'
         AND purpose = 'replaced_object' AND status = 'pending';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Store closure did not reserve India KYC deletion'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.kyc_private_object_cleanup_jobs
       WHERE site_id = NEW.id AND object_key = old_key
         AND purpose = 'replaced_object' AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Store closure did not reserve private KYC deletion'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.close_site_kyc_private_evidence_v1()
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
CREATE TRIGGER sites_close_kyc_private_evidence_v1
  AFTER UPDATE OF deleted_at ON public.sites
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.close_site_kyc_private_evidence_v1();

NOTIFY pgrst, 'reload schema';
COMMIT;
