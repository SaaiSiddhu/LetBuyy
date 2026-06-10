-- Rollback D4 app_tenant role/policies. Earlier RLS/tenant policies remain.

BEGIN;

DO $$
DECLARE
  v_table record;
  v_policy_name text;
BEGIN
  FOR v_table IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('site_id', 'store_id')
    GROUP BY table_name
  LOOP
    v_policy_name := 'app_tenant_guc_' || substr(md5(v_table.table_name), 1, 16);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, v_table.table_name);
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I FROM app_tenant', v_table.table_name);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS app_tenant_sites_guc ON public.sites;
DROP POLICY IF EXISTS app_tenant_product_variants_guc ON public.product_variants;
DROP POLICY IF EXISTS app_tenant_product_options_guc ON public.product_options;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.sites FROM app_tenant;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_variants FROM app_tenant;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_options FROM app_tenant;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM app_tenant;
REVOKE USAGE ON SCHEMA public FROM app_tenant;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    REVOKE app_tenant FROM postgres;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE app_tenant FROM service_role;
  END IF;

  DROP ROLE IF EXISTS app_tenant;
END
$$;

COMMIT;
