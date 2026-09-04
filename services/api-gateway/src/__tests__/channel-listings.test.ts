// MKT-1 — marketplace feed + taxonomy (public storefront reads) and channel-listing routes.
// Behavioural where it can be: the public routes are driven through a real Hono app with injected
// loaders, so what is asserted is the wire contract (query parsing, clamping, the five named RPC
// parameters, the response envelope, the cursor), not the source text. Source-shape assertions are
// kept only for facts no unit can exercise (mounting, "no service-role write path").

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import {
    marketplaceFeedParams,
    registerStorefrontPublicRoutes,
    MARKETPLACE_FEED_RPC,
    type MarketplaceFeedParams,
    type MarketplaceFeedRow,
} from '../routes/storefront/public-routes';
import { MarketplaceFeedQuery } from '../schemas/channel-listing.schema';

type PublicDeps = Parameters<typeof registerStorefrontPublicRoutes>[1];

const publicRoutesSource = readFileSync(new URL('../routes/storefront/public-routes.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/217_marketplace_channel_listings.sql', import.meta.url),
    'utf8',
);

const ROW: MarketplaceFeedRow = {
    listing_id: '11111111-0000-4000-8000-000000000001',
    product_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    site_id: 'aaaaaaaa-0000-4000-8000-00000000000a',
    store_name: 'Alpha Store',
    subdomain: 'alpha',
    name: 'Alpha One',
    slug: 'alpha-one',
    images: ['https://cdn.example/alpha-one.jpg'],
    price: '100.00',
    compare_price: null,
    category_slug: 'gadgets',
    approved_at: '2026-09-01T10:00:00+00:00',
};

function publicApp(overrides: Partial<PublicDeps> & { calls?: MarketplaceFeedParams[] } = {}) {
    const calls: MarketplaceFeedParams[] = overrides.calls ?? [];
    const app = new Hono();
    const deps = {
        loadMarketplaceFeed: async (_c: unknown, params: MarketplaceFeedParams) => {
            calls.push(params);
            return { data: [ROW], error: null };
        },
        listMarketplaceCategories: async () => ({
            data: [{ id: 'c1', slug: 'gadgets', name: 'Gadgets', parent_id: null, position: 0 }],
            error: null,
        }),
        ...overrides,
    } as unknown as PublicDeps;
    // Only the two MKT-1 routes are exercised; the other handlers are registered but never invoked.
    registerStorefrontPublicRoutes(app as unknown as Parameters<typeof registerStorefrontPublicRoutes>[0], deps);
    return { app, calls };
}

test('GET /marketplace/feed passes exactly the five marketplace_feed parameters, in the RPC\'s own names', async () => {
    const { app, calls } = publicApp();
    const res = await app.request('/marketplace/feed?category=gadgets&search=alpha&limit=5', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [{ category: 'gadgets', search: 'alpha', limit: 5, afterApprovedAt: null, afterId: null }]);

    const body = (await res.json()) as { success: boolean; data: MarketplaceFeedRow[]; meta: { limit: number; next_cursor: unknown } };
    assert.equal(body.success, true);
    assert.deepEqual(body.data, [ROW]);
    assert.equal(body.meta.limit, 5);
    assert.equal(body.meta.next_cursor, null, 'fewer rows than the limit means no next page');

    // The default loader names the parameters the way 217 declares them.
    for (const name of ['p_category_slug', 'p_search', 'p_limit', 'p_after_approved_at', 'p_after_id']) {
        assert.match(publicRoutesSource, new RegExp(`${name}:`), `default loader must pass ${name}`);
        assert.match(migrationSource, new RegExp(`\\b${name}\\b`), `217 must declare ${name}`);
    }
    assert.match(publicRoutesSource, new RegExp(`db\\.rpc\\(MARKETPLACE_FEED_RPC`), 'the feed is read through the RPC, never a hand-written join');
    assert.equal(MARKETPLACE_FEED_RPC, 'marketplace_feed');
});

test('GET /marketplace/feed clamps limit to 1..100 and emits a keyset cursor when a page is full', async () => {
    const { app, calls } = publicApp({
        loadMarketplaceFeed: async (_c: unknown, params: MarketplaceFeedParams) => {
            calls.push(params);
            return { data: Array.from({ length: params.limit }, (_, i) => ({ ...ROW, listing_id: `1111111${i}-0000-4000-8000-000000000001` })), error: null };
        },
    } as Partial<PublicDeps>);
    const res = await app.request('/marketplace/feed?limit=500', undefined, {});
    assert.equal(res.status, 200);
    assert.equal(calls[0].limit, 100, '500 is clamped to 100, not rejected');
    const body = (await res.json()) as { meta: { next_cursor: { after_approved_at: string; after_id: string } | null } };
    assert.deepEqual(body.meta.next_cursor, { after_approved_at: ROW.approved_at, after_id: '11111119-0000-4000-8000-000000000001' });

    const low = await app.request('/marketplace/feed?limit=0', undefined, {});
    assert.equal(low.status, 200);
    assert.equal(calls[1].limit, 1);
});

test('GET /marketplace/feed rejects a half cursor and a malformed category, and forwards a full cursor', async () => {
    const { app, calls } = publicApp();
    const half = await app.request('/marketplace/feed?after_id=11111111-0000-4000-8000-000000000001', undefined, {});
    assert.equal(half.status, 400);
    const badCategory = await app.request('/marketplace/feed?category=Not%20A%20Slug', undefined, {});
    assert.equal(badCategory.status, 400);
    assert.equal(calls.length, 0, 'validation failures never reach the loader');

    const full = await app.request(
        '/marketplace/feed?after_approved_at=2026-09-03T10:00:00%2B00:00&after_id=11111111-0000-4000-8000-000000000011',
        undefined,
        {},
    );
    assert.equal(full.status, 200);
    assert.equal(calls[0].afterApprovedAt, '2026-09-03T10:00:00+00:00');
    assert.equal(calls[0].afterId, '11111111-0000-4000-8000-000000000011');
});

test('GET /marketplace/feed maps a database error to the generic failure body, never the raw message', async () => {
    const { app } = publicApp({
        loadMarketplaceFeed: async () => ({ data: null, error: { message: 'relation "public.channel_listings" does not exist' } }),
    } as Partial<PublicDeps>);
    const res = await app.request('/marketplace/feed', undefined, {});
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.doesNotMatch(text, /channel_listings/, 'schema details must not leak to the public');
    assert.match(text, /"success":false/);
});

test('GET /marketplace/categories returns the injected live taxonomy in the success envelope', async () => {
    const { app } = publicApp();
    const res = await app.request('/marketplace/categories', undefined, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; data: Array<{ slug: string }> };
    assert.equal(body.success, true);
    assert.deepEqual(body.data.map((c) => c.slug), ['gadgets']);
    assert.match(publicRoutesSource, /\.from\('marketplace_categories'\)[\s\S]*?\.eq\('is_active', true\)/, 'the default loader mirrors the is_active read policy');
});

test('marketplaceFeedParams maps the validated query to the RPC parameter object', () => {
    const parsed = MarketplaceFeedQuery.parse({ category: 'gadgets', search: '  ', limit: '7' });
    assert.deepEqual(marketplaceFeedParams(parsed), { category: 'gadgets', search: null, limit: 7, afterApprovedAt: null, afterId: null });
});

test('the marketplace routes are registered ahead of the /:subdomain family and use the storefront cache wrapper', () => {
    const feedAt = publicRoutesSource.indexOf("router.get('/marketplace/feed'");
    const categoriesAt = publicRoutesSource.indexOf("router.get('/marketplace/categories'");
    const firstHandleRoute = publicRoutesSource.indexOf("router.get('/:subdomain");
    assert.ok(feedAt > 0 && categoriesAt > 0 && firstHandleRoute > 0);
    assert.ok(feedAt < firstHandleRoute && categoriesAt < firstHandleRoute, 'marketplace routes must precede the handle-shaped routes');
    const feedBlock = publicRoutesSource.slice(feedAt, categoriesAt);
    assert.match(feedBlock, /storefrontRequestCacheKey\(\s*c,\s*'marketplace:feed'/);
    for (const part of ['params.category', 'params.search', 'String(params.limit)', 'params.afterApprovedAt', 'params.afterId']) {
        assert.ok(feedBlock.includes(part), `the cache key must include ${part}`);
    }
    assert.match(feedBlock, /cachedJson\(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS/);
});
