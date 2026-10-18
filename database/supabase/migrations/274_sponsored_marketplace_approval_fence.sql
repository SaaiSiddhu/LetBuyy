-- Phase 6.4: a paid marketplace placement is still a marketplace read and must obey
-- the same operator approval and public-visibility fence as organic marketplace discovery.
BEGIN;

CREATE OR REPLACE FUNCTION public.marketplace_sponsored_products(p_limit integer DEFAULT 10)
RETURNS TABLE (
  campaign_id uuid,
  product_id uuid,
  site_id uuid,
  "position" integer,
  name text,
  slug text,
  price numeric,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    pl.campaign_id,
    pl.product_id,
    pl.site_id,
    pl.position,
    p.name,
    p.slug,
    p.price,
    CASE WHEN jsonb_typeof(to_jsonb(p.images)) = 'array'
         THEN to_jsonb(p.images) ->> 0 ELSE NULL END AS image_url
  FROM public.ad_campaign_placements pl
  JOIN public.ad_campaigns c
    ON c.id = pl.campaign_id AND c.site_id = pl.site_id
  JOIN public.products p
    ON p.id = pl.product_id AND p.site_id = pl.site_id
  JOIN public.channel_listings cl
    ON cl.product_id = p.id
   AND cl.site_id = pl.site_id
   AND cl.channel = 'marketplace'
   AND cl.status = 'approved'
   AND cl.visibility = 'public'
  JOIN public.sites s
    ON s.id = pl.site_id
 WHERE pl.is_active
   AND c.status = 'active'
   AND public.ad_campaign_remaining_minor(c.id) > 0
   AND (c.daily_budget_minor IS NULL
        OR public.ad_campaign_spent_today_minor(c.id, NULL) < c.daily_budget_minor)
   AND (c.starts_at IS NULL OR c.starts_at <= now())
   AND (c.ends_at IS NULL OR c.ends_at >= now())
   AND p.is_active
   AND p.deleted_at IS NULL
   AND s.status = 'published'
   AND s.deleted_at IS NULL
 ORDER BY c.bid_minor DESC, pl.position ASC, pl.created_at ASC
 LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 20), 1);
$$;

REVOKE ALL ON FUNCTION public.marketplace_sponsored_products(integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.marketplace_sponsored_products(integer) TO service_role;
  END IF;
END
$$;

COMMIT;
