// Phase 2 / F2.5 (Section 6) — POST /employees links and activates a new staff row IMMEDIATELY
// only when the invited email belongs to an already EMAIL-VERIFIED account. Confirmed accepted
// policy (apps/merchant/web/src/app/accept-invite/page.tsx, Phase N3): there is no acceptance step
// -- "ask the store owner to add you as staff directly ... instead of sending an email invite" is
// the product's own stated replacement for the retired self-service invite flow. An unverified or
// unmatched email must NOT grant access merely because the text happens to match -- that is not
// proof of who controls the address.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import employeeRouter from '../routes/employee';

const POSTGREST = 'https://employee-create-identity-link.fake-postgrest.test';
const SITE = '99999999-0000-4000-8000-0000000000a1';
const OWNER = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const VERIFIED_USER = 'aaaaaaaa-0000-4000-8000-0000000000c1';
const UNVERIFIED_USER = 'aaaaaaaa-0000-4000-8000-0000000000c2';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: 'internal-secret-for-employee-create-identity-link-tests',
    } as unknown as Env;
}

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression.startsWith('neq.')) return String(value) !== expression.slice(4);
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(value));
    if (expression === 'is.null') return value === null || value === undefined;
    if (expression === 'is.true') return value === true;
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
    const requests: { method: string; table: string; query: string; body?: unknown }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ method, table, query: url.search, body: parsedBody });
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';

        if (method === 'POST' && table === 'employees') {
            const row = parsedBody as Row;
            const rows = tablesData.employees ?? (tablesData.employees = []);
            if (rows.some((r) => r.email === row.email)) {
                return json({ code: '23505', message: `duplicate key value violates unique constraint "employees_email_key" DETAIL: Key (email)=(${row.email}) already exists.` }, 409);
            }
            // Real Postgres returns every selected column, including an unset nullable one as an
            // explicit NULL -- not an absent key. row.insert() here only carries the keys the route
            // actually set, so user_id/status must be normalized the same way a real table would.
            const stored = { id: `emp-${rows.length + 1}`, user_id: null, status: 'invited', ...row };
            rows.push(stored);
            return json(stored);
        }
        if (method === 'GET' || method === 'HEAD') {
            const rows = (tablesData[table] ?? []).filter((row) => matches(row, url.searchParams));
            if (url.searchParams.get('select')?.includes('count') || method === 'HEAD') {
                return json(rows, 200);
            }
            if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: `${rows.length} rows` }, 406);
            return json(rows);
        }
        return json([], 201);
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

function tables(): Record<string, Row[]> {
    return {
        sites: [{ id: SITE, custom_user_id: OWNER, user_id: null, deleted_at: null, site_type: 'store' }],
        users_custom: [
            { id: OWNER, email: 'owner@shop.test' },
            { id: VERIFIED_USER, email: 'verified-staff@shop.test', email_verified: true },
            { id: UNVERIFIED_USER, email: 'unverified-staff@shop.test', email_verified: false },
        ],
        subscriptions: [],
        plans: [],
        employees: [],
    };
}

function appAsOwner() {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        c.set('auth', { user: { id: OWNER, email: 'owner@shop.test', roles: [], roleCategories: [], authSource: 'internal-sso' } } as never);
        await next();
    });
    api.route('/employees', employeeRouter);
    return api;
}
async function createStaff(email: string, role = 'editor') {
    const app = appAsOwner();
    const res = await app.request('/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, store_id: SITE }),
    });
    return { res, body: await res.json() as { data?: Row; error?: { code: string; message: string } } };
}

test('a verified matching account is linked and activated IMMEDIATELY -- no acceptance step', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const { res, body } = await createStaff('verified-staff@shop.test');
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data?.user_id, VERIFIED_USER);
    assert.equal(body.data?.status, 'active');
});

test('an UNVERIFIED matching account is NOT linked -- text matching an email is not proof of ownership', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const { res, body } = await createStaff('unverified-staff@shop.test');
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data?.user_id, null, 'must stay unlinked');
    assert.equal(body.data?.status, 'invited', 'must stay invited, never auto-activated');
});

test('an email with no matching account at all is unchanged from today\'s behavior: invited, unlinked', async (t) => {
    const fake = installFakePostgrest(tables());
    t.after(fake.restore);
    const { res, body } = await createStaff('nobody-yet@shop.test');
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data?.user_id, null);
    assert.equal(body.data?.status, 'invited');
});

test('re-adding an email already staffed anywhere returns a clean 409, never a raw Postgres message or a 500', async (t) => {
    const seeded = tables();
    seeded.employees = [{ id: 'emp-existing', email: 'verified-staff@shop.test', store_id: 'some-other-site', status: 'active', role: 'manager' }];
    const fake = installFakePostgrest(seeded);
    t.after(fake.restore);
    const { res, body } = await createStaff('verified-staff@shop.test');
    assert.equal(res.status, 409);
    assert.equal(body.error?.code, 'EMPLOYEE_ALREADY_EXISTS');
    assert.doesNotMatch(body.error?.message ?? '', /constraint|DETAIL|SQLSTATE|verified-staff@shop\.test/i, 'must not leak the raw constraint message or repeat the email back');
});
