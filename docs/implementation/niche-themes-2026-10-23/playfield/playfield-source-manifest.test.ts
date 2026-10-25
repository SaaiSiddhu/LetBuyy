/** Source-only gate: execute the actual registry helper, then engine manifest
 * validation before editor/template normalization. No app/service imports. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as engine from '../../../../packages/theme-engine/src/index';
import type { ThemeTemplateValidationRuntime } from '../../../../packages/theme-engine/src/index';

const root = new URL('../../../../', import.meta.url);
const registryPath = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const editorPath = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const source = (path: string) => ts.createSourceFile(path, readFileSync(new URL(path, root), 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const registry = source(registryPath);
const names = ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'];
const registryCode = registry.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && Boolean(node.name && names.includes(node.name.text))).map(node => node.getText(registry)).join('\n');
assert.equal(registry.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)).length, names.length);
const buildActualConfig = new Function(ts.transpileModule(registryCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ';return buildBundleTemplateConfig;')() as (bundle: engine.LiquidThemePackageBundle) => Record<string, unknown>;

// Only the schema adapter is evaluated. The product template/config is never
// normalized, stripped, or passed through the editor's state serializer here.
const editor = source(editorPath);
const declarations = new Map<string, string>();
for (const node of editor.statements) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(editor));
  if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node.getText(editor));
}
const needed = new Set(['normalizeSettingsSchema']);
for (const name of needed) {
  const declaration = declarations.get(name); assert.ok(declaration, `Missing actual schema helper ${name}`);
  const parsed = ts.createSourceFile('schema-helper.ts', declaration, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => { if (ts.isIdentifier(node) && declarations.has(node.text)) needed.add(node.text); ts.forEachChild(node, visit); };
  visit(parsed);
}
const schemaCode = ts.transpileModule([...needed].map(name => declarations.get(name)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const normalizeActualSettingsSchema = new Function('normalizeEditorSchemaField', 'resolveFieldDefault', schemaCode + ';return normalizeSettingsSchema;')(engine.normalizeEditorSchemaField, engine.resolveFieldDefault) as (schema: Record<string, unknown>) => ThemeTemplateValidationRuntime['settingsSchema'];
const make = () => engine.createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' });
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function issues(bundle: engine.LiquidThemePackageBundle, jsonWire = false) {
  const manifest = engine.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
  const config = buildActualConfig(bundle);
  return engine.collectThemeTemplateValidationIssues({ themeSlug: bundle.package.slug, templateConfig: jsonWire ? wire(config) : config,
    runtime: { sectionSchemas: manifest.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'], settingsSchema: normalizeActualSettingsSchema(manifest.settings_schema) } });
}

test('fresh public Playfield config validates against its actual matching manifest before normalization and over JSON wire', () => {
  const bundle = make();
  assert.deepEqual(issues(bundle), []);
  assert.deepEqual(issues(bundle, true), []);
});

test('actual JSON-wire ThemeDocument V2 roundtrip retains every buyer template and remains manifest-valid', () => {
  const bundle = make();
  const document = wire(engine.toThemeDocumentV2(bundle));
  const restored = engine.fromThemeDocumentV2(document);
  assert.deepEqual(wire(restored), wire(bundle));
  assert.deepEqual(Object.keys(restored.templates).sort(), Object.keys(bundle.templates).sort());
  assert.deepEqual(issues(restored), []); assert.deepEqual(issues(restored, true), []);
});

test('strict gate still rejects the two unsupported fields; the runtime document adapter never silently strips them', () => {
  const document = wire(engine.toThemeDocumentV2(make()));
  document.templates.find(template => template.key === 'list-collections')!.sections.find(section => section.type === 'category-grid')!.settings.subtitle = 'Merchant supplied text stays available for correction';
  document.templates.find(template => template.key === 'search')!.sections.find(section => section.type === 'collection-product-list')!.settings.title = 'Merchant result heading';
  const restored = engine.fromThemeDocumentV2(document);
  assert.equal(restored.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Merchant supplied text stays available for correction');
  assert.equal(restored.templates.search.sections['search-results'].settings.title, 'Merchant result heading');
  for (const jsonWire of [false, true]) assert.deepEqual(issues(restored, jsonWire).sort(), [
    'templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema',
    'templates.search.sections.search-results.settings.title is not defined by the collection-product-list schema',
  ].sort());
});
