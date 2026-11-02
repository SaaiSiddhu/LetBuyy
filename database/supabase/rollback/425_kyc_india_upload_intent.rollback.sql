-- Do not remove the versioned receipt contract after real India evidence or
-- cleanup work exists. An operator must first run a reviewed data migration.
BEGIN;
-- Refuse ABI drift before any schema mutation; CREATE OR REPLACE must not add an overload.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('queue_replaced_kyc_private_object_v1', 'public.queue_replaced_kyc_private_object_v1()', ARRAY[]::text[], 'trigger', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 421 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 421 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
      WHERE storage_provider = 'aws_s3_mumbai' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.merchant_kyc_documents
      WHERE metadata->>'private_storage_provider' = 'aws_s3_mumbai' LIMIT 1) THEN
    RAISE EXCEPTION 'India KYC object evidence exists; retain versioned upload receipts'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

DROP TRIGGER IF EXISTS merchant_kyc_india_receipt_v1 ON public.merchant_kyc_documents;
DROP FUNCTION IF EXISTS public.guard_merchant_kyc_india_receipt_v1();

CREATE OR REPLACE FUNCTION public.queue_replaced_kyc_private_object_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  old_key text := OLD.metadata->>'private_object_key';
  new_key text := NEW.metadata->>'private_object_key';
BEGIN
  IF old_key IS NULL OR old_key IS NOT DISTINCT FROM new_key THEN RETURN NEW; END IF;
  IF old_key !~ ('^kyc/' || OLD.site_id::text || '/' || OLD.document_type || '/[A-Za-z0-9_-]{1,160}$') THEN
    RAISE EXCEPTION 'Previous KYC object key is outside the owned document namespace'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.kyc_private_object_cleanup_jobs(site_id, object_key)
  VALUES (OLD.site_id, old_key)
  ON CONFLICT (object_key) DO UPDATE SET
    purpose = 'replaced_object', status = 'pending', outcome = NULL,
    completed_at = NULL, next_attempt_at = now(), attempts = 0
  WHERE public.kyc_private_object_cleanup_jobs.site_id = EXCLUDED.site_id;
  RETURN NEW;
END $fn$;

REVOKE ALL ON public.kyc_private_object_cleanup_jobs FROM app_tenant;
DROP POLICY IF EXISTS kyc_india_upload_intent_insert_v1 ON public.kyc_private_object_cleanup_jobs;
DROP POLICY IF EXISTS kyc_india_upload_intent_read_v1 ON public.kyc_private_object_cleanup_jobs;
DROP INDEX IF EXISTS public.kyc_india_upload_intent_idempotency_idx;

ALTER TABLE public.merchant_kyc_documents
  DROP CONSTRAINT IF EXISTS merchant_kyc_india_object_version_check;
ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT IF EXISTS kyc_india_upload_intent_check,
  DROP CONSTRAINT IF EXISTS kyc_private_receipt_provider_check,
  DROP COLUMN IF EXISTS storage_provider,
  DROP COLUMN IF EXISTS document_type,
  DROP COLUMN IF EXISTS expected_sha256_hex,
  DROP COLUMN IF EXISTS expected_bytes,
  DROP COLUMN IF EXISTS expected_content_type,
  DROP COLUMN IF EXISTS reference_last4,
  DROP COLUMN IF EXISTS upload_idempotency_key,
  DROP COLUMN IF EXISTS intent_expires_at,
  DROP COLUMN IF EXISTS object_version_id,
  DROP COLUMN IF EXISTS head_verified_at;

NOTIFY pgrst, 'reload schema';
COMMIT;
