// F-ADM4-1 — the operator moderation chain, measured through the REAL auth and permission layers.
//
// marketplace-listings-operations.test.ts proves the handler, but it injects a fixed operator actor and a
// pass-through permission (lines 61 and 77), so it never meets authMiddleware, requirePermission or the
// tenant query guard. This file mounts the production router (its DEFAULT dependencies: rbac's real
// requirePermission, the real actor read from c.get('auth'), the real guarded admin client) behind the
// real authMiddleware, in the order services/api-gateway/src/index.ts mounts them (pinned below), against
// a fake PostgREST on globalThis.fetch.
//
// What it establishes, at 1e6cc4c3 + this phase:
//   * the console's shared bearer token, a buyer token, no credentials, and a merchant identity cannot
//     approve anything — correct, and must stay so under every operator-identity option;
//   * an identity holding only review:view cannot decide;
//   * an identity holding review:decide gets PAST auth and RBAC and is then refused by the tenant query
//     guard, because channel_listings is a registered tenant table and the operator route reads it with
//     no site_id (break #5 of F-ADM4-1). The intended approve is kept below as a TODO test with its real
//     assertions: it is blocked on the operator read-path decision, not forgotten.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import { createLetbuyyInternalIdentityHeaders } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import operationsMarketplaceListingsRouter from '../routes/operations/marketplace-listings';

const POSTGREST_ORIGIN = 'https://operator-chain.fake-postgrest.test';
const INTERNAL_SECRET = 'internal-secret-for-operator-chain-tests';
const CONSOLE_TOKEN = 'platform-console-token-for-operator-chain-tests';
const LISTING = 'cccccccc-0000-4000-8000-0000000000c1';
const SITE = 'dddddddd-0000-4000-8000-0000000000d1';
const MODERATOR = 'eeeeeeee-0000-4000-8000-0000000000e1';
const VIEWER = 'eeeeeeee-0000-4000-8000-0000000000e2';
const MERCHANT = 'ffffffff-0000-4000-8000-0000000000f1';

type Row = Record<string, unknown>;
type Captured = { method: string; table: string };

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        PLATFORM_CONSOLE_API_TOKEN: CONSOLE_TOKEN,
    } as unknown as Env;
}

// The subset of PostgREST filtering these queries use: eq, in, is.null.
function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'order', 'offset'].includes(column)) continue;
        const value = row[column];
        if (expression.startsWith('eq.')) {
            if (String(value) !== expression.slice(3)) return false;
        } else if (expression.startsWith('in.(')) {
            if (!expression.slice(4, -1).split(',').includes(String(value))) return false;
        } else if (expression === 'is.null') {
            if (value !== null && value !== undefined) return false;
        }
    }
    return true;
}

function installFakePostgrest(tables: Record<string, Row[]>, rpc: Record<string, unknown> = {}) {
    const originalFetch = globalThis.fetch;
    const requests: Captured[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST_ORIGIN, 'the chain must only talk to the fake PostgREST');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        requests.push({ method, table });
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

        if (table.startsWith('rpc/')) return json(rpc[table.slice(4)] ?? null);
        if (method !== 'GET') return json([], 201);
        const rows = (tables[table] ?? []).filter((row) => matches(row, url.searchParams));
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';
        if (single) return rows.length === 1 ? json(rows[0]) : json({ code: 'PGRST116', message: 'rows' }, 406);
        return json(rows);
    }) as typeof globalThis.fetch;
    return {
        requests,
        touched: (table: string) => requests.some((request) => request.table === table),
        restore: () => { globalThis.fetch = originalFetch; },
    };
}

// The production mount, reduced to what this route sees: auth for everything, then the router.
function gateway() {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        await next();
    });
    api.use('/*', authMiddleware);
    api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);
    return api;
}

async function identityHeaders(userId: string, email: string): Promise<Record<string, string>> {
    const plan = await createLetbuyyInternalIdentityHeaders({ userId, email, secret: INTERNAL_SECRET });
    assert.ok(plan.ok, 'the test must be able to sign an internal identity the gateway accepts');
    return plan.headers as Record<string, string>;
}

function approve(headers: Record<string, string>) {
    return gateway().request(`/operations/marketplace-listings/${LISTING}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ idempotency_key: 'admin-web:listing:approve:test-key-0001' }),
    });
}

const EMPLOYEES: Row[] = [
    { id: 'emp-moderator', user_id: MODERATOR, email: 'moderator@letbuyy.test', role: null, role_id: null, permissions: ['review:view', 'review:decide'], is_active: true, status: 'active' },
    { id: 'emp-viewer', user_id: VIEWER, email: 'viewer@letbuyy.test', role: null, role_id: null, permissions: ['review:view'], is_active: true, status: 'active' },
];
const LISTINGS: Row[] = [{ id: LISTING, site_id: SITE, product_id: 'p1', channel: 'marketplace', status: 'pending_review', version: 1 }];

test('the console\'s shared bearer token is not an operator identity: 401 before any lookup', async (t) => {
    const postgrest = installFakePostgrest({ employees: EMPLOYEES, channel_listings: LISTINGS });
    t.after(() => postgrest.restore());

    // Exactly what admin_web's fetchConsoleApi sends (packages/typescript/api-client/src/index.ts:5579).
    const response = await approve({ Authorization: `Bearer ${CONSOLE_TOKEN}` });

    assert.equal(response.status, 401);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'UNAUTHORIZED');
    assert.deepEqual(postgrest.requests, [], 'refused before touching any data');
});

test('no credentials, and a buyer-realm bearer, are refused the same way', async (t) => {
    const postgrest = installFakePostgrest({ employees: EMPLOYEES, channel_listings: LISTINGS });
    t.after(() => postgrest.restore());

    assert.equal((await approve({})).status, 401);
    // authMiddleware accepts no bearer of any realm on this router; a buyer token is just another bearer.
    assert.equal((await approve({ Authorization: 'Bearer eyJhbGciOiJFUzI1NiJ9.buyer-realm.signature' })).status, 401);
    assert.deepEqual(postgrest.requests, []);
});

test('a merchant identity with no operator role is authenticated but denied: 403, and no listing is read', async (t) => {
    const postgrest = installFakePostgrest({ employees: EMPLOYEES, channel_listings: LISTINGS });
    t.after(() => postgrest.restore());

    const response = await approve(await identityHeaders(MERCHANT, 'merchant@example.invalid'));

    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'PERMISSION_SCOPE_DENIED');
    assert.equal(postgrest.touched('channel_listings'), false);
    assert.equal(postgrest.touched('rpc/transition_channel_listing'), false);
});

test('an operator holding only review:view cannot decide', async (t) => {
    const postgrest = installFakePostgrest({ employees: EMPLOYEES, channel_listings: LISTINGS });
    t.after(() => postgrest.restore());

    const response = await approve(await identityHeaders(VIEWER, 'viewer@letbuyy.test'));

    assert.equal(response.status, 403);
    assert.equal(postgrest.touched('rpc/transition_channel_listing'), false);
});

test('KNOWN BREAK #5: a review:decide operator passes auth and RBAC, then the tenant guard refuses the cross-site read', async (t) => {
    const postgrest = installFakePostgrest({ employees: EMPLOYEES, channel_listings: LISTINGS });
    t.after(() => postgrest.restore());

    const response = await approve(await identityHeaders(MODERATOR, 'moderator@letbuyy.test'));

    // Auth and RBAC both let the moderator through — the permission lookup ran …
    assert.equal(postgrest.touched('employees'), true, 'requirePermission resolved the moderator\'s scopes');
    // … and the refusal is the tenant query guard: channel_listings is registered with scope site_id,
    // loadListing filters by id only, so the guard rejects before the query is ever sent.
    assert.equal(response.status, 500);
    assert.equal(postgrest.touched('channel_listings'), false, 'the guard refused before any request left');
    assert.equal(postgrest.touched('rpc/transition_channel_listing'), false);
});

test('an authorized operator approves a pending listing, recorded as the operator realm', {
    todo: 'blocked on the operator read-path decision — the tenant guard refuses cross-site channel_listings reads (F-ADM4-1 break #5); flip KNOWN BREAK #5 when this passes',
}, async (t) => {
    const postgrest = installFakePostgrest(
        { employees: EMPLOYEES, channel_listings: LISTINGS },
        { transition_channel_listing: [{ listing_id: LISTING, from_status: 'pending_review', to_status: 'approved', event_id: 'ev-1', replayed: false }] },
    );
    t.after(() => postgrest.restore());

    const response = await approve(await identityHeaders(MODERATOR, 'moderator@letbuyy.test'));

    assert.equal(response.status, 200);
    assert.equal(postgrest.touched('rpc/transition_channel_listing'), true);
    assert.equal(postgrest.touched('audit_logs'), true, 'every operator decision names its operator in audit_logs');
});

test('production mounts the moderation router behind authMiddleware, as this harness does', () => {
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    const auth = index.indexOf("api.use('/*', authMiddleware);");
    const mount = index.indexOf("api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);");
    const consoleMount = index.indexOf("api.route('/internal/console', internalConsoleRouter);");
    assert.ok(auth !== -1 && mount !== -1 && consoleMount !== -1);
    assert.ok(auth < mount, 'the operator routes sit behind authMiddleware — the console bearer never reaches them');
    assert.ok(consoleMount < auth, 'only /internal/console, mounted before auth, accepts the console token');
});
