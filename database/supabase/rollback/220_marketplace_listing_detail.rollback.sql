-- Rollback of 220: drop the marketplace listing-detail read. marketplace_feed and every other
-- marketplace object are untouched — this migration added one function and nothing else.
--
-- After this runs, the marketplace has a feed but no single-listing read again, which means an app
-- opening a product must fall back to the merchant storefront route, where an operator's rejection or
-- take-down is NOT enforced. That is the state 220 exists to end, so roll back only deliberately.

BEGIN;

DROP FUNCTION IF EXISTS public.marketplace_listing_detail(uuid);

COMMIT;
