// Source-only data preservation. Does not execute UI actions, app/server, DB or browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as domain from '../private-heading-successor/packages/theme-engine/src/index.ts';
import { createFirstPartyCatalogBundle } from '../private-heading-successor/packages/theme-engine/src/first-party-theme-catalog.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = resolve(here, 'results');
assert.ok(!existsSync(out), 'never overwrite an existing actual source run');
mkdirSync(out, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const write = (name, value) => writeFileSync(resolve(out, name), JSON.stringify(value, null, 2) + '\n');
const pagePath = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const registryPath = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const pageText = readFileSync(resolve(root, pagePath), 'utf8');
const registryText = readFileSync(resolve(root, registryPath), 'utf8');
assert.equal(readFileSync(resolve(root, pagePath), 'utf8'), pageText, 'do not capture a moving page read');
assert.equal(readFileSync(resolve(root, registryPath), 'utf8'), registryText, 'do not capture a moving registry read');
writeFileSync(resolve(out, 'editor-page.snapshot.tsx'), pageText);
writeFileSync(resolve(out, 'registry.snapshot.ts'), registryText);
const page = ts.createSourceFile(pagePath, pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
for (const node of page.statements) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(page));
  if (ts.isVariableStatement(node)) for (const decl of node.declarationList.declarations) if (ts.isIdentifier(decl.name)) declarations.set(decl.name.text, node.getText(page));
}
const needed = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'createSectionFromSchema', 'createBlockFromSchema']);
for (const name of needed) {
  assert.ok(declarations.has(name), `actual editor helper ${name}`);
  const walk = node => { if (ts.isIdentifier(node) && declarations.has(node.text)) needed.add(node.text); ts.forEachChild(node, walk); };
  walk(ts.createSourceFile('helper.ts', declarations.get(name), ts.ScriptTarget.Latest, true));
}
const dependencies = ['getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens', 'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug', 'MAX_BUNDLE_BLOCK_NESTING_DEPTH', 'ThemeEditorTemplateKeySchema', 'normalizeEditorSchemaField', 'resolveFieldDefault'];
const tokens = createRequire(resolve(root, 'apps/merchant/web/package.json'))('@letbuyy/ui/tokens').letbuyyPrimitiveTokens;
const helperSource = [...needed].map(name => declarations.get(name)).join('\n');
const code = ts.transpileModule(helperSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
writeFileSync(resolve(out, 'extracted-editor-helpers.js'), code);
const helpers = new Function(...dependencies, `${code};return {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,createSectionFromSchema,createBlockFromSchema};`)(...dependencies.map(name => name === 'letbuyyPrimitiveTokens' ? tokens : domain[name]));
const registry = ts.createSourceFile(registryPath, registryText, ts.ScriptTarget.Latest, true);
const registryFunctions = registry.statements.filter(node => ts.isFunctionDeclaration(node) && ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'].includes(node.name?.text)).map(node => node.getText(registry)).join('\n');
const registryCode = ts.transpileModule(registryFunctions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const buildConfig = new Function(`${registryCode};return buildBundleTemplateConfig;`)();
const bundle = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0', circuitVersion: '2.0.1' });
const base = buildConfig(bundle);
const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const schemas = manifest.section_schemas;
const settings = helpers.normalizeSettingsSchema(manifest.settings_schema);
const runtime = { sectionSchemas: schemas, settingsSchema: settings };
write('INPUTS.json', { classification: 'ACTUAL_SOURCE_HELPER_AND_COMPILER_CONTRACT_NOT_MOUNTED_UI', page: { path: pagePath, sha256: hash(pageText) }, registry: { path: registryPath, sha256: hash(registryText) }, helperDeclarations: [...needed].sort(), helperCodeSha256: hash(code), registryCodeSha256: hash(registryCode), candidateBundleSha256: hash(JSON.stringify(bundle)), rules: ['Synthetic UUID resource values prove serialization only, not resource ownership/existence.', 'State transitions are test fixture mutations; real add/reorder/hide/remove UI callbacks are not invoked.', 'No @app block is instantiated or executed.', 'Header/footer remain in their original group and retain their pinned section identities.'] });

const resourceId = '22222222-2222-4222-8222-222222222222';
function valueFor(field, key, previous) {
  switch (field.type) {
    case 'toggle': case 'checkbox': return false;
    case 'text': case 'textarea': case 'richtext': return (`Circuit source ${key}`).slice(0, field.maxLength ?? 80);
    case 'url': case 'image': return `https://example.invalid/circuit/${key}.webp`;
    case 'product': case 'collection': case 'page': case 'blog': case 'menu': return resourceId;
    case 'select': case 'radio': {
      const options = (field.options ?? []).map(option => typeof option === 'object' ? option.value : option);
      assert.ok(options.length, `real options for ${key}`);
      return options.find(option => option !== (previous ?? field.default)) ?? options[0];
    }
    case 'range': return field.min === 0 ? 0 : (field.min ?? 1);
    case 'number': return field.min ?? 0;
    case 'color': return '#1E4060';
    default: throw new Error(`Add an actual-source-backed valid value for ${key}:${field.type}; do not skip a field`);
  }
}
function fieldsFor(fields, previous = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, valueFor(field, key, previous[key])]));
}
function blocksFor(type) {
  const blocks = [];
  for (const [blockType, schema] of Object.entries(schemas[type].blocks_schema ?? {})) {
    if (blockType === '@app') continue;
    for (let copy = 0; copy < 2; copy++) {
      const block = helpers.createBlockFromSchema(blockType, schema, blocks.length * 10);
      block.settings = fieldsFor(schema.fields, block.settings);
      blocks.push(block);
    }
  }
  return blocks;
}
function save(state, label, full = false) {
  const wire = JSON.parse(JSON.stringify(helpers.buildDraftConfig(base, 'letbuyy-forge', state, 'index')));
  // Persist the actual input before any assertion, including failed validations.
  if (full) write(`${label}.wire.json`, wire);
  const issues = domain.collectThemeTemplateValidationIssues({ templateConfig: wire, runtime, themeSlug: 'letbuyy-forge' });
  if (issues.length) write(`${label}.FAILED-wire.json`, { issues, wire });
  assert.deepEqual(issues, [], `${label}: actual matching manifest validation`);
  const compiled = domain.compilePortableToLiquidBundle(wire, { baseBundle: bundle });
  assert.deepEqual(compiled.warnings, []);
  const document = domain.toThemeDocumentV2(compiled.bundle);
  assert.deepEqual(domain.fromThemeDocumentV2(JSON.parse(JSON.stringify(document))), compiled.bundle, `${label}: actual document JSON roundtrip`);
  const reloaded = helpers.normalizeEditorState(wire, 'letbuyy-forge', 'index', schemas, settings);
  return { wire, bundle: compiled.bundle, reloaded };
}
function actualSection(compiled, section, group) {
  return compiled.templates[group === 'template' ? 'index' : group].sections[section.id];
}
function assertPreserved(result, section, group, label) {
  const actual = actualSection(result.bundle, section, group);
  assert.ok(actual, `${label}: actual section instance exists`);
  assert.deepEqual(actual.settings, section.settings, `${label}: every section setting retained`);
  assert.equal(actual.disabled, !section.visible);
  assert.deepEqual(actual.block_order, section.blocks.map(block => block.id));
  for (const block of section.blocks) {
    assert.equal(actual.blocks[block.id].type, block.type);
    assert.deepEqual(actual.blocks[block.id].settings, block.settings, `${label}: every effective block field retained`);
    assert.equal(actual.blocks[block.id].disabled, !block.visible);
  }
  for (const key of Object.keys(bundle.templates).filter(key => !['index', 'header', 'footer'].includes(key))) assert.deepEqual(result.bundle.templates[key], bundle.templates[key], `${label}: unrelated template ${key}`);
  for (const key of ['header', 'footer']) assert.deepEqual(result.bundle.templates[key].order, bundle.templates[key].order, `${label}: original group section identities`);
  return { settings: actual.settings, disabled: actual.disabled, block_order: actual.block_order, blocks: actual.blocks };
}

for (const type of Object.keys(schemas).filter(type => type !== 'app-block-slot')) {
  test(`${type}: declared fields/flat block identities survive edit, hidden/reordered, shown, removal and re-add wire states`, () => {
    const state = helpers.normalizeEditorState(base, 'letbuyy-forge', 'index', schemas, settings);
    const group = ['header', 'footer'].includes(type) ? type : 'template';
    let section = group === 'template' ? helpers.createSectionFromSchema(type, schemas, 1000) : state.sections[group].find(section => section.type === type);
    assert.ok(section);
    if (group === 'template') state.sections.template.push(section);
    const originalId = section.id;
    section.settings = fieldsFor(schemas[type].settings_schema ?? {}, section.settings);
    section.blocks = blocksFor(type);
    const expectedFields = Object.keys(section.settings), expectedBlockFields = section.blocks.flatMap(block => Object.keys(block.settings).map(field => `${block.type}.${field}`));
    const phases = [];
    let result = save(state, `${type}-edited`, true);
    phases.push({ phase: 'edited', observed: assertPreserved(result, section, group, type) });
    section.visible = false;
    section.blocks.reverse();
    for (const block of section.blocks) block.visible = false;
    result = save(state, `${type}-hidden-reordered`);
    phases.push({ phase: 'hidden-reordered', observed: assertPreserved(result, section, group, type) });
    section.visible = true;
    for (const block of section.blocks) block.visible = true;
    result = save(state, `${type}-shown`);
    phases.push({ phase: 'shown', observed: assertPreserved(result, section, group, type) });
    const oldBlockIds = section.blocks.map(block => block.id);
    if (group === 'template') state.sections.template = state.sections.template.filter(row => row.id !== section.id);
    else section.blocks = [];
    result = save(state, `${type}-removed`);
    if (group === 'template') assert.ok(!result.bundle.templates.index.sections[originalId]);
    else assert.deepEqual(actualSection(result.bundle, section, group).blocks, {});
    phases.push({ phase: 'removed', originalSectionAbsent: group === 'template', protectedGroupIdentityRetained: group !== 'template' });
    if (group === 'template') {
      section = helpers.createSectionFromSchema(type, schemas, 1000);
      assert.notEqual(section.id, originalId);
      section.settings = fieldsFor(schemas[type].settings_schema ?? {}, section.settings);
      state.sections.template.push(section);
    }
    section.blocks = blocksFor(type);
    assert.ok(section.blocks.every(block => !oldBlockIds.includes(block.id)));
    result = save(state, `${type}-readded`);
    phases.push({ phase: 'readded', observed: assertPreserved(result, section, group, type) });
    write(`${type}.OBSERVED.json`, { classification: 'SOURCE_STATE_SERIALIZATION_ONLY_NOT_ACTUAL_UI_OPERATIONS', type, group, originalId, finalId: section.id, sectionFieldsExercised: expectedFields, effectiveBlockFieldsExercised: [...new Set(expectedBlockFields)], phases, resourceAuthorityProved: false, actualUiCallbacksExecuted: false });
  });
}

test('frozen extension seams remain uninstantiated; no third-party execution is introduced', () => {
  const instances = Object.values(bundle.templates).flatMap(template => Object.values(template.sections));
  assert.ok(instances.every(section => section.type !== 'app-block-slot' && Object.values(section.blocks).every(block => block.type !== '@app')));
  assert.deepEqual(bundle.sections['app-block-slot'].schema.blocks.map(block => block.type), ['@app']);
});

test('all twelve declared global setting values, including zero and approved alternative fonts, survive actual wire/compile', () => {
  const state = helpers.normalizeEditorState(base, 'letbuyy-forge', 'index', schemas, settings);
  const fields = Object.assign({}, ...Object.values(settings.settings).map(group => group.fields));
  const edits = fieldsFor(fields, state.themeSettings);
  edits.headingFontFamily = 'Playfair Display';
  edits.bodyFontFamily = 'Lato';
  Object.assign(state.themeSettings, edits);
  const result = save(state, 'theme-settings', true);
  for (const [key, value] of Object.entries(edits)) {
    assert.deepEqual(result.wire.themeSettings[key], value);
    assert.deepEqual(result.reloaded.themeSettings[key], value);
    assert.deepEqual(result.bundle.config.settings_data.current[key], value);
  }
  assert.equal(result.bundle.config.settings_data.current.borderRadius, 0);
  write('theme-settings.OBSERVED.json', { classification: 'SOURCE_SERIALIZATION_ONLY_NOT_FONT_LOADING_OR_RENDERED_CONTROL_ACCEPTANCE', fields: edits, metadataAndSchemaAuthorityUnchanged: true });
});
