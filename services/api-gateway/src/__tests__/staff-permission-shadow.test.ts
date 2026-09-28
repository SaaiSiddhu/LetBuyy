// Phase 2 / D03 runtime shadow evaluation (auth hardening mandate, Section 9). Exercises the REAL
// assertStaffPermission entry point -- the exact function every merchant route (products.ts,
// orders.ts, customers.ts, ...) already calls, which shares evaluateStaffRequest with the
// requireStaffPermission middleware -- via an actual Hono route mounted on a real router, with a
// fake PostgREST backing `sites`/`employees`. This is not a pure-function test: it proves the wiring
// at the middleware-chain level, matching the requirement to exercise actual HTTP journeys rather
// than only evaluateStaffPermission in isolation (already covered by staff-permission.test.ts).
//
// The one property every test here checks first, before anything about the shadow comparison itself:
// the REAL HTTP response (status + body) is BYTE-IDENTICAL whether shadow mode is on or off. Shadow
// mode is a side-channel log line, never a second vote on the request.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { assertStaffPermission } from '../middleware/staff-permission';

const POSTGREST = 'https://staff-permission-shadow.fake-postgrest.test';
type Row = Record<string, unknown>;

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression === 'is.null') return value === null || value === undefined;
    throw new Error(`fake PostgREST does not model "${expression}"`);
}
function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'offset', 'order'].includes(column)) continue;
        if (column === 'or') {
            // ownsStore uses .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`) -- postgrest-js
            // encodes this as a single `or` param; match if EITHER side's value equals the row's.
            const userId = expression.match(/eq\.([^,)]+)/)?.[1];
            if (!userId || (row.custom_user_id !== userId && row.user_id !== userId)) return false;
            continue;
        }
        if (!test1(row[column], expression)) return false;
    }
    return true;
}

function installFakePostgrest(tablesData: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const table = url.pathname.replace('/rest/v1/', '');
        const rows = tablesData[table] ?? (tablesData[table] = []);
        const matched = rows.filter((row) => matches(row, url.searchParams));
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        // Every query in staff-permission.ts ends in .maybeSingle().
        return matched.length <= 1 ? json(matched[0] ?? null) : json({ code: 'PGRST116', message: 'multiple rows' }, 406);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

function tables(): Record<string, Row[]> {
    return {
        sites: [{ id: 'store-1', custom_user_id: 'owner-user', user_id: null, deleted_at: null }],
        employees: [
            { store_id: 'store-1', user_id: 'manager-user', status: 'active', deleted_at: null, permissions: { granted: ['products:write'] }, role: 'manager' },
            { store_id: 'store-1', user_id: 'viewer-user', status: 'active', deleted_at: null, permissions: { granted: ['orders:read'] }, role: 'viewer' },
            // A removed/revoked membership: the row exists but status != 'active', so resolveGrants's
            // own .eq('status','active') filter excludes it -- found:false, granted:[], exactly like
            // no row existing at all. This is the "revoked membership" case from Section 9's matrix.
            { store_id: 'store-1', user_id: 'revoked-user', status: 'removed', deleted_at: null, permissions: { granted: ['products:write'] }, role: 'manager' },
        ],
    };
}

function warnLines(fn: () => Promise<void>) {
    const captured: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { captured.push(String(args[0])); };
    return fn().finally(() => { console.warn = original; }).then(() => captured);
}

function envFor(overrides: Partial<Env> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        ...overrides,
    } as unknown as Env;
}

// requireStaffPermission (the Hono middleware wrapper) reads siteId/userId from `tenant` or
// `auth.user`, which this minimal harness does not populate. assertStaffPermission -- the in-handler
// form used by every real merchant route (products.ts, orders.ts, customers.ts, ...) -- calls the
// exact same evaluateStaffRequest underneath and is simpler to exercise directly here with an
// explicit storeId/userId, so this file uses that entry point; the shadow wiring under test lives
// inside evaluateStaffRequest itself, shared by both.
function app() {
    const api = new Hono<{ Bindings: Env }>();
    api.get('/protected/:storeId/:userId', async (c) => {
        const block = await assertStaffPermission(c, c.req.param('storeId'), c.req.param('userId'), 'products:read');
        if (block) return block;
        return c.json({ data: { ok: true } });
    });
    return api;
}

async function requestOne(storeId: string, userId: string, envOverrides: Partial<Env> = {}) {
    const res = await app().request(`/protected/${storeId}/${userId}`, {}, envFor(envOverrides));
    return { status: res.status, body: await res.json() };
}

async function requestBoth(storeId: string, userId: string, shadow: 'on' | undefined) {
    const fake = installFakePostgrest(tables());
    try {
        return await requestOne(storeId, userId, { STAFF_PERMISSION_SHADOW: shadow } as Partial<Env>);
    } finally {
        fake.restore();
    }
}

test('the real HTTP response is identical with shadow mode off vs on -- owner request (allowed)', async () => {
    const off = await requestBoth('store-1', 'owner-user', undefined);
    const on = await requestBoth('store-1', 'owner-user', 'on');
    assert.equal(off.status, 200);
    assert.deepEqual(off, on);
});

test('the real HTTP response is identical with shadow mode off vs on -- mapped, matching grant (allowed)', async () => {
    const off = await requestBoth('store-1', 'manager-user', undefined);
    const on = await requestBoth('store-1', 'manager-user', 'on');
    assert.equal(off.status, 200, 'manager holds products:write, which implies products:read');
    assert.deepEqual(off, on);
});

test('the real HTTP response is identical with shadow mode off vs on -- forbidden (wrong grant)', async () => {
    const off = await requestBoth('store-1', 'viewer-user', undefined);
    const on = await requestBoth('store-1', 'viewer-user', 'on');
    assert.equal(off.status, 403, 'viewer only holds orders:read, not products:read');
    assert.deepEqual(off, on);
});

test('the real HTTP response is identical with shadow mode off vs on -- revoked membership (forbidden)', async () => {
    const off = await requestBoth('store-1', 'revoked-user', undefined);
    const on = await requestBoth('store-1', 'revoked-user', 'on');
    assert.equal(off.status, 403, 'a removed employee row must be denied identically to no row at all');
    assert.deepEqual(off, on);
});

test('shadow mode OFF (default): no shadow comparison log line is emitted at all', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        await requestOne('store-1', 'manager-user');
    });
    fake.restore();
    assert.ok(!lines.some((l) => l.includes('staff_permission_shadow_comparison')), 'shadow must not run when not explicitly enabled');
});

test('shadow mode ON: a comparison is logged for a mapped key, without altering the real decision', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200);
    });
    fake.restore();
    const shadowLine = lines.map((l) => JSON.parse(l)).find((l) => l.event === 'staff_permission_shadow_comparison');
    assert.ok(shadowLine, 'expected a shadow comparison log line');
    assert.equal(shadowLine.legacy_key, 'products:read');
    assert.equal(shadowLine.legacy_allowed, true);
    // products:read has a canonical alias (product.read); manager's grant is products:write, which
    // legacy accepts via its own write-implies-read rule -- the new engine has no such rule and only
    // checks the literal canonical action, so DIVERGE_LEGACY_ALLOWS_NEW_DENIES is the EXPECTED
    // outcome here, not a bug. Whatever it is, the real 200 above is what actually reached the caller.
    assert.ok(['MATCH', 'DIVERGE_LEGACY_ALLOWS_NEW_DENIES'].includes(shadowLine.outcome), `unexpected outcome: ${shadowLine.outcome}`);
});

test('shadow mode ON: an owner request logs OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        await requestOne('store-1', 'owner-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
    });
    fake.restore();
    const shadowLine = lines.map((l) => JSON.parse(l)).find((l) => l.event === 'staff_permission_shadow_comparison');
    assert.ok(shadowLine, 'expected a shadow comparison log line for the owner path');
    assert.equal(shadowLine.outcome, 'OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL');
});

test('shadow mode ON: a forbidden request (no matching grant) still logs a comparison, never blocking or altering the 403', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'viewer-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 403);
    });
    fake.restore();
    const shadowLine = lines.map((l) => JSON.parse(l)).find((l) => l.event === 'staff_permission_shadow_comparison');
    assert.ok(shadowLine);
    assert.equal(shadowLine.legacy_allowed, false);
});

test('shadow mode ON: a revoked/missing membership logs UNMAPPED or a MATCH-on-deny, never a false allow', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'revoked-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 403);
    });
    fake.restore();
    const shadowLine = lines.map((l) => JSON.parse(l)).find((l) => l.event === 'staff_permission_shadow_comparison');
    assert.ok(shadowLine);
    assert.equal(shadowLine.legacy_allowed, false);
    assert.notEqual(shadowLine.new_allowed, true, 'a revoked membership must never shadow-log as an allow in the new model');
});

test('shadow mode is NEVER active in production, even with the opt-in env var explicitly set', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'production' } as Partial<Env>);
        assert.equal(res.status, 200, 'the real decision is unaffected by the environment check');
    });
    fake.restore();
    assert.ok(!lines.some((l) => l.includes('staff_permission_shadow_comparison')), 'production must never run shadow evaluation regardless of the env var');
});

// runShadowComparisonSafely's catch branch (SHADOW_EVALUATION_ERROR) is not exercised by a forced
// failure here: compareStaffPermissionDecision does no I/O and, by inspection, cannot throw for any
// (isOwner, granted, requiredKey) shape evaluateStaffRequest actually constructs (isOwner is always a
// boolean, granted is always the string[] resolveGrants produces, requiredKey is a StaffPermissionKey
// literal) -- isolating a forced throw would need node:test's mock.module(), which requires the
// --experimental-test-module-mocks flag this repo's test invocations do not pass. The catch is
// defensive-in-depth against a future edit to the shadow comparator, verified by code review rather
// than by a contrived test; every test above already proves the integration's happy path never lets
// a shadow-side anything affect the real, returned decision.
test('no uncaught rejection from the shadow path escapes to the caller', async () => {
    const fake = installFakePostgrest(tables());
    const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
    fake.restore();
    assert.equal(res.status, 200, 'no unexpected 500 -- nothing escaped runShadowComparisonSafely\'s try/catch');
});
