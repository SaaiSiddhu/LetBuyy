-- 240 — the sponsored feed stops serving campaigns that cannot pay, and ranks by bid (F-ADS-1b).
--
-- WHY. 232's marketplace_sponsored_products filters on status and the campaign window and nothing
-- else, so serving and billing disagree about what "can pay" means. After F-ADS-1a gave 'spent' a
-- writer, the feed can offer a paid slot that record_ad_spend then declines: the merchant gets
-- impressions nobody can bill, and the slot earns the platform nothing.
--
-- The two predicates below close DIFFERENT gaps, and the first is narrower than it looks -- stated
-- here because the first draft of this migration overclaimed it and the executable suite caught it:
--
--   * DAILY CAP -- genuinely new. Nothing else enforces it at serve time. record_ad_spend flips a
--     campaign to 'exhausted' when its ALLOCATION runs out, but a daily cap is not exhaustion: the
--     campaign is still active and must serve again tomorrow, so status cannot carry it.
--   * REMAINING BUDGET -- mostly already covered by that 'exhausted' flip, which 232's status filter
--     honours. Its real case is a merchant RE-ACTIVATING a spent campaign: the campaign PATCH route
--     lets them set status back to 'active', and it neither knows nor cares that the budget is gone.
--     232's feed then serves it. That is the scenario the suite reproduces.
--
-- Both reuse F-ADS-1a's projections rather than re-deriving spend, so there stays one definition of
-- what a campaign has left.
--
-- HOW THIS DEFINITION WAS PRODUCED. It is 232's own text, TRANSFORMED by two insertions -- the two
-- serving predicates and the ORDER BY -- rather than retyped. tests/governance/
-- ad-credit-rpc-invariants.test.mjs pinned this function's fences against 232 BEFORE this migration
-- was written, and they are security-relevant: it decides what appears in a paid slot on a public
-- feed, so losing the product/seller visibility checks or a site_id join would leak a hidden
-- product, a soft-deleted one, an unpublished seller, or let one merchant's campaign sponsor
-- another's product.
--
-- NOT CHANGED: every visibility fence, every site_id join, the campaign window, the bounded LIMIT,
-- and the returned column list.
--
-- Rollback: database/supabase/rollback/240_sponsored_feed_serving_predicate.rollback.sql

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
   -- ADDED BY 240. A campaign that cannot pay must not be served. Without these two predicates the
   -- feed keeps showing a campaign whose allocation is spent or whose daily cap is reached, and
   -- record_ad_spend then declines every event it generates: the merchant gets free impressions and
   -- the buyer gets a slot that earns nothing. Both reuse F-ADS-1a's projections rather than
   -- re-deriving spend, so there stays one definition of what a campaign has left.
   AND public.ad_campaign_remaining_minor(c.id) > 0
   AND (c.daily_budget_minor IS NULL
        OR public.ad_campaign_spent_today_minor(c.id, NULL) < c.daily_budget_minor)
   AND (c.starts_at IS NULL OR c.starts_at <= now())
   AND (c.ends_at IS NULL OR c.ends_at >= now())
   -- The same visibility fences the storefront itself applies. A sponsored placement must not
   -- surface a hidden product, a deleted one, or a seller who is not published.
   AND p.is_active
   AND p.deleted_at IS NULL
   AND s.status = 'published'
   AND s.deleted_at IS NULL
 -- ADDED BY 240: the auction, in the only form this schema supports. Highest bid first, then the
 -- merchant's own ordering within their campaign. FIRST-PRICE -- a merchant pays what they bid --
 -- which is what someone setting a maximum expects; second-price is a pricing decision for the
 -- owner, not an implementation detail.
 --
 -- bid_minor is deliberately NOT added to the RETURNS TABLE. It ranks the feed and never leaves the
 -- database: a public endpoint returning every merchant's bid would hand competitors the whole
 -- auction book.
 ORDER BY c.bid_minor DESC, pl.position ASC, pl.created_at ASC
 LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 20), 1);
$$;

COMMIT;
