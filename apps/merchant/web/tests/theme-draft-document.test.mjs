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
const needed = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig']);
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
const helpers = new Function('getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens',
    javascript + '\nreturn {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig}')(
    domain.getDefaultStorefrontThemeTemplate, domain.hasRenderableThemeTemplate, letbuyyPrimitiveTokens,
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
