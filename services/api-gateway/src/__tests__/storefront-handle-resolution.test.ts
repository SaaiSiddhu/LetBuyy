/**
 * Storefront handle resolution — behavioural regression tests.
 *
 * A public storefront request carries one handle and must resolve exactly one tenant.
 * sites.subdomain and sites.store_name each carry their own unique index but are never
 * unique against each other, so one predicate matching both columns can match two
 * different tenants for the same handle and — with limit(1) and no ordering — hand back
 * an arbitrary one. That is a cross-tenant read: site B's store_name captures site A's
 * subdomain and the storefront serves B's tenant id under A's host.
 *
 * These tests exercise the real router (`routes/storefront`) end to end. The Supabase
 * service client is a real client pointed at a fake PostgREST endpoint installed on
 * globalThis.fetch, so the assertions run against the shipped query builders rather
 * than a re-implementation of them. The fake honours PostgREST semantics for the
 * operators the resolver uses (including `or=`), which is what makes a regression
 * visible: reinstating `or=(subdomain.eq.X,store_name.eq.X)` makes the fake return
 * site B first, and every assertion below rejects that row.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../index';
import storefrontRouter from '../routes/storefront';

// ─── Fake PostgREST ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type TableFixtures = Record<string, Row[]>;
type CapturedRequest = { table: string; params: URLSearchParams };
type FailureResponse = { status: number; body: unknown };

const POSTGREST_ORIGIN = 'https://postgrest.storefront-handle.test';

/** Query parameters PostgREST reserves for shaping rather than filtering. */
const SHAPE_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Evaluates one PostgREST filter expression (`eq.value`, `is.null`, `not.eq.value`, …)
 * against a row. Unsupported operators throw so an untested query surfaces as a failure
 * rather than silently matching nothing.
 */
function matchesExpression(row: Row, column: string, expression: string): boolean {
    const separator = expression.indexOf('.');
    const operator = separator === -1 ? expression : expression.slice(0, separator);
    const operand = separator === -1 ? '' : expression.slice(separator + 1);
    const value = row[column];

    // SQL three-valued logic: NOT (NULL = x) is NULL, which excludes the row.
    if (operator === 'not') return value === null || value === undefined ? false : !matchesExpression(row, column, operand);
    if (operator === 'is') {
        if (operand !== 'null') throw new Error(`fake PostgREST: unsupported is.${operand}`);
        return value === null || value === undefined;
    }
    if (value === null || value === undefined) return false;

    switch (operator) {
        case 'eq':
            return String(value) === operand;
        case 'gt':
            return String(value) > operand;
        case 'ilike':
            return new RegExp(`^${escapeRegExp(operand).replace(/%/g, '.*')}$`, 'i').test(String(value));
        default:
            throw new Error(`fake PostgREST: unsupported operator "${operator}"`);
    }
}

/** Splits `a.eq.1,b.eq.2` on top-level commas only. */
function splitConditions(list: string): string[] {
    const conditions: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of list) {
        if (character === '(') depth += 1;
        if (character === ')') depth -= 1;
        if (character === ',' && depth === 0) {
            conditions.push(current);
            current = '';
            continue;
        }
        current += character;
    }
    if (current) conditions.push(current);
    return conditions;
}

function matchesCondition(row: Row, condition: string): boolean {
    const separator = condition.indexOf('.');
    if (separator === -1) throw new Error(`fake PostgREST: malformed condition "${condition}"`);
    return matchesExpression(row, condition.slice(0, separator), condition.slice(separator + 1));
}

function matchesQuery(row: Row, params: URLSearchParams): boolean {
    for (const [key, value] of params.entries()) {
        if (SHAPE_PARAMS.has(key)) continue;
        if (key === 'or') {
            const conditions = splitConditions(value.replace(/^\(|\)$/g, ''));
            if (!conditions.some((condition) => matchesCondition(row, condition))) return false;
            continue;
        }
        if (!matchesExpression(row, key, value)) return false;
    }
    return true;
}

function shapeRows(rows: Row[], params: URLSearchParams): Row[] {
    let shaped = [...rows];

    const order = params.get('order');
    if (order) {
        const [column, direction] = order.split('.');
        shaped.sort((left, right) => {
            const comparison = String(left[column] ?? '').localeCompare(String(right[column] ?? ''));
            return direction === 'desc' ? -comparison : comparison;
        });
    }

    const limit = params.get('limit');
    if (limit) shaped = shaped.slice(0, Number(limit));

    const select = params.get('select');
    if (!select || select === '*') return shaped;
    if (select.includes('(')) throw new Error('fake PostgREST: embedded selects are not implemented');

    const columns = select.split(',').map((column) => column.trim());
    return shaped.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
}

type FakePostgrest = {
    readonly requests: CapturedRequest[];
    sitesRequests(): CapturedRequest[];
    restore(): void;
};

/**
 * Serves `tables` over globalThis.fetch as PostgREST would. `failWith` lets a test
 * reproduce a real schema mismatch (the only condition the compat retry exists for).
 */
function installFakePostgrest(
    tables: TableFixtures,
    failWith?: (table: string, params: URLSearchParams) => FailureResponse | null,
): FakePostgrest {
    const originalFetch = globalThis.fetch;
    const requests: CapturedRequest[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST_ORIGIN, 'the resolver must only talk to the fake PostgREST');
        assert.equal(init?.method ?? 'GET', 'GET', 'handle resolution must never write');

        const table = url.pathname.replace('/rest/v1/', '');
        requests.push({ table, params: new URLSearchParams(url.search) });

        const failure = failWith?.(table, url.searchParams) ?? null;
        if (failure) {
            return new Response(JSON.stringify(failure.body), {
                status: failure.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const rows = (tables[table] ?? []).filter((row) => matchesQuery(row, url.searchParams));
        return new Response(JSON.stringify(shapeRows(rows, url.searchParams)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as typeof globalThis.fetch;

    return {
        requests,
        sitesRequests: () => requests.filter((request) => request.table === 'sites'),
        restore: () => {
            globalThis.fetch = originalFetch;
        },
    };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** The collision shape: A owns it as a subdomain, B owns it as a store_name. */
const COLLIDING_HANDLE = 'urban-kicks';

const SITE_A: Row = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    subdomain: COLLIDING_HANDLE,
    store_name: 'tenant-a-store',
    name: 'Tenant A',
    status: 'published',
    published: true,
    access_mode: 'public',
    site_type: 'store',
    primary_color: '#0a7d33',
    deleted_at: null,
};

const SITE_B: Row = {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    subdomain: 'tenant-b-handle',
    store_name: COLLIDING_HANDLE,
    name: 'Tenant B',
    status: 'published',
    published: true,
    access_mode: 'public',
    site_type: 'store',
    primary_color: '#b3261e',
    deleted_at: null,
};

// B is listed first: a predicate that matches both tenants and keeps the first row
// returns B, so every assertion below fails loudly on a wrong-tenant result.
const COLLIDING_SITES: Row[] = [SITE_B, SITE_A];

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        // Pooled SQL stays off so resolution runs through the Supabase query builders.
        STOREFRONT_POOLED_SQL: 'off',
    } as unknown as Env;
}

function storefrontApp(): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', storefrontRouter);
    return app;
}

async function jsonBody<T>(response: Response): Promise<T> {
    return await response.json() as T;
}

// ─── Harness control ──────────────────────────────────────────────────────────

test('control: the ambiguous predicate the fix removed selects the namesake tenant', async (t) => {
    // Without this the suite could pass on a fixture that cannot express the defect.
    // Running the removed predicate through the same client and the same fake shows it
    // returns site B for site A's handle — the exact row every assertion below rejects.
    const postgrest = installFakePostgrest({ sites: COLLIDING_SITES });
    t.after(() => postgrest.restore());

    const db = createSupabaseServiceClient({
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    });
    const { data } = await db
        .from('sites')
        .select('id')
        .or(`subdomain.eq.${COLLIDING_HANDLE},store_name.eq.${COLLIDING_HANDLE}`)
        .is('deleted_at', null)
        .limit(1);

    assert.equal((data as Row[] | null)?.[0]?.id, SITE_B.id);
});

// ─── A. Handle resolution is single-valued and fails closed ───────────────────

test('handle resolution returns the subdomain owner, never the store_name namesake', async (t) => {
    const postgrest = installFakePostgrest({ sites: COLLIDING_SITES, app_extension_registrations: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(
        `/storefront/${COLLIDING_HANDLE}/checkout/extensions`,
        undefined,
        env(),
    );

    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data?: { store_id?: string } }>(response);
    assert.equal(
        payload.data?.store_id,
        SITE_A.id,
        'the handle belongs to site A as a subdomain; resolving it to site B is a cross-tenant read',
    );
    assert.notEqual(payload.data?.store_id, SITE_B.id);

    // The resolver must probe the canonical column only — an `or=` predicate or a
    // store_name filter is the ambiguity this test exists to reject.
    const sitesRequests = postgrest.sitesRequests();
    assert.ok(sitesRequests.length > 0, 'the route must actually query sites');
    for (const request of sitesRequests) {
        assert.equal(request.params.get('subdomain'), `eq.${COLLIDING_HANDLE}`);
        assert.equal(request.params.get('or'), null);
        assert.equal(request.params.get('store_name'), null);
    }
});

test('store lookup resolves the colliding handle to the subdomain owner', async (t) => {
    const postgrest = installFakePostgrest({ sites: COLLIDING_SITES });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(
        `/storefront/lookup?q=${COLLIDING_HANDLE}`,
        undefined,
        env(),
    );

    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data?: { status?: string; store?: { name?: string; subdomain?: string } } }>(response);
    assert.equal(payload.data?.status, 'found');
    // name differs between the two tenants, so a namesake match cannot pass this.
    assert.equal(payload.data?.store?.name, SITE_A.name);
    assert.equal(payload.data?.store?.subdomain, SITE_A.subdomain);
});

test('public finder excludes private/draft stores and an unknown name returns a clean miss without an unscoped fuzzy scan', async (t) => {
    const rows: Row[] = [
        {...SITE_A, subdomain:'private-fixture',store_name:'private-fixture',access_mode:'password'},
        {...SITE_B, subdomain:'draft-fixture',store_name:'draft-fixture',status:'draft',published:false},
    ];
    const postgrest=installFakePostgrest({sites:rows}); t.after(()=>postgrest.restore());
    for(const handle of ['private-fixture','draft-fixture','no-such-finder']){
        const response=await storefrontApp().request('/storefront/lookup?q='+handle,undefined,env());
        assert.equal(response.status,200);
        const body=await jsonBody<{data:{status:string;store?:unknown}}>(response);
        assert.equal(body.data.status,'not_found');assert.equal(body.data.store,undefined);
    }
    assert.ok(postgrest.sitesRequests().every(r=>!r.params.has('name')),'no unscoped fuzzy query');
});

test('an unknown handle resolves to not-found rather than an arbitrary tenant', async (t) => {
    const postgrest = installFakePostgrest({ sites: COLLIDING_SITES, app_extension_registrations: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(
        '/storefront/no-such-handle/checkout/extensions',
        undefined,
        env(),
    );

    assert.equal(response.status, 404);
    const payload = await jsonBody<{ error?: { code?: string } }>(response);
    assert.equal(payload.error?.code, 'NOT_FOUND');

    const sitesRequests = postgrest.sitesRequests();
    assert.ok(sitesRequests.length > 0, 'the route must actually query sites');
    for (const request of sitesRequests) {
        assert.equal(request.params.get('subdomain'), 'eq.no-such-handle');
    }
});

test('a soft-deleted site is not resurrected when its handle is requested', async (t) => {
    const softDeleted: Row = { ...SITE_A, deleted_at: '2026-01-04T00:00:00.000Z' };
    const postgrest = installFakePostgrest({ sites: [SITE_B, softDeleted], app_extension_registrations: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(
        `/storefront/${COLLIDING_HANDLE}/checkout/extensions`,
        undefined,
        env(),
    );

    assert.equal(response.status, 404, 'a deleted tenant must stay unreachable');

    // The compat retry drops the deleted_at filter, so it must fire only on a real
    // schema mismatch. A plain miss that reruns the query unfiltered would serve the
    // deleted tenant back.
    for (const request of postgrest.sitesRequests()) {
        assert.equal(
            request.params.get('deleted_at'),
            'is.null',
            'no handle lookup may run without the soft-delete filter',
        );
    }
});

test('the schema-compat retry still fires when deleted_at is genuinely absent', async (t) => {
    // A legacy schema with no deleted_at column: nothing can be soft-deleted there,
    // which is the only situation the filter-less retry exists for.
    const legacySiteA: Row = { ...SITE_A };
    delete legacySiteA.deleted_at;
    const legacySiteB: Row = { ...SITE_B };
    delete legacySiteB.deleted_at;

    const postgrest = installFakePostgrest(
        { sites: [legacySiteB, legacySiteA], app_extension_registrations: [] },
        (table, params) => (table === 'sites' && params.has('deleted_at')
            ? { status: 400, body: { code: '42703', message: 'column sites.deleted_at does not exist' } }
            : null),
    );
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(
        `/storefront/${COLLIDING_HANDLE}/checkout/extensions`,
        undefined,
        env(),
    );

    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data?: { store_id?: string } }>(response);
    assert.equal(payload.data?.store_id, SITE_A.id);

    const unfiltered = postgrest.sitesRequests().filter((request) => !request.params.has('deleted_at'));
    assert.equal(unfiltered.length, 1, 'the compat retry must run exactly once, and only after the mismatch');
    assert.equal(unfiltered[0]?.params.get('subdomain'), `eq.${COLLIDING_HANDLE}`);
});
