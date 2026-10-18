BEGIN;

-- Extend the canonical public feed family; five/six-argument callers retain their exact
-- contracts. Seller scoping belongs before keyset pagination, with the same public columns
-- and approved/public/product/site visibility fence. No seller profile/private data is read.
CREATE OR REPLACE FUNCTION public.marketplace_feed(
  p_category_slug text,
  p_search text,
  p_limit integer,
  p_after_approved_at timestamp with time zone,
  p_after_id uuid,
  p_country_of_origin text,
  p_site_id uuid
)
RETURNS TABLE (
  listing_id uuid,
  product_id uuid,
  site_id uuid,
  store_name text,
  subdomain text,
  name text,
  slug text,
  images text[],
  price numeric,
  compare_price numeric,
  category_slug text,
  approved_at timestamp with time zone,
  country_of_origin text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    cl.id,
    p.id,
    s.id,
    s.store_name,
    s.subdomain,
    p.name,
    p.slug,
    p.images,
    p.price,
    p.compare_price,
    mc.slug,
    cl.approved_at,
    p.country_of_origin
  FROM public.channel_listings cl
  JOIN public.products p ON p.id = cl.product_id
  JOIN public.sites s ON s.id = cl.site_id
  LEFT JOIN public.marketplace_categories mc ON mc.id = cl.marketplace_category_id
  WHERE (p_site_id IS NULL OR cl.site_id = p_site_id)
    AND cl.channel = 'marketplace'
    AND cl.status = 'approved'
    AND cl.visibility = 'public'
    AND p.is_active = true
    AND p.deleted_at IS NULL
    AND s.status = 'published'
    AND s.deleted_at IS NULL
    AND (p_category_slug IS NULL OR mc.slug = p_category_slug)
    AND (
      p_search IS NULL OR length(btrim(p_search)) = 0
      OR p.name ILIKE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
    AND (
      p_country_of_origin IS NULL
      OR lower(btrim(p.country_of_origin)) = lower(btrim(p_country_of_origin))
    )
    AND (
      p_after_approved_at IS NULL OR p_after_id IS NULL
      OR (cl.approved_at, cl.id) < (p_after_approved_at, p_after_id)
    )
  ORDER BY cl.approved_at DESC, cl.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

-- Follow the current Data API hardening (309): only the Gateway service caller executes
-- this new overload. Public HTTP discovery remains available through the validated Gateway.
REVOKE ALL ON FUNCTION public.marketplace_feed(text, text, integer, timestamp with time zone, uuid, text, uuid) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.marketplace_feed(text, text, integer, timestamp with time zone, uuid, text, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
