-- KYC evidence metadata contains private object keys and upload digests.
-- Merchants read a sanitized status through the tenant-checked Gateway, not
-- directly from the base table. The service role remains the sole row reader
-- and writer for this table after migration 414.
BEGIN;

DROP POLICY IF EXISTS merchant_kyc_documents_site_owner_select
  ON public.merchant_kyc_documents;

NOTIFY pgrst, 'reload schema';
COMMIT;
