-- A closure that queued deletion cannot be undone by reverting the trigger.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
    WHERE closure_requested_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.merchant_kyc_documents
      WHERE metadata->>'retention_reason' = 'account_closed') THEN
    RAISE EXCEPTION 'Store closure processed KYC evidence; preserve deletion guard'
      USING ERRCODE = '23514';
  END IF;
END $guard$;

DROP TRIGGER sites_close_kyc_private_evidence_v1 ON public.sites;
DROP FUNCTION public.close_site_kyc_private_evidence_v1();
DROP TRIGGER merchant_kyc_closed_attempt_v1 ON public.merchant_kyc_documents;
DROP FUNCTION public.guard_closed_kyc_private_attempt_v1();
ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_india_closure_cleanup_receipt_check,
  DROP COLUMN closure_requested_at;

NOTIFY pgrst, 'reload schema';
COMMIT;
