-- 110_fk_hygiene_and_order_indexes.sql
-- P2 FK hygiene launch hardening. This migration is additive/idempotent and
-- keeps financial/order history by using SET NULL/CASCADE only on child rows.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_orders_site_id ON public.orders(site_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_items'
          AND column_name = 'store_id'
     ) THEN
    ALTER TABLE public.order_items ADD COLUMN store_id uuid;
  END IF;
END $$;

UPDATE public.order_items oi
   SET store_id = o.store_id
  FROM public.orders o
 WHERE oi.order_id = o.id
   AND oi.store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON public.order_items(store_id);

CREATE OR REPLACE FUNCTION public.sync_order_items_store_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.store_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.store_id INTO NEW.store_id
      FROM public.orders o
     WHERE o.id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_store_scope_sync ON public.order_items;

CREATE TRIGGER order_items_store_scope_sync
BEFORE INSERT OR UPDATE OF order_id, store_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_items_store_id();

DO $$
BEGIN
  IF to_regclass('public.app_reviews') IS NOT NULL THEN
    ALTER TABLE public.app_reviews DROP CONSTRAINT IF EXISTS app_reviews_store_id_fkey;
    ALTER TABLE public.app_reviews
      ADD CONSTRAINT app_reviews_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
