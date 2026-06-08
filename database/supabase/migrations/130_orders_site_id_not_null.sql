-- 130_orders_site_id_not_null.sql
-- Issue #49: orders must always carry both tenant keys.
-- Canonical ownership remains public.orders.store_id; site_id is the
-- compatibility mirror required by older contracts during the transition.

BEGIN;

UPDATE public.orders
   SET store_id = COALESCE(store_id, site_id),
       site_id = COALESCE(site_id, store_id),
       updated_at = NOW()
 WHERE store_id IS NULL
    OR site_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_orders_tenant_keys()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.store_id := COALESCE(NEW.store_id, NEW.site_id);
  NEW.site_id := COALESCE(NEW.site_id, NEW.store_id);

  IF NEW.store_id IS NULL OR NEW.site_id IS NULL THEN
    RAISE EXCEPTION 'orders.store_id and orders.site_id are required';
  END IF;

  IF NEW.site_id <> NEW.store_id THEN
    RAISE EXCEPTION 'orders.site_id must mirror orders.store_id during transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_tenant_key_sync ON public.orders;

CREATE TRIGGER orders_tenant_key_sync
BEFORE INSERT OR UPDATE OF store_id, site_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_orders_tenant_keys();

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public.orders
       WHERE store_id IS NULL
          OR site_id IS NULL
    ) THEN
      RAISE EXCEPTION 'orders tenant keys must be backfilled before NOT NULL enforcement';
    END IF;

    ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN site_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_store_status_created_active
  ON public.orders(store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_site_status_created_active
  ON public.orders(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;
