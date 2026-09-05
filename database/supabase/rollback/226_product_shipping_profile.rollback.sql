-- Rollback of 226: unlink products from shipping profiles.
--
-- Loses which profile each product was assigned; every product falls back to its site's default
-- profile, which is the behaviour before 226. No product, profile, rate or zone row is deleted.

BEGIN;

DROP INDEX IF EXISTS public.products_shipping_profile_idx;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_shipping_profile_same_site_fkey;
ALTER TABLE public.products DROP COLUMN IF EXISTS shipping_profile_id;
ALTER TABLE public.shipping_profiles DROP CONSTRAINT IF EXISTS shipping_profiles_id_site_key;

COMMIT;
