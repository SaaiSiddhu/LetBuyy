-- Rollback for 163_d2_live_data_leak_rls.sql.
-- This rollback intentionally does not recreate PUBLIC USING(true) policies.
-- It preserves service-role-only access and removes only the D2 tenant-GUC
-- policies so an operator can re-apply a narrower policy set manually.

BEGIN;

DROP POLICY IF EXISTS orders_tenant_site_guc ON public.orders;
DROP POLICY IF EXISTS products_tenant_site_guc ON public.products;
DROP POLICY IF EXISTS product_variants_tenant_site_guc ON public.product_variants;
DROP POLICY IF EXISTS product_options_tenant_site_guc ON public.product_options;
DROP POLICY IF EXISTS sites_tenant_site_guc ON public.sites;
DROP POLICY IF EXISTS store_customers_tenant_store_guc ON public.store_customers;
DROP POLICY IF EXISTS customer_activity_log_tenant_store_guc ON public.customer_activity_log;
DROP POLICY IF EXISTS wishlists_tenant_store_guc ON public.wishlists;
DROP POLICY IF EXISTS customer_wishlists_tenant_store_guc ON public.customer_wishlists;
DROP POLICY IF EXISTS subscriptions_tenant_site_guc ON public.subscriptions;
DROP POLICY IF EXISTS billing_history_tenant_site_guc ON public.billing_history;

DROP POLICY IF EXISTS service_role_orders ON public.orders;
CREATE POLICY service_role_orders ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_products ON public.products;
CREATE POLICY service_role_products ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_product_variants ON public.product_variants;
CREATE POLICY service_role_product_variants ON public.product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_product_options ON public.product_options;
CREATE POLICY service_role_product_options ON public.product_options FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_sites ON public.sites;
CREATE POLICY service_role_sites ON public.sites FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_store_customers ON public.store_customers;
CREATE POLICY service_all_store_customers ON public.store_customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_customer_activity_log ON public.customer_activity_log;
CREATE POLICY service_all_customer_activity_log ON public.customer_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_wishlists ON public.wishlists;
CREATE POLICY service_all_wishlists ON public.wishlists FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_customer_wishlists ON public.customer_wishlists;
CREATE POLICY service_all_customer_wishlists ON public.customer_wishlists FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_subscriptions ON public.subscriptions;
CREATE POLICY service_role_subscriptions ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_billing_history ON public.billing_history;
CREATE POLICY service_role_billing_history ON public.billing_history FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_manage_allowlist ON public.super_admin_allowlist;
CREATE POLICY service_role_manage_allowlist ON public.super_admin_allowlist FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
