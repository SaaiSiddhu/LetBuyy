#!/usr/bin/env node
// L1 — Bundle Persistence (Full Liquid V1).
//
// Generates the canonical urban-kicks Liquid bundle from the theme-engine fixture and emits:
//   - database/supabase/seeds/generated/urban-kicks-liquid-bundle.json   (evidence + source of truth)
//   - database/supabase/migrations/171_liquid_bundle_persistence.sql     (idempotent, additive backfill)
// The identical additive UPDATE is also appended once into database/supabase/seeds/urban-kicks-theme.sql
// (fresh-DB path); if the bundle changes, re-run this script and re-sync that appended block.
//
// The merge is ADDITIVE: it sets a `liquidBundle` key on themes.default_template without touching the
// existing React sections/templates, so the canary-OFF React render path is byte-identical. Rendering
// only switches to Liquid for a store with liquidRenderingCanary=true (L15). Production-safe.
//
// Run: npx tsx scripts/liquid-parity/build-urban-kicks-bundle.mjs
//   (theme-bundle.ts imports only `zod`; in a fully-installed workspace this resolves directly. In a
//    partially-installed checkout, link it first: ln -s <store>/zod packages/theme-engine/node_modules/zod)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createUrbanKicksLiquidThemeBundleFixture,
  parseLiquidThemePackageBundle,
  LiquidThemePackageBundleSchema,
} from '../../packages/theme-engine/src/theme-bundle.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GEN_DIR = resolve(ROOT, 'database/supabase/seeds/generated');
const MIG_PATH = resolve(ROOT, 'database/supabase/migrations/171_liquid_bundle_persistence.sql');
const JSON_PATH = resolve(GEN_DIR, 'urban-kicks-liquid-bundle.json');

// 1. Build + re-validate the bundle (the fixture already parses; re-parse to be explicit).
const bundle = parseLiquidThemePackageBundle(createUrbanKicksLiquidThemeBundleFixture());
const reparse = LiquidThemePackageBundleSchema.safeParse(bundle);
if (!reparse.success) {
  console.error('FATAL: bundle is not schema-valid:', reparse.error.issues);
  process.exit(1);
}
if (bundle.renderer.engine !== 'liquid') {
  console.error(`FATAL: renderer.engine is "${bundle.renderer.engine}", expected "liquid"`);
  process.exit(1);
}

const sectionKeys = Object.keys(bundle.sections);
const templateKeys = Object.keys(bundle.templates);
const blockKeys = Object.keys(bundle.blocks);

// 2. Serialize. The persisted value is the bundle itself (resolveLiquidBundle parses
//    store.templateConfig.liquidBundle against LiquidThemePackageBundleSchema).
const bundleJson = JSON.stringify(bundle);
const dollarTag = '$liquidbundle$';
if (bundleJson.includes(dollarTag)) {
  console.error('FATAL: bundle JSON contains the dollar-quote tag; pick another tag.');
  process.exit(1);
}

const attachSql = `-- ADDITIVE + idempotent: merge the Liquid bundle into themes.default_template for urban-kicks.
-- Keeps the existing React sections/templates intact; rendering stays React until a store opts into
-- liquidRenderingCanary (L15). Regenerate via scripts/liquid-parity/build-urban-kicks-bundle.mjs.
UPDATE public.themes
SET default_template = COALESCE(default_template, '{}'::jsonb)
        || jsonb_build_object('liquidBundle', ${dollarTag}${bundleJson}${dollarTag}::jsonb),
    updated_at = NOW()
WHERE slug = 'urban-kicks';
`;

const migrationSql = `-- 171_liquid_bundle_persistence.sql
-- L1 — Bundle Persistence (Full Liquid V1). Backfills EXISTING databases whose urban-kicks theme
-- was seeded before the Liquid bundle existed. Fresh databases get the bundle from the seed
-- (database/supabase/seeds/urban-kicks-theme.sql) directly. Both carry the identical bundle.
-- GENERATED — do not hand-edit the JSON; run scripts/liquid-parity/build-urban-kicks-bundle.mjs.
--
-- Safety: ADDITIVE jsonb merge (no column drop, no destructive replace); canary-gated rendering
-- (resolveThemeLiquidRenderingEnabled defaults false). No money/identity/tenancy surface touched.

${attachSql}`;

// 3. Emit.
mkdirSync(GEN_DIR, { recursive: true });
writeFileSync(JSON_PATH, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
writeFileSync(MIG_PATH, migrationSql, 'utf8');

// 4. Report.
console.log('urban-kicks Liquid bundle — generated');
console.log('  package.slug      :', bundle.package.slug);
console.log('  schema_version    :', bundle.schema_version);
console.log('  renderer.engine   :', bundle.renderer.engine, '(version', bundle.renderer.renderer_version + ')');
console.log('  sections          :', sectionKeys.length, '->', sectionKeys.join(', '));
console.log('  templates         :', templateKeys.length, '->', templateKeys.join(', '));
console.log('  blocks            :', blockKeys.length, '->', blockKeys.join(', '));
console.log('  layout            :', bundle.layout.theme.path);
console.log('  bundle JSON bytes :', bundleJson.length);
console.log('  schema-valid      : YES');
console.log('  parseLimit budget : 300000 (renderer parseLimit) — informational');
console.log('written:');
console.log('  ', JSON_PATH.replace(ROOT + '/', ''));
console.log('  ', MIG_PATH.replace(ROOT + '/', ''));
console.log('seed attach: re-sync the appended UPDATE in database/supabase/seeds/urban-kicks-theme.sql if the bundle changed.');
