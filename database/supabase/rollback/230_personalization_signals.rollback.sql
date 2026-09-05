-- Rollback of 230: drop the personalization signals.
--
-- Destructive: every buyer's recently-viewed history and the curated search suggestions are lost.
-- Nothing else references either table. Product-view ANALYTICS are unaffected — they were never
-- stored here, which is the point of 230's refusal to add a rival counter.

BEGIN;

DROP TABLE IF EXISTS public.buyer_product_views;
DROP TABLE IF EXISTS public.marketplace_trending_searches;

COMMIT;
