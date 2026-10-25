// Source contract evidence only; no installed, database, or browser acceptance claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { buildLiquidThemePackagePersistencePayload, collectThemeTemplateValidationIssues, compilePortableToLiquidBundle, fromThemeDocumentV2, toThemeDocumentV2 } from '../../../../packages/theme-engine/src/index.ts';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog.ts';

const root = new URL('../../../../', import.meta.url);
const registryPath = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const source = ts.createSourceFile(registryPath, readFileSync(new URL(registryPath, root), 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'];
const helpers = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(source));
assert.equal(helpers.length, names.length);
const code = ts.transpileModule(helpers.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const build = new Function(code + ';return buildBundleTemplateConfig;')();
const bundle = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0' });
const manifest = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const runtime = { sectionSchemas: manifest.section_schemas, settingsSchema: manifest.settings_schema };
const config = build(bundle), wire = JSON.parse(JSON.stringify(config));
const validate = templateConfig => collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: bundle.package.slug });
assert.deepEqual(validate(config), []);
assert.deepEqual(validate(wire), []);
const documentRoundtrip = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
assert.deepEqual(documentRoundtrip, bundle);
assert.deepEqual(validate(build(documentRoundtrip)), []);
const compiled = compilePortableToLiquidBundle(wire, { baseBundle: bundle });
assert.deepEqual(compiled.warnings, []);
assert.deepEqual(compiled.bundle.templates, bundle.templates);
const invalid = structuredClone(wire);
invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Undeclared merchant text';
const negativeControlIssues = validate(invalid);
assert.ok(negativeControlIssues.includes('templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema'));
assert.equal(invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Undeclared merchant text');
const freezePath = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/pantry-storybook/mockup-freeze.json';
const report = {
  createdAt: new Date().toISOString(), classification: 'SOURCE_CONTRACT_ONLY_NOT_INSTALLED_OR_BROWSER_ACCEPTANCE',
  removedFreshFactoryField: 'templates.list-collections.sections.list-collections-grid.settings.subtitle',
  reason: 'Unused by Pantry category-grid heading-and-links renderer; schema remains strict.',
  templateCount: Object.keys(bundle.templates).length, baselineValidationIssues: validate(config), wireValidationIssues: validate(wire),
  documentRoundtripEqual: true, portableCompileWarnings: compiled.warnings, negativeControlIssues,
  inputs: ['packages/theme-engine/src/pantry-theme.ts', 'packages/theme-engine/test/pantry.test.ts', registryPath, freezePath].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex') })),
  bundleSha256: createHash('sha256').update(JSON.stringify(bundle)).digest('hex'),
};
writeFileSync(new URL('factory-schema-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
