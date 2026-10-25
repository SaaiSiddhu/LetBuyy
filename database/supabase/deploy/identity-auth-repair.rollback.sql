-- Fail-closed service recovery. Preserve every original session, account and
-- verified intent; never drop live records or reopen public authentication RPCs.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE ALL ON FUNCTION public.validate_and_rotate_merchant_session(text,boolean,integer,integer)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.auth_password_set_intents FROM PUBLIC, anon, authenticated, service_role;
DROP POLICY IF EXISTS "Service role manages auth password set intents" ON public.auth_password_set_intents;
DO $tenant_role$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
   REVOKE ALL ON TABLE public.auth_password_set_intents FROM app_tenant;
   REVOKE ALL ON FUNCTION public.validate_and_rotate_merchant_session(text,boolean,integer,integer) FROM app_tenant;
 END IF;
END $tenant_role$;
NOTIFY pgrst, 'reload schema';
COMMIT;
