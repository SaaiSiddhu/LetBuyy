-- Rollback for 180_urban_kicks_liquid_theme.sql
--
-- Reverts all four changes 180 applied to the first-party urban-kicks catalog row:
--   (1) settings_schema — 180 REPLACED the whole object, so its pre-image is not recoverable from
--       the database. The appearance group is removed and the seed's colors group is reinstated
--       only when absent (pre-image source: database/supabase/seeds/urban-kicks-theme.sql).
--   (2) default_template.rendererEngine — dropped; the theme falls back to React rendering.
--   (3) default_template.themeSettings — 180 overwrote it wholesale; restored to the seed palette.
--   (4) the hero `subtitle` setting 180 deleted — restored from the seed.
--
-- Note: reverting (2) takes every store on this theme off the Liquid renderer, and reverting (1)
-- reinstates the install-validation failure 180 fixed (appearance settings become undeclared again).
-- Re-running the urban-kicks seed is the authoritative full restore; this file restores only the
-- keys 180 touched, so any later platform edit to themeSettings is overwritten by (3).
--
-- Only the platform-owned catalog row (slug = 'urban-kicks') is touched. Merchant-authored content
-- lives in theme_instances / theme_releases / store_themes and is neither read nor written here.
-- Non-destructive: jsonb key edits only. No table, column, index, policy, or row is dropped. Re-runnable.

UPDATE public.themes
SET settings_schema = CASE
        WHEN settings_schema #> '{settings,colors}' IS NULL
            THEN jsonb_set(
                settings_schema #- '{settings,appearance}',
                '{settings,colors}',
                jsonb_build_object('label', 'Colors'),
                true
            )
        ELSE settings_schema #- '{settings,appearance}'
    END,
    default_template = (default_template - 'rendererEngine')
        || jsonb_build_object('themeSettings', jsonb_build_object(
                'primaryColor',      '#8B5CF6',
                'secondaryColor',    '#3B82F6',
                'accentColor',       '#F59E0B',
                'backgroundColor',   '#FFFFFF',
                'textColor',         '#1F2937',
                'fontFamily',        'Inter',
                'headingFontFamily', 'Inter',
                'borderRadius',      12,
                'enableShadows',     true,
                'enableAnimations',  true
           )),
    updated_at = NOW()
WHERE slug = 'urban-kicks';

-- Restore the hero subtitle only when it is still missing, and only when template slot 0 is still
-- the heroBanner section 180 stripped it from — writing it into a different section would be wrong.
UPDATE public.themes
SET default_template = jsonb_set(
        default_template,
        '{sections,template,0,settings,subtitle}',
        to_jsonb('Streetwear storefront sample'::text),
        true
    ),
    updated_at = NOW()
WHERE slug = 'urban-kicks'
  AND default_template #>> '{sections,template,0,type}' = 'heroBanner'
  AND default_template #> '{sections,template,0,settings}' IS NOT NULL
  AND default_template #> '{sections,template,0,settings,subtitle}' IS NULL;
