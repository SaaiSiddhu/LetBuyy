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
import { assertStaffPermission, staffPermissionShadowEnabled } from '../middleware/staff-permission';

// A localhost-shaped origin, deliberately: staffPermissionShadowEnabled now requires
// isLocalSupabaseEnvironment(env) (SUPABASE_URL contains localhost/127.0.0.1) as an independent
// signal alongside ENVIRONMENT !== 'production' -- this fake must look like a genuinely local
// instance for the "shadow mode ON" tests below to exercise the path they intend to. A dedicated test
// further down uses a NON-local URL to prove that guard dimension independently.
const POSTGREST = 'http://localhost:54321';
type Row = Record<string, unknown>;

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression === 'is.null') return value === null || value === undefined;
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(value));
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

// `fault` lets a specific table's query throw (simulating a dropped connection) or resolve late
// (simulating a slow query), instead of always answering from `tablesData` -- used below to measure
// the shadow path's actual failure/latency behavior against real fetch semantics, rather than only
// asserting it "should" be safe.
function installFakePostgrest(tablesData: Record<string, Row[]>, fault?: { throwOnTable?: string; delayMsOnTable?: readonly [string, number] }) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const table = url.pathname.replace('/rest/v1/', '');
        if (fault?.throwOnTable === table) throw new Error(`simulated connection failure querying "${table}"`);
        if (fault?.delayMsOnTable && fault.delayMsOnTable[0] === table) {
            await new Promise((resolve) => setTimeout(resolve, fault.delayMsOnTable![1]));
        }
        const rows = tablesData[table] ?? (tablesData[table] = []);
        const matched = rows.filter((row) => matches(row, url.searchParams));
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) {
            return matched.length <= 1 ? json(matched[0] ?? null) : json({ code: 'PGRST116', message: 'multiple rows' }, 406);
        }
        return json(matched);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

const MANAGER_PRINCIPAL = 'principal-manager';
const OWNER_PRINCIPAL = 'principal-owner';
const OWNER_ROLE = 'role-owner';

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
        // Target-model fixtures (auth hardening follow-up, Section 6): real backfilled principals and
        // active memberships WITH roles that actually grant permissions, so the target-backed
        // comparator has real data to resolve rather than always hitting a not-backfilled outcome.
        // owner-user is backfilled exactly like D03 permission equivalence (Section 7, 2026-09-28)
        // describes: a normal store_membership carrying the global 'owner' role -- no special-cased
        // bypass, the same lookup path as any staff member.
        principals: [
            { id: MANAGER_PRINCIPAL, realm: 'merchant', legacy_user_id: 'manager-user', deleted_at: null },
            { id: OWNER_PRINCIPAL, realm: 'merchant', legacy_user_id: 'owner-user', deleted_at: null },
        ],
        store_memberships: [
            { id: 'membership-1', store_id: 'store-1', principal_id: MANAGER_PRINCIPAL, status: 'active', role_ids: ['role-manager'], deleted_at: null },
            { id: 'membership-owner', store_id: 'store-1', principal_id: OWNER_PRINCIPAL, status: 'active', role_ids: [OWNER_ROLE], deleted_at: null },
        ],
        site_role_permissions: [
            { role_id: 'role-manager', permission: 'product.read', effect: 'allow', deleted_at: null },
            { role_id: OWNER_ROLE, permission: 'product.read', effect: 'allow', deleted_at: null },
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

// D03 permission equivalence (auth hardening follow-up, Section 12, 2026-09-28): "exceptions are
// caught" is not the same claim as "failure is bounded" -- these two tests measure each independently
// against real fetch/rejection/delay semantics rather than asserting the property from reading the
// source.

test('BOUNDED FAILURE: a target-store connection failure (thrown fetch, not a well-formed error response) still logs TARGET_LOOKUP_ERROR and leaves the real response untouched', async () => {
    const fake = installFakePostgrest(tables(), { throwOnTable: 'principals' });
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200, 'the real, legacy-authoritative decision must be completely unaffected by the target store being unreachable');
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line, 'a thrown fetch must still produce a shadow log line, not silently vanish');
    assert.equal(line.outcome, 'TARGET_LOOKUP_ERROR');
    assert.equal(line.target_allowed, false, 'an unreachable target store must never be reported as an allow');
});

test('LATENCY (measured, not asserted): a slow-but-still-under-budget target-store query is unaffected by the new timeout -- the real request still just waits for it', async () => {
    // A real gap was measured here, then fixed (D03 permission equivalence follow-up, 2026-09-28):
    // `runShadowComparisonSafely`'s two comparisons are now each raced against
    // SHADOW_COMPARISON_TIMEOUT_MS (middleware/staff-permission.ts, 800ms) -- a merely-slow-but-
    // eventually-resolving query is no longer unbounded. This test's own 120ms artificial delay stays
    // well under that budget, so the real request still simply waits it out (exactly as before the
    // fix) -- proving the new timeout does not fire spuriously for a genuinely-fine, if unhurried,
    // target store. See the next test for proof the bound actually caps a much slower one.
    const ARTIFICIAL_DELAY_MS = 120;
    const fake = installFakePostgrest(tables(), { delayMsOnTable: ['principals', ARTIFICIAL_DELAY_MS] });
    const startedAt = Date.now();
    const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
    const elapsedMs = Date.now() - startedAt;
    fake.restore();
    assert.equal(res.status, 200, 'the real decision is unaffected either way -- this test is about latency, not correctness');
    assert.ok(elapsedMs >= ARTIFICIAL_DELAY_MS, `expected the real request to have waited out the full artificial delay (well under the timeout budget): elapsed ${elapsedMs}ms, delay ${ARTIFICIAL_DELAY_MS}ms`);
});

test('LATENCY, BOUNDED (measured, not asserted): a target-store query far slower than the timeout budget no longer adds its full delay to the real request', async () => {
    // The actual fix, proven: push the artificial delay well past SHADOW_COMPARISON_TIMEOUT_MS
    // (800ms) and confirm the real response returns close to the timeout bound, not anywhere near the
    // full artificial delay -- the shadow path is genuinely raced against a timer now, not merely
    // wrapped in a try/catch that only a thrown exception could trip.
    const ARTIFICIAL_DELAY_MS = 2000;
    const fake = installFakePostgrest(tables(), { delayMsOnTable: ['principals', ARTIFICIAL_DELAY_MS] });
    const lines = await warnLines(async () => {
        const startedAt = Date.now();
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        const elapsedMs = Date.now() - startedAt;
        assert.equal(res.status, 200, 'the real, legacy-authoritative decision must be completely unaffected by the target store timing out');
        assert.ok(
            elapsedMs < ARTIFICIAL_DELAY_MS / 2,
            `expected the real request to return well before the full ${ARTIFICIAL_DELAY_MS}ms artificial delay (bounded by the ~800ms timeout instead): elapsed ${elapsedMs}ms`,
        );
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line, 'a timed-out comparison must still produce a shadow log line, not silently vanish');
    assert.equal(line.outcome, 'TARGET_SHADOW_EVALUATION_TIMEOUT');
    assert.equal(line.target_allowed, null, 'a timed-out comparison must never be reported as an allow (or a deny) -- it never ran to completion');
});

// ============================================================================
// Target-backed shadow comparison (auth hardening follow-up, Section 6): reads REAL
// principals/store_memberships/site_role_permissions rows, never legacy grants. The fixture's
// manager-user principal is backfilled with an active membership holding a role that genuinely
// grants product.read -- so these tests prove the resolution mechanism works end to end, not just
// that it never crashes.
// ============================================================================

function targetShadowLine(lines: string[]) {
    return lines.map((l) => JSON.parse(l)).find((l) => l.event === 'staff_permission_target_shadow_comparison');
}

test('target-backed shadow: a real backfilled principal with a granting role logs MATCH, target_allowed true', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200);
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line, 'expected a target-backed shadow comparison log line');
    assert.equal(line.canonical_action, 'product.read');
    assert.equal(line.legacy_allowed, true);
    assert.equal(line.target_allowed, true);
    assert.equal(line.outcome, 'MATCH');
});

test('target-backed shadow: a legacy-only staff member (never backfilled) logs TARGET_PRINCIPAL_NOT_BACKFILLED, never grants', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        await requestOne('store-1', 'viewer-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line);
    assert.equal(line.outcome, 'TARGET_PRINCIPAL_NOT_BACKFILLED');
    assert.equal(line.target_allowed, false, 'missing target data must never be reported as an allow');
});

test('target-backed shadow: a BACKFILLED owner resolves through the normal role chain -- MATCH, no special-case bypass', async () => {
    const fake = installFakePostgrest(tables());
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'owner-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200, 'the real decision is still owner-bypass -- unaffected by this test');
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line);
    assert.equal(line.outcome, 'MATCH', 'a backfilled owner with the owner role must resolve via the same lookup path as any staff member, not a special case');
    assert.equal(line.target_allowed, true);
});

test('target-backed shadow: an owner NOT YET backfilled fails safely (TARGET_PRINCIPAL_NOT_BACKFILLED), never a silent allow', async () => {
    const data = tables();
    data.principals = data.principals.filter((p) => p.id !== OWNER_PRINCIPAL);
    data.store_memberships = data.store_memberships.filter((m) => m.principal_id !== OWNER_PRINCIPAL);
    const fake = installFakePostgrest(data);
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'owner-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200, 'the real legacy decision is unaffected by target backfill state');
    });
    fake.restore();
    const line = targetShadowLine(lines);
    assert.ok(line);
    assert.equal(line.outcome, 'TARGET_PRINCIPAL_NOT_BACKFILLED');
    assert.equal(line.target_allowed, false, 'a not-yet-backfilled owner must never be reported as allowed');
});

test('SHADOW INDEPENDENCE: mutating ONLY the target fixture produces a measured divergence, and the real HTTP result is unchanged', async () => {
    // Step 1-2: backfilled manager-user, legacy and target both currently allow (MATCH) -- proven by
    // the "MATCH, target_allowed true" test above.
    // Step 3: change ONLY the target data -- revoke the target membership, touching nothing in
    // `employees` (the legacy source) at all.
    const data = tables();
    (data.store_memberships[0] as Row).status = 'suspended';

    const fake = installFakePostgrest(data);
    const lines = await warnLines(async () => {
        // Step 5: the real HTTP authorization result must remain exactly what it was before the
        // target-only mutation (200 -- legacy still grants via products:write).
        const res = await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 200, 'the real request must be completely unaffected by a target-only fixture change');
    });
    fake.restore();

    // Step 4: confirm the divergence is observed.
    const line = targetShadowLine(lines);
    assert.ok(line);
    assert.equal(line.legacy_allowed, true, 'the legacy decision is untouched');
    assert.equal(line.target_allowed, false, 'the target decision must reflect the real, mutated membership status');
    assert.equal(line.outcome, 'TARGET_MEMBERSHIP_INACTIVE');

    // Step 6-7: restore the target fixture and confirm matching decisions return.
    const restored = tables();
    const fake2 = installFakePostgrest(restored);
    const lines2 = await warnLines(async () => {
        await requestOne('store-1', 'manager-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
    });
    fake2.restore();
    const line2 = targetShadowLine(lines2);
    assert.equal(line2.outcome, 'MATCH', 'reconciling the target fixture must restore agreement');
});

test('SHADOW INDEPENDENCE (opposite direction): a target role that would allow more than legacy does not affect the real, still-forbidden result', async () => {
    // viewer-user is legacy-denied for products:read (only holds orders:read). Backfill a principal
    // and an active membership for viewer-user with a role that DOES grant product.read in the
    // target model -- the real HTTP request must still be 403.
    const data = tables();
    data.principals.push({ id: 'principal-viewer', realm: 'merchant', legacy_user_id: 'viewer-user', deleted_at: null });
    data.store_memberships.push({ id: 'membership-2', store_id: 'store-1', principal_id: 'principal-viewer', status: 'active', role_ids: ['role-viewer-plus'], deleted_at: null });
    data.site_role_permissions.push({ role_id: 'role-viewer-plus', permission: 'product.read', effect: 'allow', deleted_at: null });

    const fake = installFakePostgrest(data);
    const lines = await warnLines(async () => {
        const res = await requestOne('store-1', 'viewer-user', { STAFF_PERMISSION_SHADOW: 'on' } as Partial<Env>);
        assert.equal(res.status, 403, 'legacy still denies -- the target model granting more must never leak into the real result');
    });
    fake.restore();

    const line = targetShadowLine(lines);
    assert.ok(line);
    assert.equal(line.legacy_allowed, false);
    assert.equal(line.target_allowed, true);
    assert.equal(line.outcome, 'DIVERGE_LEGACY_DENIES_TARGET_ALLOWS');
});

// ============================================================================
// Environment eligibility matrix (Section 7 of the follow-up: "ENVIRONMENT !== 'production' is not
// identical to 'local only'"). Pure, fast tests of staffPermissionShadowEnabled directly -- no fake
// PostgREST needed since eligibility never reaches the database.
// ============================================================================

test('environment eligibility: approved local development (non-production ENVIRONMENT + localhost SUPABASE_URL) qualifies', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'development', SUPABASE_URL: 'http://localhost:54321' } as unknown as Env), true);
});

test('environment eligibility: production never qualifies, even with a localhost-shaped SUPABASE_URL', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'production', SUPABASE_URL: 'http://localhost:54321' } as unknown as Env), false);
});

test('environment eligibility: a staging/preview-shaped SUPABASE_URL never qualifies, regardless of the ENVIRONMENT label', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'staging', SUPABASE_URL: 'https://staging-project.supabase.co' } as unknown as Env), false);
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'preview', SUPABASE_URL: 'https://preview-project.supabase.co' } as unknown as Env), false);
});

test('environment eligibility: an unset ENVIRONMENT does not silently qualify a non-local SUPABASE_URL', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', SUPABASE_URL: 'https://real-project.supabase.co' } as unknown as Env), false);
});

test('environment eligibility: a malformed/unrecognized ENVIRONMENT value does not silently qualify a non-local SUPABASE_URL', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'Prod-uction!! typo', SUPABASE_URL: 'https://real-project.supabase.co' } as unknown as Env), false);
});

test('environment eligibility: the flag off never qualifies, even in a genuinely local environment', () => {
    assert.equal(staffPermissionShadowEnabled({ ENVIRONMENT: 'development', SUPABASE_URL: 'http://localhost:54321' } as unknown as Env), false);
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'off', ENVIRONMENT: 'development', SUPABASE_URL: 'http://localhost:54321' } as unknown as Env), false);
});

test('environment eligibility: an unset SUPABASE_URL does not silently qualify a non-production ENVIRONMENT', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'development' } as unknown as Env), false);
});

test('environment eligibility: a misleading hostname containing a local-looking substring never qualifies -- this is a real, parsed-hostname check, not a raw string match', () => {
    // D03 permission equivalence (Section 13, 2026-09-28): isLocalSupabaseEnvironment previously did
    // `url.includes('localhost')`, a substring match against the WHOLE url. A hostname like this one
    // contains that substring but is not actually localhost at all.
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'development', SUPABASE_URL: 'https://evil-localhost-lookalike.attacker.example' } as unknown as Env), false);
});

test('environment eligibility: a malformed SUPABASE_URL fails closed (never local), not thrown or silently qualified', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'development', SUPABASE_URL: 'not a url at all' } as unknown as Env), false);
});

test('environment eligibility: a genuine *.localhost subdomain still qualifies (the reserved local TLD, not a substring coincidence)', () => {
    assert.equal(staffPermissionShadowEnabled({ STAFF_PERMISSION_SHADOW: 'on', ENVIRONMENT: 'development', SUPABASE_URL: 'http://my-project.localhost:54321' } as unknown as Env), true);
});
