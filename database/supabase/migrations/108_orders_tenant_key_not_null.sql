-- 108_orders_tenant_key_not_null.sql
-- Canonical orders tenant key is public.orders.store_id.
-- Keep site_id during transition as a compatibility mirror only.

BEGIN;

UPDATE public.orders
   SET store_id = COALESCE(store_id, site_id),
       updated_at = NOW()
 WHERE store_id IS NULL
   AND site_id IS NOT NULL;

UPDATE public.orders
   SET site_id = store_id,
       updated_at = NOW()
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_orders_tenant_keys()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.store_id := COALESCE(NEW.store_id, NEW.site_id);
  NEW.site_id := COALESCE(NEW.site_id, NEW.store_id);

  IF NEW.store_id IS NULL THEN
    RAISE EXCEPTION 'orders.store_id is required';
  END IF;

  IF NEW.site_id IS NOT NULL AND NEW.site_id <> NEW.store_id THEN
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
  IF to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.orders WHERE store_id IS NULL) THEN
    ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL;
  END IF;
END $$;

COMMIT;
