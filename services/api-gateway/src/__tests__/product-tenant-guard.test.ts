// APPID-FIX2 — product edit and delete by id: the tenant query guard is satisfied by an exact
// store predicate, not weakened, and a store never sees or mutates another store's product.
//
// Before this phase, `getOwnedProduct` (execution/product-execution.adapter.ts), and the writes and
// refresh-selects that followed it in `updateProduct`/`softDelete`, looked a product up by
// `.eq('id', productId)` alone. The tenant query guard (`createTenantGuardedSupabaseClient`) refuses
// ANY query against a tenant-registered table (`products`: scope columns `site_id`/`store_id`) that
// never references one of its registered scope columns — so `PATCH`/`DELETE /v1/products/:id` 500'd
// even after the staff check (APPID-P5b's `ownedProductStoreId`, which already used the correct
// scoped shape) had already resolved and cleared the product's real store. CLOUD_HANDOFF.md §8 and
// `docs/evidence/appid-2026-09-24/P5B_STAFF_PATHS.md` "Found, not fixed here" record the defect.
//
// Everything below except the negative control runs the production code against a fake PostgREST on
// globalThis.fetch, through the REAL tenant-guarded admin client and the REAL products router, so a
// query the guard would refuse fails here as it would live, and every filter the gateway sends is
// applied to the rows as PostgREST would apply it (eq, in, is) — same harness as
// __tests__/staff-paths-fail-closed.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../index';
import { AppError, formatAppError } from '../lib/errors';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';
import productsRouter from '../routes/products';

const POSTGREST = 'https://product-tenant-guard.fake-postgrest.test';
const SITE_A = '44444444-0000-4000-8000-0000000000a1';
const SITE_B = '44444444-0000-4000-8000-0000000000a2';
const OWNER_A = '55555555-0000-4000-8000-0000000000b1';
const OWNER_B = '55555555-0000-4000-8000-0000000000b2';
const PRODUCT_A = '66666666-0000-4000-8000-0000000000c1';
const PRODUCT_A2 = '66666666-0000-4000-8000-0000000000c2';
// D03 permission equivalence follow-up (2026-09-28): a real, non-owner staff member at SITE_A, one
// permitted (products:write) and one not (products:read only) -- see section 5, below.
const STAFF_FULL = '77777777-0000-4000-8000-0000000000d1';
const STAFF_READONLY = '77777777-0000-4000-8000-0000000000d2';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    } as unknown as Env;
}

// PostgREST's filter grammar, for the operators the gateway sends here.
function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(value));
    if (expression === 'is.null') return value === null || value === undefined;
    throw new Error(`fake PostgREST does not model "${expression}"`);
}

function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'order', 'offset', 'columns'].includes(column)) continue;
        if (column === 'or') {
            const alternatives = expression.slice(1, -1).split(',');
            if (!alternatives.some((alt) => {
                const [col, ...rest] = alt.split('.');
                return test1(row[col], rest.join('.'));
            })) return false;
            continue;
        }
        if (!test1(row[column], expression)) return false;
    }
    return true;
}

function installFakePostgrest(tables: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    const requests: { method: string; table: string; query: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        requests.push({ method, table, query: url.search });
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (method === 'POST' && !url.pathname.startsWith('/rest/v1/rpc/')) {
            // A real insert (e.g. createProduct's `.insert(...).select().single()`), not an RPC call:
            // give the row an id if the caller didn't, store it, and return it in whichever shape the
            // caller asked for (single() vs a bare array) -- needed once a real create path (D03
            // permission equivalence follow-up, section 5) started exercising POST through this fake,
            // not just PATCH/DELETE. Deliberately does NOT compute `rows`/call `matches()` below (an
            // insert has nothing to filter by) -- an insert's query string can carry params like
            // `on_conflict=...` that `matches()` cannot interpret as a row filter, and once this branch
            // starts a table with real rows in it (e.g. the outbox/events table, after the first of
            // several emitProductEvent calls in one test), a later insert's own `rows` computation would
            // wrongly try to filter those rows by that same param and throw.
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            const inserted = Array.isArray(body) ? body : [body];
            const withIds = inserted.map((row) => ({ id: row.id ?? crypto.randomUUID(), deleted_at: null, ...row }));
            (tables[table] ?? (tables[table] = [])).push(...withIds);
            return single ? json(withIds[0]) : json(withIds, 201);
        }
        const rows = (tables[table] ?? []).filter((row) => matches(row, url.searchParams));
        if (method === 'PATCH') {
            const patch = JSON.parse(String(init?.body ?? '{}')) as Row;
            for (const row of rows) Object.assign(row, patch);
        } else if (method !== 'GET' && method !== 'HEAD') {
            return json([], 201);
        }
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
        return json(rows);
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

function freshTables(): { sites: Row[]; products: Row[]; users_custom: Row[]; employees: Row[] } {
    return {
        sites: [
            { id: SITE_A, custom_user_id: OWNER_A, user_id: null, deleted_at: null },
            { id: SITE_B, custom_user_id: OWNER_B, user_id: null, deleted_at: null },
        ],
        products: [
            { id: PRODUCT_A, store_id: SITE_A, name: 'Original Name', price: 999, is_active: true, deleted_at: null, variants: [] },
            { id: PRODUCT_A2, store_id: SITE_A, name: 'Second Product', price: 499, is_active: true, deleted_at: null, variants: [] },
        ],
        users_custom: [
            { id: OWNER_A, email: `${OWNER_A}@shop.test`, full_name: 'Owner A' },
            { id: OWNER_B, email: `${OWNER_B}@shop.test`, full_name: 'Owner B' },
            { id: STAFF_FULL, email: `${STAFF_FULL}@shop.test`, full_name: 'Staff Full' },
            { id: STAFF_READONLY, email: `${STAFF_READONLY}@shop.test`, full_name: 'Staff Readonly' },
        ],
        // Real legacy staff-permission.ts grants (employees.permissions.granted), the same shape
        // staff-permission-shadow.test.ts uses -- not shadow/target data, since STAFF_PERMISSION_SHADOW
        // is unset here (shadow mode off) and these tests exercise only the real, authoritative decision.
        employees: [
            { store_id: SITE_A, user_id: STAFF_FULL, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:read', 'products:write'] }, role: 'manager' },
            { store_id: SITE_A, user_id: STAFF_READONLY, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:read'] }, role: 'viewer' },
        ],
    };
}

// A merchant session as merchant web sends it: a user, and no store of its own — the exact shape
// that made the staff check resolve the product's store through `ownedProductStoreId` (APPID-P5b).
function productGateway(userId: string) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        c.set('auth', { user: { id: userId, email: `${userId}@shop.test`, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    // Mirrors index.ts' global error handler (lib/errors.ts AppError -> status), so NotFoundError/
    // ForbiddenError surface as 404/403 here exactly as they would through the real gateway, instead
    // of the bare Hono default of 500 for any uncaught throw.
    api.onError((err, c) => {
        if (err instanceof AppError) {
            const { body, status } = formatAppError(err);
            return c.json(body, status as never);
        }
        return c.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'error' } }, 500);
    });
    api.route('/products', productsRouter);
    return api;
}

// ---------------------------------------------------------------------------------------------------
// 1. Success: the owner of store A edits and deletes A's own product through the real router,
//    adapter and guarded client.
// ---------------------------------------------------------------------------------------------------

test('an authorized owner edit fails closed without its SQL transaction, while scoped deletion succeeds', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);

    const patchRes = await productGateway(OWNER_A).request(`/products/${PRODUCT_A}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, idempotency_key: crypto.randomUUID(), name: 'Renamed by Owner A' }),
    });
    const patchText = await patchRes.text();
    assert.equal(patchRes.status, 503, patchText);
    assert.equal(JSON.parse(patchText).error.code, 'PRODUCT_EDIT_UNAVAILABLE');
    assert.equal(tables.products[0].name, 'Original Name', 'a missing SQL transaction cannot fall back to a REST write');
    // Real owner/staff edits, receipts and rollback are exercised by product-atomic-edits.postgres.test.ts.
    assert.equal(tables.products[0].deleted_at, null);

    const deleteRes = await productGateway(OWNER_A).request(`/products/${PRODUCT_A}`, { method: 'DELETE' });
    const deleteText = await deleteRes.text();
    assert.equal(deleteRes.status, 200, deleteText);
    const deleteBody = JSON.parse(deleteText) as { data: { deleted: boolean; product_id: string } };
    assert.equal(deleteBody.data.deleted, true);
    assert.equal(deleteBody.data.product_id, PRODUCT_A);
    assert.ok(tables.products[0].deleted_at, 'the row carries a deletion timestamp: it is gone, not merely reported gone');
    assert.equal(tables.products[0].is_active, false);

    // Every write the adapter sent for this product carried the store predicate the guard requires.
    const productWrites = fake.requests.filter((r) => r.table === 'products' && r.method === 'PATCH');
    assert.equal(productWrites.length, 1, 'only deletion uses a REST write; edits require the tenant SQL transaction');
    for (const write of productWrites) {
        assert.match(write.query, /store_id=/, `every product write is store-scoped: ${write.query}`);
    }
});

// ---------------------------------------------------------------------------------------------------
// 2. Cross-tenant denial: the owner of store B, who owns no product here, gets 403/404 and mutates
//    nothing of A's.
// ---------------------------------------------------------------------------------------------------

test("cross-tenant denial: the owner of store B is refused for store A's product, which is left byte-identical, and no write for it ever reaches PostgREST", async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);
    const before = JSON.parse(JSON.stringify(tables.products[0])) as Row;

    for (const [method, init] of [
        ['PATCH', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, idempotency_key: crypto.randomUUID(), name: 'Hijacked by Owner B' }) }],
        ['DELETE', { method: 'DELETE' }],
    ] as const) {
        const res = await productGateway(OWNER_B).request(`/products/${PRODUCT_A}`, init);
        const body = await res.text();
        assert.ok([403, 404].includes(res.status), `${method}: expected 403 or 404, got ${res.status}: ${body}`);
        assert.deepEqual(tables.products[0], before, `${method}: store A's product must be byte-identical after a cross-tenant attempt`);
    }

    assert.ok(
        !fake.requests.some((r) => r.table === 'products' && r.method === 'PATCH'),
        'zero mutating requests against products were ever sent for a caller who owns none of them',
    );
});

// ---------------------------------------------------------------------------------------------------
// 3. Negative control: the exact pre-fix shape (an id predicate alone) is refused by the tenant
//    guard itself, independent of the adapter's own application logic — so if a future change drops
//    the store predicate again, the guard catches it, not a passing test.
// ---------------------------------------------------------------------------------------------------

test('negative control: a products lookup by id alone (the pre-APPID-FIX2 shape) is refused by the tenant guard; the scoped shape is not', async () => {
    const raw = createSupabaseServiceClient({
        SUPABASE_URL: 'https://negative-control.invalid.test',
        SUPABASE_SERVICE_ROLE_KEY: 'unused',
    } as never);
    const guarded = createTenantGuardedSupabaseClient(raw as never);

    // getOwnedProduct's shape before this phase: `.eq('id', productId).is('deleted_at', null)`, no
    // site_id/store_id predicate anywhere in the chain.
    await assert.rejects(
        Promise.resolve(guarded.from('products').select('id, store_id, price').eq('id', PRODUCT_A).is('deleted_at', null).maybeSingle()),
        /Tenant table products requires a tenant\/owner predicate before execution/,
        'an unscoped id-only lookup must still be refused -- this is the exact regression APPID-FIX2 fixed; ' +
        'if a future change drops the store predicate again, THIS is what stops it, not application logic',
    );

    // The fixed shape (`.in('store_id', ownedStoreIds)` alongside `.eq('id', productId)`) must clear
    // the guard's own scoping check. The fetch itself then fails against the unreachable fake host,
    // which is a network error, never the guard's synchronous rejection -- proving the guard was not
    // weakened to let the unscoped shape through too.
    try {
        await guarded.from('products').select('id, store_id, price').eq('id', PRODUCT_A).in('store_id', [SITE_A]).is('deleted_at', null).maybeSingle();
    } catch (err) {
        assert.ok(
            !/Tenant table/.test((err as Error).message),
            `a store-scoped lookup must not be refused by the guard: ${(err as Error).message}`,
        );
    }
});

// ---------------------------------------------------------------------------------------------------
// 4. `POST /products/bulk` (execution/product-execution.adapter.ts `bulkAction`) has the same defect
//    class: the ownership-check select and the write it drove were both `.in('id', productIds)`
//    alone, no store predicate. Found while auditing the adapter for every unscoped `products` query,
//    not named in CLOUD_HANDOFF.md's own acceptance list; fixed alongside the id-lookup paths since
//    it is the same file, the same guard, and the same shape of bug.
// ---------------------------------------------------------------------------------------------------

test('bulk deactivate: the owner of store A affects both of A\'s own products, scoped writes only', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);

    const res = await productGateway(OWNER_A).request('/products/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: SITE_A, product_ids: [PRODUCT_A, PRODUCT_A2], action: 'deactivate' }),
    });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text) as { success: boolean; data: { affected: number } };
    assert.equal(body.data.affected, 2);
    assert.equal(tables.products[0].is_active, false);
    assert.equal(tables.products[1].is_active, false);

    const writes = fake.requests.filter((r) => r.table === 'products' && r.method === 'PATCH');
    assert.ok(writes.length > 0);
    for (const write of writes) {
        assert.match(write.query, /store_id=/, `every bulk write is store-scoped: ${write.query}`);
    }
});

test("bulk deactivate: the owner of store B naming store A's product gets a denial and A's products are untouched", async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);
    const before = JSON.parse(JSON.stringify(tables.products)) as Row[];

    const res = await productGateway(OWNER_B).request('/products/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: SITE_B, product_ids: [PRODUCT_A], action: 'deactivate' }),
    });
    const text = await res.text();
    assert.ok([403, 404].includes(res.status), `expected 403 or 404, got ${res.status}: ${text}`);
    assert.deepEqual(tables.products, before, "store A's products must be byte-identical after a cross-tenant bulk attempt");
    assert.ok(!fake.requests.some((r) => r.table === 'products' && r.method === 'PATCH'), 'zero mutating requests reached products');
});

// ---------------------------------------------------------------------------------------------------
// 5. D03 permission equivalence follow-up (2026-09-28): a real, non-owner staff member can now
//    actually create/update/delete a product they have real products:write grant for -- PATCH/DELETE
//    used to resolve the product's store through an OWNER-ONLY lookup (ownedProductStoreId) that threw
//    before assertStaffPermission ever ran, and createProduct's own internal assertStoreOwnership ran
//    a SECOND, stricter owner-only check AFTER the route's assertStaffPermission had already correctly
//    allowed a permitted staff member through -- meaning no staff member, however permissioned, could
//    ever complete a product mutation. Discovered building
//    real-http-shadow-rehearsal.postgres.test.ts; fixed here. A staff member with only products:read
//    must still be denied all three, exactly as before.
// ---------------------------------------------------------------------------------------------------

test('permitted staff reach the required product transaction and cannot fall back to REST when SQL is unavailable', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);

    const res = await productGateway(STAFF_FULL).request(`/products/${PRODUCT_A}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, idempotency_key: crypto.randomUUID(), name: 'Renamed by permitted staff' }),
    });
    const text = await res.text();
    assert.equal(res.status, 503, text);
    assert.equal(JSON.parse(text).error.code, 'PRODUCT_EDIT_UNAVAILABLE');
    assert.equal(tables.products[0].name, 'Original Name', 'unavailable SQL must not mutate through REST');
});

test('a permitted staff member (products:write, not the owner) can DELETE a product', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);

    const res = await productGateway(STAFF_FULL).request(`/products/${PRODUCT_A}`, { method: 'DELETE' });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    assert.ok(tables.products[0].deleted_at, 'the row carries a deletion timestamp');
    assert.equal(tables.products[0].is_active, false);
});

test('a permitted staff member (products:write, not the owner) can POST a new product', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);

    const res = await productGateway(STAFF_FULL).request('/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: SITE_A, name: 'Created by permitted staff', price: 199 }),
    });
    const text = await res.text();
    assert.equal(res.status, 201, text);
    const body = JSON.parse(text) as { data: { name: string; store_id: string } };
    assert.equal(body.data.name, 'Created by permitted staff');
    assert.equal(body.data.store_id, SITE_A);
});

test('a staff member with only products:read is still denied PATCH, DELETE, and POST -- this fix never over-corrects', async (t) => {
    const tables = freshTables();
    const fake = installFakePostgrest(tables);
    t.after(fake.restore);
    const before = JSON.parse(JSON.stringify(tables.products)) as Row[];

    const patchRes = await productGateway(STAFF_READONLY).request(`/products/${PRODUCT_A}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, idempotency_key: crypto.randomUUID(), name: 'Should never apply' }),
    });
    assert.equal(patchRes.status, 403, await patchRes.clone().text());

    const deleteRes = await productGateway(STAFF_READONLY).request(`/products/${PRODUCT_A}`, { method: 'DELETE' });
    assert.equal(deleteRes.status, 403, await deleteRes.clone().text());

    const createRes = await productGateway(STAFF_READONLY).request('/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: SITE_A, name: 'Should never be created', price: 1 }),
    });
    assert.equal(createRes.status, 403, await createRes.clone().text());

    assert.deepEqual(tables.products, before, 'a read-only staff member must never change or add a product');
    assert.ok(!fake.requests.some((r) => r.table === 'products' && r.method === 'PATCH'), 'zero mutating requests reached products');
});
