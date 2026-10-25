-- Recovery disables password setup while retaining verified intent records.
-- Deliberately retain the client-deny security floor: restoring 078's PUBLIC
-- capability policy would expose authentication authority and is not recovery.
BEGIN;
DROP POLICY IF EXISTS "Service role manages auth password set intents" ON public.auth_password_set_intents;
REVOKE ALL ON TABLE public.auth_password_set_intents FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.auth_password_set_intents ENABLE ROW LEVEL SECURITY;
DO $tenant_role$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
        REVOKE ALL ON TABLE public.auth_password_set_intents FROM app_tenant;
    END IF;
END $tenant_role$;

ALTER TABLE public.auth_password_set_intents FORCE ROW LEVEL SECURITY;
COMMIT;
