import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { ContentService } from '../src/lib/content-service';

const pageId = '33333333-3333-4333-8333-333333333333';
const payload = { resource: 'page', content: { id: pageId, title: 'Owned current draft', slug: 'owned', content: { body: '<p>Owned draft</p>' } }, articles: [], pagination: { page: 1, limit: 1, has_more: false } };
function fixture(result: unknown = payload, failure?: unknown, publicListing = false) {
    const calls: unknown[][] = [];
    const file = new URL('../src/lib/content-service.ts', import.meta.url);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const modules: Record<string, unknown> = {
        'server-only': {}, './api/client': {
            createStorefrontApiClient: (options: unknown) => { calls.push(['client', options]); return { storefront: {
                themePreviewContent: async (...args: unknown[]) => { calls.push(['content', ...args]); if (failure) throw failure; return structuredClone(result); },
                blogPosts: async (...args: unknown[]) => { calls.push(['blog', ...args]); if (failure) throw failure; return structuredClone(result); },
            } }; },
            storefrontReadInit: () => { if (!publicListing) throw new Error('Public content/cache fallback must not run'); return { next: { revalidate: 60 } }; },
        },
    };
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', code)((name: string) => { assert.ok(Object.hasOwn(modules, name), `Unexpected dependency ${name}`); return modules[name]; }, exports);
    return { calls, service: exports.ContentService as typeof ContentService };
}
test('actual content adapter keeps signed preview reads uncached and maps the selected resource without public fallback', async () => {
    const f = fixture();
    const result = await f.service.getPreviewContent('synthetic-editor', 'synthetic-token', { resource: 'page', resource_id: pageId });
    assert.deepEqual(f.calls[0], ['client', { cache: 'no-store' }]);
    assert.deepEqual(f.calls[1], ['content', 'synthetic-editor', 'synthetic-token', { resource: 'page', resource_id: pageId }]);
    assert.match(JSON.stringify(result), /Owned draft/);
});
test('mismatched resources and upstream failure remain explicit and scrub capability-bearing errors', async () => {
    for (const f of [fixture({ ...payload, content: { ...payload.content, id: 'another-page' } }), fixture(payload, new Error('https://private.invalid/?token=SYNTHETIC_SECRET'))])
        await assert.rejects(f.service.getPreviewContent('synthetic-editor', 'synthetic-token', { resource: 'page', resource_id: pageId }), error => error instanceof Error && error.message === 'Preview content is unavailable. Retry the preview.');
});
test('an absent authorized resource stays unavailable rather than substituting other content', async () => {
    const f = fixture(payload, { status: 404 });
    assert.equal(await f.service.getPreviewContent('synthetic-editor', 'synthetic-token', { resource: 'page', resource_id: pageId }), null);
});

test('actual public blog adapter retains canonical totals and page while existing summary callers keep their shape', async () => {
    const f = fixture({ data: [{ id: pageId, title: 'Page two article', slug: 'page-two' }], total: 21, page: 2, limit: 20, has_more: false }, undefined, true);
    const paged = await f.service.listBlogPosts('synthetic-editor', { page: 2, limit: 20 });
    assert.equal(paged.data[0].title, 'Page two article');
    assert.equal(paged.page, 2); assert.equal(paged.total, 21); assert.equal(paged.limit, 20);
    assert.deepEqual(f.calls[1], ['blog', 'synthetic-editor', { page: 2, limit: 20 }]);
    const summaries = await f.service.listBlogPosts('synthetic-editor');
    assert.equal(Array.isArray(summaries), true); assert.equal(summaries[0].id, pageId);
});
