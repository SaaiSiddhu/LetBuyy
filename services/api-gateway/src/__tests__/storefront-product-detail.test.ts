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
    if (operator === 'ilike') {
        const pattern = operand
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
        return { ok: new RegExp(`^${pattern}$`, 'i').test(String(value ?? '')) };
    }
    // SEC-2: variant hydration filters with `.in('product_id', [...])`, which PostgREST sends as
    // `in.(a,b)`. Without this the fake matched nothing and the relational variant path could not be
    // exercised at all — the reason no existing test covered it.
    if (operator === 'in') {
        const members = operand.replace(/^\(/, '').replace(/\)$/, '').split(',').map((entry) => entry.trim().replace(/^"|"$/g, ''));
        return { ok: members.includes(String(value)) };
    }
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

// ─── SEC-1: merchant-internal columns must never reach an unauthenticated caller ──────────────
//
// This route is mounted at index.ts:754, BEFORE authMiddleware at :781, so every assertion below
// describes what an anonymous visitor to a storefront product page receives. PRODUCT_A above sets
// cost_price, sku and barcode to null, which is exactly why the leak survived every existing test
// here — these fixtures carry real values instead.

// Everything a merchant may see about its own product but a shopper may not: margin data
// (cost_price, cost_per_item), stock-keeping identifiers (sku, barcode) and row bookkeeping.
const MERCHANT_INTERNAL_FIELDS = ['cost_price', 'cost_per_item', 'sku', 'barcode', 'deleted_at', 'created_by', 'updated_by', 'version'] as const;

const PRODUCT_WITH_INTERNALS: Row = {
    ...PRODUCT_A,
    cost_price: 412.5,
    sku: 'SNZ-TOTE-001',
    barcode: '8901234567890',
    cost_per_item: 400,
    deleted_at: null,
    created_by: 'cccccccc-0000-4000-8000-0000000000c1',
    updated_by: 'cccccccc-0000-4000-8000-0000000000c1',
    version: 3,
};

test('SEC-1: the public product detail never returns cost price, SKU or barcode', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_WITH_INTERNALS], product_variants: [] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, env());
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ success: boolean; data: Record<string, unknown> }>(response);
    assert.equal(payload.success, true);
    assert.equal(payload.data.name, 'Snaz Canvas Tote', 'the public fields a storefront needs must still be returned');
    assert.equal(payload.data.price, 999);

    const serialized = JSON.stringify(payload);
    for (const field of MERCHANT_INTERNAL_FIELDS) {
        assert.ok(!(field in payload.data), `${field} must not be a key in a public product response`);
    }
    // Values, not just keys: a rename or a nested copy would still be a leak.
    assert.ok(!serialized.includes('412.5'), 'the cost price value must not appear anywhere in the response');
    assert.ok(!serialized.includes('SNZ-TOTE-001'), 'the SKU value must not appear anywhere in the response');
    assert.ok(!serialized.includes('8901234567890'), 'the barcode value must not appear anywhere in the response');

    // The select sent to PostgREST must not ask for them either — defence in depth, and the reason
    // the projection alone is not the whole fix.
    const select = postgrest.tableRequests('products')[0]?.params.get('select') ?? '';
    for (const field of ['cost_price', 'sku', 'barcode']) {
        assert.ok(!select.includes(field), `the public select must not request ${field}: ${select}`);
    }
});

test('SEC-1: the same holds on the non-relational fallback branch, which previously selected everything', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_WITH_INTERNALS], product_variants: [] });
    t.after(() => postgrest.restore());

    // PRODUCT_VARIANTS_RELATIONAL_READS=off took the `'*'` path, which returned every column on the
    // row — including cost_per_item and the bookkeeping columns the allowlist above never named.
    const offEnv = { ...env(), PRODUCT_VARIANTS_RELATIONAL_READS: 'off' } as unknown as Env;
    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, offEnv);
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data: Record<string, unknown> }>(response);
    for (const field of MERCHANT_INTERNAL_FIELDS) {
        assert.ok(!(field in payload.data), `${field} must not leak through the fallback branch either`);
    }
    const select = postgrest.tableRequests('products')[0]?.params.get('select') ?? '';
    assert.notEqual(select, '*', 'a public route must never select every column');
});

// ─── SEC-2: the same identifiers, one level down ──────────────────────────────────────────────
//
// SEC-1 removed cost_price, sku and barcode from the product row. Its allowlist filters TOP-LEVEL
// keys and deliberately keeps `variants`, so the array was copied through untouched — and variants
// carry sku and barcode on both paths: publicProductVariantView maps them in explicitly on the
// relational path, and products.variants (built by migration 086) contains them in the jsonb blob.
// Nothing renders either field. These fixtures carry real values, for the same reason SEC-1's did.

const VARIANT_INTERNAL_FIELDS = ['sku', 'barcode', 'cost_price', 'cost_per_item'] as const;

const VARIANT_ROW: Row = {
    id: 'dddddddd-0000-4000-8000-000000000001',
    product_id: PRODUCT_A.id,
    title: 'Large / Blue',
    price: 1099,
    compare_price: null,
    sku: 'VAR-SKU-777',
    barcode: '4006381333931',
    inventory_qty: 4,
    weight: null,
    weight_unit: 'kg',
    option1: 'Large',
    option2: 'Blue',
    option3: null,
    image_url: null,
    position: 1,
};

test('SEC-3: public product lists and by-id lookups use the recursive projection and evidenced compare price', async (t) => {
    const productWithJsonbVariant: Row = {
        ...PRODUCT_WITH_INTERNALS,
        price: 999,
        compare_price: 1499,
        currency: 'INR',
        category: 'bags',
        avg_rating: 4.5,
        review_count: 12,
        quantity: 25,
        stock_quantity: 25,
        status: 'active',
        variants: [{
            ...VARIANT_ROW,
            sku: 'VAR-SKU-777',
            barcode: '4006381333931',
            cost_per_item: 500,
            stock: 4,
        }],
    };
    const postgrest = installFakePostgrest({
        sites: [SITE_A],
        products: [productWithJsonbVariant],
        product_variants: [],
    });
    t.after(() => postgrest.restore());
    const offEnv = { ...env(), PRODUCT_VARIANTS_RELATIONAL_READS: 'off' } as unknown as Env;

    for (const path of ['/storefront/snaz/products', `/storefront/snaz/products/by-ids?ids=${PRODUCT_A.id}`]) {
        const response = await storefrontApp().request(path, undefined, offEnv);
        assert.equal(response.status, 200, path);
        const payload = await jsonBody<{ data: Record<string, unknown>[] }>(response);
        const product = payload.data[0];
        assert.equal(product.id, PRODUCT_A.id);
        assert.equal('currency' in product, false, 'product currency is inherited from the store, not read from a nonexistent products.currency column');
        assert.equal(product.category, 'bags');
        assert.equal('avg_rating' in product, false, 'product ratings are not stored on the products row');
        assert.equal('review_count' in product, false, 'product review counts are not stored on the products row');
        assert.equal(product.compare_price, null, 'an absent/incomplete reference window suppresses the seller-entered compare price');
        for (const field of [...MERCHANT_INTERNAL_FIELDS, 'quantity', 'stock_quantity', 'status']) {
            assert.equal(field in product, false, `${path} must not expose ${field}`);
        }
        const variants = product.variants as Record<string, unknown>[];
        assert.equal(variants.length, 1);
        assert.equal(variants[0].title, VARIANT_ROW.title);
        for (const field of VARIANT_INTERNAL_FIELDS) {
            assert.equal(field in variants[0], false, `${path} must not expose variant.${field}`);
        }
        assert.doesNotMatch(JSON.stringify(payload), /VAR-SKU-777|4006381333931/);
    }
});

test('F5: storefront list, assigned collection, and by-id reads apply exact case-insensitive origin filters', async (t) => {
    const india: Row & { id: string } = { ...PRODUCT_A, id: String(PRODUCT_A.id), category: 'clothing', country_of_origin: 'India' };
    const japan: Row & { id: string } = {
        ...PRODUCT_A,
        id: 'aadc3e37-dd10-4fa2-82c4-40379f3aa562',
        slug: 'japanese-tote',
        name: 'Japanese Tote',
        category: 'clothing',
        country_of_origin: 'Japan',
    };
    const foreignStoreIndiaTote: Row & { id: string } = {
        ...india,
        id: 'aadc3e37-dd10-4fa2-82c4-40379f3aa563',
        store_id: STORE_B_ID,
        name: 'India Tote from another store',
    };
    const collectionId = 'cccccccc-0000-4000-8000-000000000001';
    const postgrest = installFakePostgrest({
        sites: [SITE_A],
        products: [india, japan, foreignStoreIndiaTote],
        product_variants: [],
        collections: [{ id: collectionId, store_id: STORE_A_ID, title: 'Summer', is_active: true, deleted_at: null }],
        collection_products: [
            { collection_id: collectionId, product_id: india.id, position: 0 },
            { collection_id: collectionId, product_id: japan.id, position: 1 },
        ],
    });
    t.after(() => postgrest.restore());

    const app = storefrontApp();
    const list = await app.request('/storefront/snaz/products?country_of_origin=india&category=clothing&search=Tote', undefined, env());
    assert.equal(list.status, 200);
    assert.deepEqual((await jsonBody<{ data: Row[] }>(list)).data.map((product) => product.id), [india.id]);

    const byIds = await app.request(`/storefront/snaz/products/by-ids?ids=${india.id},${japan.id},${foreignStoreIndiaTote.id}&country_of_origin=INDIA`, undefined, env());
    assert.equal(byIds.status, 200);
    assert.deepEqual((await jsonBody<{ data: Row[] }>(byIds)).data.map((product) => product.id), [india.id]);

    const collection = await app.request(`/storefront/snaz/collections/${collectionId}?country_of_origin=India`, undefined, env());
    assert.equal(collection.status, 200, await collection.clone().text());
    const collectionPayload = await jsonBody<{ data: { products: Row[]; total: number } }>(collection);
    assert.deepEqual(collectionPayload.data.products.map((product) => product.id), [india.id]);
    assert.equal(collectionPayload.data.total, 1);

    const invalid = await app.request(`/storefront/snaz/products?country_of_origin=${'x'.repeat(101)}`, undefined, env());
    assert.equal(invalid.status, 400);
});

test('SEC-2: the relational variant path returns no sku or barcode', async (t) => {
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [PRODUCT_A], product_variants: [VARIANT_ROW] });
    t.after(() => postgrest.restore());

    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, env());
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data: { variants?: Record<string, unknown>[] } }>(response);
    const variants = payload.data.variants ?? [];
    assert.equal(variants.length, 1, 'the variant must still be returned — this is a redaction, not a removal');

    for (const field of VARIANT_INTERNAL_FIELDS) {
        assert.ok(!(field in variants[0]), `variant.${field} must not reach a public caller`);
    }
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes('VAR-SKU-777'), 'the variant SKU value must not appear anywhere in the response');
    assert.ok(!serialized.includes('4006381333931'), 'the variant barcode value must not appear anywhere in the response');

    // What a storefront actually renders must be untouched.
    assert.equal(variants[0].title, 'Large / Blue');
    assert.equal(variants[0].price, 1099);
    assert.equal(variants[0].option1, 'Large');
    assert.equal(variants[0].stock, 4);
});

test('SEC-2: the products.variants jsonb path returns no sku or barcode either', async (t) => {
    // Migration 086 builds this blob with 'sku' and 'barcode' inside it. With
    // PRODUCT_VARIANTS_RELATIONAL_READS=off the row's own column is what ships, so the projection —
    // not the select list — is the only thing standing between that blob and an anonymous caller.
    const productWithJsonbVariants: Row = {
        ...PRODUCT_A,
        variants: [{
            id: VARIANT_ROW.id,
            product_id: PRODUCT_A.id,
            title: 'Large / Blue',
            price: 1099,
            compare_price: null,
            sku: 'VAR-SKU-777',
            barcode: '4006381333931',
            stock: 4,
            inventory_qty: 4,
            option1: 'Large',
            option2: 'Blue',
            option3: null,
            image_url: null,
            position: 1,
        }],
    };
    const postgrest = installFakePostgrest({ sites: [SITE_A], products: [productWithJsonbVariants], product_variants: [] });
    t.after(() => postgrest.restore());

    const offEnv = { ...env(), PRODUCT_VARIANTS_RELATIONAL_READS: 'off' } as unknown as Env;
    const response = await storefrontApp().request(`/storefront/snaz/products/${PRODUCT_A.slug}`, undefined, offEnv);
    assert.equal(response.status, 200);
    const payload = await jsonBody<{ data: { variants?: Record<string, unknown>[] } }>(response);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes('VAR-SKU-777'), 'the jsonb blob must be projected, not passed through');
    assert.ok(!serialized.includes('4006381333931'), 'the jsonb blob must be projected, not passed through');
    for (const variant of payload.data.variants ?? []) {
        for (const field of VARIANT_INTERNAL_FIELDS) {
            assert.ok(!(field in variant), `variant.${field} must not survive the jsonb path`);
        }
    }
});
