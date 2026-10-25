-- PRIVATE UNNUMBERED PROPOSAL. NOT APPLIED. Preserve committed carts and receipts.
BEGIN;
DROP FUNCTION public.edit_storefront_configured_cart_line(uuid,uuid,text,timestamptz,text,uuid,text,uuid,integer,jsonb);
DROP FUNCTION public.write_storefront_cart(uuid,uuid,text,timestamptz,jsonb,uuid,integer);
COMMIT;
