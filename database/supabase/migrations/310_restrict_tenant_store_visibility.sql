-- A public published-store policy is permissive and therefore ORs with the
-- tenant GUC policy. Restrict app_tenant reads/writes to the resolved store while
-- preserving public discovery for the anon/authenticated roles and backend reads.
BEGIN;

DO $guard$
DECLARE v_policy pg_catalog.pg_policy%ROWTYPE;
BEGIN
  SELECT * INTO v_policy FROM pg_catalog.pg_policy
   WHERE polrelid='public.sites'::regclass AND polname='app_tenant_sites_restrictive_guc';
  IF FOUND THEN
    IF v_policy.polpermissive OR v_policy.polcmd <> '*'
       OR v_policy.polroles IS DISTINCT FROM ARRAY['app_tenant'::regrole::oid]
       OR pg_catalog.pg_get_expr(v_policy.polqual,v_policy.polrelid) IS DISTINCT FROM '(id = current_site_id())'
       OR pg_catalog.pg_get_expr(v_policy.polwithcheck,v_policy.polrelid) IS DISTINCT FROM '(id = current_site_id())' THEN
      RAISE EXCEPTION 'migration 310 refuses a changed tenant store restriction';
    END IF;
  ELSE
    CREATE POLICY app_tenant_sites_restrictive_guc ON public.sites
      AS RESTRICTIVE FOR ALL TO app_tenant
      USING (id = public.current_site_id())
      WITH CHECK (id = public.current_site_id());
  END IF;
END;
$guard$;

COMMIT;
