BEGIN;

DROP FUNCTION IF EXISTS public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer);
DROP TRIGGER IF EXISTS trg_order_items_marketplace_listing_guard ON public.order_items;
DROP FUNCTION IF EXISTS public.marketplace_order_item_listing_guard();
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_marketplace_fingerprint_format,
  DROP CONSTRAINT IF EXISTS order_items_marketplace_listing_fingerprint_pair,
  DROP COLUMN IF EXISTS marketplace_approved_fingerprint,
  DROP COLUMN IF EXISTS marketplace_listing_id;

COMMIT;
