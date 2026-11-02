-- Match the merchant promise: KYC reference fields retain no more than four
-- characters. Existing overlong values require a reviewed privacy cleanup;
-- never silently discard evidence or pretend that a migration is lossless.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.merchant_kyc_documents
    WHERE document_number_last4 IS NOT NULL
      AND document_number_last4 !~ '^[A-Za-z0-9]{2,4}$'
  ) THEN
    RAISE EXCEPTION 'KYC reference cleanup required before enforcing four-character limit'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

ALTER TABLE public.merchant_kyc_documents
  DROP CONSTRAINT merchant_kyc_documents_last4_check;
ALTER TABLE public.merchant_kyc_documents
  ADD CONSTRAINT merchant_kyc_documents_last4_check
  CHECK (document_number_last4 IS NULL OR document_number_last4 ~ '^[A-Za-z0-9]{2,4}$');
COMMIT;
