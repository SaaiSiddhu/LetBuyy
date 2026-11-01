-- Do not remove the versioned receipt contract after real India evidence or
-- cleanup work exists. An operator must first run a reviewed data migration.
BEGIN;
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
