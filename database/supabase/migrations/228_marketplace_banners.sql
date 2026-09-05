-- 228 — marketplace_banners: the platform-curated home merchandising strip (CAP-FB-BANNERS, D-9).
--
-- Replaces System A's flat Firestore `banners` collection
-- (packages/dart/marketplace_services/lib/src/providers/banner_provider.dart), which the client read
-- with orderBy('priority') and NO owner filter, and wrote directly with createBannerWithFile /
-- updateBanner / deleteBanner / toggleBannerStatus.
--
-- PLATFORM-SCOPED, NOT A TENANT TABLE. There is deliberately no site_id: the marketplace home strip
-- is one curated list for every visitor, exactly like marketplace_categories (217) and
-- mobile_app_releases (227). A merchant does not own a slot here, so giving the table a site_id would
-- invent a per-store merchandising surface that no caller asks for and that the operator API could
-- not curate. If per-store merchandising is ever wanted it is a DIFFERENT table with a different
-- owner, not a nullable column on this one.
--
-- Not carried over from Firestore, deliberately:
--   * a scheduling window (starts_at / ends_at) — the source model has only isActive, nothing would
--     set a window, and a column no writer populates reads later as a feature that exists.
--   * image UPLOAD — the table stores a URL. The canonical media pipeline is out of this phase's
--     scope; an operator supplies an already-hosted URL.
--
-- Ordering: (position, created_at). Firestore ordered on `priority` alone, so two banners sharing a
-- priority came back in an order Firestore never promised and the carousel could reshuffle between
-- loads. created_at is the tiebreak that makes the strip stable.
--
-- Rollback: database/supabase/rollback/228_marketplace_banners.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  -- Presentation hints the client already carries on BannerModel. Nullable because a banner is
  -- displayable without them; the carousel falls back to its own aspect ratio.
  icon_name text NULL,
  target_route text NULL,
  color_hex text NULL,
  image_width integer NULL,
  image_height integer NULL,
  aspect_ratio_type text NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- https only. The strip renders inside the app; an http image is a mixed-content failure at best
  -- and a downgrade at worst, and this is the only place the URL is ever validated in the database.
  CONSTRAINT marketplace_banners_image_url_check CHECK (image_url ~ '^https://'),
  CONSTRAINT marketplace_banners_title_check CHECK (btrim(title) <> ''),
  CONSTRAINT marketplace_banners_color_hex_check
    CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT marketplace_banners_aspect_ratio_check
    CHECK (aspect_ratio_type IS NULL OR aspect_ratio_type IN ('wide', 'square', 'tall')),
  CONSTRAINT marketplace_banners_image_width_check CHECK (image_width IS NULL OR image_width > 0),
  CONSTRAINT marketplace_banners_image_height_check CHECK (image_height IS NULL OR image_height > 0),
  -- A relative in-app route or an https link. A bare '//host' or 'javascript:' target must never
  -- reach a client that will hand it to a router or a launcher.
  CONSTRAINT marketplace_banners_target_route_check
    CHECK (target_route IS NULL OR target_route ~ '^(/[^/]|https://)')
);

-- The public read's exact shape: live banners in display order.
CREATE INDEX IF NOT EXISTS marketplace_banners_active_position_idx
  ON public.marketplace_banners (position, created_at)
  WHERE is_active;

ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_banners FORCE ROW LEVEL SECURITY;

-- Public read of LIVE banners only — never USING (true) (Constitution ART-09 / R-3; 217:56 shape).
-- An inactive banner is unpublished editorial work and must not be readable by anon.
DROP POLICY IF EXISTS marketplace_banners_public_read ON public.marketplace_banners;
CREATE POLICY marketplace_banners_public_read ON public.marketplace_banners
  FOR SELECT TO anon, authenticated, app_tenant
  USING (is_active = true);

-- Curation is an operator concern (this phase's operations router).
DROP POLICY IF EXISTS service_role_marketplace_banners ON public.marketplace_banners;
CREATE POLICY service_role_marketplace_banners ON public.marketplace_banners
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- app_tenant received SELECT/INSERT/UPDATE/DELETE via 164's ALTER DEFAULT PRIVILEGES; the policy
-- above only permits SELECT, so the table-level grant is narrowed to match the intent (217:66).
-- A policy grants no table privilege, so service_role's grant is stated explicitly (223's lesson).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.marketplace_banners FROM app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.marketplace_banners TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.marketplace_banners TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_banners TO service_role;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_marketplace_banners_updated_at ON public.marketplace_banners;
    CREATE TRIGGER trg_marketplace_banners_updated_at
      BEFORE UPDATE ON public.marketplace_banners
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

COMMIT;
