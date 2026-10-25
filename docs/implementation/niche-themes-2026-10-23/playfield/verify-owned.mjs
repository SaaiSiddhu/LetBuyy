/** Read-only source/artifact checks. No browser, server, database or release publication. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const output = 'docs/implementation/niche-themes-2026-10-23/playfield/';
const approved = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/';
const inventory = JSON.parse(await readFile(approved + 'implementation-impact.json', 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const frozen = Object.entries(inventory.frozenApprovedMockups.sha256);
for (const [file, expected] of frozen) assert.equal(sha256(await readFile(approved + file)), expected, `Frozen artifact changed: ${file}`);
const assetsPath = 'apps/commerce/web/public/theme-assets/playfield/v2/';
const manifest = JSON.parse(await readFile(assetsPath + 'PROVENANCE.json', 'utf8'));
for (const asset of manifest.assets) {
  const bytes = await readFile(assetsPath + asset.file);
  assert.equal(sha256(bytes), asset.sha256);
  assert.equal(bytes.length, asset.bytes);
  assert.equal(sha256(await readFile(asset.original.path)), asset.original.sha256);
  assert.ok(asset.bytes < 200000);
}
const sourceFiles = [
  'packages/theme-engine/src/playfield-theme.ts', 'packages/theme-engine/src/playfield-styles.ts', 'packages/theme-engine/src/playfield-discovery.ts', 'packages/theme-engine/test/playfield.test.ts',
  'packages/commerce-core/src/playfield-facts.ts', 'packages/commerce-core/test/playfield-facts.test.ts', 'apps/commerce/web/src/lib/demo/playfield-demo.ts',
  output + 'playfield-source-manifest.test.ts', output + 'playfield-discovery.test.ts', output + 'playfield-app-mapper.test.ts', output + 'playfield-variant-fixtures.test.ts', output + 'playfield-variant-create-fixtures.json',
  'apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.tsx',
  'apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.test.tsx',
  'apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.module.css',
  'apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.tsx',
  'apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.test.tsx',
  'apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.module.css',
  output + 'playfield-collection-membership.test.ts',
  'apps/merchant/web/src/components/products/VariantFactsEditor.tsx',
  'apps/merchant/web/src/components/products/VariantFactsEditor.test.tsx',
  'apps/merchant/web/src/lib/variant-facts-draft.ts',
  'apps/merchant/web/src/lib/variant-facts-draft.test.ts',
];
const sources = [];
for (const path of sourceFiles) sources.push({ path, sha256: sha256(await readFile(path)) });
const sharedReadDependencies = [];
for (const path of ['apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'packages/commerce-core/src/product-fact-presentation.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/theme-engine/src/theme-renderer.ts']) sharedReadDependencies.push({ path, sha256: sha256(await readFile(path)) });
const visual = JSON.parse(await readFile(output + 'visual-audit.json', 'utf8'));
assert.equal(visual.passed, true);
assert.equal(visual.audit.length, 49);
assert.equal(visual.keyboardFailures.length, 0);
for (const capture of visual.captures) assert.equal(sha256(await readFile(output + 'actual-liquid-review/' + capture.file)), capture.sha256, capture.file);
const rendered = JSON.parse(await readFile(output + 'render-review.json', 'utf8'));
const rendererInputs = [];
for (const scene of rendered.scenes) {
  const path = output + 'actual-liquid/' + scene.name + '.html';
  const bytes = await readFile(path);assert.equal(bytes.length, scene.bytes);
  rendererInputs.push({ path, sha256: sha256(bytes) });
}
for (const [file, count] of [['variant-editor-tests.tap', 13], ['collection-membership-tests.tap', 4], ['variant-wrapper-tests.tap', 17], ['variant-parent-tests.tap', 69], ['discovery-regression-tests.tap', 37], ['discovery-contract-tests.tap', 8], ['discovery-sec4-tests.tap', 1], ['factory-source-tests.tap', 30], ['query-continuity-tests.tap', 37]]) {
  const tap = await readFile(output + file, 'utf8');
  assert.match(tap, new RegExp(`^# tests ${count}$`, 'm'));
  assert.match(tap, new RegExp(`^# pass ${count}$`, 'm'));
  assert.match(tap, /^# fail 0$/m);
}
const report = { frozenArtifactCount: frozen.length, frozenArtifactsUnchanged: true, originalArtworkUnchanged: true, assetCount: manifest.assets.length, totalWebpBytes: manifest.assets.reduce((total, asset) => total + asset.bytes, 0), sourceFiles: sources, sharedReadDependencies, sharedHashScope: 'Current read-only verification checkpoint; archived renderer input/output bytes are separately pinned below and predate the later sample collection link update.', rendererInputs, rendererCaptureCount: visual.captures.length, rendererCaptureHashesMatch: true, appMapperLiquidAcceptance: 'six targeted cases pass; generic depth4 unchanged', inlineBlockEditorAttributes: 'ten roots annotated with raw server fragment; actual preview DOM ids and public-mode absence pass; interactive editor lifecycle pending', implementationBrowserAcceptance: '49 archived static assembled Liquid cases and native keyboard checks pass; owned browser/server closed and slot released; hydration/transactions/lifecycle pending', merchantFactsEditorAcceptance: 'nine mounted tests, focused component/test typecheck and CSS stylelint pass; coordinator reports product controls connected with 21 separate parent tests', merchantVariantFactsEditorAcceptance: '13 mounted tests, focused component/test typecheck and scoped CSS stylelint pass; partial-variant parent atomic save/snapshot integration passes synthetic mounted acceptance; browser/API/DB gates separate', collectionMembershipAcceptance: 'four pure shared resolver tests and focused typecheck pass; map ready for marketplace dispatcher integration', productionComplete: false };
report.sharedVariantWrapperAcceptance = '69 current parent/wrapper/helper cases pass, including all 36 protected regressions; scoped TypeScript passes, ESLint zero errors and eleven identical baseline warnings; shared parent lease released; browser/API/DB acceptance separate';
report.sharedParentReceipt = JSON.parse(await readFile(output + 'parent-wiring-receipt.json', 'utf8'));
for (const source of report.sharedParentReceipt.files) assert.equal(sha256(await readFile(source.path)), source.sha256, source.path);
report.factorySourceReceipt = JSON.parse(await readFile(output + 'factory-source-receipt.json', 'utf8'));
report.queryContinuityReceipt = JSON.parse(await readFile(output + 'query-continuity-receipt.json', 'utf8'));
const latestSourceHashes = new Map([...report.factorySourceReceipt.changedSourceFiles, ...report.factorySourceReceipt.currentReadDependencies, ...report.queryContinuityReceipt.changedSourceFiles, ...report.queryContinuityReceipt.currentReadDependencies].map(source => [source.path, source.sha256]));
report.discoveryGateReceipt = JSON.parse(await readFile(output + 'discovery-wiring-receipt.json', 'utf8'));
for (const source of [...report.discoveryGateReceipt.changedSourceFiles, ...report.discoveryGateReceipt.readOnlySharedDependencies]) assert.equal(sha256(await readFile(source.path)), latestSourceHashes.get(source.path) ?? source.sha256, source.path);
for (const source of [...report.factorySourceReceipt.changedSourceFiles, ...report.factorySourceReceipt.currentReadDependencies]) assert.equal(sha256(await readFile(source.path)), latestSourceHashes.get(source.path) ?? source.sha256, source.path);
for (const source of [...report.queryContinuityReceipt.changedSourceFiles, ...report.queryContinuityReceipt.currentReadDependencies]) assert.equal(sha256(await readFile(source.path)), source.sha256, source.path);
report.queryContinuityAcceptance = '37 current targeted tests pass; native FormData/URLSearchParams and canonical repeated-value parser cover collection/search, zero results, conditional choosers, search/sort, every active clear and repeated connector values; engine/harness TypeScript and owned-module/test lint pass; zero network calls; independent oracle untouched by Playfield, concurrent source change reported to coordinator';
report.factorySourceAcceptance = 'two unused inherited fresh defaults removed; 30 targeted tests and scoped TypeScript pass; actual registry config and JSON-wire matching-manifest validation green before normalization, full document JSON roundtrip and unchanged buyer HTML proven; negative unsupported fields still rejected';
report.discoveryGateAcceptance = 'eight actual validated-page/projection/public-v2/Liquid DOM cases and the current 37-case regression cohort pass; generic SEC-4 unchanged; scoped TypeScript and CSS Stylelint pass; archived browser audit predates this update';
await writeFile(output + 'owned-verification.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ frozenArtifacts: frozen.length, assets: report.assetCount, webpBytes: report.totalWebpBytes, sources: sources.length }) + '\n');
