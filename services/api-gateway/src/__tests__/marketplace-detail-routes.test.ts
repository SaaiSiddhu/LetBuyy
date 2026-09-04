// MKT-3 — variants on the marketplace listing detail, and the boundaries around them.
//
// The route is driven through a real Hono app with injected fakes for the two reads, so what is
// asserted is the wire contract: what a marketplace shopper receives, in what order, and what they
// must never receive. The fence itself is SQL and is proven in
// tests/executable/marketplace-listing-detail-postgres.test.mjs; what matters here is that variants
// are read only after that fence has already admitted the listing, and that every variant row goes
// through SEC-2's shared projection rather than reaching the client as the database returned it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    PUBLIC_VARIANT_SELECT,
    registerStorefrontMarketplaceDetailRoutes,
    type MarketplaceListingDetailRow,
} from '../routes/storefront/marketplace-detail-routes';

const routeSource = readFileSync(new URL('../routes/storefront/marketplace-detail-routes.ts', import.meta.url), 'utf8');

const LISTING = '99999999-9999-4999-8999-999999999999';
const PRODUCT = '44444444-4444-4444-8444-444444444444';

const LISTING_ROW = {
    listing_id: LISTING,
    product_id: PRODUCT,
    site_id: '11111111-1111-4111-8111-111111111111',
    store_name: 'MKT3 Store',
    subdomain: 'mkt3-store',
    name: 'Listed Item',
    slug: 'listed-item',
    description: 'A description.',
    images: [],
    price: 799,
    compare_price: null,
    product_type: null,
    tags: [],
    thumbnail_url: null,
    stock: 5,
    track_inventory: true,
    seo_title: null,
    seo_description: null,
    category_slug: 'gadgets',
    approved_at: '2026-09-05T00:00:00.000Z',
} as unknown as MarketplaceListingDetailRow;

// Deliberately carries the two fields a public caller must never see, exactly as a real row would if
// the select list were ever widened — the projection, not the query, is what this proves.
const VARIANT_ROWS: Record<string, unknown>[] = [
    { id: 'v2', product_id: PRODUCT, title: 'Large', price: 1099, inventory_qty: 2, option1: 'Large', position: 2, sku: 'VAR-SKU-777', barcode: '4006381333931' },
    { id: 'v1', product_id: PRODUCT, title: 'Small', price: 999, inventory_qty: 7, option1: 'Small', position: 1 },
];

function app(options: {
    listing?: MarketplaceListingDetailRow | null;
    listingError?: unknown;
    variants?: Record<string, unknown>[];
    variantError?: unknown;
} = {}) {
    const variantCalls: string[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerStorefrontMarketplaceDetailRoutes(router, {
        loadMarketplaceListingDetail: async () => ({
            data: options.listing === undefined ? LISTING_ROW : options.listing,
            error: (options.listingError ?? null) as never,
        }),
        loadListingVariants: async (_c, productId) => {
            variantCalls.push(productId);
            return { data: options.variants ?? [], error: (options.variantError ?? null) as never };
        },
    });
    const outer = new Hono<{ Bindings: Env }>();
    outer.route('/storefront', router);
    return { app: outer, variantCalls };
}

const env = () => ({ ENVIRONMENT: 'test', STOREFRONT_POOLED_SQL: 'off' } as unknown as Env);
const request = (harness: ReturnType<typeof app>) =>
    harness.app.request(`/storefront/marketplace/listings/${LISTING}`, undefined, env());

test('an approved listing returns its variants, ordered as the loader supplied them', async () => {
    // The loader orders by position in SQL; the route must not reshuffle or drop any.
    const harness = app({ variants: [...VARIANT_ROWS].sort((a, b) => Number(a.position) - Number(b.position)) });
    const response = await request(harness);
    assert.equal(response.status, 200);
    const body = await response.json() as { success: boolean; data: { variants: Record<string, unknown>[] } };
    assert.equal(body.success, true);
    assert.deepEqual(body.data.variants.map((v) => v.title), ['Small', 'Large'], 'variants arrive in the loader\'s order');
    assert.equal(body.data.variants[0].price, 999);
    assert.deepEqual(harness.variantCalls, [PRODUCT], 'variants are read for the listing\'s own product, exactly once');
});

test('a variant row carrying sku or barcode leaks neither — the projection is applied, not bypassed', async () => {
    const harness = app({ variants: VARIANT_ROWS });
    const response = await request(harness);
    const body = await response.json() as { data: { variants: Record<string, unknown>[] } };
    for (const variant of body.data.variants) {
        assert.ok(!('sku' in variant), 'variant.sku must not reach a marketplace shopper');
        assert.ok(!('barcode' in variant), 'variant.barcode must not reach a marketplace shopper');
    }
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('VAR-SKU-777'), 'the SKU value must not appear anywhere in the response');
    assert.ok(!serialized.includes('4006381333931'), 'the barcode value must not appear anywhere in the response');
    // And the query does not even ask for them.
    assert.ok(!PUBLIC_VARIANT_SELECT.includes('sku'), 'the variant select must not request sku');
    assert.ok(!PUBLIC_VARIANT_SELECT.includes('barcode'), 'the variant select must not request barcode');
});

test('a product with no variants returns an empty array, not a missing key or an error', async () => {
    const response = await request(app({ variants: [] }));
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { variants: unknown[] } };
    assert.deepEqual(body.data.variants, [], 'a single-variant product still gets the key, so a client need not special-case it');
});

test('a variant-read failure degrades the page instead of failing it', async () => {
    // A product page without a variant picker is degraded; a 500 is broken. The listing itself was
    // already read successfully, so there is nothing dishonest about serving it.
    const response = await request(app({ variants: [], variantError: { message: 'relation "public.product_variants" does not exist' } }));
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { name: string; variants: unknown[] } };
    assert.equal(body.data.name, 'Listed Item');
    assert.deepEqual(body.data.variants, []);
});

test('a listing the fence excludes is still a 404, and no variants are read for it', async () => {
    const harness = app({ listing: null });
    const response = await request(harness);
    assert.equal(response.status, 404);
    assert.deepEqual(harness.variantCalls, [], 'variants must never be read for a listing the fence did not admit');
});

test('the route reads variants only after the listing is confirmed, and projects them through the shared definition', () => {
    const executable = routeSource.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    assert.match(executable, /import \{ toPublicVariant \} from '\.\.\/\.\.\/lib\/public-product-view'/, 'the shared projection is the one used');
    assert.doesNotMatch(executable, /sku:|barcode:/, 'the route must not map either field itself');
    // Ordering: the not-found return must appear before the variant read, so no read can precede the fence.
    const notFound = executable.indexOf('status: 404');
    const variantRead = executable.indexOf('await loadVariants(');
    assert.ok(notFound !== -1 && variantRead !== -1 && notFound < variantRead, 'the 404 path returns before any variant read');
});
