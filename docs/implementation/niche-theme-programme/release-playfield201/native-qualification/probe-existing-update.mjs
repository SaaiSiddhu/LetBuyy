// Source-only probe: no database, gateway construction, network or application import.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const root = new URL('../../../../../', import.meta.url);
const engine = require(new URL('packages/theme-engine/src/index.ts', root).pathname);
const read = path => readFileSync(new URL(path, root), 'utf8');
const hash = source => createHash('sha256').update(source).digest('hex');
const proposal = 'docs/implementation/niche-theme-programme/release-playfield201/proposals/6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c/';
const manifest = JSON.parse(read(proposal + 'manifest.json'));
const currentPath = manifest.previous.file, targetPath = proposal + 'letbuyy-bloom-2.0.1.json';
const current = engine.LiquidThemePackageBundleSchema.parse(JSON.parse(read(currentPath)).document.liquidBundle);
const target = engine.LiquidThemePackageBundleSchema.parse(JSON.parse(read(targetPath)).document.liquidBundle);
assert.equal(current.package.version, '2.0.0');
assert.equal(target.package.version, '2.0.1');
assert.notEqual(current.sections['product-detail'].source, target.sections['product-detail'].source);
const doc = engine.toThemeDocumentV2(current);
const before = JSON.stringify(doc);
const preview = engine.computeThemeUpdateDiff(doc, target);
const result = engine.planThemeSafeUpdate({ currentDocument: doc, nextBundle: target });
const output = engine.fromThemeDocumentV2(result.updatedDoc);
assert.equal(JSON.stringify(doc), before, 'canonical planner must remain pure');
const upgraded = output.package.version === target.package.version && output.sections['product-detail'].source === target.sections['product-detail'].source;
const downgraded = (() => {
  try { engine.computeThemeUpdateDiff(engine.toThemeDocumentV2(target), current); return { rejected: false }; }
  catch (error) { return { rejected: true, errorName: error.name }; }
})();
const sourcePaths = ['packages/theme-engine/src/theme-safe-update.ts', 'packages/theme-engine/src/theme-document.ts', 'services/api-gateway/src/routes/themes/theme-update-route.ts', 'services/api-gateway/src/execution/theme-execution.adapter.ts'];
console.log(JSON.stringify({
  status: upgraded ? 'SOURCE_UPDATE_PROBE_TARGET_APPLIED' : 'SOURCE_BLOCKER_CONFIRMED_PACKAGE_PATCH_UPGRADE_IS_NOOP',
  scope: 'Exact captured bundles through existing public exports only. No database, route request, browser, fixture or native acceptance.',
  current: { path: currentPath, sha256: hash(read(currentPath)), packageVersion: current.package.version, schemaVersion: current.schema_version },
  target: { path: targetPath, sha256: hash(read(targetPath)), packageVersion: target.package.version, schemaVersion: target.schema_version },
  output: { packageVersion: output.package.version, schemaVersion: output.schema_version, productSourceMatchesOld: output.sections['product-detail'].source === current.sections['product-detail'].source, productSourceMatchesTarget: output.sections['product-detail'].source === target.sections['product-detail'].source },
  preview, sameDocumentReturned: result.updatedDoc === doc, requiresConfirmation: result.requiresConfirmation,
  downgradeProbe: downgraded,
  pureInputUnchanged: true,
  sourceFiles: sourcePaths.map(path => ({ path, sha256: hash(read(path)) })),
  nativeTestRun: false,
}, null, 2));
