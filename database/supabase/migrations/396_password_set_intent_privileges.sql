-- Password verification intents are private Accounts capabilities, never Data API
-- user records. Close the original 078 all-role policy without changing data.
BEGIN;
ALTER TABLE public.auth_password_set_intents ENABLE ROW LEVEL SECURITY;
DO $tenant_role$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
        REVOKE ALL ON TABLE public.auth_password_set_intents FROM app_tenant;
    END IF;
END $tenant_role$;

ALTER TABLE public.auth_password_set_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_password_set_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_password_set_intents TO service_role;
DROP POLICY IF EXISTS "Service role manages auth password set intents" ON public.auth_password_set_intents;
CREATE POLICY "Service role manages auth password set intents"
    ON public.auth_password_set_intents FOR ALL TO service_role
    USING (true) WITH CHECK (true);
COMMIT;
