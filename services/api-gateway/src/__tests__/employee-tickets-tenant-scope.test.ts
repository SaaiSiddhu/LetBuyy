// Phase 2 / F2.7 (Section 11/12) — GET /employees/tickets must be scoped to the caller's own
// store. Found while auditing whether reusing support_tickets for buyer privacy requests
// (buyer-privacy-routes.ts) could leak through an EXISTING, unrelated route: this one had no
// site_id predicate at all, so any active employee of any store could read every ticket
// platform-wide -- including buyer privacy requests, which are platform-level (site_id IS NULL).
// Runs through the REAL tenant-guarded admin client against a fake PostgREST, so a query the guard
// would refuse fails here as it would live.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import employeeRouter from '../routes/employee';

const POSTGREST = 'https://employee-tickets-scope.fake-postgrest.test';
const SITE_A = '66666666-0000-4000-8000-0000000000a1';
const SITE_B = '66666666-0000-4000-8000-0000000000a2';
const STAFF_A = '77777777-0000-4000-8000-0000000000b1';
const OUTSIDER = '77777777-0000-4000-8000-0000000000b2';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: 'internal-secret-for-employee-tickets-scope-tests',
    } as unknown as Env;
}

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression === 'is.null') return value === null || value === undefined;
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

function tables(): Record<string, Row[]> {
    return {
        employees: [
            { id: 'emp-a', store_id: SITE_A, user_id: STAFF_A, email: 'staff-a@shop.test', role: 'manager', status: 'active', is_active: true, deleted_at: null, permissions: {} },
        ],
        support_tickets: [
            { id: 'tk-a', ticket_ref: 'SUP-A', site_id: SITE_A, requester_email: 'buyer-a@shop.test', subject: 'Order help at store A', status: 'open', priority: 'normal', topic: 'orders', assignee_id: null, first_response_due_at: null, resolution_due_at: null, created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z', deleted_at: null },
            { id: 'tk-b', ticket_ref: 'SUP-B', site_id: SITE_B, requester_email: 'buyer-b@shop.test', subject: 'Order help at store B', status: 'open', priority: 'normal', topic: 'orders', assignee_id: null, first_response_due_at: null, resolution_due_at: null, created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z', deleted_at: null },
            { id: 'tk-priv', ticket_ref: 'PRIV-1', site_id: null, requester_email: null, subject: 'Data access request', status: 'open', priority: 'normal', topic: 'privacy', assignee_id: null, first_response_due_at: null, resolution_due_at: null, created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z', deleted_at: null },
        ],
    };
}

function appAs(userId: string) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        c.set('auth', { user: { id: userId, email: `${userId}@shop.test`, roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    api.route('/employees', employeeRouter);
    return api;
}

test('an active employee sees only THEIR OWN store\'s tickets -- never another store\'s, never a platform-level (site_id null) privacy request', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);

    const res = await appAs(STAFF_A).request('/employees/tickets');
    const body = await res.json() as { data: { tickets: Array<{ id: string }> } };
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    const ids = body.data.tickets.map((t) => t.id).sort();
    assert.deepEqual(ids, ['tk-a'], 'only Store A\'s own ticket, never Store B\'s and never the platform-level privacy ticket');
});

test('a caller with no active employee row anywhere is refused, not shown an empty-but-successful list', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);

    const res = await appAs(OUTSIDER).request('/employees/tickets');
    assert.equal(res.status, 403);
});
