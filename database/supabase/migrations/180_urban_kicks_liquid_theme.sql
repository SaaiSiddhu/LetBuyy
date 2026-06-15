-- 180 — Make Urban Kicks a first-class Liquid theme.
--
-- The Liquid bundle was already persisted into themes.default_template by migration 172. This migration
-- finishes the conversion so the theme renders Liquid and installs cleanly:
--   1) rendererEngine = 'liquid'  — resolveThemeLiquidRenderingEnabled() honors templateConfig.rendererEngine
--      (and store-service passes it through to the storefront gate), so any store on this theme renders Liquid.
--   2) settings_schema gains an "appearance" group so the standard brand-color/typography settings VALIDATE
--      (collectThemeTemplateValidationIssues previously rejected them as "not defined by the theme settings
--      schema", which blocked install).
--   3) brand colors are set in default_template.themeSettings.
--   4) the unschematized hero `subtitle` setting that also failed install validation is removed.
--
-- Additive + idempotent. Note: if the theme is (re)created from seeds/urban-kicks-theme.sql on a fresh DB,
-- mirror these defaults there too (same pattern as migration 172's seed sync).
UPDATE public.themes
SET settings_schema = jsonb_build_object(
        'settings', jsonb_build_object(
            'appearance', jsonb_build_object(
                'label', 'Appearance',
                'fields', jsonb_build_object(
                    'primaryColor',      jsonb_build_object('type','text','label','Primary color'),
                    'secondaryColor',    jsonb_build_object('type','text','label','Secondary color'),
                    'accentColor',       jsonb_build_object('type','text','label','Accent color'),
                    'backgroundColor',   jsonb_build_object('type','text','label','Background'),
                    'textColor',         jsonb_build_object('type','text','label','Text'),
                    'fontFamily',        jsonb_build_object('type','text','label','Body font'),
                    'headingFontFamily', jsonb_build_object('type','text','label','Heading font'),
                    'borderRadius',      jsonb_build_object('type','number','label','Corner radius'),
                    'enableShadows',     jsonb_build_object('type','toggle','label','Shadows'),
                    'enableAnimations',  jsonb_build_object('type','toggle','label','Animations')
                )
            )
        )
    ),
    default_template = (
        COALESCE(default_template, '{}'::jsonb)
        || jsonb_build_object('rendererEngine', 'liquid')
        || jsonb_build_object('themeSettings', jsonb_build_object(
                'primaryColor',      '#6d5dfc',
                'secondaryColor',    '#4f7cff',
                'accentColor',       '#22d3ee',
                'backgroundColor',   'rgb(255 255 255)',
                'textColor',         'rgb(26 26 46)',
                'fontFamily',        'Inter',
                'headingFontFamily', 'Space Grotesk',
                'borderRadius',      12,
                'enableShadows',     true,
                'enableAnimations',  true
           ))
    ) #- '{sections,template,0,settings,subtitle}',
    updated_at = NOW()
WHERE slug = 'urban-kicks';
