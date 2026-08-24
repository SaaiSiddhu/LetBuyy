-- Rollback for 199_liquid_activation_fresh_db_closure.sql
--
-- Reverts the same three things 180/181/193 revert, for the same reason: this migration is a
-- fresh/already-migrated-DB mirror of their closure, not a new decision.
--   (1) settings_schema — 199 REPLACED the whole object (same as 180), so its pre-image is not
--       recoverable from the database. The appearance group is removed and the seed's colors group is
--       reinstated only when absent (pre-image source: database/supabase/seeds/urban-kicks-theme.sql).
--   (2) default_template.rendererEngine — dropped; the theme falls back to React rendering.
--   (3) default_template.themeSettings — 199 overwrote it wholesale (same as 180); restored to the
--       original seed palette.
--   (4) the hero `subtitle` setting 199 deleted (same as 180); restored from the seed.
--   (5) the theme_schema_manifests registry sync (mirrors 193's rollback part 2) — unwrapped back to
--       the bare group map.
--
-- Note: reverting (2) takes urban-kicks off the Liquid renderer (the only theme this repository flips
-- to Liquid); reverting (1)/(5) reinstates the install-validation failure 180/193 fixed. Re-running the
-- urban-kicks seed (with its own appended closure block, added alongside this migration) is the
-- authoritative full restore for a fresh database; this file restores only the keys 199 touched.
--
-- Only the platform-owned catalog row (slug = 'urban-kicks') and its registry manifest are touched.
-- Merchant-authored content lives in theme_instances / theme_releases / store_themes and is neither
-- read nor written here. Non-destructive: jsonb key edits only. No table, column, index, policy, or row
-- is dropped. Re-runnable; safe when the row does not exist (matches zero rows, no error).

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
-- the heroBanner section 199 stripped it from — writing it into a different section would be wrong.
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

-- Unwrap the registry manifest back to the bare group map the seed originally shipped.
UPDATE public.theme_schema_manifests m
SET settings_schema = COALESCE(m.settings_schema -> 'settings', m.settings_schema),
    updated_at = NOW()
FROM public.theme_package_versions v
JOIN public.theme_packages p ON p.id = v.theme_package_id
JOIN public.themes t ON t.slug = p.slug
WHERE m.theme_package_version_id = v.id
  AND p.slug = 'urban-kicks'
  AND m.settings_schema ? 'settings';
