-- Rollback of 223: drop the platform buyer identity tables.
--
-- Destructive: any buyer account and any buyer-to-store-customer link is lost. store_customers is
-- untouched by 223 and is untouched here, so per-store customers and their order history survive --
-- what is lost is the cross-store identity that joined them.

BEGIN;

DROP TABLE IF EXISTS public.buyer_store_customers;
DROP TABLE IF EXISTS public.buyer_accounts;

COMMIT;
