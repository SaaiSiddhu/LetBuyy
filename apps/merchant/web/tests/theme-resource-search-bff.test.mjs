import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function fixture({ denial = false, upstreamStatus = 200 } = {}) {
    const calls = { resolve: 0, fetch: [] };
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async () => { calls.resolve++; return denial ? { error: Response.json({ error: 'Denied' }, { status: 403 }) } : { storeId: '11111111-1111-4111-8111-111111111111' }; } },
        '@/lib/api/client': {
            merchantApiFetch: async (path, options) => { calls.fetch.push({ path, options }); return Response.json(upstreamStatus === 200 ? { data: [{ id: 'owned-post', title: 'Owned post' }], meta: { page: 2, limit: 20, has_more: false } } : { error: { message: 'Unavailable' } }, { status: upstreamStatus }); },
            merchantApiErrorResponse: error => { throw error; },
        },
    };
    const source = readFileSync(new URL('../src/app/api/stores/[store]/resource-search/route.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {}; new Function('require', 'exports', code)(name => { assert.ok(modules[name]); return modules[name]; }, exports);
    const request = query => exports.GET(new Request('http://merchant.invalid/api/stores/owned/resource-search?' + query), { params: Promise.resolve({ store: 'owned' }) });
    return { calls, request };
}
test('actual resource BFF forwards pagination and authoritative resolved site while preserving response metadata', async () => {
    const f = fixture(); const response = await f.request('type=blog&q=Same&page=2&limit=20&store_id=forged');
    assert.equal(response.status, 200);
    const url = new URL(f.calls.fetch[0].path, 'https://gateway.example.invalid');
    assert.equal(url.searchParams.get('page'), '2'); assert.equal(url.searchParams.get('store_id'), '11111111-1111-4111-8111-111111111111');
    assert.equal(f.calls.fetch[0].options.requireSession, true);
    assert.equal((await response.json()).meta.page, 2);
});
test('invalid discovery pages/queries fail before store resolution or gateway access', async () => {
    const f = fixture();
    for (const query of ['type=blog&page=0', 'type=page&page=1x', 'type=blog&page=1001', 'type=blog&q=' + 'x'.repeat(201)]) assert.equal((await f.request(query)).status, 400);
    assert.equal(f.calls.resolve, 0); assert.equal(f.calls.fetch.length, 0);
});
test('ownership denial and gateway failure stay explicit rather than becoming empty success', async () => {
    const denied = fixture({ denial: true }); assert.equal((await denied.request('type=page')).status, 403); assert.equal(denied.calls.fetch.length, 0);
    const failed = fixture({ upstreamStatus: 503 }); assert.equal((await failed.request('type=blog')).status, 503);
});
