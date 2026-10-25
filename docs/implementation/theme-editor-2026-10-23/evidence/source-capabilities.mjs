// Source-derived evidence only. Not an editor catalog or capability authority.
// Run from the repository: node --import tsx <this file>
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { firstPartyThemeListings, createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog.ts';

const root = new URL('../../../../', import.meta.url);
const editorPath = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const page = readFileSync(new URL(editorPath, root), 'utf8');
const sourceFile = ts.createSourceFile(editorPath, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['FIELD_TYPES', 'asRecord', 'stringValue', 'optionalString', 'labelFromKey', 'normalizeFieldType', 'normalizeFieldOptions', 'normalizeField', 'normalizeTemplateKey']);
const functions = sourceFile.statements.filter(node => {
    if (ts.isFunctionDeclaration(node)) return names.has(node.name?.text);
    return ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(sourceFile)));
}).map(node => node.getText(sourceFile)).join('\n');
// Executes only the named pure helpers extracted from the actual page, not a copied model.
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const normalize = new Function(`${js}\nreturn normalizeField;`)();
const normalizeKey = new Function(`${js}\nreturn normalizeTemplateKey;`)();
const proposed = { sense: 'Threadline', bloom: 'Playfield', forge: 'Circuit', refresh: 'Pantry', craft: 'Habitat', summit: 'Kindred', nova: 'MadeYours', aura: 'Dewdrop', ride: 'Trailmark', dawn: 'Marginalia' };
const fields = (schema, scope) => {
    if (!schema || typeof schema !== 'object') return [];
    if (Array.isArray(schema)) return schema.map((field, index) => ({ scope, id: field.id || `field_${index + 1}`, ...field }));
    return Object.entries(schema).map(([id, field]) => ({ scope, id, ...field }));
};
const report = {
    generatedAt: new Date().toISOString(),
    classification: 'SOURCE_DERIVED_EVIDENCE_NOT_AUTHORITY',
    editorSource: { path: editorPath, sha256: createHash('sha256').update(page).digest('hex') },
    caveat: 'Generated package contracts only. No API/DB installed artifact, browser, persistence or publication acceptance.',
    normalizationSamples: {},
    templateKeySamples: Object.fromEntries(['index', 'page', 'blog', 'article', 'page.faq', 'product.alternate', 'customers/account', '../private'].map(key => [key, normalizeKey(key)])),
    themes: [],
};
for (const type of ['font_picker', 'checkbox', 'color_background', 'color_scheme', 'video', 'video_url', 'header', 'paragraph', 'page', 'blog', 'menu', 'future_list']) {
    const input = { type, label: 'Synthetic field', default: { reference: 'synthetic' }, required: true, visible_if: { field: 'enabled', value: true }, options: [{ value: 'one', label: 'First option' }] };
    report.normalizationSamples[type] = { input, actual: normalize('example', input) };
}
for (const listing of firstPartyThemeListings()) {
    const bundle = createFirstPartyCatalogBundle(listing.slug);
    const sectionContracts = Object.entries(bundle.sections).map(([type, file]) => ({
        type, name: file.schema.name, maxBlocks: file.schema.max_blocks ?? null,
        enabledOn: file.schema.enabled_on ?? null, disabledOn: file.schema.disabled_on ?? null,
        fields: fields(file.schema.settings, `section:${type}`),
        blocks: (file.schema.blocks ?? []).map(block => ({ ...block, fields: fields(block.settings, `section:${type}/block:${block.type}`) })),
    }));
    const blockContracts = Object.entries(bundle.blocks ?? {}).map(([type, file]) => ({ type, ...file.schema, fields: fields(file.schema?.settings, `block:${type}`) }));
    const globalGroups = bundle.config.settings_schema.settings ?? {};
    const globalFields = Object.entries(globalGroups).flatMap(([group, schema]) => fields(schema.fields, `global:${group}`));
    const allFields = [...globalFields, ...sectionContracts.flatMap(s => [...s.fields, ...s.blocks.flatMap(b => b.fields)]), ...blockContracts.flatMap(b => b.fields)];
    const typeCounts = {};
    for (const field of allFields) typeCounts[field.type] = (typeCounts[field.type] ?? 0) + 1;
    report.themes.push({
        presetId: listing.presetId, plannedName: proposed[listing.presetId], registeredName: listing.name,
        slug: listing.slug, packageId: listing.id, version: bundle.package.version, renderer: bundle.renderer,
        nicheImplementation: listing.presetId === 'sense' ? 'IMPLEMENTED_UNVERIFIED_BY_THIS_WORKSTREAM' : 'BLOCKED_DEPENDENCY_405_REVIEW_AND_THEME_WRITER',
        templates: Object.entries(bundle.templates).map(([key, template]) => ({ key, order: template.order, sections: template.sections })),
        globalGroups, sectionContracts, blockContracts, fieldTypeCounts: typeCounts,
        globalNormalizationChanges: globalFields.flatMap(field => {
            const actual = normalize(field.id, field);
            return actual.type !== field.type || ['required', 'visible_if', 'resource_type'].some(key => field[key] !== undefined && actual[key] === undefined)
                ? [{ scope: field.scope, id: field.id, declaredType: field.type, actualType: actual.type, metadataDropped: ['required', 'visible_if', 'resource_type'].filter(key => field[key] !== undefined && actual[key] === undefined) }] : [];
        }),
        acceptance: { editor: 'IMPLEMENTED_UNVERIFIED', savedRoundTrip: 'IMPLEMENTED_UNVERIFIED', preview: 'IMPLEMENTED_UNVERIFIED', publication: 'IMPLEMENTED_UNVERIFIED', buyer: 'IMPLEMENTED_UNVERIFIED', pagesBlogArticle: 'IMPLEMENTED_UNVERIFIED' },
    });
}
writeFileSync(new URL('./source-capabilities.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ generatedAt: report.generatedAt, themes: report.themes.map(t => ({ preset: t.presetId, name: t.registeredName, version: t.version, templates: t.templates.length, sections: t.sectionContracts.length, blocks: t.blockContracts.length, fieldTypes: t.fieldTypeCounts, globalNormalizationChanges: t.globalNormalizationChanges.length })), normalization: Object.entries(report.normalizationSamples).map(([declared, r]) => ({ declared, actual: r.actual.type, requiredRetained: r.actual.required === true, options: r.actual.options })) }, null, 2));
