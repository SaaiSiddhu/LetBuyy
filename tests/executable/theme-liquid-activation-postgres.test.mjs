// S1/W2 — migration 199_liquid_activation_fresh_db_closure.sql behavioral coverage.
//
// Builds a minimal public.themes + theme_packages/theme_package_versions/theme_schema_manifests
// schema (columns copied verbatim from database/supabase/migrations/000_baseline.sql), seeds it with
// rows shaped exactly like the PRE-CLOSURE urban-kicks seed output (no rendererEngine, no appearance
// settings_schema group, a bare-group-map registry manifest) plus an untouched letbuyy-core-shaped row,
// then applies migration 199's real SQL from disk (not a re-implementation) and asserts the fix.
//
// Requires the ephemeral fixture from scripts/governance/foundation-ephemeral-postgres.mjs — run
// `pnpm run foundation:pg:start` first (docker exec only; no host port; does not disturb any other
// running Postgres/Redis container).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

const migrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/199_liquid_activation_fresh_db_closure.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/199_liquid_activation_fresh_db_closure.rollback.sql'),
  'utf8',
);

function psql(sql, targetDatabase = database) {
  return execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  ).trim();
}

// Dropping and recreating the database (rather than `DROP SCHEMA public CASCADE`) avoids exhausting the
// shared lock table when a prior run (e.g. the full 127-migration replay in
// scripts/liquid-parity/reproduce-d2-fresh-db.mjs) left thousands of objects in this same fixture.
function resetSchema() {
  psql(`DROP DATABASE IF EXISTS "${database}"; CREATE DATABASE "${database}";`, 'postgres');
  psql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE public.themes (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        site_type text DEFAULT 'store'::text NOT NULL,
        category text,
        description text,
        preview_url text,
        thumbnail_url text,
        is_premium boolean DEFAULT false,
        price numeric(10,2) DEFAULT 0,
        config jsonb DEFAULT '{}'::jsonb,
        author text DEFAULT 'LetBuyy'::text,
        version text DEFAULT '1.0'::text,
        is_active boolean DEFAULT true,
        sort_order integer DEFAULT 0,
        install_count integer DEFAULT 0,
        created_at timestamp with time zone DEFAULT now(),
        long_description text,
        industry text[] DEFAULT '{}'::text[],
        theme_preset_id text,
        letbuyy_pricing_type text DEFAULT 'free'::text,
        letbuyy_price_usd numeric(10,2) DEFAULT 0,
        letbuyy_price_inr numeric(10,2) DEFAULT 0,
        screenshots text[] DEFAULT '{}'::text[],
        demo_url text,
        color_presets jsonb DEFAULT '[]'::jsonb,
        font_pairings jsonb DEFAULT '[]'::jsonb,
        features text[] DEFAULT '{}'::text[],
        supported_site_types text[] DEFAULT '{store}'::text[],
        supported_platforms text[] DEFAULT '{letbuyy}'::text[],
        tags text[] DEFAULT '{}'::text[],
        rating_avg numeric(3,2) DEFAULT 0,
        review_count integer DEFAULT 0,
        author_url text,
        author_verified boolean DEFAULT false,
        updated_at timestamp with time zone DEFAULT now(),
        default_template jsonb DEFAULT '{}'::jsonb NOT NULL,
        section_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
        block_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
        settings_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
        renderer_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
        schema_version text DEFAULT '1.0.0'::text NOT NULL,
        renderer_version text DEFAULT '1.0.0'::text NOT NULL
    );

    CREATE TABLE public.theme_packages (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        name text NOT NULL,
        status text DEFAULT 'active'::text NOT NULL
    );

    CREATE TABLE public.theme_package_versions (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        theme_package_id uuid NOT NULL REFERENCES public.theme_packages(id),
        version text NOT NULL
    );

    CREATE TABLE public.theme_schema_manifests (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        theme_package_version_id uuid NOT NULL REFERENCES public.theme_package_versions(id),
        settings_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
}

// Mirrors the PRE-closure urban-kicks seed row shape exactly (default_template.themeSettings present,
// no rendererEngine key; settings_schema is the bare colors/typography/layout group with no top-level
// "settings" key) — i.e. the state migration 199 must repair on an "already-migrated" database whose
// row predates this phase's seed fix.
function seedPreClosureRows() {
  psql(`
    INSERT INTO public.themes (name, slug, default_template, settings_schema, renderer_manifest)
    VALUES (
      'Urban Kicks', 'urban-kicks',
      jsonb_build_object(
        'themeId', 'urban-kicks',
        'themeSettings', jsonb_build_object('primaryColor', '#8B5CF6'),
        'sections', jsonb_build_object(
          'template', jsonb_build_array(
            jsonb_build_object('id', 'hero-1', 'type', 'heroBanner', 'settings', jsonb_build_object('heading', 'Urban Kicks', 'subtitle', 'Streetwear storefront sample'))
          )
        )
      ),
      jsonb_build_object('colors', jsonb_build_object('label', 'Colors')),
      jsonb_build_object('engine', 'theme-engine-v1')
    );

    -- letbuyy-core: must NEVER be touched by migration 199 (canary stays off).
    INSERT INTO public.themes (name, slug, default_template, settings_schema, renderer_manifest)
    VALUES (
      'LetBuyy Core', 'letbuyy-core',
      jsonb_build_object('themeId', 'letbuyy-core'),
      jsonb_build_object('settings', jsonb_build_object('appearance', jsonb_build_object('fields', jsonb_build_object()))),
      jsonb_build_object('engine', 'theme-engine-v1')
    );

    INSERT INTO public.theme_packages (slug, name) VALUES ('urban-kicks', 'Urban Kicks');
    INSERT INTO public.theme_package_versions (theme_package_id, version)
      SELECT id, '1.0.0' FROM public.theme_packages WHERE slug = 'urban-kicks';
    INSERT INTO public.theme_schema_manifests (theme_package_version_id, settings_schema)
      SELECT v.id, jsonb_build_object('colors', jsonb_build_object('label', 'Colors'))
      FROM public.theme_package_versions v
      JOIN public.theme_packages p ON p.id = v.theme_package_id
      WHERE p.slug = 'urban-kicks';
  `);
}

function readUrbanKicksRow() {
  const raw = psql(`
    SELECT row_to_json(t) FROM (
      SELECT slug,
             default_template->>'rendererEngine' AS renderer_engine,
             default_template->'themeSettings' AS theme_settings,
             default_template #>> '{sections,template,0,settings,subtitle}' AS hero_subtitle,
             settings_schema #> '{settings,appearance,fields}' AS appearance_fields,
             settings_schema AS settings_schema,
             default_template AS default_template
      FROM public.themes WHERE slug = 'urban-kicks'
    ) t;
  `);
  return JSON.parse(raw);
}

function readLetbuyyCoreRow() {
  const raw = psql(`
    SELECT row_to_json(t) FROM (
      SELECT slug, default_template->>'rendererEngine' AS renderer_engine
      FROM public.themes WHERE slug = 'letbuyy-core'
    ) t;
  `);
  return JSON.parse(raw);
}

function readManifestSettingsSchema() {
  const raw = psql(`
    SELECT m.settings_schema::text
    FROM public.theme_schema_manifests m
    JOIN public.theme_package_versions v ON v.id = m.theme_package_version_id
    JOIN public.theme_packages p ON p.id = v.theme_package_id
    WHERE p.slug = 'urban-kicks';
  `);
  return JSON.parse(raw);
}

test('S1/W2: migration 199 closes the fresh/already-migrated urban-kicks Liquid-activation gap', async (t) => {
  resetSchema();
  seedPreClosureRows();

  await t.test('before: urban-kicks has no rendererEngine (matches the reproduced D2 state)', () => {
    const before = readUrbanKicksRow();
    assert.equal(before.renderer_engine, null);
  });

  psql(migrationSql);

  await t.test('after: urban-kicks renders Liquid with the complete appearance schema', () => {
    const after = readUrbanKicksRow();
    assert.equal(after.renderer_engine, 'liquid');
    assert.equal(after.hero_subtitle, null, 'the unschematized hero subtitle must be removed, per migration 180');
    const fields = Object.keys(after.appearance_fields).sort();
    assert.deepEqual(fields, [
      'accentColor', 'backgroundColor', 'bodyFontFamily', 'borderRadius', 'enableAnimations',
      'enableShadows', 'fontFamily', 'headingFontFamily', 'isDark', 'primaryColor',
      'secondaryColor', 'surfaceColor', 'textColor',
    ].sort());
    assert.notEqual(after.default_template, '{}');
    assert.notEqual(after.settings_schema, '{}');
  });

  await t.test('letbuyy-core is untouched — the canary stays off (D2 fix must not flip the canonical theme)', () => {
    const core = readLetbuyyCoreRow();
    assert.equal(core.renderer_engine, null, 'letbuyy-core must never gain rendererEngine as a side effect of the urban-kicks fix');
  });

  await t.test('the theme_schema_manifests registry copy is synced (migration 193 part 1, mirrored)', () => {
    const manifest = readManifestSettingsSchema();
    assert.ok('settings' in manifest, 'the manifest must gain the top-level "settings" wrapper');
    assert.ok(manifest.settings.appearance.fields.bodyFontFamily, 'bodyFontFamily must be present in the synced manifest');
  });

  const afterFirstRun = readUrbanKicksRow();

  await t.test('idempotent: re-applying 199 produces byte-identical final state', () => {
    psql(migrationSql);
    const afterSecondRun = readUrbanKicksRow();
    assert.deepEqual(afterSecondRun, afterFirstRun);
  });

  await t.test('non-destructive: no DROP/DELETE/TRUNCATE in the migration text', () => {
    assert.doesNotMatch(migrationSql, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION|DROP\s+POLICY/i);
  });

  await t.test('rollback reverses the migration (renderer falls back to React, appearance group removed)', () => {
    psql(rollbackSql);
    const rolledBack = readUrbanKicksRow();
    assert.equal(rolledBack.renderer_engine, null);
    assert.equal(rolledBack.appearance_fields, null);
  });

  await t.test('rollback is re-runnable and safe when the row already lacks the closure', () => {
    assert.doesNotThrow(() => psql(rollbackSql));
  });
});
