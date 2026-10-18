-- This rollback removes the un-deployed 270/271 observation feature as a unit.
-- Reconstructing 270 price-write events as public offers would be misleading.
DROP TRIGGER IF EXISTS sites_capture_offer_price_observations ON public.sites;
DROP TRIGGER IF EXISTS channel_listings_capture_offer_price_observation ON public.channel_listings;
DROP TRIGGER IF EXISTS channel_listings_capture_offer_price_deletion ON public.channel_listings;
DROP TRIGGER IF EXISTS product_variants_capture_price_observation ON public.product_variants;
DROP TRIGGER IF EXISTS products_capture_price_observation ON public.products;
DROP FUNCTION IF EXISTS public.capture_site_offer_price_observations();
DROP FUNCTION IF EXISTS public.capture_listing_offer_price_observation();
DROP FUNCTION IF EXISTS public.capture_removed_marketplace_offer_price_observation(uuid, uuid);
DROP FUNCTION IF EXISTS public.capture_product_price_observation();
DROP FUNCTION IF EXISTS public.capture_channel_offer_price_observations(uuid, text);
DROP FUNCTION IF EXISTS public.product_price_reference_window(uuid[], timestamptz, text);
DROP TABLE IF EXISTS public.product_price_observations;
