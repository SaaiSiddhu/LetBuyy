-- Claim an unreferenced Mumbai KYC key before deleting any S3 version. The
-- claim and document attachment serialize on the same receipt row lock.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_private_object_cleanup_jobs_status_check,
  ADD CONSTRAINT kyc_private_object_cleanup_jobs_status_check
    CHECK (status IN ('pending', 'deleting', 'completed')),
  DROP CONSTRAINT kyc_private_cleanup_completion,
  ADD CONSTRAINT kyc_private_cleanup_completion CHECK (
    (status IN ('pending', 'deleting') AND outcome IS NULL AND completed_at IS NULL)
    OR (status = 'completed' AND outcome IS NOT NULL AND completed_at IS NOT NULL)
  ),
  DROP CONSTRAINT kyc_india_scan_receipt_check,
  ADD CONSTRAINT kyc_india_scan_receipt_check CHECK (
    (scan_event_id IS NULL AND scan_verdict IS NULL AND scan_completed_at IS NULL)
    OR (storage_provider = 'aws_s3_mumbai' AND scan_event_id IS NOT NULL
      AND scan_verdict IN ('clean', 'rejected') AND scan_completed_at IS NOT NULL
      AND object_version_id IS NOT NULL AND head_verified_at IS NOT NULL
      AND ((purpose = 'upload_reservation' AND status = 'completed' AND outcome = 'retained')
        OR (purpose = 'replaced_object' AND (
          status IN ('pending', 'deleting') OR status = 'completed' AND outcome = 'deleted'))))
  );

-- The row lock makes the attachment guard serialize with the cleanup claim.
-- An in-flight insert either commits before the claim's reference check or
-- sees `deleting` and cannot attach the bytes.
CREATE OR REPLACE FUNCTION public.guard_merchant_kyc_india_receipt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF NEW.metadata->>'private_storage_provider' IS DISTINCT FROM 'aws_s3_mumbai' THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.kyc_private_object_cleanup_jobs AS j
   WHERE j.site_id = NEW.site_id AND j.document_type = NEW.document_type
     AND j.object_key = NEW.metadata->>'private_object_key'
     AND j.storage_provider = 'aws_s3_mumbai'
     AND j.purpose = 'upload_reservation'
     AND j.object_version_id = NEW.metadata->>'private_object_version_id'
     AND j.expected_sha256_hex = NEW.metadata->>'sha256'
     AND j.expected_bytes::text = NEW.metadata->>'byte_size'
     AND j.expected_content_type = NEW.metadata->>'content_type'
     AND j.reference_last4 = NEW.document_number_last4
     AND j.head_verified_at IS NOT NULL
     AND (j.status = 'pending' AND j.next_attempt_at > now()
       OR j.status = 'completed' AND j.outcome = 'retained')
     AND j.deleted_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'India KYC evidence requires a verified site-bound upload receipt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.list_due_kyc_india_cleanup_v1(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, site_id uuid, object_key text, document_type text,
  purpose text, attempts integer, object_version_id text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT j.id, j.site_id, j.object_key, j.document_type, j.purpose,
    j.attempts, j.object_version_id
    FROM public.kyc_private_object_cleanup_jobs AS j
   WHERE j.status IN ('pending', 'deleting') AND j.deleted_at IS NULL
     AND j.storage_provider = 'aws_s3_mumbai'
     AND j.next_attempt_at <= now()
   ORDER BY j.created_at, j.id
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;
REVOKE ALL ON FUNCTION public.list_due_kyc_india_cleanup_v1(integer)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.list_due_kyc_india_cleanup_v1(integer)
  TO service_role;

CREATE FUNCTION public.claim_due_kyc_india_cleanup_v1(p_id uuid, p_site uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  j public.kyc_private_object_cleanup_jobs%ROWTYPE;
  d public.merchant_kyc_documents%ROWTYPE;
BEGIN
  SELECT * INTO j FROM public.kyc_private_object_cleanup_jobs
   WHERE id = p_id AND site_id = p_site AND storage_provider = 'aws_s3_mumbai'
     AND status IN ('pending', 'deleting') AND deleted_at IS NULL
     AND next_attempt_at <= now() FOR UPDATE;
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  SELECT * INTO d FROM public.merchant_kyc_documents
   WHERE site_id = j.site_id AND metadata->>'private_object_key' = j.object_key
     AND deleted_at IS NULL FOR SHARE;
  IF FOUND THEN
    IF j.purpose = 'upload_reservation' AND j.status = 'pending'
      AND j.object_version_id IS NOT NULL
      AND d.metadata->>'private_storage_provider' = 'aws_s3_mumbai'
      AND d.metadata->>'private_object_version_id' = j.object_version_id THEN
      UPDATE public.kyc_private_object_cleanup_jobs
         SET status = 'completed', outcome = 'retained', completed_at = now()
       WHERE id = j.id;
      RETURN 'retained';
    END IF;
    RETURN 'conflict';
  END IF;
  IF j.status = 'pending' THEN
    UPDATE public.kyc_private_object_cleanup_jobs SET status = 'deleting'
     WHERE id = j.id;
  END IF;
  RETURN 'delete';
END $fn$;
REVOKE ALL ON FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
