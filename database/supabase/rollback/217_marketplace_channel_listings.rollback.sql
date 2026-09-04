-- Rollback for 217_marketplace_channel_listings.sql
-- Restores the 216 state: drops the two RPCs, the two trigger functions, the three tables (their
-- policies, triggers, indexes and any rows go with them) in reverse dependency order. No data
-- precondition — nothing is wired to these tables (MARKETPLACE_CHANNEL_MODEL.md §9), so dropping
-- rows with the tables is the correct meaning of "restore 216". products, sites and their policies
-- are untouched by both directions.

BEGIN;

DROP FUNCTION IF EXISTS public.marketplace_feed(text, text, integer, timestamp with time zone, uuid);
DROP FUNCTION IF EXISTS public.transition_channel_listing(uuid, uuid, text, text, uuid, text, text);

DROP TABLE IF EXISTS public.channel_listing_moderation_events;
DROP TABLE IF EXISTS public.channel_listings;

DROP FUNCTION IF EXISTS public.channel_listings_status_via_rpc();
DROP FUNCTION IF EXISTS public.channel_listings_site_matches_product();

DROP TABLE IF EXISTS public.marketplace_categories;

COMMIT;
