-- Rollback of 260: drop the buyer address book and the buyer profile fields.
--
-- Destructive: any saved buyer address is lost, and any full_name/phone a buyer entered is lost.
-- store_customers/customer_addresses are untouched by 260 and untouched here -- per-store customer
-- profiles and their own address books are a completely separate table family and survive.
-- Placed orders' own address/contact snapshots are untouched: nothing in 260 or here references an
-- order table.

BEGIN;

DROP TRIGGER IF EXISTS buyer_addresses_set_updated_at ON public.buyer_addresses;
DROP FUNCTION IF EXISTS public.update_buyer_addresses_updated_at();
DROP TABLE IF EXISTS public.buyer_addresses;

ALTER TABLE public.buyer_accounts DROP COLUMN IF EXISTS full_name;
ALTER TABLE public.buyer_accounts DROP COLUMN IF EXISTS phone;

COMMIT;
