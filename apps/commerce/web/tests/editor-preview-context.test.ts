import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createUrbanKicksLiquidThemeBundleFixture, EditorPreviewContextSchema, ThemeEditorTemplateKeySchema, parseTemplateKey, toThemeDocumentV2, createEditorPreviewIdentityIndex, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';

// Run the actual server adapter without importing its Next/CSS/rendering shell.
const file = new URL('../src/app/preview/preview-content.tsx', import.meta.url);
const tree = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ['asRecord', 'resolveEditorPreviewContext', 'editorPreviewLiquidContent'].map(name => {
    const node = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(node, `Missing actual adapter ${name}`); return node.getText(tree);
});
const javascript = ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const adapters = new Function('EditorPreviewContextSchema', 'ThemeEditorTemplateKeySchema', 'parseTemplateKey', 'toThemeDocumentV2', 'createEditorPreviewIdentityIndex', javascript + ';return {resolveEditorPreviewContext,editorPreviewLiquidContent};')(EditorPreviewContextSchema, ThemeEditorTemplateKeySchema, parseTemplateKey, toThemeDocumentV2, createEditorPreviewIdentityIndex);
const resolve = adapters.resolveEditorPreviewContext;
function fixture() {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    for (const name of ['page', 'page.faq', 'blog', 'article', 'customers/account']) bundle.templates[name] = structuredClone(bundle.templates.index);
    return { subdomain: 'synthetic-editor', templateConfig: { liquidBundle: bundle, releaseVersion: 4, releaseManifest: { preview: true, preview_session_id: '33333333-3333-4333-8333-333333333333' } } };
}

for (const key of ['page', 'page.faq', 'blog', 'article', 'customers/account']) test(`signed preview chooses exact ${key} without changing a template assignment`, () => {
    const store = fixture(), before = structuredClone(store);
    const resolved = resolve(store, key);
    assert.equal(resolved.context.templateKey, key);
    assert.equal(resolved.route.templateKey, key);
    assert.equal(resolved.route.type, key === 'customers/account' ? 'customer_account' : key.split('.')[0]);
    assert.equal(resolved.context.revision, 4);
    assert.deepEqual(store, before);
});
test('missing template, invalid keys, absent signed manifest or malformed session fail closed', () => {
    const store = fixture();
    for (const key of ['page.missing', 'constructor', '../private', 'header', 'footer']) assert.equal(resolve(store, key), null);
    assert.equal(resolve({ ...store, templateConfig: { ...store.templateConfig, releaseManifest: {} } }, 'page'), null);
    assert.equal(resolve({ ...store, templateConfig: { ...store.templateConfig, releaseVersion: '4' } }, 'page'), null);
    assert.equal(resolve({ ...store, templateConfig: { ...store.templateConfig, releaseManifest: { preview: true, preview_session_id: 'invalid' } } }, 'page'), null);
});
test('resource context stays a separate preview choice and membership derives from the canonical document', () => {
    const resolved = resolve(fixture(), 'page.faq', 'synthetic-page-id');
    assert.equal(resolved.context.resourceId, 'synthetic-page-id');
    assert.equal(resolved.route.resourceId, 'synthetic-page-id');
    assert.ok(Object.keys(resolved.identities).length > 0);
});
test('private blog pagination is bounded and correlated without changing the saved document', () => {
    const store = fixture(), before = structuredClone(store);
    const resolved = resolve(store, 'blog', undefined, '2');
    assert.equal(resolved.context.page, 2);
    assert.equal(resolved.route.searchParams.page, '2');
    assert.deepEqual(store, before);
    for (const invalid of ['0', '1001', '2x', ['1', '2'], '']) assert.equal(resolve(store, 'blog', undefined, invalid), null);
});
test('actual private CMS projection reaches the canonical Liquid renderer and its sanitizer', async () => {
    const page = adapters.editorPreviewLiquidContent({ resource: 'page', articles: [], pagination: { page: 1, limit: 1, has_more: false }, content: { id: 'owned-page', title: 'Owned private page', slug: 'owned-page', content: { body: '<p>Owned private body</p><script>untrusted()</script>' } } });
    const rendered = await new LiquidRenderer().render({
        context: { storeId: '33333333-3333-4333-8333-333333333333', subdomain: 'synthetic-editor', path: '/preview', locale: 'en', previewMode: true },
        storeTemplate: { storeId: '33333333-3333-4333-8333-333333333333', themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        liquidBundle: createUrbanKicksLiquidThemeBundleFixture(), liquidTemplateKey: 'page', liquidContext: { page },
    });
    assert.equal(rendered.status, 'rendered', rendered.warnings.join(', '));
    assert.match(rendered.liquid!.layoutHtml, /Owned private body/);
    assert.doesNotMatch(rendered.liquid!.layoutHtml, /<script|untrusted\(\)/);
});
test('private blog projection exposes real pagination state without claiming a fabricated one-page total', () => {
    const projected = adapters.editorPreviewLiquidContent({ resource: 'blog', content: null, articles: [{ id: 'owned-article', title: 'Owned article', slug: 'owned-article' }], pagination: { page: 2, limit: 20, has_more: true } });
    assert.equal(projected._blog.current_page, 2); assert.equal(projected._blog.has_more, true);
    assert.equal(Object.hasOwn(projected._blog, 'pages_count'), false);
    assert.equal(projected._blog.articles[0].id, 'owned-article');
    const counted = adapters.editorPreviewLiquidContent({ resource: 'blog', content: null, articles: [], pagination: { page: 2, limit: 20, has_more: false, total: 21, total_pages: 2 } });
    assert.equal(counted._blog.total, 21); assert.equal(counted._blog.pages_count, 2);
});
