-- Roll back only before this expiry path has processed a document.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
    WHERE retention_expired_at IS NOT NULL) THEN
    RAISE EXCEPTION 'India KYC pending attempts expired; preserve retention guard'
      USING ERRCODE = '23514';
  END IF;
END $guard$;

DROP FUNCTION public.expire_kyc_india_pending_v1(integer);
DROP TRIGGER merchant_kyc_india_expired_attempt_v1 ON public.merchant_kyc_documents;
DROP FUNCTION public.guard_expired_kyc_india_attempt_v1();
DROP INDEX public.merchant_kyc_india_pending_retention_idx;
ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_india_retention_expiry_receipt_check,
  DROP COLUMN retention_expired_at;

NOTIFY pgrst, 'reload schema';
COMMIT;
