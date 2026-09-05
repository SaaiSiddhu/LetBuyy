-- 230 — personalization signals (CAP-FB-PERSONALIZE, D-9): recently-viewed products, and the
-- operator-curated search suggestions the client calls "trending".
--
-- Replaces two System A Firestore shapes and DELIBERATELY DECLINES A THIRD:
--
--   buyer_product_views          <- recently_viewed/{userId}/products/{productId}
--   marketplace_trending_searches <- trending_searches  (the client's own comment says "admin-managed",
--                                    and it reads isActive + priority: curated, never computed)
--
--   NOT BUILT: a products.view_count column. product_details_screen.dart increments a `viewCount`
--   field on the product document, but analytics_events / analytics_event_stream /
--   analytics_rollups_daily already own product-view analytics canonically. A counter column here
--   would be a SECOND source of truth for the same number, competing with the pipeline that already
--   records the event -- the failure this programme keeps finding. Popularity for feed ordering must
--   be derived from the analytics rollups, not from a rival counter maintained on the write path.
--
-- Rollback: database/supabase/rollback/230_personalization_signals.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. buyer_product_views — the buyer's own recently-viewed list
-- ---------------------------------------------------------------------------
-- Buyer-owned, not tenant-owned: the list spans every seller the buyer has browsed, which is the
-- whole point of it. buyer_account_id is a registered OWNER column (CAP-FB-SOCIAL), so a query
-- predicated on it is properly scoped and the tenant guard accepts it.
CREATE TABLE IF NOT EXISTS public.buyer_product_views (
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  -- One row per (buyer, product): viewing again UPDATES the timestamp rather than appending. The
  -- Firestore version used .set(merge:true) on the same document path to get this; here it is the
  -- key, so a duplicate is impossible rather than absorbed, and "recently viewed" cannot fill with
  -- ten copies of one product.
  PRIMARY KEY (buyer_account_id, product_id)
);

-- The read is "my newest N", so the index carries the order.
CREATE INDEX IF NOT EXISTS buyer_product_views_recent_idx
  ON public.buyer_product_views (buyer_account_id, viewed_at DESC);

ALTER TABLE public.buyer_product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_product_views FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages buyer product views" ON public.buyer_product_views;
CREATE POLICY "Service role manages buyer product views" ON public.buyer_product_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A merchant must not be able to read what a platform buyer browsed at OTHER sellers, which is what
-- this table is. Revoked rather than merely unpolicied so a later permissive policy cannot open it.
REVOKE ALL ON public.buyer_product_views FROM app_tenant, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_product_views TO service_role;

-- ---------------------------------------------------------------------------
-- 2. marketplace_trending_searches — operator-curated search suggestions
-- ---------------------------------------------------------------------------
-- Platform-scoped with NO site_id, like marketplace_banners (228) and marketplace_categories (217):
-- one curated list for every visitor. The name is the client's; the behaviour is curation.
CREATE TABLE IF NOT EXISTS public.marketplace_trending_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_trending_searches_term_check CHECK (btrim(term) <> ''),
  CONSTRAINT marketplace_trending_searches_term_length_check CHECK (char_length(term) <= 100),
  -- The same suggestion twice is an editorial mistake that reaches every visitor, so it is refused.
  -- Case-insensitive: "Shoes" and "shoes" are one suggestion.
  CONSTRAINT marketplace_trending_searches_term_key UNIQUE (term)
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_trending_searches_term_lower_key
  ON public.marketplace_trending_searches (lower(term));

CREATE INDEX IF NOT EXISTS marketplace_trending_searches_active_position_idx
  ON public.marketplace_trending_searches (position, created_at)
  WHERE is_active;

ALTER TABLE public.marketplace_trending_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_trending_searches FORCE ROW LEVEL SECURITY;

-- Public read of LIVE suggestions only; never USING (true) (ART-09 / R-3). An inactive suggestion is
-- unpublished editorial work, exactly as with banners.
DROP POLICY IF EXISTS marketplace_trending_searches_public_read ON public.marketplace_trending_searches;
CREATE POLICY marketplace_trending_searches_public_read ON public.marketplace_trending_searches
  FOR SELECT TO anon, authenticated, app_tenant
  USING (is_active = true);

DROP POLICY IF EXISTS service_role_marketplace_trending_searches ON public.marketplace_trending_searches;
CREATE POLICY service_role_marketplace_trending_searches ON public.marketplace_trending_searches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.marketplace_trending_searches FROM app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.marketplace_trending_searches TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.marketplace_trending_searches TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_trending_searches TO service_role;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_marketplace_trending_searches_updated_at ON public.marketplace_trending_searches;
    CREATE TRIGGER trg_marketplace_trending_searches_updated_at
      BEFORE UPDATE ON public.marketplace_trending_searches
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

COMMIT;
