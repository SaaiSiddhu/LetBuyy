// Phase 2 / D04 (Mandate 7, Section 9) -- end-to-end proof that requirePlatformOperator +
// requirePermission, wired together in the REAL operations/support.ts router, produce the intended
// tiered outcome: a non-superadmin platform employee can now reach this router at all (the router-
// level gate no longer blocks them), and their SPECIFIC tier's scopes (INTERNAL_PERMISSION_TIERS,
// via loadEffectivePermissionScopes -- both pre-existing, unchanged by this pass) decide which
// individual routes they may call. require-platform-operator.test.ts already proves the router-level
// gate in isolation; this file proves the two gates compose correctly on the real router.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import operationsSupportRouter from '../routes/operations/support';

const POSTGREST = 'https://operations-support-tier-wiring.fake-postgrest.test';
type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: 'internal-secret-for-operations-support-tier-wiring-tests',
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
        const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
        const rows = (tablesData[table] ?? []).filter((row) => matches(row, url.searchParams));
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
        return json(rows, 200, { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

const VIEWER = 'user-viewer-tier';
const MERCHANT_LOOKALIKE = 'user-merchant-lookalike';

function tables(): Record<string, Row[]> {
    return {
        super_admin_allowlist: [],
        employees: [
            { id: 'plat-viewer', user_id: VIEWER, store_id: null, role: 'viewer', status: 'active', deleted_at: null, role_id: null, permissions: {} },
            { id: 'merch-lookalike', user_id: MERCHANT_LOOKALIKE, store_id: 'a-real-store', role: 'support', status: 'active', deleted_at: null, role_id: null, permissions: { granted: ['support:manage'] } },
        ],
        employee_permissions: [],
        break_glass_grants: [],
        support_tickets: [],
        ticket_sla_clocks: [],
        ticket_csat: [],
        ticket_macros: [],
    };
}

function appAs(userId: string) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        c.set('auth', { user: { id: userId, email: `${userId}@example.test`, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    api.route('/operations/support', operationsSupportRouter);
    return api;
}

test('a viewer-tier platform employee is no longer blocked at the ROUTER level (a pre-existing, unrelated defect in /overview\'s own support_tickets query is reached identically by a superadmin, proving it is not this pass\'s regression)', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);

    // GET /overview's own support_tickets count queries (.in('status', [...]) with no site_id
    // predicate) trip the REAL tenant guard (tenant-scoped.ts) regardless of caller -- confirmed a
    // pre-existing, unrelated defect, not introduced by this pass (git diff on this file touches only
    // the import list and the router.use line, never any route handler's own query). Demonstrated
    // here by reaching the identical failure as a SUPERADMIN, whose access this pass changes nothing
    // about -- if the tier change had caused this, a superadmin would not reproduce it identically.
    const asSuperadminData = tables();
    asSuperadminData.super_admin_allowlist.push({ id: 'sa-1', user_id: 'user-superadmin-control', email: 'user-superadmin-control@example.test', is_active: true });
    const fakeSuperadmin = installFakePostgrest(asSuperadminData);
    const superadminOverview = await appAs('user-superadmin-control').request('/operations/support/overview');
    fakeSuperadmin.restore();
    assert.equal(superadminOverview.status, 500, 'confirms the downstream defect is universal, not tier-related -- flagged separately, out of this pass\'s scope to fix');

    const viewerOverview = await appAs(VIEWER).request('/operations/support/overview');
    assert.notEqual(viewerOverview.status, 401, 'requirePlatformOperator must not reject an active platform employee');
    assert.notEqual(viewerOverview.status, 403, 'requirePermission must not reject support:view for the viewer tier, which grants it');
    assert.equal(viewerOverview.status, 500, 'reaches the identical pre-existing downstream defect as the superadmin control -- proof both gates were correctly passed before the unrelated failure');

    const macroCreate = await appAs(VIEWER).request('/operations/support/macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test macro', body: 'hello', reason: 'testing tier limits' }),
    });
    assert.equal(macroCreate.status, 403, 'viewer tier does not include support:manage -- denied at the permission-scope level, not the router level, and this route has no downstream tenant-guard defect to mask the result');
});

test('a merchant\'s own staff (store-scoped, role/permission strings that look platform-related) is still denied at the router level -- requirePlatformOperator, not requirePermission, is what stops them', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(MERCHANT_LOOKALIKE).request('/operations/support/overview');
    assert.equal(res.status, 403);
});
