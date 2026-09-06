-- Rollback of 245: return inventory_adjustments to having no tenant column and no database backstop.
--
-- This restores a real gap on purpose. After it, the table's only isolation is one route predicate,
-- which is the state the executable suite reproduces so that the fix can be shown doing the work.
-- Dropping `store_id` discards the backfilled attribution; re-applying 245 recomputes it from
-- `products.store_id`, which is where it came from.

BEGIN;

DROP POLICY IF EXISTS store_owners_view_adjustments ON public.inventory_adjustments;
CREATE POLICY store_owners_view_adjustments
  ON public.inventory_adjustments
  FOR SELECT
  TO authenticated
  USING (product_id IN (
      SELECT products.id FROM public.products
      WHERE products.store_id IN (SELECT sites.id FROM public.sites WHERE sites.user_id = auth.uid())
  ));

DROP POLICY IF EXISTS inventory_adjustments_tenant_site_guc ON public.inventory_adjustments;

DO $rollback$
DECLARE
    v_policy_name text := 'app_tenant_guc_' || substr(md5('inventory_adjustments'), 1, 16);
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.inventory_adjustments', v_policy_name);
END
$rollback$;

ALTER TABLE public.inventory_adjustments NO FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS inventory_adjustments_store_id_fill ON public.inventory_adjustments;
DROP FUNCTION IF EXISTS public.set_inventory_adjustment_store_id();

DROP INDEX IF EXISTS public.idx_inventory_adjustments_store_id;
ALTER TABLE public.inventory_adjustments DROP CONSTRAINT IF EXISTS inventory_adjustments_store_id_fkey;
ALTER TABLE public.inventory_adjustments DROP COLUMN IF EXISTS store_id;

COMMIT;
