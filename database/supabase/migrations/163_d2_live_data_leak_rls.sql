-- D2 / P2 emergency: close live-data leaks caused by PUBLIC-by-default
-- policies that used USING (true). PostgreSQL policies without an explicit TO
-- clause apply to PUBLIC, so the baseline service_role_* names were not
-- actually service-role-only.

BEGIN;

-- RT-1: orders must deny anon service-role-equivalent access.
-- RT-2: orders must deny forged site_id access.
DROP POLICY IF EXISTS service_role_orders ON public.orders;
CREATE POLICY service_role_orders ON public.orders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orders_tenant_site_guc ON public.orders;
CREATE POLICY orders_tenant_site_guc ON public.orders
  FOR ALL TO authenticated
  USING (COALESCE(site_id, store_id) = public.current_site_id())
  WITH CHECK (COALESCE(site_id, store_id) = public.current_site_id());

-- RT-3: product variants must deny anon service-role-equivalent access.
-- RT-4: product options must deny forged product_id access.
-- Products and child product tables must resolve through the
-- owning product tenant instead of trusting caller-supplied identifiers.
DROP POLICY IF EXISTS service_role_products ON public.products;
CREATE POLICY service_role_products ON public.products
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS products_tenant_site_guc ON public.products;
CREATE POLICY products_tenant_site_guc ON public.products
  FOR ALL TO authenticated
  USING (COALESCE(site_id, store_id) = public.current_site_id())
  WITH CHECK (COALESCE(site_id, store_id) = public.current_site_id());

DROP POLICY IF EXISTS service_role_product_variants ON public.product_variants;
CREATE POLICY service_role_product_variants ON public.product_variants
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS product_variants_tenant_site_guc ON public.product_variants;
CREATE POLICY product_variants_tenant_site_guc ON public.product_variants
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS service_role_product_options ON public.product_options;
CREATE POLICY service_role_product_options ON public.product_options
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS product_options_tenant_site_guc ON public.product_options;
CREATE POLICY product_options_tenant_site_guc ON public.product_options
  FOR ALL TO authenticated
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

-- RT-5: sites table writes must not inherit service_role access through PUBLIC.
DROP POLICY IF EXISTS service_role_sites ON public.sites;
CREATE POLICY service_role_sites ON public.sites
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS sites_tenant_site_guc ON public.sites;
CREATE POLICY sites_tenant_site_guc ON public.sites
  FOR ALL TO authenticated
  USING (id = public.current_site_id())
  WITH CHECK (id = public.current_site_id());

-- RT-6: customer records and activity are private tenant data.
DROP POLICY IF EXISTS service_all_store_customers ON public.store_customers;
CREATE POLICY service_all_store_customers ON public.store_customers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_customers_tenant_store_guc ON public.store_customers;
DROP POLICY IF EXISTS store_customers_tenant_site_guc ON public.store_customers;
CREATE POLICY store_customers_tenant_store_guc ON public.store_customers
  FOR ALL TO authenticated
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

DROP POLICY IF EXISTS service_all_customer_activity_log ON public.customer_activity_log;
CREATE POLICY service_all_customer_activity_log ON public.customer_activity_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_activity_log_tenant_store_guc ON public.customer_activity_log;
CREATE POLICY customer_activity_log_tenant_store_guc ON public.customer_activity_log
  FOR ALL TO authenticated
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

-- RT-7: wishlist writes/readbacks go through API-owned tenant/session checks.
DROP POLICY IF EXISTS "Anyone can manage their wishlists via API" ON public.wishlists;
DROP POLICY IF EXISTS "Store owners view wishlists" ON public.wishlists;

DROP POLICY IF EXISTS service_all_wishlists ON public.wishlists;
CREATE POLICY service_all_wishlists ON public.wishlists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS wishlists_tenant_store_guc ON public.wishlists;
CREATE POLICY wishlists_tenant_store_guc ON public.wishlists
  FOR ALL TO authenticated
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

DROP POLICY IF EXISTS service_all_customer_wishlists ON public.customer_wishlists;
CREATE POLICY service_all_customer_wishlists ON public.customer_wishlists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_wishlists_tenant_store_guc ON public.customer_wishlists;
CREATE POLICY customer_wishlists_tenant_store_guc ON public.customer_wishlists
  FOR ALL TO authenticated
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

-- RT-8: billing and subscription rows must not be visible or mutable by anon.
DROP POLICY IF EXISTS service_role_subscriptions ON public.subscriptions;
CREATE POLICY service_role_subscriptions ON public.subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS subscriptions_tenant_store_guc ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_tenant_site_guc ON public.subscriptions;
CREATE POLICY subscriptions_tenant_site_guc ON public.subscriptions
  FOR ALL TO authenticated
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS service_role_billing_history ON public.billing_history;
CREATE POLICY service_role_billing_history ON public.billing_history
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS billing_history_tenant_store_guc ON public.billing_history;
DROP POLICY IF EXISTS billing_history_tenant_site_guc ON public.billing_history;
CREATE POLICY billing_history_tenant_site_guc ON public.billing_history
  FOR ALL TO authenticated
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

-- RT-9: super admin allowlist cannot be inserted into by anon/authenticated.
DROP POLICY IF EXISTS service_role_manage_allowlist ON public.super_admin_allowlist;
CREATE POLICY service_role_manage_allowlist ON public.super_admin_allowlist
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS super_admin_manage_allowlist ON public.super_admin_allowlist;
CREATE POLICY super_admin_manage_allowlist ON public.super_admin_allowlist
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS super_admin_read_allowlist ON public.super_admin_allowlist;
CREATE POLICY super_admin_read_allowlist ON public.super_admin_allowlist
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.products,
  public.product_variants,
  public.product_options,
  public.orders,
  public.sites,
  public.store_customers,
  public.customer_activity_log,
  public.customer_wishlists,
  public.wishlists,
  public.subscriptions,
  public.billing_history
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.super_admin_allowlist FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.products,
  public.product_variants,
  public.product_options,
  public.orders,
  public.sites,
  public.store_customers,
  public.customer_activity_log,
  public.customer_wishlists,
  public.wishlists,
  public.subscriptions,
  public.billing_history,
  public.super_admin_allowlist
TO service_role;

COMMIT;
