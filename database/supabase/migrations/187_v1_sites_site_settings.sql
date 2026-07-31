-- Merchant Appearance settings (sites.site_settings) — brand color, font, radius, logo,
-- favicon, custom CSS — persisted by the Appearance page and read by the storefront so the
-- saved brand reaches the storefront :root tokens (LB-9 appearance bridge). Additive + replayable.
-- Writer:
--   services/api-gateway/src/routes/stores.ts -> sites (site_settings allowed in PATCH)
-- Readers:
--   services/api-gateway/src/routes/storefront.ts (STOREFRONT_SITE_SELECT / *_COMPAT_SELECT)
--   apps/storefront-runtime/src/lib/store-service.ts (mapSupabaseToStore appearance bridge)
-- Rollback (forward-fix preferred): drop the column with IF EXISTS in a follow-up migration.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS site_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sites.site_settings IS
  'Merchant Appearance-page settings (snake_case): primary_color, font_family, border_radius, logo_url, favicon_url, custom_css. Mapped into storefront themeSettings by mapSupabaseToStore (LB-9).';
