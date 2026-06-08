-- Rollback for 158_order_items_tenant_scope.sql.
-- Use only in a local/staging rollback drill. Production rollback is
-- human-owned and should prefer a forward fix after restore-point review.

BEGIN;

DROP POLICY IF EXISTS order_items_owner_site_select ON public.order_items;
DROP POLICY IF EXISTS order_items_tenant_site_guc ON public.order_items;
DROP POLICY IF EXISTS order_items_service_role_all ON public.order_items;

DROP TRIGGER IF EXISTS order_items_site_scope_sync ON public.order_items;
DROP FUNCTION IF EXISTS public.sync_order_items_site_id();

DROP INDEX IF EXISTS public.idx_order_items_site_product_active;
DROP INDEX IF EXISTS public.idx_order_items_site_order_active;
DROP INDEX IF EXISTS public.idx_order_items_site_id;

ALTER TABLE IF EXISTS public.order_items
  DROP CONSTRAINT IF EXISTS order_items_site_id_fkey;

ALTER TABLE IF EXISTS public.order_items
  DROP COLUMN IF EXISTS site_id;

COMMIT;
