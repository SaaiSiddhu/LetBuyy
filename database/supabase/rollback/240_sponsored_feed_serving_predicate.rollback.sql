-- Rollback of 240: restore 232's marketplace_sponsored_products.
--
-- Not destructive to data. It DOES restore the behaviour 240 removed: the feed will again serve
-- campaigns with no remaining budget and campaigns that have hit their daily cap, and every event
-- they generate will be declined by record_ad_spend. Nothing breaks loudly; the merchant simply
-- receives impressions nobody can bill.

BEGIN;

CREATE OR REPLACE FUNCTION public.marketplace_sponsored_products(p_limit integer DEFAULT 10)
RETURNS TABLE (
  campaign_id uuid,
  product_id uuid,
  site_id uuid,
  -- Quoted: `position` is reserved in a RETURNS TABLE list (it is the SQL position(... in ...)
  -- function), even though it is a perfectly ordinary column name on the table itself.
  "position" integer,
  name text,
  slug text,
  price numeric,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
  JOIN public.sites s
    ON s.id = pl.site_id
 WHERE pl.is_active
   AND c.status = 'active'
   AND (c.starts_at IS NULL OR c.starts_at <= now())
   AND (c.ends_at IS NULL OR c.ends_at >= now())
   -- The same visibility fences the storefront itself applies. A sponsored placement must not
   -- surface a hidden product, a deleted one, or a seller who is not published.
   AND p.is_active
   AND p.deleted_at IS NULL
   AND s.status = 'published'
   AND s.deleted_at IS NULL
 ORDER BY pl.position ASC, pl.created_at ASC
 LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 20), 1);
$$;

COMMIT;
