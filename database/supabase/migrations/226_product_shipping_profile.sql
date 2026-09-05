-- 226: a product's shipping profile (CAP-FB-SHIPPING-PRODUCT, under D-9).
--
-- ============================================================================
-- WHY THIS IS A LINK AND NOT A NEW SHIPPING MODEL
-- ============================================================================
-- FB-2's register described this gap in Firestore's shape -- shippingDays, shippingPrice,
-- freeShippingAbove, isFreeDelivery, expressDelivery, expressDeliveryDays hanging off a product
-- document -- and concluded there was no canonical equivalent. A verification sweep found that
-- framing was the problem, not the capability: migration 145 already installs shipping_profiles,
-- shipping_rates, shipping_zones, shipping_serviceability_rules and order_shipping_lines, all scoped
-- per SITE. What is genuinely missing is only that nothing ties a profile to a product.
--
-- So this adds the link and nothing else. Copying Firestore's six per-product fields would have
-- created a second shipping model competing with the one that already computes rates, serviceability
-- and COD eligibility -- the "two implementations, one wired to nothing" failure this programme keeps
-- finding.
--
-- ============================================================================
-- WHY A COMPOSITE FOREIGN KEY
-- ============================================================================
-- A product's shipping profile must belong to the SAME SITE as the product. A plain
-- `REFERENCES shipping_profiles(id)` cannot express that: it would happily accept another merchant's
-- profile id, and nothing downstream would object because both rows are individually legitimate --
-- the product is real, the profile is real, and no tenant check is being violated by either one on
-- its own. That is a cross-tenant reference the tenancy model would never catch.
--
-- shipping_profiles therefore gains UNIQUE (id, site_id) -- redundant on its own, since id is already
-- the primary key, and that is exactly what makes it usable as a composite FK target -- and products
-- references the PAIR. A product can now only point at a profile belonging to its own site, enforced
-- by the database rather than by application code some later path could bypass.
--
-- NULL is allowed and is the default: a product without a profile falls back to the site's default
-- profile, which is how every existing product already behaves. Nothing is backfilled.
--
-- Rollback: database/supabase/rollback/226_product_shipping_profile.rollback.sql

BEGIN;

-- The composite FK target. Redundant as a uniqueness claim (id is the PK); required so the pair can
-- be referenced.
ALTER TABLE public.shipping_profiles
  DROP CONSTRAINT IF EXISTS shipping_profiles_id_site_key;
ALTER TABLE public.shipping_profiles
  ADD CONSTRAINT shipping_profiles_id_site_key UNIQUE (id, site_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_profile_id uuid NULL;

-- ON DELETE SET NULL, not CASCADE: deleting a shipping profile must never delete products. The
-- product falls back to the site default, which is the same state it was in before this migration.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shipping_profile_same_site_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_shipping_profile_same_site_fkey
  FOREIGN KEY (shipping_profile_id, site_id)
  REFERENCES public.shipping_profiles (id, site_id)
  ON DELETE SET NULL;

-- Answers "which products use this profile", which is what a merchant needs before editing or
-- deleting one. Partial: most products will inherit the site default and carry NULL.
CREATE INDEX IF NOT EXISTS products_shipping_profile_idx
  ON public.products (shipping_profile_id)
  WHERE shipping_profile_id IS NOT NULL;

COMMIT;
