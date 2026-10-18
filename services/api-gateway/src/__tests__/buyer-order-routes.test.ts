// SUSTAINED-D3 — GET /buyer/orders, the marketplace realm's cross-store order list.
//
// Two layers, proven separately and both for real:
// 1. The ROUTE (registerBuyerOrderRoutes): auth, that the buyer id comes from the verified token
//    and never a request parameter, and the response/pagination shape -- through a real signed
//    buyer-session JWT, the same harness buyer-return-routes.test.ts established.
// 2. The QUERY (listBuyerOrdersFromDatabase, the same function production wiring calls): the
//    ownership walk and the tenant-guard shape, through a fake PostgREST on globalThis.fetch and
//    the REAL tenant-guarded admin client -- the same technique product-tenant-guard.test.ts uses.
//    buyer_order_links is the only ownership source; a query the guard would refuse fails here
//    exactly as it would live.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../index';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';
import { installBuyerSessionState } from './buyer-session-state-fake';
import {
    registerBuyerOrderRoutes,
    listBuyerOrdersFromDatabase,
    type BuyerOrderSummaryRow,
} from '../routes/storefront/buyer-order-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const BUYER_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function buyerToken(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
}

const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

// ---------------------------------------------------------------------------------------------------
// 1. The route: auth, the buyer id comes from the token, response/pagination shape.
// ---------------------------------------------------------------------------------------------------

function routeHarness(rows: BuyerOrderSummaryRow[] = [], hasMore = false) {
    const calls: { buyerAccountId: string; limit: number; before: unknown }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerOrderRoutes(router, {
        loadBuyerOrderDetail: async () => ({ data: null, error: null }),
        listBuyerOrders: async (_c, buyerAccountId, input) => {
            calls.push({ buyerAccountId, limit: input.limit, before: input.before });
            return { data: rows, error: null, hasMore };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}

function getOrders(h: ReturnType<typeof routeHarness>, jwks: string, tok: string | null, query = '') {
    return h.app.request(
        `/storefront/buyer/orders${query}`,
        { headers: tok ? { 'X-LetBuyy-Buyer-Session': tok } : {} },
        env(jwks),
    );
}

test('the route refuses without a buyer session', async () => {
    const { jwks } = await keys();
    const h = routeHarness();
    const res = await getOrders(h, jwks, null);
    assert.equal(res.status, 401);
    assert.equal(h.calls.length, 0);
});

test('the buyer id comes from the TOKEN, never a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = routeHarness();
    await getOrders(h, jwks, await buyerToken(privateKey, BUYER_A), `?buyer_account_id=${BUYER_B}`);
    assert.equal(h.calls[0].buyerAccountId, BUYER_A);
    assert.notEqual(h.calls[0].buyerAccountId, BUYER_B);
});

test('a MERCHANT token cannot read the buyer order list', async () => {
    const { privateKey, jwks } = await keys();
    const h = routeHarness();
    const now = Math.floor(Date.now() / 1000);
    const merchant = await new SignJWT({ realm: 'merchant', token_use: 'merchant_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:merchant-session').setSubject(BUYER_A)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
    assert.equal((await getOrders(h, jwks, merchant)).status, 401);
    assert.equal(h.calls.length, 0);
});

test('limit is bounded to 50 and defaults to 20; an invalid limit falls back to the default', async () => {
    const { privateKey, jwks } = await keys();
    const tok = await buyerToken(privateKey, BUYER_A);
    assert.equal((await getOrders(routeHarness(), jwks, tok)).status, 200);
    const h1 = routeHarness(); await getOrders(h1, jwks, tok); assert.equal(h1.calls[0].limit, 20);
    const h2 = routeHarness(); await getOrders(h2, jwks, tok, '?limit=200'); assert.equal(h2.calls[0].limit, 50);
    const h3 = routeHarness(); await getOrders(h3, jwks, tok, '?limit=not-a-number'); assert.equal(h3.calls[0].limit, 20);
});

test('the response carries orders, next_cursor and has_more; a further page is fetchable by cursor', async () => {
    const { privateKey, jwks } = await keys();
    const tok = await buyerToken(privateKey, BUYER_A);
    const row: BuyerOrderSummaryRow = {
        id: ORDER_A1, linked_at: '2026-09-24T10:00:00.000Z', site_id: 'site-a',
        store_name: 'Snaz', order_number: '1001', status: 'paid', total: 500, currency: 'INR',
        created_at: '2026-09-24T09:00:00.000Z',
    };
    const h = routeHarness([row], true);
    const res = await getOrders(h, jwks, tok);
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { orders: BuyerOrderSummaryRow[]; next_cursor: string | null; has_more: boolean } };
    assert.equal(body.data.orders.length, 1);
    assert.equal(body.data.orders[0].store_name, 'Snaz');
    assert.equal(body.data.has_more, true);
    assert.ok(body.data.next_cursor, 'a further page exists, so a cursor must be issued');

    const h2 = routeHarness([], false);
    await getOrders(h2, jwks, tok, `?cursor=${encodeURIComponent(body.data.next_cursor!)}`);
    assert.equal(h2.calls[0].before, row.linked_at, 'the cursor must decode back to the row it was minted from');
});

// ---------------------------------------------------------------------------------------------------
// 2. The query: buyer_order_links-only ownership, the tenant guard, cross-buyer isolation.
// ---------------------------------------------------------------------------------------------------

const POSTGREST = 'https://buyer-order-routes.fake-postgrest.test';
const SITE_A = '44444444-0000-4000-8000-0000000000a1';
const SITE_B = '44444444-0000-4000-8000-0000000000a2';
const ORDER_A1 = '66666666-0000-4000-8000-0000000000c1';
const ORDER_A2 = '66666666-0000-4000-8000-0000000000c2';
const ORDER_B1 = '66666666-0000-4000-8000-0000000000c3';

type Row = Record<string, unknown>;

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(value));
    if (expression.startsWith('lt.')) return value !== null && value !== undefined && String(value) < expression.slice(3);
    throw new Error(`fake PostgREST does not model "${expression}"`);
}

function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'order', 'offset'].includes(column)) continue;
        if (!test1(row[column], expression)) return false;
    }
    return true;
}

function installFakePostgrest(tables: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    const requests: { method: string; table: string; query: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const table = url.pathname.replace('/rest/v1/', '');
        requests.push({ method: 'GET', table, query: url.search });
        let rows = (tables[table] ?? []).filter((row) => matches(row, url.searchParams));
        const order = url.searchParams.get('order');
        if (order) {
            for (const clause of order.split(',').reverse()) {
                const [col, dir] = clause.split('.');
                rows = [...rows].sort((a, b) => {
                    const av = String(a[col] ?? ''); const bv = String(b[col] ?? '');
                    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                    return dir === 'desc' ? -cmp : cmp;
                });
            }
        }
        const limit = url.searchParams.get('limit');
        if (limit) rows = rows.slice(0, Number(limit));
        return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

function guardedClient() {
    const raw = createSupabaseServiceClient({ SUPABASE_URL: POSTGREST, SUPABASE_SERVICE_ROLE_KEY: 'test' } as never);
    return createTenantGuardedSupabaseClient(raw as never);
}

function tables(): Record<string, Row[]> {
    return {
        buyer_order_links: [
            { order_id: ORDER_A1, buyer_account_id: BUYER_A, site_id: SITE_A, linked_at: '2026-09-24T12:00:00.000Z' },
            { order_id: ORDER_A2, buyer_account_id: BUYER_A, site_id: SITE_B, linked_at: '2026-09-23T12:00:00.000Z' },
            { order_id: ORDER_B1, buyer_account_id: BUYER_B, site_id: SITE_A, linked_at: '2026-09-24T13:00:00.000Z' },
        ],
        orders: [
            { id: ORDER_A1, site_id: SITE_A, order_number: '1001', status: 'paid', total: 500, currency: 'INR', created_at: '2026-09-24T11:00:00.000Z' },
            { id: ORDER_A2, site_id: SITE_B, order_number: '2001', status: 'paid', total: 900, currency: 'INR', created_at: '2026-09-23T11:00:00.000Z' },
            { id: ORDER_B1, site_id: SITE_A, order_number: '1002', status: 'paid', total: 300, currency: 'INR', created_at: '2026-09-24T12:00:00.000Z' },
        ],
        sites: [
            { id: SITE_A, store_name: 'Snaz' },
            { id: SITE_B, store_name: 'Urban Kicks' },
        ],
    };
}

test('a buyer with links at two different stores sees both orders, correctly attributed', async () => {
    const fake = installFakePostgrest(tables());
    try {
        const { data, error, hasMore } = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 20 });
        assert.equal(error, null);
        assert.equal(hasMore, false);
        assert.equal(data?.length, 2);
        assert.deepEqual(data?.map((o) => o.store_name).sort(), ['Snaz', 'Urban Kicks']);
        assert.ok(data?.every((o) => [ORDER_A1, ORDER_A2].includes(o.id)));
    } finally {
        fake.restore();
    }
});

test("cross-buyer isolation: buyer B's own order never appears in buyer A's list, and vice versa", async () => {
    const fake = installFakePostgrest(tables());
    try {
        const forA = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 20 });
        assert.ok(!forA.data?.some((o) => o.id === ORDER_B1), "buyer A's list must never include buyer B's order");

        const forB = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_B, { limit: 20 });
        assert.equal(forB.data?.length, 1);
        assert.equal(forB.data?.[0].id, ORDER_B1);
        assert.ok(!forB.data?.some((o) => [ORDER_A1, ORDER_A2].includes(o.id)), "buyer B's list must never include buyer A's orders");
    } finally {
        fake.restore();
    }
});

test('a buyer with no links gets an empty list, not an error, and no orders/sites read is even attempted', async () => {
    const fake = installFakePostgrest({ buyer_order_links: [], orders: [], sites: [] });
    try {
        const { data, error } = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 20 });
        assert.equal(error, null);
        assert.deepEqual(data, []);
        assert.ok(!fake.requests.some((r) => r.table === 'orders' || r.table === 'sites'));
    } finally {
        fake.restore();
    }
});

test('every orders/sites read the query sends is tenant-guard-scoped: site_id/id predicates, never id alone', async () => {
    const fake = installFakePostgrest(tables());
    try {
        await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 20 });
        const ordersReads = fake.requests.filter((r) => r.table === 'orders');
        assert.ok(ordersReads.length > 0);
        for (const read of ordersReads) assert.match(read.query, /site_id=/, `orders read must carry site_id: ${read.query}`);

        const sitesReads = fake.requests.filter((r) => r.table === 'sites');
        assert.ok(sitesReads.length > 0);
        for (const read of sitesReads) assert.match(read.query, /id=in\.|id=eq\./, `sites read must carry id: ${read.query}`);
    } finally {
        fake.restore();
    }
});

test('pagination: a cursor (before=linked_at) excludes the already-seen page and hasMore reflects a further page', async () => {
    const fake = installFakePostgrest(tables());
    try {
        const first = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 1 });
        assert.equal(first.data?.length, 1);
        assert.equal(first.hasMore, true);
        assert.equal(first.data?.[0].id, ORDER_A1, 'the newest link (linked_at desc) comes first');

        const second = await listBuyerOrdersFromDatabase(guardedClient(), BUYER_A, { limit: 1, before: first.data![0].linked_at });
        assert.equal(second.data?.length, 1);
        assert.equal(second.data?.[0].id, ORDER_A2);
        assert.equal(second.hasMore, false);
    } finally {
        fake.restore();
    }
});

test('negative control: a products-style unscoped orders read (id alone) is refused by the guard -- proves the guard, not application logic, backstops this route', async () => {
    await assert.rejects(
        Promise.resolve(guardedClient().from('orders').select('id, order_number').eq('id', ORDER_A1)),
        /Tenant table orders requires a tenant\/owner predicate before execution/,
    );
});
