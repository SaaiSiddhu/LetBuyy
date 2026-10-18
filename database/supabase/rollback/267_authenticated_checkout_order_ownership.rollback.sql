-- Apply only after the worker no longer calls create_checkout_order_for_buyer.
BEGIN;
DROP FUNCTION IF EXISTS public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint);
COMMIT;
