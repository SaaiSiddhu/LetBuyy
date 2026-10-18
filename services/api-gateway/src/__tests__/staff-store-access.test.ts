// Phase 2 / F2.5 — three real, reproduced-live gaps in the merchant/staff convergence path, found by
// driving an actual browser journey (real login, real session, real UI) rather than a direct database
// query. All three run through the REAL tenant-guarded admin client on a fake PostgREST, the same
// harness as staff-paths-fail-closed.test.ts, so a query the tenant guard would refuse fails here as
// it would live.
//
// 1. GET /stores/handle/:handle (stores.ts) was owner-only: an active staff member's employees row was
//    never consulted, so merchant-web's [store]/layout.tsx -- the shell every /[store]/* page renders
//    inside -- 404'd for any staff member before any per-route permission check ever ran.
// 2. GET /products?store_id= (products.ts) was also owner-only (verifyStoreOwnership), so a staff
//    member who legitimately held a products:read/products:write grant still got 403 reading the
//    catalog they could otherwise write to.
// 3. PATCH and DELETE /employees/:id (employee.ts) verified ownership by looking the row up
//    `.eq('id', employeeId)` alone, with no store_id predicate -- employees is a registered tenant
//    table, so the tenant guard refused the query outright ("Tenant table employees requires a
//    tenant/owner predicate before execution"). This 500'd for the real store OWNER, not just staff:
//    the one supported way to revoke a staff member's access was broken end to end.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import storesRouter from '../routes/stores';
import productsRouter from '../routes/products';
import employeeRouter from '../routes/employee';

const POSTGREST = 'https://staff-store-access.fake-postgrest.test';
const SITE = '44444444-0000-4000-8000-0000000000a1';
const OTHER_SITE = '44444444-0000-4000-8000-0000000000a2';
const OWNER = '55555555-0000-4000-8000-0000000000b1';
const STAFF_READ = '55555555-0000-4000-8000-0000000000b2';
const STAFF_NO_GRANT = '55555555-0000-4000-8000-0000000000b3';
const STAFF_OTHER_SITE = '55555555-0000-4000-8000-0000000000b4';
const OUTSIDER = '55555555-0000-4000-8000-0000000000b5';
const EMPLOYEE_ROW = 'cccccccc-0000-4000-8000-0000000000d1';
const PRODUCT = 'cccccccc-0000-4000-8000-0000000000e1';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: 'internal-secret-for-staff-store-access-tests',
    } as unknown as Env;
}

// PostgREST quotes an .or()/.eq() value that might contain a comma or paren, e.g.
// `custom_user_id.eq."55555555-..."` (see stores.ts's ownedByCustomUserFilter). Real PostgREST
// unescapes that wrapper before comparing; this fake must too, or every quoted-value match fails.
function unquotePostgrestValue(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    return value;
}

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === unquotePostgrestValue(expression.slice(3));
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

function installFakePostgrest(tablesData: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    const requests: { method: string; table: string; query: string; body?: any }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        const requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ method, table, query: url.search, body: requestBody });
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

        // Only the transport reply is stubbed. Real ownership/effect/audit/receipt proof is in the owned DB suite.
        if (table === 'rpc/mutate_merchant_staff_v1') return json({ status: 200, data: { id: EMPLOYEE_ROW, deleted: true }, replayed: false });
        const rows = (tablesData[table] ?? []).filter((row) => matches(row, url.searchParams));
        if (method === 'PATCH') {
            const patch = JSON.parse(String(init?.body ?? '{}')) as Row;
            for (const row of rows) Object.assign(row, patch);
            const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
            if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
            return json(rows);
        }
        if (method !== 'GET' && method !== 'HEAD') return json([], 201);

        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
        return json(rows, 200);
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

function baseTables(): Record<string, Row[]> {
    return {
        sites: [
            { id: SITE, name: 'Site One', store_name: 'site-one', subdomain: 'site-one', site_type: 'store', status: 'active', custom_user_id: OWNER, user_id: null, trial_ends_at: null, trial_status: null, theme_id: 'modern', theme_settings: null, custom_domain: 'shop.example.test', custom_domain_status: 'pending', deleted_at: null },
            { id: OTHER_SITE, name: 'Site Two', store_name: 'site-two', subdomain: 'site-two', site_type: 'store', status: 'active', custom_user_id: OUTSIDER, user_id: null, trial_ends_at: null, trial_status: null, theme_id: 'modern', theme_settings: null, custom_domain: null, deleted_at: null },
        ],
        users_custom: [
            { id: OWNER, email: 'owner@shop.test', full_name: 'Owner' },
            { id: STAFF_READ, email: 'staff-read@shop.test', full_name: 'Staff Read' },
            { id: STAFF_NO_GRANT, email: 'staff-no-grant@shop.test', full_name: 'Staff No Grant' },
            { id: STAFF_OTHER_SITE, email: 'staff-other@shop.test', full_name: 'Staff Other Site' },
            { id: OUTSIDER, email: 'outsider@shop.test', full_name: 'Outsider' },
        ],
        employees: [
            { id: EMPLOYEE_ROW, store_id: SITE, user_id: STAFF_READ, email: 'staff-read@shop.test', role: 'manager', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:read', 'products:write'] } },
            { id: 'emp-no-grant', store_id: SITE, user_id: STAFF_NO_GRANT, email: 'staff-no-grant@shop.test', role: 'viewer', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: [] } },
            { id: 'emp-other-site', store_id: OTHER_SITE, user_id: STAFF_OTHER_SITE, email: 'staff-other@shop.test', role: 'manager', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:read', 'products:write'] } },
        ],
        products: [
            { id: PRODUCT, store_id: SITE, name: 'Test Product', price: 100, deleted_at: null },
        ],
    };
}

function appWithAuth(userId: string, router: typeof storesRouter, mountPath: string) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        c.set('auth', { user: { id: userId, email: `${userId}@shop.test`, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    api.route(mountPath, router);
    return api;
}

// ---------------------------------------------------------------------------------------------------
// 1. GET /stores/handle/:handle -- owner OR active staff resolves; a stranger, or staff at a
//    different site, does not.
// ---------------------------------------------------------------------------------------------------

test('GET /stores/handle/:handle resolves for the owner and for an active staff member, never for a stranger', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const owner = await appWithAuth(OWNER, storesRouter, '/stores').request('/stores/handle/site-one');
    assert.equal(owner.status, 200, 'owner resolves');
    assert.equal(((await owner.json()) as { data: { custom_domain_status: string } }).data.custom_domain_status, 'pending');

    const staff = await appWithAuth(STAFF_READ, storesRouter, '/stores').request('/stores/handle/site-one');
    assert.equal(staff.status, 200, 'an active staff member resolves the store they are staff at');
    const staffStore = (await staff.json()) as { data: { id: string; custom_domain_status: string } };
    assert.equal(staffStore.data.id, SITE);
    assert.equal(staffStore.data.custom_domain_status, 'pending');

    const strangerRes = await appWithAuth(OUTSIDER, storesRouter, '/stores').request('/stores/handle/site-one');
    assert.equal(strangerRes.status, 404, 'a user with no relationship to this site does not resolve it');

    const wrongSite = await appWithAuth(STAFF_OTHER_SITE, storesRouter, '/stores').request('/stores/handle/site-one');
    assert.equal(wrongSite.status, 404, 'staff at a DIFFERENT site does not resolve this one -- the fallback is site-scoped, not a blanket staff bypass');

    const siteSelects = fake.requests
        .filter((request) => request.table === 'sites')
        .map((request) => new URLSearchParams(request.query).get('select'));
    assert.ok(siteSelects.length > 0 && siteSelects.every((select) => select?.split(',').includes('custom_domain_status')),
        'both owner and staff resolution paths select the domain lifecycle status used by the merchant dashboard');
});

// ---------------------------------------------------------------------------------------------------
// 2. GET /products?store_id= -- owner or a staff member holding products:read/products:write can
//    list; a staff member with neither grant is refused.
// ---------------------------------------------------------------------------------------------------

test('GET /products?store_id= allows a products:read-granted staff member and refuses one with no grant', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const owner = await appWithAuth(OWNER, productsRouter, '/products').request(`/products?store_id=${SITE}`);
    assert.equal(owner.status, 200, 'owner is unaffected');

    const staffRead = await appWithAuth(STAFF_READ, productsRouter, '/products').request(`/products?store_id=${SITE}`);
    assert.equal(staffRead.status, 200, 'a staff member holding products:read can list the catalog');

    const staffNoGrant = await appWithAuth(STAFF_NO_GRANT, productsRouter, '/products').request(`/products?store_id=${SITE}`);
    assert.equal(staffNoGrant.status, 403, 'a staff member with no products:read/products:write grant is refused');

    const staffOtherSite = await appWithAuth(STAFF_OTHER_SITE, productsRouter, '/products').request(`/products?store_id=${SITE}`);
    assert.equal(staffOtherSite.status, 403, 'staff at a different site cannot list this one by naming its store_id');
});

// ---------------------------------------------------------------------------------------------------
// 2b. GET /products/:id -- the SAME owner-only gap, one layer deeper: this route bootstraps by the
//     product's own globally-unique id (products is a registered tenant table; `.eq('id', ...)`
//     alone is not a scope predicate, so this 500'd via the tenant guard for every caller before
//     this fix), then re-verifies via ownership OR staff permission -- never trusting the bootstrap
//     read as authorization by itself.
// ---------------------------------------------------------------------------------------------------

test('GET /products/:id: bootstraps without 500ing, then is denied to a staff member with no grant and to staff at another site', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const owner = await appWithAuth(OWNER, productsRouter, '/products').request(`/products/${PRODUCT}`);
    assert.equal(owner.status, 200, `owner should read the product, not be refused by the tenant guard: ${await owner.text()}`);

    const staffRead = await appWithAuth(STAFF_READ, productsRouter, '/products').request(`/products/${PRODUCT}`);
    assert.equal(staffRead.status, 200, 'a staff member holding products:read/products:write at this store can read it');

    const staffNoGrant = await appWithAuth(STAFF_NO_GRANT, productsRouter, '/products').request(`/products/${PRODUCT}`);
    assert.equal(staffNoGrant.status, 404, 'a staff member with no grant at this store gets the same not-found as a stranger, not a 500');

    const staffOtherSite = await appWithAuth(STAFF_OTHER_SITE, productsRouter, '/products').request(`/products/${PRODUCT}`);
    assert.equal(staffOtherSite.status, 404, 'staff holding the grant at a DIFFERENT site cannot read this product by knowing its id');

    const outsider = await appWithAuth(OUTSIDER, productsRouter, '/products').request(`/products/${PRODUCT}`);
    assert.equal(outsider.status, 404, 'a stranger with no relationship to this store cannot read it by guessing the id');
});

// ---------------------------------------------------------------------------------------------------
// 3. PATCH and DELETE /employees/:id -- the owner's mutation actually reaches the database (the
//    tenant guard does not refuse it), scoped by store_id; a non-owner is forbidden before any write.
// ---------------------------------------------------------------------------------------------------

test('DELETE /employees/:id: the owner\'s revoke reaches the database, scoped by store_id, not just employeeId', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const res = await appWithAuth(OWNER, employeeRouter, '/employees').request(`/employees/${EMPLOYEE_ROW}`, { method: 'DELETE', headers: { 'content-type': 'application/json', 'X-Idempotency-Key': 'synthetic-staff-remove' },
        body: JSON.stringify({ expected_updated_at: '2026-10-15T00:00:00Z' }) });
    const body = await res.text();
    assert.equal(res.status, 200, `owner delete should reach the database, not be refused by the tenant guard: ${body}`);

    const mutation = fake.requests.find((r) => r.table === 'rpc/mutate_merchant_staff_v1');
    assert.ok(mutation, 'the removal reaches the atomic lifecycle RPC');
    assert.equal(mutation.body.p_store_id,SITE);
    assert.equal(mutation.body.p_employee_id,EMPLOYEE_ROW);
    assert.equal(mutation.body.p_operation,'remove');
});

test('DELETE /employees/:id: a non-owner is forbidden before any write is attempted', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const res = await appWithAuth(STAFF_READ, employeeRouter, '/employees').request(`/employees/${EMPLOYEE_ROW}`, { method: 'DELETE', headers: { 'content-type': 'application/json', 'X-Idempotency-Key': 'synthetic-staff-remove' },
        body: JSON.stringify({ expected_updated_at: '2026-10-15T00:00:00Z' }) });
    assert.equal(res.status, 403);
    assert.ok(!fake.requests.some((r) => r.table === 'rpc/mutate_merchant_staff_v1' || (r.method === 'PATCH' && r.table === 'employees')), 'no mutation is attempted for a refused caller');
});

test('PATCH /employees/:id: the owner\'s role update reaches the database, scoped by store_id', async (t) => {
    const fake = installFakePostgrest(baseTables());
    t.after(fake.restore);

    const res = await appWithAuth(OWNER, employeeRouter, '/employees').request(`/employees/${EMPLOYEE_ROW}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'X-Idempotency-Key': 'synthetic-staff-update' },
        body: JSON.stringify({ role: 'viewer', expected_updated_at: '2026-10-15T00:00:00Z' }),
    });
    const body = await res.text();
    assert.equal(res.status, 200, `owner update should reach the database, not be refused by the tenant guard: ${body}`);

    const mutation = fake.requests.find((r) => r.table === 'rpc/mutate_merchant_staff_v1');
    assert.ok(mutation, 'the update reaches the atomic lifecycle RPC');
    assert.equal(mutation.body.p_store_id,SITE);
    assert.equal(mutation.body.p_employee_id,EMPLOYEE_ROW);
    assert.equal(mutation.body.p_operation,'update');
});
