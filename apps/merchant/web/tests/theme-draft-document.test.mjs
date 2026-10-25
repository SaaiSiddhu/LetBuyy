import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as domain from '@letbuyy/theme-engine';
import { createRequire } from 'node:module';
// UI tokens are exported through the package's CommonJS TypeScript entry.
const { letbuyyPrimitiveTokens } = createRequire(import.meta.url)('@letbuyy/ui/tokens');

const file = new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx', import.meta.url);
const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(source));
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node.getText(source));
    }
}

// Execute the actual page's document helpers and their local dependencies.
// No duplicate serializer, mock validator, Next runtime or DOM is used here.
const needed = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'normalizeTemplateOptions', 'normalizeBlock', 'blockToPortableRecord', 'getBlockById', 'createBlockFromSchema', 'updateBlockInTree', 'removeBlockFromTree', 'getAllSections', 'updateSectionById', 'firstSelection']);
for (const name of needed) {
    assert.ok(declarations.has(name), `Missing editor helper ${name}`);
    const tree = ts.createSourceFile('helper.ts', declarations.get(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const walk = node => {
        if (ts.isIdentifier(node) && declarations.has(node.text)) needed.add(node.text);
        ts.forEachChild(node, walk);
    };
    walk(tree);
}
const javascript = ts.transpileModule([...needed].map(name => declarations.get(name)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
export const helpers = new Function('getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens', 'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug', 'MAX_BUNDLE_BLOCK_NESTING_DEPTH', 'ThemeEditorTemplateKeySchema', 'normalizeEditorSchemaField', 'resolveFieldDefault',
    javascript + '\nreturn {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,normalizeTemplateOptions,normalizeBlock,blockToPortableRecord,getBlockById,createBlockFromSchema,updateBlockInTree,removeBlockFromTree,getAllSections,updateSectionById,firstSelection}')(
    domain.getDefaultStorefrontThemeTemplate, domain.hasRenderableThemeTemplate, letbuyyPrimitiveTokens, domain.isUnchangedCoreDemoCategoryBlocks, domain.isFirstPartyCoreBundleSlug, domain.MAX_BUNDLE_BLOCK_NESTING_DEPTH, domain.ThemeEditorTemplateKeySchema, domain.normalizeEditorSchemaField, domain.resolveFieldDefault,
);

function document() {
    const slug = 'letbuyy-core';
    const base = domain.getDefaultStorefrontThemeTemplate(slug);
    const runtime = { sectionSchemas: domain.getSectionSchemas(slug), settingsSchema: domain.getThemeSettingsSchema(slug) };
    const settings = helpers.normalizeSettingsSchema(runtime.settingsSchema);
    const state = helpers.normalizeEditorState(base, slug, 'index', runtime.sectionSchemas, settings);
    const config = helpers.buildDraftConfig(base, slug, state, 'index');
    return { config, issues: () => domain.collectThemeTemplateValidationIssues({ templateConfig: config, runtime, themeSlug: slug }) };
}

test('the actual default editor document passes canonical validation before its first CAS save', () => {
    assert.deepEqual(document().issues(), []);
});

test('editor document validation continues rejecting unsafe color values in both representations', () => {
    const draft = document();
    const newsletter = draft.config.sections.template.find(section => section.type === 'newsletter');
    newsletter.settings.backgroundColor = 'javascript:invalid-color';
    draft.config.templates.index.sections[newsletter.id].settings.backgroundColor = 'javascript:invalid-color';
    assert.ok(draft.issues().filter(issue => issue.includes('backgroundColor must be a valid CSS color')).length >= 2);
});

function actualLiquidDocument() {
    const file = new URL('../../../../services/api-gateway/src/execution/schema-registry-execution.adapter.ts', import.meta.url)
    const tree = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const names = new Set(['asRecord','isLiquidBundle','buildBundleTemplateConfig'])
    const code = tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(tree)).join('\n')
    const build = new Function(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return buildBundleTemplateConfig')()
    const bundle = domain.createLetbuyyCoreLiquidThemeBundleFixture()
    const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest
    const base = build(bundle)
    const settings = helpers.normalizeSettingsSchema(manifest.settings_schema)
    const runtime = {sectionSchemas:manifest.section_schemas,settingsSchema:settings}
    const state = helpers.normalizeEditorState(base,bundle.package.slug,'index',runtime.sectionSchemas,settings)
    const config = helpers.buildDraftConfig(base,bundle.package.slug,state,'index')
    return {base,state,config,runtime,slug:bundle.package.slug}
}

test('the actual installed Liquid document remains valid when normalized by the editor', () => {
    const doc = actualLiquidDocument()
    assert.deepEqual(domain.collectThemeTemplateValidationIssues({templateConfig:doc.base,runtime:doc.runtime,themeSlug:doc.slug}),[], 'the installed document is valid before the client loads it')
    assert.deepEqual(domain.collectThemeTemplateValidationIssues({templateConfig:doc.config,runtime:doc.runtime,themeSlug:doc.slug}),[])
})

test('every header/footer section remains selectable and editable through the actual compiler round trip', () => {
    const doc = actualLiquidDocument();
    const footer = structuredClone(doc.base.templates.footer.sections['footer-default']);
    doc.base.templates.footer.sections['footer-secondary'] = footer;
    doc.base.templates.footer.order.push('footer-secondary');
    const state = helpers.normalizeEditorState(doc.base, doc.slug, 'index', doc.runtime.sectionSchemas, doc.runtime.settingsSchema);
    assert.deepEqual(state.sections.header.map(section => section.id), ['announcement-default', 'header-default']);
    assert.deepEqual(state.sections.footer.map(section => section.id), ['footer-default', 'footer-secondary']);
    assert.equal(helpers.firstSelection(state, doc.runtime.settingsSchema).sectionId, 'announcement-default');
    const identities = domain.createEditorPreviewIdentityIndex(helpers.getAllSections(state));
    assert.ok(identities['header-default']);
    assert.ok(identities['footer-secondary']);
    const edited = helpers.updateSectionById(state, 'header-default', section => ({ ...section, settings: { ...section.settings, showSearch: false } }));
    const hidden = helpers.updateSectionById(edited, 'footer-secondary', section => ({ ...section, visible: false }));
    assert.equal(state.sections.header[1].settings.showSearch, true, 'history remains immutable');
    const config = helpers.buildDraftConfig(doc.base, doc.slug, hidden, 'index');
    assert.equal(config.sections.header.id, 'announcement-default', 'the legacy DTO remains a single section projection');
    assert.equal(config.sections.footer.id, 'footer-default');
    assert.deepEqual(domain.collectThemeTemplateValidationIssues({ templateConfig: config, runtime: doc.runtime, themeSlug: doc.slug }), []);
    const compiled = domain.compilePortableToLiquidBundle(config, { baseBundle: doc.base.liquidBundle }).bundle;
    assert.deepEqual(compiled.templates.header.order, ['announcement-default', 'header-default']);
    assert.equal(compiled.templates.header.sections['header-default'].settings.showSearch, false);
    assert.deepEqual(compiled.templates.header.sections['announcement-default'].settings, state.sections.header[0].settings);
    assert.deepEqual(compiled.templates.footer.order, ['footer-default', 'footer-secondary']);
    assert.equal(compiled.templates.footer.sections['footer-default'].disabled, false);
    assert.equal(compiled.templates.footer.sections['footer-secondary'].disabled, true);
    const readback = helpers.normalizeEditorState({ ...config, templates: compiled.templates, liquidBundle: compiled }, doc.slug, 'index', doc.runtime.sectionSchemas, doc.runtime.settingsSchema);
    assert.equal(readback.sections.header[1].settings.showSearch, false);
    assert.equal(readback.sections.footer[1].visible, false);
});

test('customer templates and alternates preserve their own identity instead of relabeling home', () => {
    const doc = actualLiquidDocument()
    doc.base.templates['page.faq'] = { name: 'Synthetic FAQ', sections: {}, order: [] }
    const options = helpers.normalizeTemplateOptions([],doc.base)
    assert.notEqual(options.find(option=>option.key==='index').label,'Addresses')
    assert.equal(options.filter(option=>option.key==='index').length,1)
    assert.equal(options.find(option=>option.key==='page.faq').label,'Synthetic FAQ')
    assert.ok(options.some(option=>option.key==='customers/addresses'))
    assert.notEqual(options.find(option=>option.key==='blog').label,options.find(option=>option.key==='article').label)
})

test('an intentionally empty alternate stays empty instead of inheriting another template body', () => {
    const doc = actualLiquidDocument();
    const populated = helpers.buildDraftConfig(doc.base, doc.slug, doc.state, 'index');
    populated.templates['page.empty'] = { name: 'Empty page', sections: {}, order: [] };
    const empty = helpers.normalizeEditorState(populated, doc.slug, 'page.empty', doc.runtime.sectionSchemas, doc.runtime.settingsSchema);
    assert.deepEqual(empty.sections.template, []);
    const saved = helpers.buildDraftConfig(populated, doc.slug, empty, 'page.empty');
    assert.deepEqual(saved.templates['page.empty'].sections, {});
    assert.deepEqual(saved.templates['page.empty'].order, []);
    assert.deepEqual(saved.templates.index, populated.templates.index, 'home must remain untouched');
});

test('intentionally empty Liquid header/footer groups remain empty and compile without inventing a legacy slot', () => {
    const doc = actualLiquidDocument();
    doc.base.templates.header = { name: 'Empty header', sections: {}, order: [] };
    doc.base.templates.footer = { name: 'Empty footer', sections: {}, order: [] };
    const state = helpers.normalizeEditorState(doc.base, doc.slug, 'index', doc.runtime.sectionSchemas, doc.runtime.settingsSchema);
    const saved = helpers.buildDraftConfig(doc.base, doc.slug, state, 'index');
    const compiled = domain.compilePortableToLiquidBundle(saved, { baseBundle: doc.base.liquidBundle }).bundle;
    assert.deepEqual(compiled.templates.header.order, []);
    assert.deepEqual(compiled.templates.footer.order, []);
});

test('canonical disabled sections and blocks stay hidden when loaded and saved through the editor', () => {
    const doc = actualLiquidDocument();
    const [sectionId, section] = Object.entries(doc.base.templates.index.sections).find(([, item]) => item.type === 'spotlight');
    section.disabled = true;
    section.blocks = { 'hidden-badge': { type: 'badge', settings: { label: 'Synthetic hidden badge' }, disabled: true, blocks: {}, block_order: [] } };
    section.block_order = ['hidden-badge'];
    domain.parseLiquidThemePackageBundle(doc.base.liquidBundle);
    const state = helpers.normalizeEditorState(doc.base, doc.slug, 'index', doc.runtime.sectionSchemas, doc.runtime.settingsSchema);
    const loaded = state.sections.template.find(item => item.id === sectionId);
    assert.equal(loaded.visible, false, 'loading must not unhide a canonical disabled section');
    assert.equal(loaded.blocks[0].visible, false, 'loading must not unhide a canonical disabled block');
    const config = helpers.buildDraftConfig(doc.base, doc.slug, state, 'index');
    const compiled = domain.compilePortableToLiquidBundle(config, { baseBundle: doc.base.liquidBundle }).bundle;
    assert.equal(compiled.templates.index.sections[sectionId].disabled, true);
    assert.equal(compiled.templates.index.sections[sectionId].blocks['hidden-badge'].disabled, true);
});

test('nested canonical block identity, typed settings and order reach the actual editor model and serializer', () => {
    const input = { id: 'parent', type: 'badge', settings: { label: 'Parent', enabled: false, count: 3 }, blocks: {
        second: { type: 'badge', disabled: true, settings: { label: 'Same label', reference: { __lb_binding: true, source: 'resource', resourceType: 'page', id: 'owned-page' } } },
        first: { type: 'badge', settings: { label: 'Same label' } },
    }, block_order: ['first', 'second'] };
    const loaded = helpers.normalizeBlock(input, 0);
    assert.deepEqual(loaded.children.map(child => child.id), ['first', 'second']);
    assert.equal(helpers.getBlockById({ blocks: [loaded] }, 'second').visible, false);
    const encoded = helpers.blockToPortableRecord(loaded);
    assert.deepEqual(encoded.block_order, ['first', 'second']);
    assert.deepEqual(encoded.blocks.second.settings.reference, input.blocks.second.settings.reference);
    assert.equal(encoded.blocks.second.visible, false);
    assert.deepEqual(encoded.settings, input.settings);
});

test('same-millisecond block insertions receive different stable instance IDs', () => {
    const oldNow = Date.now;
    Date.now = () => 123456789;
    try {
        const a = helpers.createBlockFromSchema('badge', undefined, 0);
        const b = helpers.createBlockFromSchema('badge', undefined, 10);
        assert.notEqual(a.id, b.id, 'clock timestamps cannot identify duplicate instances');
    } finally { Date.now = oldNow; }
});

test('nested edits and removal affect the selected instance only, preserving duplicate labels and siblings', () => {
    const blocks = [helpers.normalizeBlock({ id: 'parent', type: 'badge', children: [
        { id: 'first', type: 'badge', settings: { label: 'Same label' } },
        { id: 'second', type: 'badge', settings: { label: 'Same label' } },
    ] }, 0)];
    const edited = helpers.updateBlockInTree(blocks, 'second', block => ({ ...block, settings: { ...block.settings, label: 'Changed exact block' } }));
    assert.equal(edited[0].children[0].settings.label, 'Same label');
    assert.equal(edited[0].children[1].settings.label, 'Changed exact block');
    assert.equal(blocks[0].children[1].settings.label, 'Same label', 'history snapshot must remain immutable');
    const removed = helpers.removeBlockFromTree(edited, 'second');
    assert.deepEqual(removed[0].children.map(child => child.id), ['first']);
    assert.deepEqual(edited[0].children.map(child => child.id), ['first', 'second']);
});

test('over-depth block data fails visibly instead of truncating it into a saveable tree', () => {
    const block = depth => ({ id: `block-${depth}`, type: 'badge', children: depth ? [block(depth - 1)] : [] });
    assert.throws(() => helpers.normalizeBlock(block(domain.MAX_BUNDLE_BLOCK_NESTING_DEPTH), 0), /nesting limit/);
    assert.doesNotThrow(() => helpers.normalizeBlock(block(domain.MAX_BUNDLE_BLOCK_NESTING_DEPTH - 1), 0));
});
