// Source contract regression, using the actual gateway/editor helpers extracted by AST.
// Never evidence of an installed theme, persistence or browser acceptance.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as domain from '../../../../packages/theme-engine/src/index.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings.ts';

const root = new URL('../../../../', import.meta.url).pathname;
const editorPath = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const registryPath = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const factoryPath = 'packages/theme-engine/src/kindred-theme.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(root + path, 'utf8');
const editorSource = ts.createSourceFile(editorPath, read(editorPath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
for (const node of editorSource.statements) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(editorSource));
  if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node.getText(editorSource));
  }
}
const needed = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'getAllSections']);
for (const name of needed) {
  assert.ok(declarations.has(name), `Missing actual editor helper ${name}`);
  const tree = ts.createSourceFile('helper.ts', declarations.get(name), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isIdentifier(node) && declarations.has(node.text)) needed.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
const code = ts.transpileModule([...needed].map(name => declarations.get(name)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const deps = ['getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens',
  'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug', 'MAX_BUNDLE_BLOCK_NESTING_DEPTH',
  'ThemeEditorTemplateKeySchema', 'normalizeEditorSchemaField', 'resolveFieldDefault'];
const tokens = createRequire(root + 'apps/merchant/web/package.json')('@letbuyy/ui/tokens').letbuyyPrimitiveTokens;
const helpers = new Function(...deps, code + ';return {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,getAllSections};')(
  ...deps.map(name => name === 'letbuyyPrimitiveTokens' ? tokens : domain[name]),
);
const registry = ts.createSourceFile(registryPath, read(registryPath), ts.ScriptTarget.Latest, true);
const registryCode = registry.statements.filter(node => ts.isFunctionDeclaration(node)
  && ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'].includes(node.name?.text))
  .map(node => node.getText(registry)).join('\n');
const build = new Function(ts.transpileModule(registryCode, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText + ';return buildBundleTemplateConfig;')();

const bundle = domain.createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' });
const baselineHash = hash(JSON.stringify(bundle));
const base = build(bundle);
const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const settings = helpers.normalizeSettingsSchema(manifest.settings_schema);
const runtime = { sectionSchemas: manifest.section_schemas, settingsSchema: settings };
const validate = templateConfig => domain.collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: bundle.package.slug });
const wire = value => JSON.parse(JSON.stringify(value));
const baselineValidationIssues = validate(base);
const baselineWireValidationIssues = validate(wire(base));

// Independent negative control: unknown instance settings must still fail before/after JSON.
const invalid = structuredClone(base);
invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Browse every collection in the store.';
const expectedIssue = 'templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema';
const negativeIssues = validate(invalid);
const negativeWireIssues = validate(wire(invalid));
assert.ok(negativeIssues.includes(expectedIssue));
assert.ok(negativeWireIssues.includes(expectedIssue));

const templates = [];
for (const key of Object.keys(bundle.templates).filter(key => !['header', 'footer'].includes(key))) {
  const state = helpers.normalizeEditorState(base, bundle.package.slug, key, runtime.sectionSchemas, settings);
  const draft = helpers.buildDraftConfig(base, bundle.package.slug, state, key);
  const serialized = JSON.stringify(draft);
  const parsed = JSON.parse(serialized);
  const compiled = domain.compilePortableToLiquidBundle(parsed, { baseBundle: bundle }).bundle;
  const identity = Object.keys(domain.createEditorPreviewIdentityIndex(helpers.getAllSections(state)));
  templates.push({ key, validationIssues: validate(draft), wireValidationIssues: validate(parsed),
    bytes: Buffer.byteLength(serialized), identities: identity.length,
    stableGroupIds: JSON.stringify(compiled.templates.header?.order) === JSON.stringify(state.sections.header.map(section => section.id))
      && JSON.stringify(compiled.templates.footer?.order) === JSON.stringify(state.sections.footer.map(section => section.id)),
  });
}
assert.equal(hash(JSON.stringify(bundle)), baselineHash, 'Actual helpers must not mutate the factory output');
const oldDefault = structuredClone(bundle);
oldDefault.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Browse every collection in the store.';
const rendered = await Promise.all([oldDefault, bundle].map(liquidBundle => new domain.LiquidRenderer().render({
  context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'synthetic-kindred-editor', path: '/collections', previewMode: false, locale: 'en-IN' },
  storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
  routeTemplate: { id: 'list-collections', type: 'collection', layoutKey: 'theme', sections: [] },
  liquidBundle, liquidTemplateKey: 'list-collections', liquidContext: {
    shop: { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic Kindred', subdomain: 'synthetic-kindred-editor' },
    collections: [{ id: 'birthday', title: 'Birthday', handle: 'birthday', description: 'Mark another year.' }],
  },
})));
for (const result of rendered) { assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); }
assert.match(rendered[1].liquid.contentForLayout, /All collections/);
assert.match(rendered[1].liquid.contentForLayout, /Mark another year/);
assert.doesNotMatch(rendered[1].liquid.contentForLayout, /Browse every collection in the store/);
const buyerOutputFields = ['layoutHtml', 'contentForLayout', 'header', 'footer', 'headStyleText'];
for (const field of buyerOutputFields) {
  assert.equal(typeof rendered[1].liquid[field], 'string', `Actual buyer output field ${field} exists`);
  assert.equal(rendered[0].liquid[field], rendered[1].liquid[field], `Removing unused default copy must preserve buyer ${field}`);
}
const report = { createdAt: new Date().toISOString(), classification: 'SOURCE_CONTRACT_ONLY_NOT_INSTALLED_OR_BROWSER_ACCEPTANCE',
  inputs: [factoryPath, editorPath, registryPath, 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/theme-engine/src/portable-to-liquid.ts']
    .map(path => ({ path, sha256: hash(read(path)) })),
  slug: bundle.package.slug, version: bundle.package.version, bundleSha256: baselineHash,
  withUnusedInheritedDefaultBundleSha256: hash(JSON.stringify(oldDefault)),
  baselineValidationIssues, baselineWireValidationIssues,
  freshCollectionSettings: bundle.templates['list-collections'].sections['list-collections-grid'].settings,
  negativeControl: { expectedIssue, issues: negativeIssues, wireIssues: negativeWireIssues }, templates,
  listCollectionsRenderParity: { status: 'pass', compared: buyerOutputFields,
    note: 'Renderer section-settings diagnostics intentionally reflect the removed default; actual buyer HTML/CSS is compared exactly.',
    contentSha256: hash(rendered[1].liquid.contentForLayout), warnings: rendered[1].warnings },
};
const file = process.argv[2] ?? 'editor-source-roundtrip.json';
assert.match(file, /^[a-z0-9-]+\.json$/);
writeFileSync(new URL(file, import.meta.url), JSON.stringify(report, null, 2) + '\n');
const failures = templates.filter(row => row.validationIssues.length || row.wireValidationIssues.length || !row.stableGroupIds);
console.info(JSON.stringify({ templates: templates.length, failed: failures.length, baselineValidationIssues,
  baselineWireValidationIssues, negativeControlPasses: true, bundleSha256: baselineHash }));
assert.deepEqual(baselineValidationIssues, []);
assert.deepEqual(baselineWireValidationIssues, []);
assert.deepEqual(failures, []);
