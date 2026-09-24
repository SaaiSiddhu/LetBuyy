// APPID-P5b — staff paths fail closed, and a merchant's staff never hold platform operator scopes.
//
// Everything here runs the production code against a fake PostgREST on globalThis.fetch, through the
// REAL tenant-guarded admin client, so a query the guard would refuse fails here as it would live, and
// every filter the gateway sends is applied to the rows as PostgREST would apply it (eq, in, is, or).
//
// 1. The merchant staff check (middleware/staff-permission.ts): the store owner passes; anyone else
//    needs an ACTIVE staff row AT THIS STORE (employees.store_id, the column that exists) holding the key;
//    a missing store or user, a session bound to another store, or a failed lookup is refused.
// 2. The platform RBAC (middleware/rbac.ts): a store's staff row, whatever its role or permissions JSON,
//    confers no platform scope; only a row with no store, or the super admin allowlist, does. Probed
//    through the real authMiddleware and requirePermission on an operator route.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { createLetbuyyInternalIdentityHeaders } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { assertStaffPermission, type StaffPermissionKey } from '../middleware/staff-permission';
import { loadEffectivePermissionScopes } from '../middleware/rbac';
import { getSupabaseAdminFromEnv } from '../lib/supabase';
import operationsMarketplaceListingsRouter from '../routes/operations/marketplace-listings';

const POSTGREST = 'https://staff-paths.fake-postgrest.test';
const INTERNAL_SECRET = 'internal-secret-for-staff-path-tests';
const SITE = '11111111-0000-4000-8000-0000000000a1';
const OTHER_SITE = '11111111-0000-4000-8000-0000000000a2';
const OWNER = '22222222-0000-4000-8000-0000000000b1';
const STAFF = '22222222-0000-4000-8000-0000000000b2';
const STAFF_ELSEWHERE = '22222222-0000-4000-8000-0000000000b3';
const STORE_ADMIN = '22222222-0000-4000-8000-0000000000b4';
const PLATFORM_LEAD = '22222222-0000-4000-8000-0000000000b5';
const SUPER_ADMIN = '22222222-0000-4000-8000-0000000000b6';

type Row = Record<string, unknown>;

function env(extra: Record<string, unknown> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        ...extra,
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

function installFakePostgrest(tables: Record<string, Row[]>, failing: Set<string> = new Set()) {
    const originalFetch = globalThis.fetch;
    const requests: { method: string; table: string; query: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        requests.push({ method, table, query: url.search });
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        if (failing.has(table)) return json({ code: 'XX000', message: 'database unavailable' }, 500);

        const rows = (tables[table] ?? []).filter((row) => matches(row, url.searchParams));
        if (method === 'PATCH') {
            const patch = JSON.parse(String(init?.body ?? '{}')) as Row;
            for (const row of rows) Object.assign(row, patch);
        } else if (method !== 'GET' && method !== 'HEAD') {
            return json([], 201);
        }
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
        return json(rows);
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

function tables(): Record<string, Row[]> {
    return {
        sites: [
            { id: SITE, custom_user_id: OWNER, user_id: null, deleted_at: null },
            { id: OTHER_SITE, custom_user_id: STAFF_ELSEWHERE, user_id: null, deleted_at: null },
        ],
        employees: [
            // A store's staff, as the merchant app writes them.
            { id: 'emp-staff', store_id: SITE, user_id: STAFF, email: 'staff@shop.test', role: 'editor', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:write'] } },
            { id: 'emp-elsewhere', store_id: OTHER_SITE, user_id: STAFF_ELSEWHERE, email: 'elsewhere@shop.test', role: 'manager', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['orders:write'] } },
            // A store's "admin", with platform scopes written into its permissions JSON.
            { id: 'emp-store-admin', store_id: SITE, user_id: STORE_ADMIN, email: 'admin@shop.test', role: 'admin', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: { granted: ['products:write'], scopes: ['review:view', 'review:decide', 'rbac:manage'] } },
            // The platform's own staff: no store.
            { id: 'emp-platform-lead', store_id: null, user_id: PLATFORM_LEAD, email: 'lead@letbuyy.test', role: 'operations', role_id: null, status: 'active', is_active: true, deleted_at: null, permissions: {} },
        ],
        super_admin_allowlist: [{ id: 'sa-1', user_id: SUPER_ADMIN, email: 'root@letbuyy.test', is_active: true }],
        employee_permissions: [],
        employee_roles: [],
        break_glass_grants: [],
    };
}

// ---------------------------------------------------------------------------------------------------
// 1. The merchant staff check
// ---------------------------------------------------------------------------------------------------

function staffApp(e: Env = env(), sessionStoreId?: string) {
    const app = new Hono<{ Bindings: Env }>();
    app.get('/probe', async (c) => {
        (c as unknown as { env: Env }).env = e;
        c.set('auth', { user: { id: c.req.query('user') || '', email: 'x@shop.test', storeId: sessionStoreId, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        const siteId = c.req.query('site') || undefined;
        const userId = c.req.query('user') || undefined;
        const blocked = await assertStaffPermission(c, siteId, userId, (c.req.query('key') || 'products:write') as StaffPermissionKey);
        return blocked ?? c.json({ allowed: true });
    });
    return (query: Record<string, string>) => app.request(`/probe?${new URLSearchParams(query)}`, {}, e);
}

test('the store owner passes without any staff row', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await staffApp()({ site: SITE, user: OWNER, key: 'settings:write' });
    assert.equal(res.status, 200);
    assert.ok(!fake.requests.some((r) => r.table === 'employees'), 'an owner needs no grant lookup');
});

test("staff pass only with the key, at THIS store, read from employees.store_id", async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const probe = staffApp();
    assert.equal((await probe({ site: SITE, user: STAFF, key: 'products:write' })).status, 200, 'granted here');
    const denied = await probe({ site: SITE, user: STAFF, key: 'orders:write' });
    assert.equal(denied.status, 403, 'not granted here');
    assert.equal(((await denied.json()) as { error: { code: string } }).error.code, 'STAFF_PERMISSION_REQUIRED');
    assert.equal((await probe({ site: SITE, user: STAFF_ELSEWHERE, key: 'orders:write' })).status, 403, 'a grant at another store does not carry');

    const grantReads = fake.requests.filter((r) => r.table === 'employees').map((r) => r.query);
    assert.ok(grantReads.length > 0);
    for (const query of grantReads) {
        assert.match(query, /store_id=eq\./, 'grants are read by the store column that exists');
        assert.doesNotMatch(query, /site_id=/, 'never by employees.site_id, which does not exist');
    }
});

test('no store, no user, or a session bound to another store is refused', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    assert.equal((await staffApp()({ user: OWNER })).status, 403, 'no store');
    assert.equal((await staffApp()({ site: SITE })).status, 403, 'no user');
    assert.equal((await staffApp(env(), OTHER_SITE)({ site: SITE, user: OWNER })).status, 403, 'the session is bound to another store');
    assert.equal((await staffApp(env(), SITE)({ site: SITE, user: OWNER })).status, 200, 'bound to this store');
});

test('a lookup that fails is a refusal with 503, never an allow', async (t) => {
    for (const failing of ['sites', 'employees']) {
        const fake = installFakePostgrest(tables(), new Set([failing]));
        const res = await staffApp()({ site: SITE, user: STAFF, key: 'products:write' });
        fake.restore();
        assert.equal(res.status, 503, `${failing} unavailable`);
        assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'STAFF_PERMISSION_UNAVAILABLE');
    }
    t.after(() => undefined);
});

test('a dry run allows and logs outside production, and is ignored in production', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    assert.equal((await staffApp(env({ MERCHANT_STAFF_RBAC_MODE: 'dryrun', ENVIRONMENT: 'staging' }))({ site: SITE, user: STAFF, key: 'orders:write' })).status, 200);
    assert.equal((await staffApp(env({ MERCHANT_STAFF_RBAC_MODE: 'dryrun', ENVIRONMENT: 'production' }))({ site: SITE, user: STAFF, key: 'orders:write' })).status, 403);
    assert.equal((await staffApp(env({ MERCHANT_STAFF_RBAC_MODE: 'off' }))({ site: SITE, user: STAFF, key: 'orders:write' })).status, 403, '"off" no longer exists');
});

// ---------------------------------------------------------------------------------------------------
// 2. The platform RBAC
// ---------------------------------------------------------------------------------------------------

test("a store's staff row, whatever its role or JSON, confers no platform scope", async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const db = getSupabaseAdminFromEnv(env());
    assert.deepEqual((await loadEffectivePermissionScopes(db, STORE_ADMIN, 'admin@shop.test')).scopes, [], 'a store "admin" with platform scopes in its JSON');
    assert.deepEqual((await loadEffectivePermissionScopes(db, STAFF, 'staff@shop.test')).scopes, [], 'a store "editor"');

    const lead = await loadEffectivePermissionScopes(db, PLATFORM_LEAD, 'lead@letbuyy.test');
    assert.ok(lead.scopes.includes('review:view') && lead.scopes.includes('merchant:pii'), 'the platform lead tier');
    const root = await loadEffectivePermissionScopes(db, SUPER_ADMIN, 'root@letbuyy.test');
    assert.ok(root.scopes.includes('rbac:manage'), 'the super admin');

    for (const query of fake.requests.filter((r) => r.table === 'employees').map((r) => r.query)) {
        assert.match(query, /store_id=is\.null/, 'platform staff are read with no store');
    }
});

test('a platform employee lookup that fails refuses, rather than reading as "no employee"', async (t) => {
    const fake = installFakePostgrest(tables(), new Set(['employees']));
    t.after(fake.restore);
    await assert.rejects(loadEffectivePermissionScopes(getSupabaseAdminFromEnv(env()), PLATFORM_LEAD, 'lead@letbuyy.test'), /Platform employee lookup failed/);
});

async function identity(userId: string, email: string): Promise<Record<string, string>> {
    const plan = await createLetbuyyInternalIdentityHeaders({ userId, email, secret: INTERNAL_SECRET });
    assert.ok(plan.ok);
    return plan.headers as Record<string, string>;
}

function operatorGateway() {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        await next();
    });
    api.use('/*', authMiddleware);
    api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);
    return api;
}

test("through the real auth and permission layers, a store admin is refused an operator route", async (t) => {
    const fake = installFakePostgrest({ ...tables(), channel_listings: [] });
    t.after(fake.restore);
    const res = await operatorGateway().request('/operations/marketplace-listings', { headers: await identity(STORE_ADMIN, 'admin@shop.test') });
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'PERMISSION_SCOPE_DENIED');
    assert.ok(!fake.requests.some((r) => r.table === 'channel_listings'), 'nothing is read for a refused caller');
});
