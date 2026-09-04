-- MKT-2: the marketplace's missing public read — one approved listing, by id.
--
-- WHY. Before this migration the marketplace exposed exactly two public reads, a feed and a category
-- list (MKT-1). There was no way to read ONE listing, so an app opening a product from the
-- marketplace had to fall back to the merchant's own GET /storefront/:subdomain/products/:slug.
-- That route enforces p.is_active and the store's publication, but it never reads channel_listings —
-- it cannot, it predates them. So a listing an operator REJECTED or took down through ADM-1 would
-- still render from the marketplace: the moderation decision existed in the database and was
-- unenforced on the surface a shopper actually opens.
--
-- THE FENCE. The seven predicates below are copied verbatim from marketplace_feed (217), not retyped
-- from memory, and tests/contracts/marketplace-routes-contract.test.ts asserts the two are
-- character-identical. Two public reads that disagree about what "publicly visible" means is the
-- defect this construction exists to prevent: a listing hidden from the grid must also be
-- unreachable by direct link, and a listing visible in the grid must open.
--
-- COLUMNS. SEC-1 (2026-09-05) established that a public product read names its columns explicitly and
-- never includes cost_price, cost_per_item, sku or barcode — that phase removed exactly those from
-- the storefront's public product detail after they had been served to anonymous visitors. This
-- function is written to that rule from the start. Every column below was verified to exist on
-- public.products.
--
-- VARIANTS ARE DELIBERATELY ABSENT. marketplace_feed does not return them either. products.variants
-- is a jsonb blob whose contents have not been audited against SEC-1's rule (variant-level sku and
-- barcode are a known open finding, F-SEC-2), and shipping an unaudited blob through a new public
-- read would repeat precisely the defect SEC-1 just fixed. A marketplace detail with variants is a
-- later phase that audits the blob first.
--
-- Cross-tenant by design, exactly as the feed is: a marketplace shopper reads across merchants. That
-- is why this is a SECURITY DEFINER function with an explicit allowlist rather than a table read —
-- the fence and the column list are the boundary, and both live in one place.
--
-- Rollback: database/supabase/rollback/220_marketplace_listing_detail.rollback.sql drops this
-- function only; marketplace_feed is untouched.

BEGIN;

CREATE OR REPLACE FUNCTION public.marketplace_listing_detail(
  p_listing_id uuid
)
RETURNS TABLE (
  listing_id uuid,
  product_id uuid,
  site_id uuid,
  store_name text,
  subdomain text,
  name text,
  slug text,
  description text,
  images text[],
  price numeric,
  compare_price numeric,
  product_type text,
  tags text[],
  thumbnail_url text,
  stock integer,
  track_inventory boolean,
  seo_title text,
  seo_description text,
  category_slug text,
  approved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    cl.id AS listing_id,
    p.id AS product_id,
    s.id AS site_id,
    s.store_name,
    s.subdomain,
    p.name,
    p.slug,
    p.description,
    p.images,
    p.price,
    p.compare_price,
    p.product_type,
    p.tags,
    p.thumbnail_url,
    p.stock,
    p.track_inventory,
    p.seo_title,
    p.seo_description,
    mc.slug AS category_slug,
    cl.approved_at
  FROM public.channel_listings cl
  JOIN public.products p ON p.id = cl.product_id
  JOIN public.sites s ON s.id = cl.site_id
  LEFT JOIN public.marketplace_categories mc ON mc.id = cl.marketplace_category_id
  WHERE cl.channel = 'marketplace'
    AND cl.status = 'approved'
    AND cl.visibility = 'public'
    AND p.is_active = true
    AND p.deleted_at IS NULL
    AND s.status = 'published'
    AND s.deleted_at IS NULL
    AND cl.id = p_listing_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.marketplace_listing_detail(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.marketplace_listing_detail(uuid) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.marketplace_listing_detail(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.marketplace_listing_detail(uuid) TO service_role;
  END IF;
END
$$;

COMMIT;
