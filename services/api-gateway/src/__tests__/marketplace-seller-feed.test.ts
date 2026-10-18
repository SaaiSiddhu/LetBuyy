import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import * as publicFeedCompatibility from '../routes/storefront/public-routes';
import * as canonicalFeedModule from '../routes/storefront/marketplace-feed-routes';
import {
    registerStorefrontPublicRoutes,
    type MarketplaceFeedParams,
    type MarketplaceFeedRow,
} from '../routes/storefront/public-routes';

type Deps = Parameters<typeof registerStorefrontPublicRoutes>[1];
const SITE = '11111111-1111-4111-8111-111111111111';
const LISTING = '22222222-2222-4222-8222-222222222222';
const APPROVED = '2026-10-01T00:00:00Z';
const ROW: MarketplaceFeedRow = {
    listing_id: LISTING, product_id: '33333333-3333-4333-8333-333333333333',
    site_id: SITE, store_name: 'Synthetic seller', subdomain: 'syn-seller', name: 'Synthetic product',
    slug: 'syn-product', images: [], price: 100, compare_price: null,
    category_slug: 'clothing', approved_at: APPROVED, country_of_origin: 'India',
};
function app(loader: Deps['loadMarketplaceFeed'] = async () => ({ data: [ROW], error: null })) {
    const calls: MarketplaceFeedParams[] = [];
    const router = new Hono();
    registerStorefrontPublicRoutes(router as unknown as Parameters<typeof registerStorefrontPublicRoutes>[0], {
        loadMarketplaceFeed: async (c: Parameters<NonNullable<Deps['loadMarketplaceFeed']>>[0], params: MarketplaceFeedParams) => {
            calls.push(params);
            return loader!(c, params);
        },
        loadMarketplacePriceObservations: async () => ({ data: [], error: null }),
    } as unknown as Deps);
    return { router, calls };
}

test('seller filter travels with the exact category/origin/search/cursor before the canonical feed read', async () => {
    const { router, calls } = app();
    const query = new URLSearchParams({ site_id: SITE, category: 'clothing', country_of_origin: ' India ', search: ' shirt ', limit: '1', after_approved_at: APPROVED, after_id: LISTING });
    const response = await router.request(`/marketplace/feed?${query}`, undefined, {});
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ siteId: SITE, category: 'clothing', search: 'shirt', countryOfOrigin: 'India', limit: 1, afterApprovedAt: APPROVED, afterId: LISTING }]);
    const body = await response.json() as { data: MarketplaceFeedRow[]; meta: { next_cursor: unknown } };
    assert.equal(body.data[0].site_id, SITE);
    assert.deepEqual(body.meta.next_cursor, { after_approved_at: APPROVED, after_id: LISTING });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('invalid seller identifiers and half cursors never reach the public loader', async () => {
    for (const query of ['site_id=', 'site_id=not-a-store', `site_id=${SITE}&after_id=${LISTING}`, `site_id=${SITE}&after_approved_at=${APPROVED}`]) {
        const { router, calls } = app();
        const response = await router.request(`/marketplace/feed?${query}`, undefined, {});
        assert.equal(response.status, 400, query);
        assert.equal(calls.length, 0);
    }
});

test('legacy unscoped feed params and response shape stay unchanged', async () => {
    const { router, calls } = app();
    const response = await router.request('/marketplace/feed?limit=2', undefined, {});
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ category: null, search: null, countryOfOrigin: null, limit: 2, afterApprovedAt: null, afterId: null }]);
    const body = await response.json() as { data: MarketplaceFeedRow[]; meta: { next_cursor: unknown } };
    assert.equal(body.data.length, 1);
    assert.equal(body.meta.next_cursor, null);
});

test('empty seller read is public empty data without a profile/existence claim', async () => {
    const { router } = app(async () => ({ data: [], error: null }));
    const response = await router.request(`/marketplace/feed?site_id=${SITE}`, undefined, {});
    assert.equal(response.status, 200);
    const body = await response.json() as { data: unknown[]; meta: { next_cursor: unknown } };
    assert.deepEqual(body.data, []);
    assert.equal(body.meta.next_cursor, null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('seller retries re-read eligibility and an upstream failure is sanitized rather than stale success', async () => {
    let attempt = 0;
    const { router } = app(async () => {
        attempt++;
        if (attempt === 1) return { data: [ROW], error: null };
        if (attempt === 2) return { data: null, error: { message: 'private database details' } };
        return { data: [], error: null };
    });
    const url = `/marketplace/feed?site_id=${SITE}`;
    const first = await router.request(url, undefined, {});
    assert.equal(first.status, 200);
    const failed = await router.request(url, undefined, {});
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes('private database details'), false);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
    const retried = await router.request(url, undefined, {});
    assert.equal(retried.status, 200);
    assert.deepEqual((await retried.json() as { data: unknown[] }).data, []);
    assert.equal(attempt, 3);
});


test('legacy public feed exports reference the focused canonical functions without parallel implementations', () => {
    for (const name of [
        'MARKETPLACE_FEED_RPC',
        'loadMarketplaceFeedFromDatabase',
        'loadMarketplacePriceObservationsFromDatabase',
        'listMarketplaceCategoriesFromDatabase',
        'listMarketplaceOriginsFromDatabase',
        'marketplaceFeedParams',
    ] as const) {
        assert.strictEqual(publicFeedCompatibility[name], canonicalFeedModule[name], name);
    }
});
