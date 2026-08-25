/**
 * Storefront product detail (GET /:subdomain/products/:slug) — behavioural regression tests.
 *
 * W1 (PHASE-T3): the route destructured only `data` from the Supabase response and returned
 * NOT_FOUND whenever it was falsy, which made a genuine query failure indistinguishable from a
 * real absence. Two real defects were hiding behind that swallow:
 *   1. PRODUCT_SELECT_FULL/_RELATIONAL referenced columns that do not exist on `products`
 *      (short_description, compare_at_price, category_id, brand, inventory_quantity,
 *      dimensions) — PostgREST rejected every call with 42703, reported as "Product not found".
 *   2. The `.or('slug.eq.X,id.eq.X')` filter always included the id.eq. branch even when X is
 *      not uuid-shaped, and Postgres rejects casting a non-uuid string to the `id` column's uuid
 *      type (22P02) — this broke every by-slug lookup on its own, independent of defect 1.
 *
 * These tests exercise the real router end to end against a fake PostgREST installed on
 * globalThis.fetch, following the harness shape in storefront-handle-resolution.test.ts. The
 * fake is `.single()`-aware (Accept: application/vnd.pgrst.object+json) so it can reproduce
 * PostgREST's real PGRST116 zero-row response and the 42703/22P02 failure shapes verbatim.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import storefrontRouter from '../routes/storefront';

// ─── Fake PostgREST (single()-aware) ───────────────────────────────────────────

type Row = Record<string, unknown>;
type TableFixtures = Record<string, Row[]>;
type CapturedRequest = { table: string; params: URLSearchParams; single: boolean };
type FailureResponse = { status: number; body: unknown };

const POSTGREST_ORIGIN = 'https://postgrest.storefront-product-detail.test';

const SHAPE_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);

function matchesExpression(row: Row, column: string, expression: string): { ok: boolean; error?: FailureResponse } {
    const separator = expression.indexOf('.');
    const operator = separator === -1 ? expression : expression.slice(0, separator);
    const operand = separator === -1 ? '' : expression.slice(separator + 1);
    const value = row[column];

    if (operator === 'eq') {
        // Postgres rejects casting a non-uuid string to a uuid column outright — this is the
        // exact 22P02 defect W1 fixed. `id` is the only uuid column these tests filter on.
        if (column === 'id' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operand)) {
            return {
                ok: false,
                error: {
                    status: 400,
                    body: { code: '22P02', message: `invalid input syntax for type uuid: "${operand}"`, details: null, hint: null },
                },
            };
        }
        return { ok: String(value) === operand };
    }
    if (operator === 'is') return { ok: operand === 'null' ? value === null || value === undefined : false };
    return { ok: false };
}

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

/** Evaluates one row against the full query. Returns a hard error if any predicate can't run. */
function evaluateRow(row: Row, params: URLSearchParams): { included: boolean; error?: FailureResponse } {
    for (const [key, value] of params.entries()) {
        if (SHAPE_PARAMS.has(key)) continue;
        if (key === 'or') {
            const conditions = splitConditions(value.replace(/^\(|\)$/g, ''));
            let anyMatched = false;
            for (const condition of conditions) {
                const separator = condition.indexOf('.');
                const column = condition.slice(0, separator);
                const expression = condition.slice(separator + 1);
                const result = matchesExpression(row, column, expression);
                if (result.error) return { included: false, error: result.error };
                if (result.ok) anyMatched = true;
            }
            if (!anyMatched) return { included: false };
            continue;
        }
        const result = matchesExpression(row, key, value);
        if (result.error) return { included: false, error: result.error };
        if (!result.ok) return { included: false };
    }
    return { included: true };
}

type FakePostgrest = {
    readonly requests: CapturedRequest[];
    tableRequests(table: string): CapturedRequest[];
    restore: () => void;
};

function installFakePostgrest(
    tables: TableFixtures,
    failWith?: (table: string, params: URLSearchParams) => FailureResponse | null,
): FakePostgrest {
    const originalFetch = globalThis.fetch;
    const requests: CapturedRequest[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST_ORIGIN, 'the route must only talk to the fake PostgREST');

        const table = url.pathname.replace('/rest/v1/', '');
        const headers = new Headers(init?.headers);
        const single = headers.get('accept') === 'application/vnd.pgrst.object+json';
        requests.push({ table, params: new URLSearchParams(url.search), single });

        const failure = failWith?.(table, url.searchParams) ?? null;
        if (failure) {
            return new Response(JSON.stringify(failure.body), { status: failure.status, headers: { 'Content-Type': 'application/json' } });
        }

        const rows = tables[table] ?? [];
        const matched: Row[] = [];
        for (const row of rows) {
            const evaluated = evaluateRow(row, url.searchParams);
            if (evaluated.error) {
                return new Response(JSON.stringify(evaluated.error.body), { status: evaluated.error.status, headers: { 'Content-Type': 'application/json' } });
            }
            if (evaluated.included) matched.push(row);
        }

        if (single) {
            if (matched.length !== 1) {
                return new Response(JSON.stringify({
                    code: 'PGRST116',
                    details: `The result contains ${matched.length} rows`,
                    hint: null,
                    message: 'Cannot coerce the result to a single JSON object',
                }), { status: 406, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify(matched[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify(matched), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof globalThis.fetch;

    return {
        requests,
        tableRequests: (table: string) => requests.filter((request) => request.table === table),
        restore: () => { globalThis.fetch = originalFetch; },
    };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const STORE_A_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STORE_B_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

const SITE_A: Row = {
    id: STORE_A_ID,
    subdomain: 'snaz',
    store_name: 'Snaz',
    status: 'published',
    deleted_at: null,
};

const PRODUCT_A: Row = {
    id: 'aadc3e37-dd10-4fa2-82c4-40379f3aa561',
    store_id: STORE_A_ID,
    name: 'Snaz Canvas Tote',
    slug: 'snaz-canvas-tote',
    description: 'A real product.',
    price: 999,
    compare_price: null,
    cost_price: null,
    sku: null,
    barcode: null,
    product_type: null,
    tags: [],
    images: [],
    thumbnail_url: null,
    stock: 25,
    track_inventory: true,
    is_active: true,
    is_featured: false,
    weight: null,
    seo_title: null,
    seo_description: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    variants: [],
};

// Same slug, different store — the fixture a cross-tenant read would have to reach past.
const PRODUCT_B_SAME_SLUG: Row = {
    ...PRODUCT_A,
    id: 'bbbbbbbb-1111-4000-8000-000000000099',
    store_id: STORE_B_ID,
    name: 'Store B product with a colliding slug',
};

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
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

// ─── Tests ────────────────────────────────────────────────────────────────────

test('product detail resolves a real product by id', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.id}`, undefined, env());
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ success: boolean; data?: { id?: string; name?: string } }>(response);
    assert.equal(payload.success, true);
    assert.equal(payload.data?.id, PRODUCT_A.id);
    assert.equal(payload.data?.name, PRODUCT_A.name);
});

test('product detail resolves a real product by slug', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, env());
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ success: boolean; data?: { id?: string } }>(response);
    assert.equal(payload.success, true, JSON.stringify(payload));
    assert.equal(payload.data?.id, PRODUCT_A.id);
});

test('a genuinely absent product (by slug) returns NOT_FOUND, not a swallowed error', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request('/storefront/snaz/products/totally-nonexistent-product', undefined, env());
    assert.equal(response.status, 404);
    const payload = await jsonBody<{ error?: { code?: string } }>(response);
    assert.equal(payload.error?.code, 'NOT_FOUND');
});

test('a genuinely absent product (by uuid) returns NOT_FOUND, not a swallowed error', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request('/storefront/snaz/products/00000000-0000-0000-0000-000000000000', undefined, env());
    assert.equal(response.status, 404);
    const payload = await jsonBody<{ error?: { code?: string } }>(response);
    assert.equal(payload.error?.code, 'NOT_FOUND');
});

test('a product belonging to another store is never returned for this store\'s handle', async (t) => {
    const postgrest = installFakePostgrest({
        sites: [SITE_A],
        products: [PRODUCT_B_SAME_SLUG], // only store B's product exists; A has none with this slug
        product_variants: [],
    });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_B_SAME_SLUG.slug}`, undefined, env());
    assert.equal(response.status, 404, 'store A must never receive store B\'s product for a colliding slug');
    const payload = await jsonBody<{ error?: { code?: string } }>(response);
    assert.equal(payload.error?.code, 'NOT_FOUND');

    const productRequests = postgrest.tableRequests('products');
    assert.ok(productRequests.length > 0, 'the route must actually query products');
    for (const request of productRequests) {
        assert.equal(request.params.get('store_id'), `eq.${STORE_A_ID}`, 'every product query must stay scoped to the resolved store');
    }
});

test('a genuine query failure (schema mismatch) is reported distinctly from NOT_FOUND and never leaks the raw error', async (t) => {
    const postgrest = installFakePostgrest(
        { sites: [SITE_A], products: [PRODUCT_A], product_variants: [] },
        (table) => (table === 'products'
            ? { status: 400, body: { code: '42703', message: 'column products.short_description does not exist', details: null, hint: null } }
            : null),
    );
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, env());
    assert.equal(response.status, 500, 'a query failure must not be reported as 404');
    const payload = await jsonBody<{ success: boolean; error?: { code?: string; message?: string } }>(response);
    assert.equal(payload.success, false);
    assert.equal(payload.error?.code, 'DB_ERROR');
    assert.equal(payload.error?.message, 'Database operation failed', 'the raw PostgREST error must never reach the client');
    assert.ok(!JSON.stringify(payload).includes('42703'), 'the raw error code must never leak to the client');
    assert.ok(!JSON.stringify(payload).includes('short_description'), 'the raw error message must never leak to the client');
});

test('the id.eq. branch is only added for uuid-shaped identifiers, so a slug lookup never risks a uuid cast error', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, env());
    assert.equal(response.status, 200);

    const productRequests = postgrest.tableRequests('products');
    const orParam = productRequests[0]?.params.get('or');
    assert.ok(orParam, 'expected an or= filter');
    assert.ok(!orParam?.includes('id.eq.'), `slug lookups must not add an id.eq. branch: ${orParam}`);
});
