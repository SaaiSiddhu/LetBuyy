-- D4 / P2 completion: make tenant RLS load-bearing for app traffic.
-- Adds a non-BYPASSRLS app_tenant role and app_tenant GUC policies for
-- site/store-scoped tables. The gateway must SET LOCAL ROLE app_tenant and
-- SET LOCAL app.site_id from a validated identity/ownership claim.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS;
  ELSE
    ALTER ROLE app_tenant NOBYPASSRLS;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT app_tenant TO postgres;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT app_tenant TO service_role;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;

DO $$
DECLARE
  v_table record;
  v_policy_name text;
  v_predicate text;
BEGIN
  FOR v_table IN
    SELECT
      columns.table_name,
      bool_or(columns.column_name = 'site_id') AS has_site_id,
      bool_or(columns.column_name = 'store_id') AS has_store_id
    FROM information_schema.columns
    JOIN information_schema.tables
      ON tables.table_schema = columns.table_schema
     AND tables.table_name = columns.table_name
     AND tables.table_type = 'BASE TABLE'
    WHERE columns.table_schema = 'public'
      AND columns.column_name IN ('site_id', 'store_id')
    GROUP BY columns.table_name
  LOOP
    v_policy_name := 'app_tenant_guc_' || substr(md5(v_table.table_name), 1, 16);

    IF v_table.has_site_id AND v_table.has_store_id THEN
      v_predicate := 'COALESCE(site_id, store_id) = public.current_site_id()';
    ELSIF v_table.has_site_id THEN
      v_predicate := 'site_id = public.current_site_id()';
    ELSE
      v_predicate := 'store_id = public.current_site_id()';
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO app_tenant', v_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, v_table.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO app_tenant USING (%s) WITH CHECK (%s)',
      v_policy_name,
      v_table.table_name,
      v_predicate,
      v_predicate
    );
  END LOOP;
END
$$;

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sites TO app_tenant;
DROP POLICY IF EXISTS app_tenant_sites_guc ON public.sites;
CREATE POLICY app_tenant_sites_guc ON public.sites
  FOR ALL TO app_tenant
  USING (id = public.current_site_id())
  WITH CHECK (id = public.current_site_id());

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_variants TO app_tenant;
DROP POLICY IF EXISTS app_tenant_product_variants_guc ON public.product_variants;
CREATE POLICY app_tenant_product_variants_guc ON public.product_variants
  FOR ALL TO app_tenant
  USING (
    EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_variants.product_id
        AND COALESCE(products.site_id, products.store_id) = public.current_site_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_variants.product_id
        AND COALESCE(products.site_id, products.store_id) = public.current_site_id()
    )
  );

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_options TO app_tenant;
DROP POLICY IF EXISTS app_tenant_product_options_guc ON public.product_options;
CREATE POLICY app_tenant_product_options_guc ON public.product_options
  FOR ALL TO app_tenant
  USING (
    EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_options.product_id
        AND COALESCE(products.site_id, products.store_id) = public.current_site_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_options.product_id
        AND COALESCE(products.site_id, products.store_id) = public.current_site_id()
    )
  );

COMMIT;
