import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture() {
    const calls: unknown[][] = [];
    const source = readFileSync(new URL('../src/app/store/[subdomain]/blog/(list)/page.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const modules: Record<string, unknown> = {
        'react/jsx-runtime': require('react/jsx-runtime'), 'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
        '@/lib/store-service': { StoreService: { getStoreBySubdomain: async () => ({ id: 'owned', name: 'Owned store' }) } },
        '@/lib/content-service': { ContentService: { listBlogPosts: async (...args: unknown[]) => { calls.push(args); return { data: [{ id: 'article-21', title: 'Page two article', slug: 'page-two' }], total: 21, page: 2, limit: 20, has_more: false }; } } },
        '@/lib/seo': { buildStoreMetadata: () => ({}) },
        '@/lib/theme-engine/template-resolver': { resolveStorefrontTemplate: (_store: unknown, route: unknown) => ({ route }) },
        '@/lib/theme-engine/composition-engine': { default: 'composition' },
    };
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', code)((name: string) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; }, exports);
    return { calls, render: exports.default as (props: { params: Promise<{ subdomain: string }>; searchParams: Promise<{ page?: string | string[] }> }) => Promise<{ props: { plan: { route: { searchParams: { page: string } } }; liquidPage: { _blog: { articles: Array<{ id: string }>; current_page: number; pages_count: number; total: number; has_more: boolean } } } }> };
}
test('actual public blog page sends page two to the canonical adapter and supplies real Liquid pagination', async () => {
    const f = fixture();
    const rendered = await f.render({ params: Promise.resolve({ subdomain: 'owned' }), searchParams: Promise.resolve({ page: '2' }) });
    assert.deepEqual(f.calls, [['owned', { page: 2, limit: 20 }]]);
    assert.equal(rendered.props.plan.route.searchParams.page, '2');
    assert.deepEqual(rendered.props.liquidPage._blog, {
        articles: [{ id: 'article-21', title: 'Page two article', slug: 'page-two', excerpt: null, featured_image: null, image: null, published_at: null, updated_at: null, url: '/blog/page-two' }],
        current_page: 2, pages_count: 2, total: 21, has_more: false,
    });
});
test('actual public blog page rejects malformed or repeated pages before fetching content', async () => {
    const f = fixture();
    for (const page of ['0', '1001', '2x', ['1', '2'], '']) await assert.rejects(f.render({ params: Promise.resolve({ subdomain: 'owned' }), searchParams: Promise.resolve({ page }) }), /NOT_FOUND/);
    assert.deepEqual(f.calls, []);
});
