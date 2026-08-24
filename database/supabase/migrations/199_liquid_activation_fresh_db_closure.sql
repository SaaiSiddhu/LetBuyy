-- 199 — Close the urban-kicks Liquid-activation gap on a fresh (or already-migrated) database.
--
-- WHAT / WHY.
-- Migrations 180 (rendererEngine + themeSettings + settings_schema appearance group), 181
-- (surfaceColor/isDark) and 193 (bodyFontFamily + theme_schema_manifests registry sync) are all
-- `UPDATE ... WHERE slug = 'urban-kicks'`. On a database built by applying every migration in order
-- and only then applying the seeds (database/supabase/seeds/urban-kicks-theme.sql), that row does not
-- exist yet when 180/181/193 run, so every one of those UPDATEs matches zero rows. Reproduced against
-- a real, bootstrapped Postgres 16 fixture (docs/evidence/liquid-parity/S1-W1-d2-reproduction.json,
-- scripts/liquid-parity/reproduce-d2-fresh-db.mjs): a full 127-migration + 3-seed replay leaves EVERY
-- `public.themes` row, including 'urban-kicks', with rendererEngine unset.
--
-- 180's own header already named this hazard ("if the theme is (re)created from seeds/urban-kicks-
-- theme.sql on a fresh DB, mirror these defaults there too") and 171/172 already do that mirroring for
-- default_template.liquidBundle (an UPDATE block is appended to the seed itself, so it runs AFTER the
-- seed's own INSERT ... ON CONFLICT (slug) DO UPDATE SET default_template = EXCLUDED.default_template
-- and therefore is not clobbered by it). 180/181/193 were never given the same treatment.
--
-- THE FIX HAS TWO HALVES, because migrations always run before seeds in this repository (confirmed by
-- the reproduction script) and the seed's own `ON CONFLICT (slug) DO UPDATE SET default_template =
-- EXCLUDED.default_template, settings_schema = EXCLUDED.settings_schema` unconditionally overwrites
-- both columns:
--   (a) database/supabase/seeds/urban-kicks-theme.sql now carries the SAME closure below, appended
--       after its existing liquidBundle block, so a genuinely fresh database is correct immediately —
--       a migration cannot fix this half, because migration 199 also runs before that seed.
--   (b) THIS migration is the closure for every OTHER path: an already-migrated database whose
--       urban-kicks row was created by an older copy of the seed (before half (a) existed), a
--       hand-restored row, or a re-run of migrations 000-198 against a database that already has the
--       row. Idempotent: re-running (including a second application of 199 itself) reasserts the same
--       final values and changes nothing further.
--
-- LIQUID DECISION — URBAN KICKS ONLY, NOT LETBUYY-CORE.
-- Urban Kicks is the ARB-approved Liquid canary/reference fixture (THEME_LIQUID_PORTABLE_SECTION_PARITY
-- test matrix, packages/theme-engine/src/theme-governance.ts); flipping it to Liquid is the existing,
-- already-ratified decision migrations 180/181/193 encode, not a new one. This migration does not touch
-- `letbuyy-core` (migration 197 deliberately leaves it dark) and does not touch any other theme, store,
-- or merchant-owned row. default_template.liquidBundle is untouched here — it is already closed by
-- migration 172 (already-migrated path) and the seed's existing generated append (fresh-DB path).
--
-- ADDITIVE + IDEMPOTENT + NON-DESTRUCTIVE: jsonb key edits only, guarded on slug = 'urban-kicks' (theme
-- catalog rows only) and on the theme_schema_manifests join 193 already uses. No table, column, index,
-- policy, trigger, or row is dropped. No money, identity, auth, session, ledger, or RLS surface is
-- touched. Safe when the row does not exist yet (0 rows affected, no error) — see half (a) above for
-- why that is expected and handled elsewhere, not a defect in this migration.

UPDATE public.themes
SET default_template = (
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
    settings_schema = jsonb_build_object(
        'settings', jsonb_build_object(
            'appearance', jsonb_build_object(
                'label', 'Appearance',
                'fields', jsonb_build_object(
                    'primaryColor',      jsonb_build_object('type', 'text',   'label', 'Primary color'),
                    'secondaryColor',    jsonb_build_object('type', 'text',   'label', 'Secondary color'),
                    'accentColor',       jsonb_build_object('type', 'text',   'label', 'Accent color'),
                    'backgroundColor',   jsonb_build_object('type', 'text',   'label', 'Background'),
                    'textColor',         jsonb_build_object('type', 'text',   'label', 'Text'),
                    'fontFamily',        jsonb_build_object('type', 'text',   'label', 'Body font'),
                    'headingFontFamily', jsonb_build_object('type', 'text',   'label', 'Heading font'),
                    'borderRadius',      jsonb_build_object('type', 'number', 'label', 'Corner radius'),
                    'enableShadows',     jsonb_build_object('type', 'toggle', 'label', 'Shadows'),
                    'enableAnimations',  jsonb_build_object('type', 'toggle', 'label', 'Animations'),
                    'surfaceColor',      jsonb_build_object('type', 'text',   'label', 'Surface'),
                    'isDark',            jsonb_build_object('type', 'toggle', 'label', 'Dark mode'),
                    'bodyFontFamily',    jsonb_build_object('type', 'text',   'label', 'Body font family')
                )
            )
        )
    ),
    updated_at = NOW()
WHERE slug = 'urban-kicks';

-- Registry-manifest mirror of migration 193 part (1) (see that migration's header): copy the
-- now-correctly-shaped themes.settings_schema into theme_schema_manifests wherever the manifest is
-- still the legacy bare-group shape. Guarded exactly as 193 guards it, so a marketplace-authored
-- manifest that already declares its own "settings" key is never overwritten.
UPDATE public.theme_schema_manifests m
SET settings_schema = t.settings_schema,
    updated_at = NOW()
FROM public.theme_package_versions v
JOIN public.theme_packages p ON p.id = v.theme_package_id
JOIN public.themes t ON t.slug = p.slug
WHERE m.theme_package_version_id = v.id
  AND p.slug = 'urban-kicks'
  AND t.settings_schema ? 'settings'
  AND jsonb_typeof(t.settings_schema -> 'settings') = 'object'
  AND NOT (m.settings_schema ? 'settings');
