// S1/W3 — attach the letbuyy-core Liquid bundle; the canary stays OFF.
//
// Two mandated tests:
//   1. The generated Core bundle (database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json,
//      the same JSON migration 200 attaches) parses against LiquidThemePackageBundleSchema.
//   2. THE SAFETY TEST — a store on letbuyy-core with the bundle attached and no explicit canary signal
//      resolves rendererEngine !== 'liquid', i.e. still renders React. This is the property that makes
//      "bundle present, canary off" safe: resolveThemeLiquidRenderingEnabled() only flips on an EXPLICIT
//      rendererEngine/canary signal, never merely on liquidBundle being present.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { LiquidThemePackageBundleSchema } from '../src/theme-bundle.ts';
import { resolveThemeLiquidRenderingEnabled } from '../src/theme-governance.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bundleJson = JSON.parse(
  readFileSync(resolve(ROOT, 'database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json'), 'utf8'),
);
const migrationSql = readFileSync(
  resolve(ROOT, 'database/supabase/migrations/200_letbuyy_core_liquid_bundle_attach.sql'),
  'utf8',
);

test('S1/W3: the attached Core bundle is schema-valid', () => {
  const result = LiquidThemePackageBundleSchema.safeParse(bundleJson);
  assert.ok(result.success, result.success ? undefined : JSON.stringify(result.error.issues));
  assert.equal(bundleJson.package.slug, 'letbuyy-core-liquid');
  assert.equal(bundleJson.renderer.engine, 'liquid');
});

test('S1/W3 SAFETY: bundle-present + canary-off still resolves to React (rendererEngine !== "liquid")', () => {
  // Exactly the post-migration-200 shape: default_template carries liquidBundle, carries no
  // rendererEngine key, and the store carries no liquidRenderingCanary — matching store-service.ts's
  // documented `undefined` (not `false`) default for a store with no explicit canary opt-in.
  const templateConfig = {
    sections: [],
    themeId: 'letbuyy-core',
    liquidBundle: bundleJson,
  } as any;

  const enabled = resolveThemeLiquidRenderingEnabled({ templateConfig });
  assert.equal(enabled, false, 'a bundle-present, canary-off store must render React, not Liquid');
});

test('S1/W3 SAFETY: an explicit canary=true on the SAME templateConfig does flip to Liquid (control case)', () => {
  // Proves the safety test above isn't vacuous — the resolver genuinely reads the canary signal.
  const templateConfig = {
    sections: [],
    themeId: 'letbuyy-core',
    liquidBundle: bundleJson,
    liquidRenderingCanary: true,
  } as any;

  const enabled = resolveThemeLiquidRenderingEnabled({ templateConfig });
  assert.equal(enabled, true);
});

test('S1/W3: migration 200 never sets rendererEngine or liquidRenderingCanary in executable SQL', () => {
  const executableLines = migrationSql.split('\n').filter((line) => !line.trim().startsWith('--'));
  assert.doesNotMatch(executableLines.join('\n'), /rendererEngine|liquidRenderingCanary/);
  assert.match(migrationSql, /jsonb_build_object\('liquidBundle'/);
  assert.match(migrationSql, /COALESCE\(default_template/); // additive merge, never replace
  assert.match(migrationSql, /WHERE\s+slug\s*=\s*'letbuyy-core'/);
  // The embedded bundle is Liquid/HTML source (e.g. the `truncate:` filter, "Truncated to..." copy) and
  // can legitimately contain these English/Liquid words; only the SQL BEFORE the dollar-quoted JSON
  // payload begins is real executable SQL, so scope the destructive-keyword check to that prefix.
  const sqlBeforeBundle = migrationSql.slice(0, migrationSql.indexOf('$liquidbundle$'));
  assert.doesNotMatch(sqlBeforeBundle, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION|DROP\s+POLICY/i);
});
