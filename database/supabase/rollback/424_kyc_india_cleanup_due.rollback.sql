-- Restore the pre-cleanup receipt contract only before any India intent exists.
BEGIN;
-- Refuse ABI drift before any schema mutation; CREATE OR REPLACE must not add an overload.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('guard_merchant_kyc_india_receipt_v1', 'public.guard_merchant_kyc_india_receipt_v1()', ARRAY[]::text[], 'trigger', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 424 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 424 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
    WHERE storage_provider = 'aws_s3_mumbai') THEN
    RAISE EXCEPTION 'India KYC receipts exist; retain version-aware cleanup'
      USING ERRCODE = '23514';
  END IF;
END $guard$;

DROP FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid);
DROP FUNCTION public.list_due_kyc_india_cleanup_v1(integer);

CREATE OR REPLACE FUNCTION public.guard_merchant_kyc_india_receipt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF NEW.metadata->>'private_storage_provider' IS DISTINCT FROM 'aws_s3_mumbai' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kyc_private_object_cleanup_jobs AS j
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
       AND (j.status = 'pending' OR (j.status = 'completed' AND j.outcome = 'retained'))
       AND j.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'India KYC evidence requires a verified site-bound upload receipt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_india_scan_receipt_check,
  ADD CONSTRAINT kyc_india_scan_receipt_check CHECK (
    (scan_event_id IS NULL AND scan_verdict IS NULL AND scan_completed_at IS NULL)
    OR (storage_provider = 'aws_s3_mumbai' AND purpose = 'upload_reservation'
      AND status = 'completed' AND outcome = 'retained'
      AND object_version_id IS NOT NULL AND head_verified_at IS NOT NULL
      AND scan_event_id IS NOT NULL AND scan_verdict IN ('clean', 'rejected')
      AND scan_completed_at IS NOT NULL)
  ),
  DROP CONSTRAINT kyc_private_cleanup_completion,
  ADD CONSTRAINT kyc_private_cleanup_completion CHECK (
    (status = 'pending' AND outcome IS NULL AND completed_at IS NULL)
    OR (status = 'completed' AND outcome IS NOT NULL AND completed_at IS NOT NULL)
  ),
  DROP CONSTRAINT kyc_private_object_cleanup_jobs_status_check,
  ADD CONSTRAINT kyc_private_object_cleanup_jobs_status_check
    CHECK (status IN ('pending', 'completed'));

NOTIFY pgrst, 'reload schema';
COMMIT;
