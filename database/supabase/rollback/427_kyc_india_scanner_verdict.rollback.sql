-- The scanner fence cannot be removed after any India evidence exists.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
      WHERE storage_provider = 'aws_s3_mumbai' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.merchant_kyc_documents
      WHERE metadata->>'private_storage_provider' = 'aws_s3_mumbai' LIMIT 1) THEN
    RAISE EXCEPTION 'India KYC evidence exists; retain scanner version fence'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP FUNCTION public.record_kyc_india_scan_v1(uuid,uuid,text,uuid,text,timestamptz);
DROP TRIGGER merchant_kyc_india_scan_v1 ON public.merchant_kyc_documents;
DROP FUNCTION public.guard_merchant_kyc_india_scan_v1();
DROP INDEX public.kyc_india_scan_event_idx;
ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_india_scan_receipt_check,
  DROP COLUMN scan_event_id,
  DROP COLUMN scan_verdict,
  DROP COLUMN scan_completed_at;
NOTIFY pgrst, 'reload schema';
COMMIT;
