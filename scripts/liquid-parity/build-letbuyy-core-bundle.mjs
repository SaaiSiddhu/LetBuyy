#!/usr/bin/env node
// S1/W3 — Attach the letbuyy-core Liquid bundle. Canary stays OFF.
//
// Mirrors scripts/liquid-parity/build-urban-kicks-bundle.mjs exactly, but for the `letbuyy-core`
// catalog row instead of `urban-kicks`, and — critically — the emitted migration does NOT set
// rendererEngine or liquidRenderingCanary. The bundle becomes present on the row so it can be
// evaluated for render-parity, but resolveThemeLiquidRenderingEnabled() only returns true when an
// explicit engine/canary signal is present (packages/theme-engine/src/theme-governance.ts:144-181), so
// a bundle-present-canary-off row keeps rendering React. See migration 197's header for why
// rendererEngine must never be set here by default.
//
// Generates and emits:
//   - database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json  (evidence + source of truth)
//   - database/supabase/migrations/200_letbuyy_core_liquid_bundle_attach.sql (idempotent, additive attach)
//   - database/supabase/rollback/200_letbuyy_core_liquid_bundle_attach.rollback.sql
//
// Run: npx tsx scripts/liquid-parity/build-letbuyy-core-bundle.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLetbuyyCoreLiquidThemeBundleFixture,
  LETBUYY_CORE_BUNDLE_SLUG,
} from '../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidThemePackageBundleSchema } from '../../packages/theme-engine/src/theme-bundle.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GEN_DIR = resolve(ROOT, 'database/supabase/seeds/generated');
const MIG_PATH = resolve(ROOT, 'database/supabase/migrations/200_letbuyy_core_liquid_bundle_attach.sql');
const ROLLBACK_PATH = resolve(ROOT, 'database/supabase/rollback/200_letbuyy_core_liquid_bundle_attach.rollback.sql');
const JSON_PATH = resolve(GEN_DIR, 'letbuyy-core-liquid-bundle.json');

// 1. Build + re-validate the bundle.
const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
const reparse = LiquidThemePackageBundleSchema.safeParse(bundle);
if (!reparse.success) {
  console.error('FATAL: bundle is not schema-valid:', reparse.error.issues);
  process.exit(1);
}
if (bundle.renderer.engine !== 'liquid') {
  console.error(`FATAL: renderer.engine is "${bundle.renderer.engine}", expected "liquid"`);
  process.exit(1);
}
if (bundle.package.slug !== LETBUYY_CORE_BUNDLE_SLUG) {
  console.error(`FATAL: bundle.package.slug is "${bundle.package.slug}", expected "${LETBUYY_CORE_BUNDLE_SLUG}"`);
  process.exit(1);
}

const sectionKeys = Object.keys(bundle.sections);
const templateKeys = Object.keys(bundle.templates);
const blockKeys = Object.keys(bundle.blocks);

// 2. Serialize.
const bundleJson = JSON.stringify(bundle);
const dollarTag = '$liquidbundle$';
if (bundleJson.includes(dollarTag)) {
  console.error('FATAL: bundle JSON contains the dollar-quote tag; pick another tag.');
  process.exit(1);
}

const migrationSql = `-- 200 — Attach the letbuyy-core Liquid bundle. Canary stays OFF.
--
-- WHAT / WHY.
-- packages/theme-engine/examples/letbuyy-core-liquid/ (${sectionKeys.length} sections, ${templateKeys.length}
-- templates) is authored, schema-valid, and tested — and attached to NO database row, so the canonical
-- theme cannot be evaluated for render-parity because its bundle never reaches the runtime. This
-- migration attaches it to \`letbuyy-core\` (created by migration 197) the same way migration 172
-- attaches the Urban Kicks bundle to \`urban-kicks\`: an additive jsonb merge of default_template.liquidBundle.
--
-- CANARY STAYS OFF. This migration does NOT set default_template.rendererEngine and does NOT set
-- liquidRenderingCanary anywhere. resolveThemeLiquidRenderingEnabled()
-- (packages/theme-engine/src/theme-governance.ts:144-181) only returns true when an EXPLICIT
-- rendererEngine/canary signal is present; a bundle with neither renders through the frozen React fast
-- path, unchanged. apps/commerce/web/src/lib/store-service.ts's liquidRenderingCanary default is
-- \`undefined\` (not \`false\`) specifically so it does not short-circuit a later per-theme opt-in — this
-- migration does not touch that default either. THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status stays
-- 'deferred'. Flipping letbuyy-core to Liquid is a separate, later, ARB-ratified act.
--
-- GENERATED — do not hand-edit the JSON; run scripts/liquid-parity/build-letbuyy-core-bundle.mjs.
--
-- ADDITIVE + IDEMPOTENT + NON-DESTRUCTIVE: the '||' merge only ever sets the same liquidBundle key to
-- the same value; no table, column, index, policy, or row is dropped; no money/identity/tenancy/RLS
-- surface is touched. Safe when the letbuyy-core row does not exist yet (0 rows affected, no error) —
-- migration 197 (already applied before this one, since 200 > 197) creates it on every database.
UPDATE public.themes
SET default_template = COALESCE(default_template, '{}'::jsonb)
        || jsonb_build_object('liquidBundle', ${dollarTag}${bundleJson}${dollarTag}::jsonb),
    updated_at = NOW()
WHERE slug = 'letbuyy-core';
`;

const rollbackSql = `-- Rollback for 200_letbuyy_core_liquid_bundle_attach.sql
--
-- Removes the liquidBundle key this migration added. rendererEngine was never set by 200, so there is
-- nothing to revert on that axis — the row already renders React before and after this rollback.
-- Non-destructive: a single jsonb key removal. No table, column, index, policy, or row is dropped.
-- Safe when the row does not exist, or the key is already absent (both are no-ops). Re-runnable.
UPDATE public.themes
SET default_template = default_template - 'liquidBundle',
    updated_at = NOW()
WHERE slug = 'letbuyy-core'
  AND default_template ? 'liquidBundle';
`;

// 3. Emit.
mkdirSync(GEN_DIR, { recursive: true });
writeFileSync(JSON_PATH, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
writeFileSync(MIG_PATH, migrationSql, 'utf8');
writeFileSync(ROLLBACK_PATH, rollbackSql, 'utf8');

// 4. Report.
console.log('letbuyy-core Liquid bundle — generated');
console.log('  package.slug      :', bundle.package.slug);
console.log('  schema_version    :', bundle.schema_version);
console.log('  renderer.engine   :', bundle.renderer.engine, '(version', bundle.renderer.renderer_version + ')');
console.log('  sections          :', sectionKeys.length);
console.log('  templates         :', templateKeys.length, '->', templateKeys.join(', '));
console.log('  blocks            :', blockKeys.length);
console.log('  bundle JSON bytes :', bundleJson.length);
console.log('  schema-valid      : YES');
console.log('  rendererEngine set: NO (canary stays off)');
console.log('written:');
console.log('  ', JSON_PATH.replace(ROOT + '/', ''));
console.log('  ', MIG_PATH.replace(ROOT + '/', ''));
console.log('  ', ROLLBACK_PATH.replace(ROOT + '/', ''));
