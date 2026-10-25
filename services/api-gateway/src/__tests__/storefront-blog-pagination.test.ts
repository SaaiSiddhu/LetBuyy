import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Hono } from 'hono';
import { z } from 'zod';
import { normalizeStorefrontHandle } from '@letbuyy/tenant-core';
import { paginated, success, dbFailureBody } from '../lib/supabase';

function fixture(failure = false) {
    const rows = [
        { id: 'b', store_id: 'owned', title: 'Second post', status: 'published', deleted_at: null, is_pinned: false, created_at: '2026-10-23' },
        { id: 'a', store_id: 'owned', title: 'First post', status: 'published', deleted_at: null, is_pinned: false, created_at: '2026-10-23' },
        { id: 'foreign', store_id: 'foreign', title: 'Foreign post', status: 'published', deleted_at: null },
        { id: 'draft', store_id: 'owned', title: 'Private draft', status: 'draft', deleted_at: null },
        { id: 'deleted', store_id: 'owned', title: 'Deleted post', status: 'published', deleted_at: '2026-10-23' },
    ];
    let reads = 0;
    const db = { from(table: string) {
        assert.equal(table, 'blog_posts'); reads++;
        let data = rows.slice();
        const chain = {
            select: () => chain,
            eq: (key: string, value: unknown) => { data = data.filter(row => row[key as keyof typeof row] === value); return chain; },
            is: (key: string, value: unknown) => { data = data.filter(row => row[key as keyof typeof row] === value); return chain; },
            order: (key: string) => { if (key === 'id') data.sort((a, b) => a.id.localeCompare(b.id)); return chain; },
            range: async (start: number, end: number) => ({ data: data.slice(start, end + 1), count: data.length, error: failure ? { message: 'PRIVATE_DATABASE_DETAIL' } : null }),
        };
        return chain;
    } };
    const source = readFileSync(new URL('../routes/storefront/storefront-blog-routes.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const modules: Record<string, unknown> = {
        zod: { z }, '@letbuyy/tenant-core': { normalizeStorefrontHandle },
        '../../lib/supabase': { getSupabaseAdmin: () => db, paginated, success, dbFailureBody },
        '../../lib/storefront-cache': {
            cachedJson: async (c: { json(body: unknown, status: number): Response }, _key: string, _ttl: number, _swr: number, read: () => Promise<{ body: unknown; status?: number }>) => { const result = await read(); return c.json(result.body, result.status || 200); },
            storefrontRequestCacheKey: async () => 'owned-test', STOREFRONT_CACHE_TTL_SECONDS: 60, STOREFRONT_CACHE_SWR_SECONDS: 60,
        },
    };
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', code)((name: string) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; }, exports);
    const app = new Hono();
    (exports.registerStorefrontBlogRoutes as Function)(app, {
        loadPublishedStore: async (_c: unknown, handle: string) => handle === 'owned-store' ? { id: 'owned' } : null,
        normalizePublicRouteToken: (value: string) => value, storefrontCacheTags: () => [],
    });
    return { app, get reads() { return reads; } };
}

test('mounted public blog route returns distinct stable pages with real totals and excludes foreign/private/deleted posts', async () => {
    const f = fixture();
    const responseSchema = z.object({ data: z.array(z.object({ id: z.string(), title: z.string() })), meta: z.object({ total: z.number(), total_pages: z.number(), has_next: z.boolean() }) });
    const first = responseSchema.parse(await (await f.app.request('/owned-store/blog?page=1&limit=1')).json());
    const second = responseSchema.parse(await (await f.app.request('/owned-store/blog?page=2&limit=1')).json());
    assert.equal(first.data[0].id, 'a'); assert.equal(second.data[0].id, 'b');
    assert.equal(first.meta.total, 2); assert.equal(first.meta.has_next, true);
    assert.equal(second.meta.total_pages, 2); assert.equal(second.meta.has_next, false);
    assert.doesNotMatch(JSON.stringify([first, second]), /Foreign post|Private draft|Deleted post/);
    assert.equal((await f.app.request('/unpublished-store/blog')).status, 404);
});

test('mounted public blog route rejects malformed and repeated bounds before queries and sanitizes database failures', async () => {
    const f = fixture();
    for (const query of ['page=0', 'page=-1', 'page=1x', 'page=1&page=2', 'page=1001', 'limit=51', 'limit=NaN', 'limit=']) {
        assert.equal((await f.app.request(`/owned-store/blog?${query}`)).status, 400, query);
    }
    assert.equal(f.reads, 0);
    const result = await fixture(true).app.request('/owned-store/blog');
    assert.equal(result.status, 500);
    assert.doesNotMatch(await result.text(), /PRIVATE_DATABASE_DETAIL/);
});
