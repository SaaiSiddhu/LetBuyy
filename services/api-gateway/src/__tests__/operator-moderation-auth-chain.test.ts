// F-ADM4-1/F6.2 — operator moderation through real auth, RBAC and session-user revalidation.
//
// marketplace-listings-operations.test.ts proves the handler, but it injects a fixed operator actor and a
// pass-through permission (lines 61 and 77), so it never meets authMiddleware, requirePermission or the
// tenant query guard. This file mounts the production router (its DEFAULT dependencies: rbac's real
// requirePermission, the real actor read from c.get('auth'), the real guarded admin client) behind the
// real authMiddleware, in the order services/api-gateway/src/index.ts mounts them (pinned below), against
// a fake PostgREST on globalThis.fetch.
//
// What it establishes:
//   * the console's shared bearer token, a buyer token, no credentials, and a merchant identity cannot
//     approve anything — correct, and must stay so under every operator-identity option;
//   * an identity holding only review:view cannot decide;
//   * an identity holding review:decide gets past auth and RBAC and reaches
//     channel_listings for real: the route now reads it through getSupabaseAdminUnguarded (the listing
//     lookup, a bounded single-row bootstrap by globally-unique id) and getSupabaseAdminForOperatorRead
//     (the cross-site queue list, permission-gated and page-capped) instead of the tenant-guarded
//     default client. Both are narrow, allowlisted exceptions — see their doc comments in
//     lib/supabase.ts and the two ALLOWED_CALLERS contract tests that enforce the allowlists. Fixed,
//     was F-ADM4-1 break #5 ("KNOWN BREAK #5" below is now a fixed-regression guard, not an open break).

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
const REPLACEMENT_LEAD = 'eeeeeeee-0000-4000-8000-0000000000e3';

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

        if (table === 'rpc/consume_internal_auth_replay_jti') return json(true);
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
        body: JSON.stringify({ idempotency_key: 'admin-web:listing:approve:test-key-0001', operator_user_id: MODERATOR }),
    });
}

const EMPLOYEES: Row[] = [
    { id: 'emp-moderator', user_id: MODERATOR, email: 'moderator@letbuyy.test', role: 'operations', role_id: null, permissions: [], is_active: true, status: 'active' },
    { id: 'emp-viewer', user_id: VIEWER, email: 'viewer@letbuyy.test', role: 'viewer', role_id: null, permissions: [], is_active: true, status: 'active' },
    { id: 'emp-replacement-lead', user_id: REPLACEMENT_LEAD, email: 'lead2@letbuyy.test', role: 'manager', role_id: null, permissions: [], is_active: true, status: 'active' },
];
const LISTINGS: Row[] = [{ id: LISTING, site_id: SITE, product_id: 'p1', channel: 'marketplace', status: 'pending_review', assigned_reviewer_id: MODERATOR, version: 1 }];

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
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'FORBIDDEN');
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

test('FIXED (F2.6): a review:decide operator passes auth and RBAC, and the listing read now reaches channel_listings', async (t) => {
    const postgrest = installFakePostgrest(
        { employees: EMPLOYEES, channel_listings: LISTINGS },
        { transition_channel_listing: [{ listing_id: LISTING, from_status: 'pending_review', to_status: 'approved', event_id: 'ev-1', replayed: false }] },
    );
    t.after(() => postgrest.restore());

    const response = await approve(await identityHeaders(MODERATOR, 'moderator@letbuyy.test'));

    // Auth and RBAC both let the moderator through — the permission lookup ran …
    assert.equal(postgrest.touched('employees'), true, 'requirePermission resolved the moderator\'s scopes');
    // … and the read now succeeds: loadChannelListingById (getSupabaseAdminUnguarded) reaches the
    // table instead of being refused by the tenant guard before any request left.
    assert.equal(postgrest.touched('channel_listings'), true, 'the bounded single-row lookup reached the table');
    assert.equal(response.status, 200, await response.clone().text());
});

test('an authorized operator approves a pending listing, recorded as the operator realm', async (t) => {
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

test('the production claim route revalidates the human reviewer and reaches the atomic claim RPC', async (t) => {
    const postgrest = installFakePostgrest(
        {
            employees: EMPLOYEES,
            channel_listings: [{ ...LISTINGS[0], assigned_reviewer_id: null, version: 4 }],
        },
        { claim_marketplace_listing_review: [{ listing_id: LISTING, assigned_reviewer_id: MODERATOR, version: 4, event_id: 'claim-1', replayed: false }] },
    );
    t.after(() => postgrest.restore());

    const headers = await identityHeaders(MODERATOR, 'moderator@letbuyy.test');
    const response = await gateway().request(`/operations/marketplace-listings/${LISTING}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({
            reason: 'I will review this product submission.',
            idempotency_key: 'claim-key-0001',
            expected_version: 4,
            operator_user_id: MODERATOR,
        }),
    });
    assert.equal(response.status, 200);
    assert.equal(postgrest.touched('employees'), true, 'the claimed identity has current platform membership and permissions checked');
    assert.equal(postgrest.touched('rpc/claim_marketplace_listing_review'), true);
});

test('a live platform lead can reassign through the production route and the atomic RPC', async (t) => {
    const postgrest = installFakePostgrest(
        { employees: EMPLOYEES, channel_listings: LISTINGS },
        { assign_marketplace_listing_reviewer: [{ listing_id: LISTING, previous_reviewer_id: MODERATOR, assigned_reviewer_id: REPLACEMENT_LEAD, version: 2, event_id: 'assignment-1', replayed: false }] },
    );
    t.after(() => postgrest.restore());

    const response = await gateway().request(`/operations/marketplace-listings/${LISTING}/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await identityHeaders(MODERATOR, 'moderator@letbuyy.test') },
        body: JSON.stringify({ assignee_user_id: REPLACEMENT_LEAD, reason: 'Reviewer on-call rotation changed.', idempotency_key: 'lead-assign-1', expected_version: 1, operator_user_id: MODERATOR }),
    });
    assert.equal(response.status, 200);
    assert.equal(postgrest.touched('employees'), true, 'actor and assignee are checked against current platform membership');
    assert.equal(postgrest.touched('rpc/assign_marketplace_listing_reviewer'), true);
});

test('production mounts the moderation router behind authMiddleware, as this harness does', () => {
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    const auth = index.indexOf("api.use('/*', authMiddleware);");
    const mount = index.indexOf("api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);");
    const broadOperationsGate = index.indexOf("api.route('/operations', operationsIncidentCommandRouter);");
    const consoleMount = index.indexOf("api.route('/internal/console', internalConsoleRouter);");
    assert.ok(auth !== -1 && mount !== -1 && consoleMount !== -1 && broadOperationsGate !== -1);
    assert.ok(auth < mount, 'the operator routes sit behind authMiddleware — the console bearer never reaches them');
    assert.ok(mount < broadOperationsGate, 'review routes with their own active-platform gate are mounted before incident-command');
    assert.ok(consoleMount < auth, 'only /internal/console, mounted before auth, accepts the console token');
});
