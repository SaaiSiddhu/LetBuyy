BEGIN;
-- Once new history or bindings exist, restoring the former one-row owner would
-- discard recovery authority. Roll back applications with schema retained;
-- otherwise restore the pre-change backup after an explicitly approved drain.
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.payment_credentials WHERE credential_version<>1 OR provider_key_id IS NOT NULL
  OR provider_account_id IS NOT NULL OR selected_for_checkout)
 OR EXISTS(SELECT 1 FROM public.payment_attempts WHERE credential_id IS NOT NULL) THEN
  RAISE EXCEPTION '404 rollback requires new credential history and attempts to drain; no history was removed';
 END IF;
END $guard$;
DROP TRIGGER payment_credential_binding_v1 ON public.payments;
DROP TRIGGER payment_attempt_credential_binding_v1 ON public.payment_attempts;
DROP FUNCTION public.guard_payment_credential_binding_v1();
DROP INDEX public.payment_attempts_credential_history_idx;
ALTER TABLE public.payment_attempts DROP CONSTRAINT payment_attempts_complete_credential_scope,
 DROP CONSTRAINT payment_attempts_credential_scope_fk,DROP COLUMN credential_id,DROP COLUMN credential_mode;
ALTER TABLE public.payments DROP CONSTRAINT payments_credential_scope_fk,DROP CONSTRAINT payments_credential_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_credential_id_fkey
 FOREIGN KEY(credential_id) REFERENCES public.payment_credentials(id) ON DELETE SET NULL;
DROP TRIGGER payment_credential_history_v1 ON public.payment_credentials;
DROP FUNCTION public.guard_payment_credential_history_v1();
DROP INDEX public.payment_credentials_one_checkout_per_environment;
DROP INDEX public.payment_credentials_one_provider_account;
DROP INDEX public.payment_credentials_one_manual_key;
ALTER TABLE public.payment_credentials DROP CONSTRAINT payment_credentials_connection_scope_fk,
 DROP CONSTRAINT payment_credentials_scope_version_unique,DROP CONSTRAINT payment_credentials_connection_version_unique,
 DROP CONSTRAINT payment_credentials_selected_ready,DROP CONSTRAINT payment_credentials_key_environment,
 DROP COLUMN connection_id,DROP COLUMN credential_version,DROP COLUMN provider_key_id,
 DROP COLUMN provider_account_id,DROP COLUMN selected_for_checkout,
 ADD CONSTRAINT payment_credentials_site_id_provider_mode_key UNIQUE(site_id,provider,mode);
REVOKE UPDATE(status,updated_at,updated_by) ON public.payment_credentials FROM service_role;
GRANT UPDATE,DELETE ON public.payment_credentials TO service_role,app_tenant;
NOTIFY pgrst,'reload schema';
COMMIT;
