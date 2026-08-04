-- 193 — Sync the theme schema REGISTRY with the theme CATALOG, and declare bodyFontFamily.
--
-- Two defects, one symptom: POST /v1/themes/urban-kicks/install returns
--   ValidationError: Theme template validation failed
--   ["themeSettings.primaryColor is not defined by the theme settings schema", ...12 fields]
-- so no theme_instances row is ever created and the merchant Themes page shows "No themes installed yet".
--
-- (1) WRONG SHAPE IN THE REGISTRY.
--     validateTemplateConfig() validates against resolveThemeRuntime(), which prefers
--     theme_schema_manifests.settings_schema over themes.settings_schema. The manifest seeded by
--     database/supabase/seeds/urban-kicks-theme.sql is a bare group map:
--         { "colors": {...}, "layout": {...}, "typography": {...} }
--     with no top-level "settings" key. normalizeThemeSettingsSchema() (schema-registry-execution.adapter.ts)
--     therefore takes its fallback branch and wraps the WHOLE record as settings.general.fields, so the
--     declared field names become literally "colors", "layout", "typography". validateThemeSettings()
--     flattens group.fields and then rejects every real key — primaryColor, fontFamily, and the rest.
--     Migrations 180 and 181 fixed themes.settings_schema but never touched the registry copy that
--     actually drives validation, so the theme looked correct in the catalog and still failed to install.
--     Fix: copy themes.settings_schema (already the correct { "settings": { <group>: { fields } } } shape
--     after 180/181) into the manifest, but ONLY where the manifest is mis-shaped — the
--     `NOT (settings_schema ? 'settings')` guard means a correctly-shaped marketplace manifest is
--     never overwritten, and re-running is a no-op.
--
-- (2) UNDECLARED bodyFontFamily.
--     bodyFontFamily is a real, consumed theme setting — theme-renderer.ts maps it to the --font-body
--     custom property, and theme-safe-update.ts / experience-apply.ts both carry it — but it is absent
--     from DEFAULT_THEME_SETTINGS, so migration 181 ("settings_schema_complete") declared only the other
--     twelve. Stores whose template_config carries bodyFontFamily therefore fail validation on every
--     install, draft save, and publish. Declaring it is the correct completion, matching 181's reasoning
--     for surfaceColor and isDark.
--
-- Additive + idempotent + non-destructive:
--   * jsonb_set(..., create_missing => true) writes one leaf; the other fields are untouched.
--   * The manifest UPDATE is guarded on the mis-shaped case and on a non-empty source schema.
--   * No table, column, index, policy, or row is dropped. No money/identity/RLS/checkout surface.
--   * Fresh DBs: seeds/urban-kicks-theme.sql still ships the legacy manifest shape, so this migration
--     must run after the seed — the same ordering note carried by migrations 180 and 181.

-- (2) Declare bodyFontFamily on the first-party Liquid themes.
UPDATE public.themes
SET settings_schema = jsonb_set(
        settings_schema,
        '{settings,appearance,fields,bodyFontFamily}',
        jsonb_build_object('type', 'text', 'label', 'Body font family'),
        true
    ),
    updated_at = NOW()
WHERE slug IN ('urban-kicks', 'letbuyy-core')
  AND settings_schema #> '{settings,appearance,fields}' IS NOT NULL;

-- (1) Point the registry manifest at the catalog schema wherever the manifest is mis-shaped.
UPDATE public.theme_schema_manifests m
SET settings_schema = t.settings_schema,
    updated_at = NOW()
FROM public.theme_package_versions v
JOIN public.theme_packages p ON p.id = v.theme_package_id
JOIN public.themes t ON t.slug = p.slug
WHERE m.theme_package_version_id = v.id
  AND t.settings_schema ? 'settings'
  AND jsonb_typeof(t.settings_schema -> 'settings') = 'object'
  AND NOT (m.settings_schema ? 'settings');
