/** Source-derived evidence only. No server, database, browser, install or publish. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createFirstPartyCatalogBundle } from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
import { buildLiquidThemePackagePersistencePayload } from '../../../../../packages/theme-engine/src/theme-bundle';
import { TEMPLATE_TYPE_REGISTRY } from '../../../../../packages/theme-engine/src/template-registry';
import { ElectronicsFactsSchema } from '../../../../../packages/commerce-core/src/circuit-facts';
import { StorefrontDiscoveryQuerySchema } from '../../../../../packages/commerce-core/src/storefront-discovery';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../../../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const pin = (path: string) => ({ path, sha256: hash(readFileSync(resolve(root, path))) });
const json = (path: string) => JSON.parse(source(path));
const emit = (name: string, value: unknown) => writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const now = new Date().toISOString();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();

// Hash the complete relative import/export source closure of the actual factory.
// External package imports are recorded separately, never copied from node_modules.
const closure = new Set<string>();
const external = new Set<string>();
const edges: Array<{ from: string; specifier: string; to: string | null }> = [];
function visit(path: string) {
  if (closure.has(path)) return;
  closure.add(path);
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
  for (const statement of file.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) { external.add(specifier); edges.push({ from: path, specifier, to: null }); continue; }
    const base = resolve(root, dirname(path), specifier);
    const match = [base, ...['.ts', '.tsx', '.mjs', '.json', '/index.ts'].map(ext => base + ext)].find(p => existsSync(p) && /\.(ts|tsx|mjs|json)$/.test(p));
    if (!match) throw new Error(`Unresolved source edge: ${path} -> ${specifier}`);
    const child = relative(root, match);
    edges.push({ from: path, specifier, to: child });
    if (child.startsWith('packages/theme-engine/src/')) visit(child);
  }
}
visit('packages/theme-engine/src/first-party-theme-catalog.ts');
const directPaths = [
  'packages/commerce-core/src/circuit-facts.ts', 'packages/commerce-core/src/storefront-discovery.ts',
  'packages/theme-engine/test/circuit.test.ts',
  'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
  'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
  'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
  'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ResourcePickerControl.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ImagePickerControl.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/MediaLibrary.tsx',
  'apps/merchant/web/src/components/products/niche-facts/circuit-facts-editor.tsx',
  'apps/merchant/web/src/components/products/NicheFactsEditor.tsx',
  'apps/merchant/web/src/app/[store]/products/new/page.tsx',
  'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts',
  'apps/commerce/web/src/lib/theme-engine/collection-discovery.ts',
  'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx',
  'services/api-gateway/src/execution/schema-registry-execution.adapter.ts',
  'services/api-gateway/src/execution/collection-membership.adapter.ts',
  'services/api-gateway/src/__tests__/owned-db/collection-list-read.postgres.test.ts',
  'package.json', 'pnpm-lock.yaml', 'packages/theme-engine/package.json',
  'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/circuit-storybook/capabilities.json',
];
const sourceInputs = [...new Set([...closure, ...directPaths])].sort().map(pin);
const sourceManifest = { classification: 'SOURCE_INPUTS_ONLY_NOT_RUNTIME_ADMISSION', recordedAt: now, head, branch, sourceInputs, factoryImportGraph: edges, externalImports: [...external].sort(), limits: ['Dirty working-tree inputs are pinned by bytes; HEAD alone is not the candidate.', 'External package versions are pinned by lockfile; installed dependency bytes and runtime/build/environment are not qualified here.', 'Editor/adapter files are direct interface inputs, not a claimed complete runtime closure.'] };
emit('SOURCE_MANIFEST.json', sourceManifest);

const bundle = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
const payload = buildLiquidThemePackagePersistencePayload(bundle);
const runtime = payload.schemaManifest.section_schemas as Record<string, { settings_schema: Record<string, Record<string, unknown>>; blocks_schema: Record<string, { fields: Record<string, Record<string, unknown>> }> }>;
const stripSchema = (text: string) => text.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/g, '');
const templateInstances = Object.entries(bundle.templates).map(([key, template]) => ({
  key, name: template.name, kind: key === 'header' || key === 'footer' ? 'SHARED_GROUP' : 'PAGE_TEMPLATE',
  layout: template.layout, registry: TEMPLATE_TYPE_REGISTRY[key] ?? null,
  order: template.order, sections: Object.entries(template.sections).map(([id, section]) => ({ id, ...section })),
}));
const instancesOf = (type: string) => templateInstances.flatMap(t => t.sections.filter(s => s.type === type).map(s => ({ template: t.key, sectionId: s.id, settings: s.settings })));
const controlsSource = source('apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx');
const supportedControls = [...controlsSource.matchAll(/case '([^']+)':/g)].map(m => m[1]);
const resourceTypes = new Set(['product', 'collection', 'blog', 'page', 'menu', 'image', 'video']);
const sectionTypes = Object.entries(bundle.sections).map(([type, section]) => {
  const liquid = stripSchema(section.source);
  return {
    type, path: section.path, name: section.schema.name, schema: section.schema,
    runtimeDescriptor: runtime[type], sourceSha256: hash(section.source),
    defaultInstances: instancesOf(type),
    ownership: ['header', 'footer'].includes(type) ? 'SHARED_GROUP_PINNED_IN_CURRENT_EDITOR' : type === 'app-block-slot' ? 'FROZEN_EXTENSION_SEAM_DO_NOT_ACTIVATE' : 'DECLARED_SECTION_RUNTIME_APPLICABILITY_TO_VERIFY',
    settingConsumption: section.schema.settings.map(field => ({
      id: field.id, type: field.type,
      directLiquidReference: new RegExp(`section\\.settings\\.${field.id}\\b`).test(liquid),
      sourceControlTypeHandled: supportedControls.includes(field.type),
      indirectBindingPossible: resourceTypes.has(field.type) || field.id === 'requireSelection',
      qualification: 'STATIC_REFERENCE_ONLY_NOT_CONNECTED_CONTROL_PROOF',
    })),
    nestedBlockDeclarations: section.schema.blocks.map(block => ({
      ...block, effectiveFields: runtime[type].blocks_schema[block.type]?.fields ?? {},
      reusableSource: bundle.blocks[block.type]?.path ?? null,
      extensionSeam: block.type === '@app',
      nesting: 'No child block-type declarations are present in this factory schema; generic editor tree capability requires its separate guard/identity checks.',
    })),
  };
});
const globalFields = Object.entries(bundle.config.settings_schema.settings).flatMap(([group, schema]) => Object.entries(schema.fields).map(([id, descriptor]) => ({ group, id, descriptor, currentValue: bundle.config.settings_data.current[id], defaultSource: Object.hasOwn(bundle.config.settings_data.current, id) ? 'CURRENT_SETTINGS' : 'SCHEMA_DEFAULT', sourceControlTypeHandled: supportedControls.includes(descriptor.type) })));
const fieldRows = sectionTypes.flatMap(s => s.schema.settings.map(f => ({ location: `section/${s.type}/${f.id}`, sectionType: s.type, blockType: null, field: f.id, descriptor: f, instances: s.defaultInstances, resourceOrMedia: resourceTypes.has(f.type) })));
const blockFields = sectionTypes.flatMap(s => s.nestedBlockDeclarations.flatMap(b => Object.entries(b.effectiveFields).map(([id, descriptor]) => ({ location: `block/${s.type}/${b.type}/${id}`, sectionType: s.type, blockType: b.type, field: id, descriptor, instances: s.defaultInstances, resourceOrMedia: resourceTypes.has(String(descriptor.type)) }))));
const design = json('docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/circuit-storybook/capabilities.json');
const coreRequire = createRequire(resolve(root, 'packages/commerce-core/package.json'));
const { z } = coreRequire('zod');
const factsSchema = z.toJSONSchema(ElectronicsFactsSchema);
type JsonSchema = { properties?: Record<string, JsonSchema>; items?: JsonSchema; [key: string]: unknown };
function factLeaves(schema: JsonSchema, prefix = ''): Array<{ path: string; descriptor: JsonSchema }> {
  if (schema.properties) return Object.entries(schema.properties).flatMap(([key, value]) => factLeaves(value, prefix ? `${prefix}.${key}` : key));
  if (schema.items) return factLeaves(schema.items, `${prefix}[]`);
  return [{ path: prefix, descriptor: schema }];
}
const catalogueFields = factLeaves(factsSchema).map(field => ({ ...field, controlOwner: 'apps/merchant/web/src/components/products/niche-facts/circuit-facts-editor.tsx', authority: field.path === 'version' ? 'SCHEMA_VERSION_PROTECTED' : 'CATALOGUE_PRODUCT_EDITOR_NOT_THEME_SETTING', actualControlVerification: 'SOURCE_DECLARED_NOT_BROWSER_VERIFIED' }));
const counts = {
  pageTemplates: templateInstances.filter(t => t.kind === 'PAGE_TEMPLATE').length,
  sharedGroups: templateInstances.filter(t => t.kind === 'SHARED_GROUP').length,
  sectionTypes: sectionTypes.length,
  defaultSectionInstances: templateInstances.reduce((sum, t) => sum + t.sections.length, 0),
  declaredBlockTypePlacements: sectionTypes.reduce((sum, s) => sum + s.nestedBlockDeclarations.length, 0),
  extensionSeamPlacements: sectionTypes.reduce((sum, s) => sum + s.nestedBlockDeclarations.filter(b => b.extensionSeam).length, 0),
  reusableBlockTypes: Object.keys(bundle.blocks).length,
  defaultBlockInstances: templateInstances.reduce((sum, t) => sum + t.sections.reduce((n, s) => n + Object.keys(s.blocks).length, 0), 0),
  themeFields: globalFields.length, sectionFields: fieldRows.length, effectiveBlockFields: blockFields.length,
  catalogueLeafFields: catalogueFields.length, editableCatalogueLeafFields: catalogueFields.filter(f => f.path !== 'version').length,
};
const inventory = {
  schemaVersion: 1, classification: 'GENERATED_SOURCE_DERIVED_INVENTORY_NOT_GOVERNANCE_OR_ACCEPTANCE', recordedAt: now,
  theme: { name: 'Circuit', preset: 'forge', slug: bundle.package.slug, version: bundle.package.version },
  source: { head, branch, manifest: 'SOURCE_MANIFEST.json', manifestSha256: hash(readFileSync(resolve(output, 'SOURCE_MANIFEST.json'))), bundleJsonSha256: hash(JSON.stringify(bundle)), builder: "createFirstPartyCatalogBundle('letbuyy-forge', {designVersion:'2.0.0'})" },
  counts, templates: templateInstances, sectionTypes, reusableBlocks: bundle.blocks,
  themeSettings: { groups: bundle.config.settings_schema, current: bundle.config.settings_data.current, fields: globalFields },
  fieldIndex: [...fieldRows, ...blockFields],
  resourcesAndMedia: [...fieldRows, ...blockFields].filter(f => f.resourceOrMedia),
  layout: Object.fromEntries(Object.entries(bundle.layout).map(([key, file]) => [key, { path: file.path, sourceSha256: hash(file.source) }])),
  locales: bundle.locales, renderer: bundle.renderer,
  advertisedCapabilities: design.capabilities,
  catalogueFacts: { owner: 'packages/commerce-core/src/circuit-facts.ts', storage: 'metadata.electronics', fields: Object.keys(ElectronicsFactsSchema.shape), leafFields: catalogueFields, schemaSnapshot: factsSchema, jsonSchemaLimit: 'Custom refinements are not all encoded in JSON Schema: real calendar dates, named device models, duplicate connectors/devices, pass-through <= input remain mandatory in the pinned source schema.', arrayControls: ['connectors:add/remove; maximum20; unique kind+role; count1..16', 'host_requirements:add/remove; maximum20; text1..500', 'box_contents:add/remove; maximum30; label1..200; quantity1..1000', 'compatible_devices:add/remove; maximum30; specific manufacturer/model/reference/date'], groupClearControls: ['video', 'dimensions_mm', 'fact_sheet', 'all electronics facts'], variantNamespace: 'UNSUPPORTED_ELECTRONICS_OVERRIDE; cosmetic variant UUID/stock/options remain canonical', constraints: 'See pinned strict schema, real date checks, duplicates, finite positive units, maximums, and pass-through <= input superRefine; never derive facts from media or theme settings.' },
  discovery: { owner: 'packages/commerce-core/src/storefront-discovery.ts', actualStrictQueryKeys: Object.keys(StorefrontDiscoveryQuerySchema.shape), presentationOwner: 'packages/theme-engine/src/circuit-discovery.ts', potentialDesignContractGaps: ['M1 proposed manufacturer and compatibility-evidence facets are not keys in the actual strict query schema. Do not send unsupported keys or silently certify these controls. Allocator review of actual promised scope is required.'] },
  protectedControls: ['Identity/session/realm issuance and callback authority', 'Catalogue product/variant UUIDs, facts, stock and prices', 'Server cart totals, tax, rates, eligibility and provider choice', 'Hosted checkout execution, order identity and ledger', 'Third-party @app execution stays a frozen seam'],
  limitations: ['This invokes pure in-memory catalogue factories and persistence-schema projection only. It does not start an app/build/database/browser.', 'Declared schemas and static references do not prove mounted editable controls, permission enforcement, persisted values or actual public rendering.', 'Only the actual supplied default block instances are enumerated; none are invented. All supported block types still require sacrificial-draft lifecycle coverage.', 'All-template nesting, group and section availability must be checked on the admitted editor API and actual instance, with security/business invariants preserved.'],
};
emit('CAPABILITY_INVENTORY.json', inventory);
emit('FACTORY_SCHEMA_SNAPSHOT.json', { classification: inventory.classification, source: inventory.source, package: bundle.package, templates: bundle.templates, sectionSchemas: Object.fromEntries(Object.entries(bundle.sections).map(([type, file]) => [type, file.schema])), reusableBlockSchemas: Object.fromEntries(Object.entries(bundle.blocks).map(([type, file]) => [type, file.schema])), schemaManifest: payload.schemaManifest, config: bundle.config });
console.log(JSON.stringify({ classification: inventory.classification, ...counts, sourceFiles: sourceInputs.length, factoryClosureFiles: closure.size, bundleSha256: inventory.source.bundleJsonSha256 }));
