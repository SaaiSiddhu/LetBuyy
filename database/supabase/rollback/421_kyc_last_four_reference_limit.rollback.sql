-- Reverses the schema limit only; it does not restore or create any identifier.
BEGIN;
ALTER TABLE public.merchant_kyc_documents
  DROP CONSTRAINT merchant_kyc_documents_last4_check;
ALTER TABLE public.merchant_kyc_documents
  ADD CONSTRAINT merchant_kyc_documents_last4_check
  CHECK (document_number_last4 IS NULL OR document_number_last4 ~ '^[A-Za-z0-9]{2,8}$');
COMMIT;
