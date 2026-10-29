-- D2: one store/environment owns a connection. Extend the canonical credential
-- owner; each row is an immutable credential version, not another payment system.
-- Existing rows remain unselected. No live readiness, migration of unknown
-- provider identity, key decryption, collection or historical money is inferred.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.payment_credentials
 ADD COLUMN connection_id uuid,
 ADD COLUMN credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
 ADD COLUMN provider_key_id text,
 ADD COLUMN provider_account_id text,
 ADD COLUMN selected_for_checkout boolean NOT NULL DEFAULT false;
-- This structural backfill must not manufacture a verification/update date.
-- The migration runner executes the file transactionally; only this named
-- user trigger is paused, never RLS or the table's integrity controls.
ALTER TABLE public.payment_credentials DISABLE TRIGGER trg_payment_credentials_updated_at;
UPDATE public.payment_credentials SET connection_id=id;
ALTER TABLE public.payment_credentials ENABLE TRIGGER trg_payment_credentials_updated_at;
ALTER TABLE public.payment_credentials ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE public.payment_credentials
 DROP CONSTRAINT payment_credentials_site_id_provider_mode_key,
 ADD CONSTRAINT payment_credentials_scope_version_unique UNIQUE(id,site_id,provider,mode),
 ADD CONSTRAINT payment_credentials_connection_version_unique UNIQUE(connection_id,credential_version),
 ADD CONSTRAINT payment_credentials_connection_scope_fk FOREIGN KEY(connection_id,site_id,provider,mode)
  REFERENCES public.payment_credentials(id,site_id,provider,mode) ON DELETE RESTRICT,
 ADD CONSTRAINT payment_credentials_selected_ready CHECK(NOT selected_for_checkout OR
  (status='active' AND last_verified_at IS NOT NULL AND provider_key_id IS NOT NULL
   AND mode='sandbox' AND provider='razorpay')),
 ADD CONSTRAINT payment_credentials_key_environment CHECK(provider_key_id IS NULL OR
  (provider='razorpay' AND ((mode='sandbox' AND provider_key_id ~ '^rzp_test_[A-Za-z0-9]+$') OR
   (mode='live' AND provider_key_id ~ '^rzp_live_[A-Za-z0-9]+$'))));
CREATE UNIQUE INDEX payment_credentials_one_checkout_per_environment
 ON public.payment_credentials(site_id,mode) WHERE selected_for_checkout AND deleted_at IS NULL;
CREATE UNIQUE INDEX payment_credentials_one_provider_account
 ON public.payment_credentials(provider,mode,provider_account_id)
 WHERE id=connection_id AND provider_account_id IS NOT NULL;
CREATE UNIQUE INDEX payment_credentials_one_manual_key
 ON public.payment_credentials(provider,mode,provider_key_id)
 WHERE id=connection_id AND provider_key_id IS NOT NULL;

CREATE FUNCTION public.guard_payment_credential_history_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE root public.payment_credentials;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment credential history cannot be deleted' USING ERRCODE='22023'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.connection_id IS NULL THEN NEW.connection_id:=NEW.id; END IF;
  IF NEW.connection_id=NEW.id THEN
   IF NEW.credential_version<>1 THEN RAISE EXCEPTION 'Invalid first credential version' USING ERRCODE='22023'; END IF;
  ELSE
   SELECT * INTO root FROM public.payment_credentials WHERE id=NEW.connection_id AND id=connection_id FOR KEY SHARE;
   IF root.id IS NULL OR (root.site_id,root.provider,root.mode,root.provider_key_id,root.provider_account_id)
     IS DISTINCT FROM (NEW.site_id,NEW.provider,NEW.mode,NEW.provider_key_id,NEW.provider_account_id)
     OR NEW.credential_version<=1 THEN
    RAISE EXCEPTION 'Payment connection scope cannot change' USING ERRCODE='22023';
   END IF;
  END IF;
  -- Selection is an explicit, separately verified operation; inserting a saved
  -- key is never activation, including a caller omitting the old status default.
  IF NEW.selected_for_checkout THEN RAISE EXCEPTION 'Save cannot activate checkout' USING ERRCODE='22023'; END IF;
  RETURN NEW;
 END IF;
 IF (NEW.id,NEW.site_id,NEW.provider,NEW.mode,NEW.connection_id,NEW.credential_version,
  NEW.provider_key_id,NEW.provider_account_id,NEW.kms_key_ref,NEW.encrypted_credentials,
  NEW.last_verified_at,NEW.metadata,NEW.created_at,NEW.created_by,NEW.deleted_at)
  IS DISTINCT FROM
  (OLD.id,OLD.site_id,OLD.provider,OLD.mode,OLD.connection_id,OLD.credential_version,
  OLD.provider_key_id,OLD.provider_account_id,OLD.kms_key_ref,OLD.encrypted_credentials,
  OLD.last_verified_at,OLD.metadata,OLD.created_at,OLD.created_by,OLD.deleted_at) THEN
  RAISE EXCEPTION 'Append a new credential version; history is immutable' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER payment_credential_history_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.payment_credentials
 FOR EACH ROW EXECUTE FUNCTION public.guard_payment_credential_history_v1();
REVOKE ALL ON FUNCTION public.guard_payment_credential_history_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_payment_credential_history_v1() TO service_role;
-- Status/selection are the only mutable operational state. Secrets, account,
-- site and environment cannot be overwritten even by normal service grants.
REVOKE UPDATE,DELETE ON public.payment_credentials FROM service_role,app_tenant,anon,authenticated;
GRANT UPDATE(status,selected_for_checkout,updated_at,updated_by) ON public.payment_credentials TO service_role;

ALTER TABLE public.payments DROP CONSTRAINT payments_credential_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_credential_id_fkey
 FOREIGN KEY(credential_id) REFERENCES public.payment_credentials(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_credential_scope_fk
 FOREIGN KEY(credential_id,site_id,provider,mode) REFERENCES public.payment_credentials(id,site_id,provider,mode)
 ON DELETE RESTRICT NOT VALID;
-- NOT VALID preserves any legacy mismatch for explicit remediation, while all
-- new/changed references are enforced. No old identifier is silently rewritten.
ALTER TABLE public.payment_attempts
 ADD COLUMN credential_id uuid,
 ADD COLUMN credential_mode text CHECK(credential_mode IN('sandbox','live')),
 ADD CONSTRAINT payment_attempts_credential_scope_fk FOREIGN KEY(credential_id,site_id,provider,credential_mode)
  REFERENCES public.payment_credentials(id,site_id,provider,mode) ON DELETE RESTRICT,
 ADD CONSTRAINT payment_attempts_complete_credential_scope CHECK((credential_id IS NULL)=(credential_mode IS NULL));
CREATE INDEX payment_attempts_credential_history_idx ON public.payment_attempts(site_id,credential_id,created_at DESC)
 WHERE credential_id IS NOT NULL;

CREATE FUNCTION public.guard_payment_credential_binding_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF OLD.credential_id IS NOT NULL AND
  (NEW.credential_id,NEW.site_id,NEW.provider) IS DISTINCT FROM (OLD.credential_id,OLD.site_id,OLD.provider) THEN
  RAISE EXCEPTION 'Historical payment credential binding is immutable' USING ERRCODE='22023';
 END IF;
 IF OLD.credential_id IS NOT NULL THEN
  IF TG_TABLE_NAME='payments' THEN
   IF NEW.mode IS DISTINCT FROM OLD.mode THEN RAISE EXCEPTION 'Payment environment is immutable' USING ERRCODE='22023'; END IF;
  ELSE
   IF NEW.credential_mode IS DISTINCT FROM OLD.credential_mode THEN RAISE EXCEPTION 'Payment environment is immutable' USING ERRCODE='22023'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER payment_credential_binding_v1 BEFORE UPDATE ON public.payments
 FOR EACH ROW EXECUTE FUNCTION public.guard_payment_credential_binding_v1();
CREATE TRIGGER payment_attempt_credential_binding_v1 BEFORE UPDATE ON public.payment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.guard_payment_credential_binding_v1();
REVOKE ALL ON FUNCTION public.guard_payment_credential_binding_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_payment_credential_binding_v1() TO service_role;
NOTIFY pgrst,'reload schema';
