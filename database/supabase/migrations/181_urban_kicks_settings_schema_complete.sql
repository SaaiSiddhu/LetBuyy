-- 181 — Complete the Urban Kicks appearance settings schema so the theme editor can save drafts.
--
-- The theme editor (merchant-control-plane) sends the FULL ThemeSettings object on every draft save /
-- live-preview sync. collectThemeTemplateValidationIssues() rejects any themeSettings key that is not
-- declared in the theme's settings_schema with
--   "themeSettings.<key> is not defined by the theme settings schema"
-- which the gateway surfaces as `ValidationError: Theme template validation failed` → HTTP 400. That 400
-- broke PUT /v1/themes/urban-kicks/editor/draft (the editor's auto-save + preview-token step).
--
-- Migration 180 added the appearance group but declared only 10 of the 12 ThemeSettings fields. The two
-- missing fields — `surfaceColor` and `isDark` — are part of DEFAULT_THEME_SETTINGS (so the editor always
-- sends them) and are genuinely consumed by the storefront preview's buildThemeCss() (--surface, --is-dark,
-- card/footer derivations). Declaring them is the correct completion, not a workaround.
--
-- Additive + idempotent: jsonb_set(..., create_missing => true) only inserts/overwrites these two leaves and
-- leaves the other 10 fields untouched. Re-running is a no-op. (If the theme is recreated from
-- seeds/urban-kicks-theme.sql on a fresh DB, mirror these two fields there too — same note as migration 180.)
UPDATE public.themes
SET settings_schema = jsonb_set(
        jsonb_set(
            settings_schema,
            '{settings,appearance,fields,surfaceColor}',
            jsonb_build_object('type', 'text', 'label', 'Surface'),
            true
        ),
        '{settings,appearance,fields,isDark}',
        jsonb_build_object('type', 'toggle', 'label', 'Dark mode'),
        true
    ),
    updated_at = NOW()
WHERE slug = 'urban-kicks'
  AND settings_schema #> '{settings,appearance,fields}' IS NOT NULL;
