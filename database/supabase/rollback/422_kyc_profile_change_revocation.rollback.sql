-- Pre-use rollback only; removing this guard after evidence exists could make
-- a later profile edit leave an old approval current.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.merchant_kyc_documents LIMIT 1) THEN
    RAISE EXCEPTION 'KYC evidence exists; retain profile-change revocation and use a reviewed forward change' USING ERRCODE = '55000';
  END IF;
END $guard$;

DROP TRIGGER IF EXISTS sites_revoke_kyc_on_profile_change_v1 ON public.sites;
DROP FUNCTION IF EXISTS public.revoke_kyc_on_profile_change_v1();
NOTIFY pgrst, 'reload schema';
COMMIT;
