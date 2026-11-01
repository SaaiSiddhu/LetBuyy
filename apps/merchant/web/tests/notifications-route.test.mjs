import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const merchantRequire = createRequire(new URL('../package.json', import.meta.url));

function fixture({ denied = false, countFails = false } = {}) {
    const calls = [];
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        zod: merchantRequire('zod'),
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async handle => {
            calls.push(['ownership', handle]);
            return denied ? { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) } : { storeId: 'owned-site' };
        } },
        '@/lib/api/client': {
            createMerchantApiClient: () => ({ notifications: {
                list: async query => {
                    calls.push(['list', query]);
                    return { data: [{ id: 'notice-1', title: 'Real inbox notice' }], page: query.page, limit: query.limit, total: 1, has_more: false };
                },
                unreadCount: async () => {
                    calls.push(['count']);
                    if (countFails) throw new Error('optional count unavailable');
                    return { count: 4 };
                },
                markAllRead: async () => { calls.push(['read-all']); return { marked_all: true }; },
            } }),
            merchantApiErrorResponse: () => Response.json({ error: { code: 'UPSTREAM_UNAVAILABLE' } }, { status: 503 }),
        },
    };
    const source = readFileSync(new URL('../src/app/api/stores/[store]/notifications/route.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { route: exports, calls };
}

const params = { params: Promise.resolve({ store: 'owned-shop' }) };
const request = query => ({ nextUrl: new URL(`https://merchant.example/api/stores/owned-shop/notifications${query}`) });

test('owned inbox read forwards bounded paging and the account-wide unread count', async () => {
    const f = fixture();
    const response = await f.route.GET(request('?page=2&limit=20'), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        data: [{ id: 'notice-1', title: 'Real inbox notice' }],
        meta: { page: 2, limit: 20, total: 1, has_more: false, unread_count: 4 },
    });
    assert.deepEqual(f.calls, [['ownership', 'owned-shop'], ['list', { page: 2, limit: 20 }], ['count']]);
});

test('invalid inbox paging and denied ownership stop before data access', async () => {
    for (const query of ['?page=-1', '?page=1.5', '?limit=1000', '?limit=NaN']) {
        const f = fixture();
        assert.equal((await f.route.GET(request(query), params)).status, 400);
        assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
    }
    const f = fixture({ denied: true });
    assert.equal((await f.route.GET(request(''), params)).status, 403);
    assert.equal((await f.route.POST({}, params)).status, 403);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop'], ['ownership', 'owned-shop']]);
});

test('read-all persists through the gateway and a count failure leaves the list available', async () => {
    const f = fixture({ countFails: true });
    const read = await f.route.GET(request(''), params);
    assert.equal(read.status, 200);
    assert.equal((await read.json()).meta.unread_count, null);
    const write = await f.route.POST({}, params);
    assert.equal(write.status, 200);
    assert.equal(write.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await write.json(), { data: { marked_all: true } });
    assert.deepEqual(f.calls.at(-1), ['read-all']);
});

function preferenceFixture({ denied = false } = {}) {
    const calls = [];
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        zod: merchantRequire('zod'),
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async handle => {
            calls.push(['ownership', handle]);
            return denied ? { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) } : { storeId: 'owned-site' };
        } },
        '@/lib/api/client': {
            createMerchantApiClient: () => ({ notifications: { preferences: {
                list: async query => { calls.push(['list', query]); return [{ channel: 'email', category: 'orders', enabled: true }]; },
                update: async input => { calls.push(['update', input]); return { ...input, id: 'saved-preference' }; },
            } } }),
            merchantApiErrorResponse: () => Response.json({ error: { code: 'UPSTREAM_UNAVAILABLE' } }, { status: 503 }),
        },
    };
    const source = readFileSync(new URL('../src/app/api/stores/[store]/notifications/preferences/route.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { route: exports, calls };
}

test('notification preference route scopes reads and validated writes to the owned store', async () => {
    const f = preferenceFixture();
    const read = await f.route.GET({}, params);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await read.json(), { data: [{ channel: 'email', category: 'orders', enabled: true }] });
    const write = await f.route.PUT({ json: async () => ({ channel: 'email', category: 'orders', enabled: false }) }, params);
    assert.equal(write.status, 200);
    assert.equal(write.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await write.json(), { data: { store_id: 'owned-site', channel: 'email', category: 'orders', enabled: false, id: 'saved-preference' } });
    assert.deepEqual(f.calls, [
        ['ownership', 'owned-shop'], ['list', { store_id: 'owned-site' }],
        ['ownership', 'owned-shop'], ['update', { store_id: 'owned-site', channel: 'email', category: 'orders', enabled: false }],
    ]);
});

test('notification preference route rejects malformed writes before the gateway', async () => {
    for (const body of [
        { channel: 'email', category: 'orders', enabled: 'false' },
        { channel: 'unsafe-channel', category: 'orders', enabled: true },
        { channel: 'email', category: '   ', enabled: false },
        { channel: 'email', category: 'x'.repeat(121), enabled: false },
        { channel: 'email', category: 'orders', store_id: 'rival-site', enabled: false },
    ]) {
        const f = preferenceFixture();
        const result = await f.route.PUT({ json: async () => body }, params);
        assert.equal(result.status, 400, JSON.stringify(body));
        assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
    }
    const f = preferenceFixture();
    assert.equal((await f.route.PUT({ json: async () => { throw new SyntaxError('bad json'); } }, params)).status, 400);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
});

test('notification preference route denies a rival store before read or write', async () => {
    const f = preferenceFixture({ denied: true });
    assert.equal((await f.route.GET({}, params)).status, 403);
    assert.equal((await f.route.PUT({ json: async () => ({ channel: 'email', category: 'orders', enabled: false }) }, params)).status, 403);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop'], ['ownership', 'owned-shop']]);
});

function deliveryFixture({ denied = false } = {}) {
    const calls = [];
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        zod: merchantRequire('zod'),
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async handle => {
            calls.push(['ownership', handle]);
            return denied ? { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) } : { storeId: 'owned-site' };
        } },
        '@/lib/api/client': {
            createMerchantApiClient: () => ({ notifications: {
                deliveryLogs: async query => {
                    calls.push(['deliveryLogs', query]);
                    return { data: [{ id: 'log-1', status: 'queued' }], page: query.page, limit: query.limit, total: 1, has_more: false };
                },
            } }),
            merchantApiErrorResponse: () => Response.json({ error: { code: 'UPSTREAM_UNAVAILABLE' } }, { status: 503 }),
        },
    };
    const source = readFileSync(new URL('../src/app/api/stores/[store]/notifications/delivery-logs/route.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { route: exports, calls };
}

test('delivery-log route forwards bounded filters to the owned site and does not cache the response', async () => {
    const f = deliveryFixture();
    const response = await f.route.GET(request('/delivery-logs?page=2&limit=20&channel=whatsapp&status=queued'), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).meta, { page: 2, per_page: 20, total: 1, total_pages: 1, has_next: false, has_prev: true });
    assert.deepEqual(f.calls, [['ownership', 'owned-shop'], ['deliveryLogs', { site_id: 'owned-site', channel: 'whatsapp', status: 'queued', page: 2, limit: 20 }]]);
});

test('delivery-log route rejects malformed filters and rival ownership before a gateway read', async () => {
    for (const query of ['?page=NaN', '?page=0', '?page=1.5', '?page=', '?page=10001', '?limit=101', '?status=bounced', '?channel=bogus']) {
        const f = deliveryFixture();
        const response = await f.route.GET(request(`/delivery-logs${query}`), params);
        assert.equal(response.status, 400, query);
        assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
    }
    const f = deliveryFixture({ denied: true });
    assert.equal((await f.route.GET(request('/delivery-logs'), params)).status, 403);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
});
