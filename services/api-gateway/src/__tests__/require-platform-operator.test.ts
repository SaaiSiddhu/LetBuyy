// Phase 2 / D04 (Mandate 7, Sections 7-9) -- requirePlatformOperator, exercised through REAL
// middleware + route wiring (a Hono app + a fake PostgREST), not as an isolated pure function. This
// is the gate PROPOSED to replace operations/support.ts's router-level requireRoleCategory('ops') +
// requireSuperAdmin pair -- not yet wired into that router in this commit (see the mandate's own
// note on the prior rejected attempt); this file proves the REPLACEMENT's own correctness first.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { requirePlatformOperator } from '../middleware/rbac';

const POSTGREST = 'https://require-platform-operator.fake-postgrest.test';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: 'internal-secret-for-require-platform-operator-tests',
    } as unknown as Env;
}

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression === 'is.null') return value === null || value === undefined;
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(value));
    throw new Error(`fake PostgREST does not model "${expression}"`);
}
function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'order', 'offset', 'columns'].includes(column)) continue;
        if (!test1(row[column], expression)) return false;
    }
    return true;
}
function installFakePostgrest(tablesData: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const table = url.pathname.replace('/rest/v1/', '');
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        const rows = (tablesData[table] ?? []).filter((row) => matches(row, url.searchParams));
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
        return json(rows);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

function appWithAuth(userId: string | null, email = `${userId}@example.test`) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        if (userId) c.set('auth', { user: { id: userId, email, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    api.get('/probe', requirePlatformOperator(), (c) => c.json({ ok: true }));
    return api;
}

const SUPERADMIN = 'user-superadmin';
const PLATFORM_VIEWER = 'user-platform-viewer';
const PLATFORM_OPERATOR_TIER = 'user-platform-operator-tier';
const PLATFORM_INACTIVE = 'user-platform-inactive';
const MERCHANT_OWNER = 'user-merchant-owner';
const MERCHANT_STAFF_LOOKALIKE = 'user-merchant-staff-lookalike';

function tables(): Record<string, Row[]> {
    return {
        super_admin_allowlist: [
            { id: 'sa-1', user_id: SUPERADMIN, email: `${SUPERADMIN}@example.test`, is_active: true },
        ],
        employees: [
            // Real platform operators: store_id IS NULL.
            { id: 'plat-1', user_id: PLATFORM_VIEWER, store_id: null, role: 'viewer', status: 'active', deleted_at: null },
            { id: 'plat-2', user_id: PLATFORM_OPERATOR_TIER, store_id: null, role: 'support', status: 'active', deleted_at: null },
            { id: 'plat-3', user_id: PLATFORM_INACTIVE, store_id: null, role: 'viewer', status: 'removed', deleted_at: '2026-09-01T00:00:00Z' },
            // A merchant's OWN store-scoped staff, deliberately given a role/permission that LOOKS
            // platform-adjacent (role literally named 'support', a support:*-shaped permission, and
            // even a wildcard) -- must still be denied, because store_id is NOT NULL.
            {
                id: 'merch-1', user_id: MERCHANT_STAFF_LOOKALIKE, store_id: 'some-real-store-id', role: 'support',
                status: 'active', deleted_at: null, permissions: { granted: ['support:manage', '*'] },
            },
        ],
    };
}

test('unauthenticated: 401, never reaches the database at all', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(null).request('/probe');
    assert.equal(res.status, 401);
});

test('a merchant owner (authenticated, but no employees row and no allowlist entry): 403', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(MERCHANT_OWNER).request('/probe');
    assert.equal(res.status, 403);
});

test('a merchant\'s own store-scoped staff member, even with a role/permission string that LOOKS platform-related (role="support", permissions include "support:manage" and "*"): 403 -- store_id IS NOT NULL is the disqualifier, not the role name', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(MERCHANT_STAFF_LOOKALIKE).request('/probe');
    assert.equal(res.status, 403);
});

test('an inactive (removed) platform employee: 403, even though a matching store_id-IS-NULL row exists', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(PLATFORM_INACTIVE).request('/probe');
    assert.equal(res.status, 403);
});

test('an active platform employee (viewer tier, store_id IS NULL): 200 -- this is exactly the capability D04 approved unlocking', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(PLATFORM_VIEWER).request('/probe');
    assert.equal(res.status, 200);
});

test('an active platform employee (operator tier, store_id IS NULL): 200', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(PLATFORM_OPERATOR_TIER).request('/probe');
    assert.equal(res.status, 200);
});

test('a superadmin (allowlist entry, no employees row at all): 200 -- unchanged from today\'s behavior', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appWithAuth(SUPERADMIN).request('/probe');
    assert.equal(res.status, 200);
});

test('revocation is fresh per request: an operator active in one call and revoked before the next is denied on the very next call, with no re-login needed to observe it', async (t) => {
    const data = tables();
    const fake = installFakePostgrest(data);
    t.after(fake.restore);
    const before = await appWithAuth(PLATFORM_VIEWER).request('/probe');
    assert.equal(before.status, 200);

    const row = data.employees.find((r) => r.user_id === PLATFORM_VIEWER)!;
    row.status = 'removed';
    row.deleted_at = '2026-09-28T00:00:00Z';

    const after = await appWithAuth(PLATFORM_VIEWER).request('/probe');
    assert.equal(after.status, 403, 'the SAME identity, same test run, no cache -- revocation must take effect immediately');
});
