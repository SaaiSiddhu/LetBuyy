-- Once a replacement has queued a private object, retaining the retry record is
-- required for deletion. A later forward migration must drain it first.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs LIMIT 1) THEN
    RAISE EXCEPTION 'KYC private cleanup records exist; retain the retry queue and use a reviewed forward change'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

ALTER TABLE public.merchant_kyc_documents
  DROP CONSTRAINT IF EXISTS merchant_kyc_private_object_key_owned_check;

DROP TRIGGER IF EXISTS merchant_kyc_queue_replaced_private_object_v1
  ON public.merchant_kyc_documents;
DROP FUNCTION IF EXISTS public.queue_replaced_kyc_private_object_v1();
DROP FUNCTION IF EXISTS public.list_due_kyc_private_cleanup_v1(integer);
DROP TABLE public.kyc_private_object_cleanup_jobs;
NOTIFY pgrst, 'reload schema';
COMMIT;
