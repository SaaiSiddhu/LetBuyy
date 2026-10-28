BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.checkout_sessions WHERE payment_credential_id IS NOT NULL) THEN
  RAISE EXCEPTION '406 rollback requires credential-bound checkouts to drain; retain schema to preserve history';
 END IF;
END $guard$;
DROP TRIGGER checkout_payment_credential_v1 ON public.checkout_sessions;
DROP FUNCTION public.guard_checkout_payment_credential_v1();
DROP INDEX public.checkout_payment_credential_drain_idx;
ALTER TABLE public.checkout_sessions DROP CONSTRAINT checkout_payment_credential_scope_fk,
 DROP CONSTRAINT checkout_payment_credential_scope_present,DROP COLUMN payment_credential_id;
ALTER TABLE public.payment_credentials DROP CONSTRAINT payment_credentials_site_reference_unique;
NOTIFY pgrst,'reload schema';
COMMIT;
