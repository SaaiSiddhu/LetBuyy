-- 188 — Materialize the canonical `letbuyy-core` theme row (Phase G / G5).
--
-- `packages/theme-engine/src/theme-bundle-core.ts` aliases urban-kicks <-> letbuyy-core in CODE
-- (resolveCanonicalThemeSlug, LETBUYY_CORE_THEME_SLUG = 'letbuyy-core'), but the `themes` table has never
-- had a row with slug = 'letbuyy-core'. Any DB lookup by the canonical slug returns 0 rows, so the code
-- alias silently dead-ends for anything that queries the table by slug (certified risk in
-- docs/storefront-liquid-discovery). This migration gives the canonical slug a real, renderable row by
-- cloning the already-Liquid urban-kicks row (its default_template carries rendererEngine = 'liquid' and
-- the appearance settings_schema from migrations 180-181), overriding only id/name/slug.
--
-- Additive + idempotent:
--   * ON CONFLICT (slug) DO NOTHING — safe to re-run; never overwrites an existing letbuyy-core row.
--   * If urban-kicks does not exist yet (fresh DB before its seed), the SELECT yields 0 rows and nothing
--     is inserted — no error. Re-running after the seed lands then creates the row.
--   * Touches only public.themes. No money/RLS/auth tables. No data deletion. No existing row is modified.
--   * The code alias remains the runtime fallback; this row is the DB-of-record so slug queries resolve.
INSERT INTO public.themes (
    id, name, slug,
    site_type, category, description,
    config, default_template, settings_schema,
    is_active, is_premium,
    letbuyy_pricing_type, supported_site_types, supported_platforms, industry
)
SELECT
    gen_random_uuid(), 'LetBuyy Core', 'letbuyy-core',
    site_type, category, description,
    config, default_template, settings_schema,
    is_active, is_premium,
    letbuyy_pricing_type, supported_site_types, supported_platforms, industry
FROM public.themes
WHERE slug = 'urban-kicks'
ON CONFLICT (slug) DO NOTHING;
