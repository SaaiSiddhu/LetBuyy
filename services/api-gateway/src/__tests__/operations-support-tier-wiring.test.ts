// Phase 2 / D04 (Mandate 7, Section 9) + follow-up fix -- end-to-end proof, against the REAL
// operations/support.ts router, of two things together:
//
// 1. requirePlatformOperator + requirePermission produce the intended tiered outcome: a
//    non-superadmin platform employee can reach this router at all, and their specific tier's
//    scopes decide which individual routes they may call.
// 2. The tenant-guard 500 this fix closes: GET /overview, GET /tickets, GET /tickets/:id, and
//    PATCH /tickets/:id/assign now return their REAL result (200, with real data) for both a
//    superadmin and a viewer/moderator-tier platform employee, not the "Tenant table support_tickets
//    requires a tenant/owner predicate" 500 every caller previously got.
//
// require-platform-operator.test.ts already proves the router-level gate in isolation; this file
// proves the two gates AND the query fix compose correctly on the real router, against real data.

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
    if (expression.startsWith('lt.')) return typeof value === 'string' && value < expression.slice(3);
    throw new Error(`fake PostgREST does not model "${expression}"`);
}
function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'offset', 'order', 'columns'].includes(column)) continue;
        if (!test1(row[column], expression)) return false;
    }
    return true;
}

/** A capable-enough fake PostgREST: GET (list/count/single), PATCH (update, matched rows only,
 *  optionally returning the updated row via select().single()), POST (insert, echoes the row back). */
function installFakePostgrest(tablesData: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
        const rows = tablesData[table] ?? (tablesData[table] = []);
        const matched = rows.filter((row) => matches(row, url.searchParams));
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';

        if (method === 'GET' || method === 'HEAD') {
            if (single) return matched.length === 1 ? json(matched[0]) : json({ code: 'PGRST116', message: `${matched.length} rows` }, 406);
            return json(matched, 200, { 'Content-Range': `0-${Math.max(matched.length - 1, 0)}/${matched.length}` });
        }
        if (method === 'PATCH') {
            const patch = init?.body ? JSON.parse(String(init.body)) : {};
            for (const row of matched) Object.assign(row, patch);
            if (single) return matched.length === 1 ? json(matched[0]) : json({ code: 'PGRST116', message: `${matched.length} rows` }, 406);
            return json(matched);
        }
        if (method === 'POST') {
            const row = init?.body ? JSON.parse(String(init.body)) : {};
            const stored = { id: `generated-${rows.length + 1}`, ...row };
            rows.push(stored);
            return json(single ? stored : [stored], 201);
        }
        return json([], 200);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

const VIEWER = 'user-viewer-tier';
const MODERATOR = 'user-moderator-tier';
const ADMINISTRATOR = 'user-administrator-tier';
const MERCHANT_LOOKALIKE = 'user-merchant-lookalike';
const SUPERADMIN = 'user-superadmin-control';
// A real uuid: the routes validate :id as one before any lookup (P2-OPERATOR-QUEUE-CORRECTNESS), as support_tickets.id is.
const TICKET_A = '11111111-1111-4111-8111-111111111111';

function tables(): Record<string, Row[]> {
    return {
        super_admin_allowlist: [
            { id: 'sa-1', user_id: SUPERADMIN, email: `${SUPERADMIN}@example.test`, is_active: true },
        ],
        employees: [
            { id: 'plat-viewer', user_id: VIEWER, store_id: null, role: 'viewer', status: 'active', deleted_at: null, role_id: null, permissions: {} },
            { id: 'plat-moderator', user_id: MODERATOR, store_id: null, role: 'support', status: 'active', deleted_at: null, role_id: null, permissions: {} },
            { id: 'merch-lookalike', user_id: MERCHANT_LOOKALIKE, store_id: 'a-real-store', role: 'support', status: 'active', deleted_at: null, role_id: null, permissions: { granted: ['support:manage'] } },
            // role: 'manager' -> INTERNAL_EMPLOYEE_ROLE_DEFAULT_TIERS['manager'] === 'lead', the tier
            // D04's "Administrator" product role maps to (PHASE2_DECISIONS.md's mapping table). This
            // identity holds NO super_admin_allowlist entry -- its support:manage must come from
            // role-derived tier resolution alone, proving the lead tier works independently of the
            // superadmin-allowlist bypass path, which every other support:manage test here exercises.
            { id: 'plat-administrator', user_id: ADMINISTRATOR, store_id: null, role: 'manager', status: 'active', deleted_at: null, role_id: null, permissions: {} },
        ],
        employee_permissions: [],
        break_glass_grants: [],
        support_tickets: [
            { id: TICKET_A, site_id: 'site-1', ticket_ref: 'SUP-2026-AAAA1111', requester_type: 'merchant', requester_email: 'merchant@shop.test', subject: 'Payout delayed', status: 'open', priority: 'normal', topic: 'payments', assignee_id: null, deleted_at: null, created_at: '2026-09-01T00:00:00Z' },
        ],
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

test('the tenant-guard 500 is fixed: GET /overview now returns real aggregate counts for a superadmin, not a 500', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(SUPERADMIN).request('/operations/support/overview');
    const body = await res.json() as { data?: { open_count: number } };
    assert.equal(res.status, 200, `expected the real fix to apply for every caller, including superadmin: ${JSON.stringify(body)}`);
    assert.equal(body.data?.open_count, 1, 'the one seeded open ticket must be counted');
});

test('a viewer-tier platform employee reaches GET /overview (router-level gate passes) and gets the real counts (query-level fix applies)', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(VIEWER).request('/operations/support/overview');
    assert.equal(res.status, 200);

    const macroCreate = await appAs(VIEWER).request('/operations/support/macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test macro', body: 'hello', reason: 'testing tier limits' }),
    });
    assert.equal(macroCreate.status, 403, 'viewer tier does not include support:manage -- denied at the permission-scope level, unaffected by this fix');
});

test('GET /tickets: a moderator-tier employee lists the real ticket, not a 500', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(MODERATOR).request('/operations/support/tickets');
    const body = await res.json() as { data?: Array<{ id: string }> };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data?.length, 1);
    assert.equal(body.data?.[0]?.id, TICKET_A);
});

test('GET /tickets/:id: a viewer-tier employee fetches the real ticket by id, not a 500', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(VIEWER).request(`/operations/support/tickets/${TICKET_A}`);
    const body = await res.json() as { data?: { ticket?: { id: string } } };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data?.ticket?.id, TICKET_A);
});

test('PATCH /tickets/:id/assign: a moderator-tier employee (support:reply, NOT support:manage) is denied by the permission check, unaffected by the query fix', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(MODERATOR).request(`/operations/support/tickets/${TICKET_A}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: null, reason: 'reassigning for testing' }),
    });
    assert.equal(res.status, 403);
});

test('PATCH /tickets/:id/assign: a superadmin (support:manage via the admin tier) successfully assigns the real ticket, not a 500', async (t) => {
    const data = tables();
    const fake = installFakePostgrest(data);
    t.after(fake.restore);
    const res = await appAs(SUPERADMIN).request(`/operations/support/tickets/${TICKET_A}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: null, reason: 'reassigning for testing' }),
    });
    const body = await res.json() as { data?: { ticket?: { status: string } } };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data?.ticket?.status, 'pending_internal');
});

test('PATCH /tickets/:id/assign: a lead-tier employee (D04\'s approved "Administrator", role-derived support:manage, NOT superadmin) successfully assigns the real ticket', async (t) => {
    const data = tables();
    const fake = installFakePostgrest(data);
    t.after(fake.restore);
    const res = await appAs(ADMINISTRATOR).request(`/operations/support/tickets/${TICKET_A}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: null, reason: 'reassigning for testing' }),
    });
    const body = await res.json() as { data?: { ticket?: { status: string } } };
    assert.equal(res.status, 200, `lead tier must grant support:manage via role resolution alone, no allowlist entry involved: ${JSON.stringify(body)}`);
    assert.equal(body.data?.ticket?.status, 'pending_internal');
});

test('a merchant\'s own staff (store-scoped, role/permission strings that look platform-related) is still denied at the router level, unaffected by this fix', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const res = await appAs(MERCHANT_LOOKALIKE).request('/operations/support/overview');
    assert.equal(res.status, 403);
});
