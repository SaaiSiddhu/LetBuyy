BEGIN;
DROP FUNCTION IF EXISTS public.create_marketplace_checkout_order_with_delivery_rate(
  uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric
);
COMMIT;
