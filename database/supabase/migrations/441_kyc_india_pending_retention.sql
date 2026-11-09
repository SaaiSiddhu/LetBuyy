-- Expire stale India KYC attempts without deleting a still-referenced S3 key.
-- The existing replacement trigger creates the version-aware deletion receipt
-- in the same transaction that removes the document's active object reference.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD COLUMN retention_expired_at timestamptz,
  ADD CONSTRAINT kyc_india_retention_expiry_receipt_check CHECK (
    retention_expired_at IS NULL OR
    (storage_provider = 'aws_s3_mumbai' AND purpose = 'replaced_object')
  );

CREATE INDEX merchant_kyc_india_pending_retention_idx
  ON public.merchant_kyc_documents(submitted_at, id)
  WHERE deleted_at IS NULL AND status IN ('submitted', 'needs_review')
    AND metadata->>'private_storage_provider' = 'aws_s3_mumbai';

CREATE FUNCTION public.guard_expired_kyc_india_attempt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF OLD.metadata->>'retention_reason' = 'pending_timeout'
    AND OLD.metadata->>'private_object_key' IS NULL
    AND NEW.metadata->>'private_object_key' IS NULL
    AND (NEW.metadata->>'retention_reason' IS DISTINCT FROM 'pending_timeout'
      OR NEW.status IS DISTINCT FROM 'needs_review'
      OR NEW.provider_reference IS NOT NULL OR NEW.verified_at IS NOT NULL
      OR NEW.rejected_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Expired India KYC attempt requires a new private upload'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_expired_kyc_india_attempt_v1() FROM PUBLIC;
CREATE TRIGGER merchant_kyc_india_expired_attempt_v1
  BEFORE UPDATE OF status, provider_reference, verified_at, rejected_at, metadata
  ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_expired_kyc_india_attempt_v1();

CREATE FUNCTION public.expire_kyc_india_pending_v1(p_limit integer DEFAULT 20)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  d public.merchant_kyc_documents%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR d IN
    SELECT * FROM public.merchant_kyc_documents
     WHERE deleted_at IS NULL AND status IN ('submitted', 'needs_review')
       AND metadata->>'private_storage_provider' = 'aws_s3_mumbai'
       AND metadata->>'private_object_key' IS NOT NULL
       AND submitted_at IS NOT NULL
       AND submitted_at <= now() - interval '30 days'
     ORDER BY submitted_at, id
     LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.merchant_kyc_documents
       SET metadata = (d.metadata - ARRAY[
            'private_storage_provider', 'private_object_key',
            'private_object_version_id', 'private_upload_receipt_id',
            'sha256', 'byte_size', 'content_type', 'malware_scan_status',
            'scan_event_id', 'scan_completed_at', 'provider_unavailable'
          ]) || jsonb_build_object(
            'retention_reason', 'pending_timeout',
            'retention_expired_at', now(),
            'retention_requires_resubmission', true,
            'provider_verified', false),
           status = 'needs_review', provider_reference = NULL,
           verified_at = NULL, rejected_at = NULL, submitted_at = NULL,
           file_url = NULL, file_name = NULL, updated_at = now()
     WHERE id = d.id AND site_id = d.site_id;
    UPDATE public.kyc_private_object_cleanup_jobs
       SET retention_expired_at = now()
     WHERE site_id = d.site_id
       AND object_key = d.metadata->>'private_object_key'
       AND storage_provider = 'aws_s3_mumbai'
       AND purpose = 'replaced_object' AND status = 'pending';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'India KYC expiry did not reserve a deletion receipt'
        USING ERRCODE = '23514';
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $fn$;
REVOKE ALL ON FUNCTION public.expire_kyc_india_pending_v1(integer)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.expire_kyc_india_pending_v1(integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
