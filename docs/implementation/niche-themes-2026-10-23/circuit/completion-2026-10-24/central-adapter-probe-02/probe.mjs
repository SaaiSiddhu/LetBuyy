import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { loadCanonicalAdapters } from '../shared-roundtrip-harness/canonical-adapters.mjs';
import { sha256, assertBundleIdentity } from '../shared-roundtrip-harness/theme-data-contract.mjs';

const root = process.cwd(), out = dirname(fileURLToPath(import.meta.url));
const source = {
  domainModule: 'packages/theme-engine/src/index.ts',
  editorPage: 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
  registryAdapter: 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts',
  tokenPackage: 'apps/merchant/web/package.json',
};
const emit = (name, value) => writeFileSync(resolve(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const tree = dir => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? tree(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
const paths = [...tree('packages/theme-engine/src'), ...Object.values(source),
  'packages/theme-engine/package.json', 'packages/typescript/ui/src/tokens.ts', 'pnpm-lock.yaml',
  'apps/merchant/web/src/components/theme-editor/editor-block-actions.ts',
  'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/shared-roundtrip-harness/canonical-adapters.mjs',
  'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/shared-roundtrip-harness/theme-data-contract.mjs'];
const pins = [...new Set(paths)].sort().map(path => ({ path, sha256: sha256(readFileSync(resolve(root, path))) }));
emit('source-pins-before.json', pins);
const stages = [];
try {
  const domain = await import(pathToFileURL(resolve(root, source.domainModule)));
  const external = ['getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug', 'MAX_BUNDLE_BLOCK_NESTING_DEPTH', 'ThemeEditorTemplateKeySchema', 'normalizeEditorSchemaField', 'resolveFieldDefault'];
  for (const name of external) assert.notEqual(domain[name], undefined, `public domain export unavailable: ${name}`);
  stages.push({ name: 'Existing explicit public-domain externals all defined', passed: true, names: external });
  const { createFirstPartyCatalogBundle } = await import(pathToFileURL(resolve(root, 'packages/theme-engine/src/first-party-theme-catalog.ts')));
  const bundle = createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' });
  const expected = { slug: 'letbuyy-dawn', version: '2.0.0', bundleSha256: sha256(bundle) };
  assertBundleIdentity(bundle, expected);
  // This hash records a source probe input; it is NOT independent package admission.
  emit('observed-source-input.json', { expectedIdentity: expected, derivedHashForObservationOnly: true, factory: { module: 'packages/theme-engine/src/first-party-theme-catalog.ts', export: 'createFirstPartyCatalogBundle', args: ['letbuyy-dawn', { designVersion: '2.0.0' }] }, adapters: source });
  const adapters = await loadCanonicalAdapters(source, { root, emit });
  const extracted = readFileSync(resolve(out, 'extracted-editor.js'), 'utf8');
  const sf = ts.createSourceFile(source.editorPage, readFileSync(resolve(root, source.editorPage), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imported = [];
  for (const statement of sf.statements) if (ts.isImportDeclaration(statement)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) if (!e.isTypeOnly && new RegExp(`\\b${e.name.text}\\b`).test(extracted)) imported.push({ local: e.name.text, imported: e.propertyName?.text ?? e.name.text, module: statement.moduleSpecifier.text });
  }
  const injected = [...external, 'letbuyyPrimitiveTokens'];
  for (const importedName of imported) assert.ok(injected.includes(importedName.local), `new imported runtime dependency outside extracted closure: ${importedName.local}`);
  stages.push({ name: 'All extracted imported runtime identifiers resolve the existing seam', passed: true, imports: imported });
  const { sectionSchemas, settingsSchema } = adapters.describeBundle(bundle);
  const settings = adapters.normalizeSettingsSchema(settingsSchema);
  const config = adapters.buildEditorConfig(bundle);
  const normalized = adapters.normalizeEditorState(config, expected.slug, 'index', sectionSchemas, settings);
  const wire = adapters.buildDraftConfig(config, expected.slug, normalized, 'index');
  const issues = adapters.collectValidationIssues({ templateConfig: wire, runtime: { sectionSchemas, settingsSchema: settings }, themeSlug: expected.slug });
  assert.deepEqual(issues, []);
  const compiled = adapters.compile(wire, { baseBundle: bundle });
  assert.deepEqual(compiled.warnings, []);
  assert.equal(compiled.bundle.package.version, expected.version);
  stages.push({ name: 'Current Marginalia source normalization and save/compile probe', passed: true, templateKey: 'index', actualUIActions: false });
  emit('probe-wire.json', wire);
  const after = pins.map(pin => ({ ...pin, actual: sha256(readFileSync(resolve(root, pin.path))) }));
  for (const pin of after) assert.equal(pin.actual, pin.sha256, `source drift: ${pin.path}`);
  emit('source-pins-after.json', after);
  emit('result.json', { status: 'CURRENT_ADAPTER_RESOLVES_EDITOR03_NO_REBIND_NEEDED', stages, pinsExact: pins.length, bundleIdentity: expected, historicalHarnessChanged: false, MarginaliaFullHarnessExecuted: false, installedAcceptance: false });
  process.stdout.write(JSON.stringify({ status: 'CURRENT_ADAPTER_RESOLVES_EDITOR03_NO_REBIND_NEEDED', stages: stages.length, pinsExact: pins.length }) + '\n');
} catch (error) {
  emit('failure.json', { status: 'PROBE_FAILED_REBIND_REVIEW_REQUIRED', stages, message: error.message, stack: error.stack });
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
}
