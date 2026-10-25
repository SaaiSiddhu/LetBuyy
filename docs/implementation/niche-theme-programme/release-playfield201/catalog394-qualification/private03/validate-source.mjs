// Offline source/provenance witness only: never imports or executes the native suite.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = process.cwd();
const read = path => readFileSync(resolve(root, path), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = JSON.parse(readFileSync(resolve(here, 'SOURCE_PROPOSAL.json'), 'utf8'));
const tablePath = receipt.frozenBuilderInputs.path;
assert.equal(sha(read(tablePath)), receipt.frozenBuilderInputs.sha256);
const table = JSON.parse(read(tablePath));
const manifestPath = 'docs/implementation/niche-theme-programme/release-playfield201/proposals394/f5f54a8009732ff71ba248e1f3356f58441e8b2340225c47b19e5ac386ac790e/manifest.json';
const manifest = JSON.parse(read(manifestPath));
assert.equal(sha(read(manifestPath)), 'a363ce4d0fed00f8989194d9e531da11939f2e4d1bf3f97bf4b3863ece0887f1');
const canonicalJson = value => JSON.stringify((function sort(input) {
  return Array.isArray(input) ? input.map(sort) : input && typeof input === 'object'
    ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sort(child)])) : input;
})(value));
function verifyArchive(candidate) {
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.files.length, 61);
  assert.equal(new Set(candidate.files.map(row => row.sourcePath)).size, 61);
  assert.deepEqual(candidate.files.map(row => row.sourcePath).sort(), Object.keys(manifest.sourceHashes).sort());
  for (const row of candidate.files) {
    assert(!row.sourcePath.startsWith('/') && !row.sourcePath.includes('..'));
    assert(row.archivePath.startsWith('docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/private03/frozen-builder/') && !row.archivePath.includes('..'));
    assert.equal(row.sha256, manifest.sourceHashes[row.sourcePath]);
    assert.equal(sha(read(row.archivePath)), row.sha256);
  }
}
verifyArchive(table);
for (const change of [
  copy => { copy.files[0].sha256 = '0'.repeat(64); },
  copy => { copy.files[0].sourcePath = copy.files[1].sourcePath; },
  copy => { copy.files[0].archivePath = '../foreign'; },
]) {
  const corrupt = structuredClone(table); change(corrupt);
  assert.throws(() => verifyArchive(corrupt));
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const original = read(receipt.suiteLogicalPath), proposed = read(receipt.proposal.path);
assert.equal(sha(original), receipt.suiteBeforeSHA256);
assert.equal(sha(proposed), receipt.proposal.sha256);
const parse = text => ts.createSourceFile(receipt.suiteLogicalPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const oldTree = parse(original), newTree = parse(proposed);
assert.equal(newTree.parseDiagnostics.length, 0);
const imports = tree => tree.statements.filter(ts.isImportDeclaration).map(node => node.getText(tree));
assert.deepEqual(imports(newTree), imports(oldTree));
function stages(tree) {
  const values = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'stage' && ts.isStringLiteral(node.arguments[0])) values.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree); return values;
}
assert.equal(stages(newTree).length, 8);
assert.deepEqual(stages(newTree), stages(oldTree));
assert.equal(proposed.split('}),TenantPublicationContextError);').length, original.split('}),TenantPublicationContextError);').length);
assert.ok(proposed.includes("}),{code:'42501'});assert.equal(fullState(),directState"));
const owner = proposed.indexOf("await tx.unsafe('SET LOCAL ROLE postgres');");
const create = proposed.indexOf("await tx.unsafe('CREATE TEMP TABLE themes(id uuid,slug text) ON COMMIT DROP');", owner);
const restore = proposed.indexOf("await tx.unsafe('SET LOCAL ROLE app_tenant');", create);
const recheck = proposed.indexOf('assert.deepEqual(afterShadow[0],beforeShadow[0]', restore);
const publish = proposed.indexOf('await publishThemeReleaseInTenantTx', recheck);
assert(owner > 0 && create > owner && restore > create && recheck > restore && publish > recheck);
assert.ok(proposed.includes("ROLLBACK TO SAVEPOINT owned_shadow_fixture_setup"));
assert.ok(proposed.includes("for(const file of closure.files){assert(!file.path.includes('..')&&!file.path.startsWith('/'));assert.equal(sha(read(file.path)),file.sha256);}"), 'actual current source hashes remain mandatory, independently of archived builder bytes');

const previousFetch = globalThis.fetch; let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('Offline source witness refuses network'); };
let rawFactorySha256;
try {
  const { createFirstPartyCatalogBundle } = await import(pathToFileURL(resolve(root, 'packages/theme-engine/src/first-party-theme-catalog.ts')).href);
  const { buildLiquidThemePackagePersistencePayload, LiquidThemePackageBundleSchema } = await import(pathToFileURL(resolve(root, 'packages/theme-engine/src/theme-bundle.ts')).href);
  const raw = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0', playfieldVersion: '2.0.1' });
  rawFactorySha256 = sha(JSON.stringify(raw));
  assert.equal(rawFactorySha256, manifest.rawFactorySha256);
  const artifactPath = manifestPath.replace('manifest.json', 'letbuyy-bloom-2.0.1.json');
  const artifact = JSON.parse(read(artifactPath));
  assert.deepEqual(raw, artifact.document.liquidBundle);
  // Match the existing generator's canonical JSON -> schema -> persistence
  // sequence, including section-key ordering and JSON omission of undefined.
  const normalized = LiquidThemePackageBundleSchema.parse(JSON.parse(canonicalJson(raw)));
  assert.equal(canonicalJson(buildLiquidThemePackagePersistencePayload(normalized)), canonicalJson(artifact.persistence));
  assert.equal(sha(read(artifactPath)), '68bd7e7031f4e330d09fa7a7643c4159266c7ef04885917fe40320e4f9810c23');
} finally { globalThis.fetch = previousFetch; }
assert.equal(networkCalls, 0);
const result = { status: 'PRIVATE_SOURCE_AND_FROZEN_BUILDER_WITNESS_PASS_NOT_RUNTIME_ADMISSION', archiveFiles: 61, tamperControls: 3, eightPhaseLabelsPreserved: true, strictPublicationContextOracleRetained: true, newOwnerFixtureSetupSourceOrderVerified: true, currentRuntimeFullHashCheckRetained: true, currentPlayfieldFactoryAndPersistenceEqualImmutableCapture: true, rawFactorySha256, sourceParseDiagnostics: 0, networkCalls, nativeExecuted: false, databaseAccessed: false, MainSuiteChanged: false, runtimeClosureRebind: 'STILL_REQUIRED_AFTER_SHARED_SOURCE_SEALS' };
writeFileSync(resolve(here, 'VALIDATION.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(result) + '\n');
