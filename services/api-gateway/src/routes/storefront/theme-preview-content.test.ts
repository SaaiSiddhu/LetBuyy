import assert from 'node:assert/strict';
import test from 'node:test';
import { readThemePreviewContent, readThemePreviewCollection } from './theme-preview-content';

const siteA = '11111111-1111-4111-8111-111111111111', siteB = '22222222-2222-4222-8222-222222222222';
const pageA = '33333333-3333-4333-8333-333333333333', pageB = '44444444-4444-4444-8444-444444444444';
function fixture(error: unknown = null) {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const rows = [
        { id: pageA, store_id: siteA, title: 'Owned current draft', slug: 'owned-page', status: 'draft', deleted_at: null as string | null, content: { body: '<p>Draft content</p>' }, created_at: '2026-01-01', is_active: true },
        { id: pageB, store_id: siteB, title: 'Foreign private content', slug: 'foreign-page', status: 'draft', deleted_at: null, content: { body: 'Foreign private body' }, created_at: '2026-01-01' },
    ];
    const db = { from(table: string) {
        let filtered = rows.map(row => ({ ...row })) as Record<string, unknown>[];
        const order: Array<{ key: string; ascending: boolean }> = [];
        const chain: Record<string, (...args: unknown[]) => unknown> = {};
        for (const method of ['select', 'eq', 'is', 'neq', 'order', 'range', 'maybeSingle']) chain[method] = (...args: unknown[]) => {
            calls.push({ table, method, args });
            if (method === 'eq' || method === 'is') filtered = filtered.filter(row => row[String(args[0])] === args[1]);
            if (method === 'neq') filtered = filtered.filter(row => row[String(args[0])] !== args[1]);
            if (method === 'order') order.push({ key: String(args[0]), ascending: (args[1] as { ascending: boolean }).ascending });
            if (method === 'maybeSingle') return Promise.resolve({ data: filtered[0] || null, error });
            if (method === 'range') {
                filtered.sort((a, b) => { for (const sort of order) { const comparison = String(a[sort.key]).localeCompare(String(b[sort.key])); if (comparison) return sort.ascending ? comparison : -comparison; } return 0; });
                return Promise.resolve({ data: filtered.slice(Number(args[0]), Number(args[1]) + 1), count: filtered.length, error });
            }
            return chain;
        };
        return chain;
    } } as unknown as Parameters<typeof readThemePreviewContent>[0];
    return { db, calls, rows };
}

test('the actual helper reads an owned unpublished page then denies foreign/deleted/missing resources', async () => {
    const f = fixture();
    const own = await readThemePreviewContent(f.db, siteA, { resource: 'page', resource_id: pageA, store_id: siteB });
    assert.equal(own.status, 200); assert.match(JSON.stringify(own.body), /Draft content/);
    assert.doesNotMatch(JSON.stringify(own.body), /store_id|Foreign private/);
    assert.equal((await readThemePreviewContent(f.db, siteA, { resource: 'page', resource_id: pageB })).status, 404);
    f.rows[0].deleted_at = '2026-10-23';
    assert.equal((await readThemePreviewContent(f.db, siteA, { resource: 'page', resource_id: pageA })).status, 404);
});
test('exact collection preview reads only its verified site and rejects invalid/foreign identifiers', async () => {
    const f = fixture();
    assert.equal((await readThemePreviewCollection(f.db, siteA, pageA)).status, 200);
    assert.equal((await readThemePreviewCollection(f.db, siteA, pageB)).status, 404);
    const previous = f.calls.length;
    assert.equal((await readThemePreviewCollection(f.db, siteA, '../private')).status, 400);
    assert.equal(f.calls.length, previous);
    assert.equal(f.calls.some(call => call.method === 'range'), false, 'an exact resource lookup is not limited to the first list page');
});
test('blog pages have stable ordering and bounded lookahead rather than a fabricated page count', async () => {
    const f = fixture();
    f.rows.push({ ...f.rows[0], id: '55555555-5555-4555-8555-555555555555', title: 'Owned second draft', slug: 'second' });
    const first = await readThemePreviewContent(f.db, siteA, { resource: 'blog', page: 1, limit: 1 });
    const second = await readThemePreviewContent(f.db, siteA, { resource: 'blog', page: 2, limit: 1 });
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.ok('data' in first.body && 'data' in second.body);
    if ('data' in first.body && 'data' in second.body) {
        assert.equal(first.body.data.articles.length, 1); assert.equal(first.body.data.pagination.has_more, true);
        assert.equal(second.body.data.articles.length, 1); assert.equal(second.body.data.pagination.has_more, false);
        assert.notEqual(first.body.data.articles[0].id, second.body.data.articles[0].id);
    }
    assert.ok(f.calls.some(call => call.method === 'order' && call.args[0] === 'id'));
});
test('invalid kinds, identifiers and pagination fail before queries; database errors stay sanitized', async () => {
    const f = fixture();
    for (const query of [{ resource: 'page' }, { resource: 'article', resource_id: '../private' }, { resource: 'blog', page: 0 }, { resource: 'blog', limit: 51 }, { resource: 'blog', page: 1001 }, { resource: 'blog', resource_id: pageA }, { resource: 'products' }])
        assert.equal((await readThemePreviewContent(f.db, siteA, query)).status, 400);
    assert.equal(f.calls.length, 0);
    const broken = fixture({ message: 'SYNTHETIC_PRIVATE_DATABASE_DETAIL' });
    const result = await readThemePreviewContent(broken.db, siteA, { resource: 'page', resource_id: pageA });
    assert.equal(result.status, 500); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE_DATABASE_DETAIL/);
});
