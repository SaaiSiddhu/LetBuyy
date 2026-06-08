-- 158_order_items_tenant_scope.sql
-- Issue #105: give order_items its own tenant scope instead of relying only
-- on joins through orders. Store remains UI/API language; site_id is the
-- direct database tenant key for this table.
-- Writer: services/api-gateway/src/routes/orders.ts

BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS site_id uuid;

UPDATE public.order_items oi
   SET site_id = COALESCE(oi.site_id, o.site_id, o.store_id),
       store_id = COALESCE(oi.store_id, o.store_id, o.site_id)
  FROM public.orders o
 WHERE oi.order_id = o.id
   AND (oi.site_id IS NULL OR oi.store_id IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.order_items
     WHERE site_id IS NULL
  ) THEN
    RAISE EXCEPTION 'order_items.site_id must be backfilled before NOT NULL enforcement';
  END IF;

  ALTER TABLE public.order_items ALTER COLUMN site_id SET NOT NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'order_items_site_id_fkey'
       AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_site_id_fkey;

CREATE OR REPLACE FUNCTION public.sync_order_items_site_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id uuid;
  v_store_id uuid;
BEGIN
  SELECT COALESCE(o.site_id, o.store_id), COALESCE(o.store_id, o.site_id)
    INTO v_site_id, v_store_id
    FROM public.orders o
   WHERE o.id = NEW.order_id;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'order_items.site_id requires an owning order tenant';
  END IF;

  NEW.site_id := COALESCE(NEW.site_id, v_site_id);
  NEW.store_id := COALESCE(NEW.store_id, v_store_id);

  IF NEW.site_id <> v_site_id THEN
    RAISE EXCEPTION 'order_items.site_id must match owning order tenant';
  END IF;

  IF NEW.store_id IS NOT NULL AND NEW.store_id <> v_store_id THEN
    RAISE EXCEPTION 'order_items.store_id must match owning order tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_site_scope_sync ON public.order_items;

CREATE TRIGGER order_items_site_scope_sync
BEFORE INSERT OR UPDATE OF order_id, site_id, store_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_items_site_id();

CREATE INDEX IF NOT EXISTS idx_order_items_site_id
  ON public.order_items(site_id);

CREATE INDEX IF NOT EXISTS idx_order_items_site_order_active
  ON public.order_items(site_id, order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_site_product_active
  ON public.order_items(site_id, product_id)
  WHERE product_id IS NOT NULL
    AND deleted_at IS NULL;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_service_role_all ON public.order_items;
CREATE POLICY order_items_service_role_all
  ON public.order_items
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS order_items_tenant_site_guc ON public.order_items;
CREATE POLICY order_items_tenant_site_guc
  ON public.order_items
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS order_items_owner_site_select ON public.order_items;
CREATE POLICY order_items_owner_site_select
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.sites s
       WHERE s.id = order_items.site_id
         AND (s.user_id = auth.uid() OR s.custom_user_id = auth.uid())
         AND s.deleted_at IS NULL
    )
  );

COMMENT ON COLUMN public.order_items.site_id IS
  'Direct tenant key for order line items. Backfilled from orders and kept in sync by public.sync_order_items_site_id(). Written only through services/api-gateway/src/routes/orders.ts.';

COMMIT;
