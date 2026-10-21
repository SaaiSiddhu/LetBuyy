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
const needed = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'normalizeTemplateOptions']);
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
export const helpers = new Function('getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens', 'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug',
    javascript + '\nreturn {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,normalizeTemplateOptions}')(
    domain.getDefaultStorefrontThemeTemplate, domain.hasRenderableThemeTemplate, letbuyyPrimitiveTokens, domain.isUnchangedCoreDemoCategoryBlocks, domain.isFirstPartyCoreBundleSlug,
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

test('unsupported nested template keys cannot relabel the home template', () => {
    const doc = actualLiquidDocument()
    const options = helpers.normalizeTemplateOptions([],doc.base)
    assert.notEqual(options.find(option=>option.key==='index').label,'Addresses')
    assert.equal(options.filter(option=>option.key==='index').length,1)
})
