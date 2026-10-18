-- Removing this restriction restores the previous published-store visibility to
-- app_tenant. Prefer a reviewed forward repair; store rows and public policies remain.
BEGIN;

DO $rollback_precondition$
DECLARE v_policy pg_catalog.pg_policy%ROWTYPE;
BEGIN
  SELECT * INTO v_policy FROM pg_catalog.pg_policy
   WHERE polrelid='public.sites'::regclass AND polname='app_tenant_sites_restrictive_guc';
  IF NOT FOUND OR v_policy.polpermissive OR v_policy.polcmd <> '*'
     OR v_policy.polroles IS DISTINCT FROM ARRAY['app_tenant'::regrole::oid]
     OR pg_catalog.pg_get_expr(v_policy.polqual,v_policy.polrelid) IS DISTINCT FROM '(id = current_site_id())'
     OR pg_catalog.pg_get_expr(v_policy.polwithcheck,v_policy.polrelid) IS DISTINCT FROM '(id = current_site_id())' THEN
    RAISE EXCEPTION 'rollback 310 refuses to run: tenant store restriction changed or is missing';
  END IF;
END;
$rollback_precondition$;

DROP POLICY app_tenant_sites_restrictive_guc ON public.sites;
COMMIT;
