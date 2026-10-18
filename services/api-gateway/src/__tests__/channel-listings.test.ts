// MKT-1 — marketplace feed + taxonomy (public storefront reads) and channel-listing routes.
// Behavioural where it can be: the public routes are driven through a real Hono app with injected
// loaders, so what is asserted is the wire contract (query parsing, clamping, the five named RPC
// parameters, the response envelope, the cursor), not the source text. Source-shape assertions are
// kept only for facts no unit can exercise (mounting, "no service-role write path").

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
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
const originMigrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/272_marketplace_origin_filter.sql', import.meta.url),
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
    compare_price: 250,
    category_slug: 'gadgets',
    approved_at: '2026-09-01T10:00:00+00:00',
    country_of_origin: 'India',
};

function publicApp(overrides: Partial<PublicDeps> & { calls?: MarketplaceFeedParams[]; priceChannels?: string[] } = {}) {
    const calls: MarketplaceFeedParams[] = overrides.calls ?? [];
    const priceChannels: string[] = overrides.priceChannels ?? [];
    const app = new Hono();
    const deps = {
        loadMarketplaceFeed: async (_c: unknown, params: MarketplaceFeedParams) => {
            calls.push(params);
            return { data: [ROW], error: null };
        },
        loadMarketplacePriceObservations: async (_c: unknown, _productIds: string[], channel: string) => {
            priceChannels.push(channel);
            return { data: [], error: null };
        },
        listMarketplaceCategories: async () => ({
            data: [{ id: 'c1', slug: 'gadgets', name: 'Gadgets', parent_id: null, position: 0 }],
            error: null,
        }),
        ...overrides,
    } as unknown as PublicDeps;
    // Only the two MKT-1 routes are exercised; the other handlers are registered but never invoked.
    registerStorefrontPublicRoutes(app as unknown as Parameters<typeof registerStorefrontPublicRoutes>[0], deps);
    return { app, calls, priceChannels };
}

test('GET /marketplace/feed passes the origin filter and existing feed parameters', async () => {
    const { app, calls, priceChannels } = publicApp();
    const res = await app.request('/marketplace/feed?category=gadgets&search=alpha&limit=5', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [{ category: 'gadgets', search: 'alpha', limit: 5, afterApprovedAt: null, afterId: null, countryOfOrigin: null }]);

    const body = (await res.json()) as { success: boolean; data: MarketplaceFeedRow[]; meta: { limit: number; next_cursor: unknown } };
    assert.equal(body.success, true);
    assert.equal(body.data[0].product_id, ROW.product_id);
    assert.equal(body.data[0].price, 100);
    assert.equal(body.data[0].compare_price, null, 'a feed item without complete evidence has no sale reference');
    assert.deepEqual(priceChannels, ['marketplace'], 'marketplace feed history must never fall back to the storefront channel');
    assert.equal(body.meta.limit, 5);
    assert.equal(body.meta.next_cursor, null, 'fewer rows than the limit means no next page');

    // The old five-argument RPC remains available; the overloaded origin-aware call adds one input
    // and one public field while preserving the same listing visibility contract.
    for (const name of ['p_category_slug', 'p_search', 'p_limit', 'p_after_approved_at', 'p_after_id']) {
        assert.match(publicRoutesSource, new RegExp(`${name}:`), `default loader must pass ${name}`);
        assert.match(migrationSource, new RegExp(`\\b${name}\\b`), `217 must declare ${name}`);
    }
    assert.match(originMigrationSource, /p_country_of_origin text/);
    assert.match(originMigrationSource, /lower\(btrim\(p\.country_of_origin\)\) = lower\(btrim\(p_country_of_origin\)\)/);
    assert.match(originMigrationSource, /cl\.channel = 'marketplace'[\s\S]*cl\.status = 'approved'[\s\S]*cl\.visibility = 'public'/);
    assert.match(publicRoutesSource, /p_country_of_origin: params\.countryOfOrigin/);
    assert.match(publicRoutesSource, new RegExp(`db\\.rpc\\(MARKETPLACE_FEED_RPC`), 'the feed is read through the RPC, never a hand-written join');
    assert.equal(MARKETPLACE_FEED_RPC, 'marketplace_feed');
    assert.match(publicRoutesSource, /p_channel:\s*channel/, 'the price-history loader must forward the requested channel to the RPC');
});

test('GET /marketplace/feed replaces compare price with a complete prior low', async () => {
    const { app } = publicApp({
        loadMarketplacePriceObservations: async () => ({
            data: [{
                product_id: ROW.product_id,
                variant_id: null,
                current_price: 100,
                prior_lowest_price_30d: 150,
                prior_coverage_complete: true,
                price_observed_at: '2026-10-04T00:00:00Z',
            }],
            error: null,
        }),
    } as Partial<PublicDeps>);
    const res = await app.request('/marketplace/feed', undefined, {});
    assert.equal(res.status, 200);
    const body = await res.json() as { data: MarketplaceFeedRow[] };
    assert.equal(body.data[0].compare_price, 150);
});

test('marketplace feed search rechecks eligibility instead of serving a cached approval', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    let cacheLookups = 0;
    let cacheWrites = 0;
    Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: { default: {
            match: async () => {
                cacheLookups += 1;
                return new Response(JSON.stringify({ success: true, data: [ROW] }));
            },
            put: async () => { cacheWrites += 1; },
            delete: async () => true,
        } },
    });
    try {
        let eligibleRows: MarketplaceFeedRow[] = [ROW];
        const { app } = publicApp({ loadMarketplaceFeed: async () => ({ data: eligibleRows, error: null }) });
        const request = () => app.request('/marketplace/feed?search=alpha', undefined,
            { ENVIRONMENT: 'test', STOREFRONT_CACHE: 'on' } as unknown as Env);

        const first = await request();
        assert.equal(first.status, 200);
        assert.equal(first.headers.get('Cache-Control'), 'no-store');
        assert.equal(first.headers.get('X-Storefront-Cache'), 'BYPASS');
        assert.deepEqual((await first.json() as { data: MarketplaceFeedRow[] }).data.map((row) => row.listing_id), [ROW.listing_id]);

        eligibleRows = [];
        const afterRevocation = await request();
        assert.equal(afterRevocation.status, 200);
        assert.equal(afterRevocation.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual((await afterRevocation.json() as { data: MarketplaceFeedRow[] }).data, []);
        assert.equal(cacheLookups, 0, 'search/feed must not consult the stale approved response');
        assert.equal(cacheWrites, 0, 'eligibility-sensitive feed results must not repopulate cache');
    } finally {
        if (original) Object.defineProperty(globalThis, 'caches', original);
        else Reflect.deleteProperty(globalThis, 'caches');
    }
});

test('GET /marketplace/feed clamps limit to 1..100 and emits a keyset cursor when a page is full', async () => {
    const listingId = (i: number) => `11111111-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const { app, calls } = publicApp({
        loadMarketplaceFeed: async (_c: unknown, params: MarketplaceFeedParams) => {
            calls.push(params);
            return { data: Array.from({ length: params.limit }, (_, i) => ({ ...ROW, listing_id: listingId(i) })), error: null };
        },
    } as Partial<PublicDeps>);
    const res = await app.request('/marketplace/feed?limit=500', undefined, {});
    assert.equal(res.status, 200);
    assert.equal(calls[0].limit, 100, '500 is clamped to 100, not rejected');
    const body = (await res.json()) as { meta: { next_cursor: { after_approved_at: string; after_id: string } | null } };
    assert.deepEqual(body.meta.next_cursor, { after_approved_at: ROW.approved_at, after_id: listingId(99) }, 'the cursor is the last row of a full page');

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

test('marketplaceFeedParams trims the country filter and maps it into the RPC contract', () => {
    const parsed = MarketplaceFeedQuery.parse({ category: 'gadgets', search: '  ', country_of_origin: '  India  ', limit: '7' });
    assert.deepEqual(marketplaceFeedParams(parsed), { category: 'gadgets', search: null, limit: 7, afterApprovedAt: null, afterId: null, countryOfOrigin: 'India' });
});

test('marketplace origin filter rejects blank and overlong input', () => {
    assert.equal(MarketplaceFeedQuery.safeParse({ country_of_origin: '   ' }).success, false);
    assert.equal(MarketplaceFeedQuery.safeParse({ country_of_origin: 'x'.repeat(101) }).success, false);
});

test('GET /marketplace/origins returns only the database-derived visible-offer facet', async () => {
    const { app } = publicApp({
        listMarketplaceOrigins: async () => ({
            data: [{ country_of_origin: 'India' }, { country_of_origin: 'Japan' }],
            error: null,
        }),
    } as Partial<PublicDeps>);
    const res = await app.request('/marketplace/origins', undefined, {});
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Array<{ country_of_origin: string }> };
    assert.equal(body.success, true);
    assert.deepEqual(body.data.map((item) => item.country_of_origin), ['India', 'Japan']);
    assert.match(originMigrationSource, /CREATE OR REPLACE FUNCTION public\.marketplace_origins\(\)/);
    assert.match(originMigrationSource, /GROUP BY lower\(btrim\(p\.country_of_origin\)\)[\s\S]*ORDER BY lower\(min\(btrim\(p\.country_of_origin\)\)\)/);
    assert.match(originMigrationSource, /cl\.channel = 'marketplace'[\s\S]*cl\.status = 'approved'[\s\S]*cl\.visibility = 'public'/);
    assert.match(publicRoutesSource, /db\.rpc\('marketplace_origins'\)/);
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
    assert.match(feedBlock, /},\s*\{\s*bypassCache:\s*true\s*\}\);/,
        'the feed must re-run approval eligibility instead of serving a prior cached result');
});

// ── MKT-1 merchant routes: /channel-listings under the tenant transaction ──────────────────────

import {
    createChannelListingsRouter,
    mapChannelListingDatabaseError,
    RESUBMIT_CHANNEL_LISTING_SQL,
    TRANSITION_SQL,
    type ChannelListingRouteDependencies,
    type TenantSql,
} from '../routes/channel-listings';
import { TenantTransactionUnavailableError } from '../lib/tenant-transaction';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const listingsRouteSource = readFileSync(new URL('../routes/channel-listings.ts', import.meta.url), 'utf8');

const SITE_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const LISTING = '11111111-0000-4000-8000-000000000001';
const PRODUCT = 'aaaaaaaa-0000-4000-8000-000000000001';

type SqlCall = { query: string; params: unknown[] | undefined };

function merchantApp(options: {
    rows?: unknown[] | ((call: SqlCall) => unknown[]);
    sqlError?: Error;
    txUnavailable?: boolean;
} = {}) {
    const sqlCalls: SqlCall[] = [];
    const scopeCalls: string[] = [];
    const tenantCalls: unknown[] = [];
    const tenant = { siteId: SITE_A, requestId: 'req-1' };
    const sql: TenantSql = {
        unsafe: async (query, params) => {
            sqlCalls.push({ query, params });
            if (options.sqlError) throw options.sqlError;
            return typeof options.rows === 'function' ? options.rows({ query, params }) : (options.rows ?? []);
        },
    };
    const deps: ChannelListingRouteDependencies = {
        resolveOwnedStoreScope: async (_c, siteId) => {
            scopeCalls.push(siteId);
            return { siteId: SITE_A, customUser: { id: 'user-1', email: 'm@example.com' }, tenant: tenant as never };
        },
        withResolvedTenantTx: async (_c, tenantArg, callback) => {
            tenantCalls.push(tenantArg);
            if (options.txUnavailable) throw new TenantTransactionUnavailableError();
            return callback(sql);
        },
    };
    const app = new Hono();
    app.route('/channel-listings', createChannelListingsRouter(deps));
    return { app, sqlCalls, scopeCalls, tenantCalls };
}

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('POST /channel-listings answers 503 TENANT_TX_UNAVAILABLE and touches no database when pooled SQL is missing', async () => {
    const { app, sqlCalls } = merchantApp({ txUnavailable: true });
    const res = await app.request('/channel-listings', json({ store_id: SITE_A, product_id: PRODUCT, channel: 'marketplace' }), {});
    assert.equal(res.status, 503);
    // The gateway's error envelope (lib/errors.ts formatAppError, emitted by app.onError) is
    // { error: { code, message } } — the same shape every other route's failures use.
    const body = (await res.json()) as { success?: boolean; error: { code: string; message: string } };
    assert.notEqual(body.success, true);
    assert.equal(body.error.code, 'TENANT_TX_UNAVAILABLE');
    assert.doesNotMatch(body.error.message, /postgres|HYPERDRIVE|SUPABASE/i, 'no infrastructure detail leaks to the merchant');
    assert.equal(sqlCalls.length, 0);
});

test('POST /channel-listings inserts inside the tenant tx with the RESOLVED site, and a body site_id is rejected', async () => {
    const created = { id: LISTING, site_id: SITE_A, product_id: PRODUCT, channel: 'marketplace', status: 'draft' };
    const { app, sqlCalls, scopeCalls, tenantCalls } = merchantApp({ rows: [created] });
    const res = await app.request('/channel-listings', json({ store_id: SITE_A, product_id: PRODUCT, channel: 'marketplace', marketplace_category_id: null }), {});
    assert.equal(res.status, 201);
    assert.deepEqual(scopeCalls, [SITE_A], 'the body store_id only selects which owned store to resolve');
    assert.deepEqual(tenantCalls, [{ siteId: SITE_A, requestId: 'req-1' }], 'the tenant tx is opened with the resolved scope');
    assert.equal(sqlCalls.length, 1);
    assert.match(sqlCalls[0].query, /^insert into public\.channel_listings \(site_id, product_id, channel, marketplace_category_id, visibility, pricing_policy, created_by, updated_by\)/);
    assert.equal(sqlCalls[0].params?.[0], SITE_A, 'site_id comes from the resolved scope');
    assert.equal(sqlCalls[0].params?.[6], 'user-1', 'created_by is the resolved custom user');
    const insertedColumns = sqlCalls[0].query.match(/^insert into public\.channel_listings \(([^)]+)\)/)?.[1] ?? '';
    assert.doesNotMatch(insertedColumns, /\bstatus\b/, 'status is never written by the create path (it defaults to draft in 217)');

    const smuggled = await app.request('/channel-listings', json({ store_id: SITE_A, product_id: PRODUCT, channel: 'marketplace', site_id: 'bbbbbbbb-0000-4000-8000-00000000000b' }), {});
    assert.equal(smuggled.status, 400, 'strict schema: an unknown site_id key is a validation error');
    const withStatus = await app.request('/channel-listings', json({ store_id: SITE_A, product_id: PRODUCT, channel: 'marketplace', status: 'approved' }), {});
    assert.equal(withStatus.status, 400, 'strict schema: status cannot be set on create');
});

test('POST /channel-listings/:id/transition calls transition_channel_listing with exactly seven positional parameters in 217\'s order', async () => {
    const result = { listing_id: LISTING, from_status: 'draft', to_status: 'pending_review', event_id: 'e1', replayed: false };
    const { app, sqlCalls, tenantCalls } = merchantApp({ rows: [result] });
    const res = await app.request(`/channel-listings/${LISTING}/transition`, json({ store_id: SITE_A, to_status: 'pending_review', idempotency_key: 'k1' }), {});
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()) as unknown, { success: true, data: result });
    assert.equal(sqlCalls.length, 1);
    assert.equal(sqlCalls[0].query, TRANSITION_SQL);
    assert.deepEqual(sqlCalls[0].params, [SITE_A, LISTING, 'pending_review', 'merchant', 'user-1', null, 'k1']);
    assert.deepEqual(tenantCalls, [{ siteId: SITE_A, requestId: 'req-1' }]);

    // The SQL names the RPC and binds exactly $1..$7 — the same arity 217 declares.
    assert.match(TRANSITION_SQL, /public\.transition_channel_listing\(\$1, \$2, \$3, \$4, \$5, \$6, \$7\)$/);
    assert.match(migrationSource, /FUNCTION public\.transition_channel_listing\(\s*p_site_id uuid,\s*p_listing_id uuid,\s*p_to_status text,\s*p_actor_realm text,\s*p_actor_id uuid,\s*p_reason text,\s*p_idempotency_key text\s*\)/);
});

test('POST /channel-listings/:id/transition only accepts merchant edges, and maps the RPC\'s refusals to typed statuses', async () => {
    const { app } = merchantApp({ rows: [] });
    const operatorEdge = await app.request(`/channel-listings/${LISTING}/transition`, json({ store_id: SITE_A, to_status: 'rejected', idempotency_key: 'k' }), {});
    assert.equal(operatorEdge.status, 400, 'rejected is an operator edge and is not in the merchant schema');

    const cases: Array<[string, number, string]> = [
        ['invalid_transition: draft -> approved by merchant', 409, 'CONFLICT'],
        ['listing not found', 404, 'NOT_FOUND'],
        ['marketplace listings require a marketplace_category_id before review', 422, 'UNPROCESSABLE'],
        ['product is not sellable', 422, 'UNPROCESSABLE'],
        ['tenant context required for merchant transitions', 500, 'TENANT_CONTEXT_MISSING'],
    ];
    for (const [message, status, code] of cases) {
        const { app: failing } = merchantApp({ sqlError: new Error(message) });
        const res = await failing.request(`/channel-listings/${LISTING}/transition`, json({ store_id: SITE_A, to_status: 'pending_review', idempotency_key: 'k' }), {});
        assert.equal(res.status, status, message);
        const body = (await res.json()) as { error: { code: string } };
        assert.equal(body.error.code, code, message);
    }
    const dup = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    assert.equal(mapChannelListingDatabaseError(dup)?.statusCode, 409);
    assert.equal(mapChannelListingDatabaseError(new Error('something else entirely')), null, 'unknown errors are rethrown, never masked');
});

test('PATCH /channel-listings/:id updates only merchant fields inside the tenant tx and can never write status', async () => {
    const updated = { id: LISTING, site_id: SITE_A, status: 'draft', visibility: 'hidden' };
    const { app, sqlCalls } = merchantApp({ rows: [updated] });
    const res = await app.request(`/channel-listings/${LISTING}`, { ...json({ store_id: SITE_A, visibility: 'hidden' }), method: 'PATCH' }, {});
    assert.equal(res.status, 200);
    assert.equal(sqlCalls.length, 1);
    assert.match(sqlCalls[0].query, /^update public\.channel_listings set visibility = \$1, updated_by = \$2 where id = \$3 and site_id = \$4 returning /);
    assert.deepEqual(sqlCalls[0].params, ['hidden', 'user-1', LISTING, SITE_A]);

    const status = await app.request(`/channel-listings/${LISTING}`, { ...json({ store_id: SITE_A, status: 'approved' }), method: 'PATCH' }, {});
    assert.equal(status.status, 400, 'status is not an updatable field');
    const empty = await app.request(`/channel-listings/${LISTING}`, { ...json({ store_id: SITE_A }), method: 'PATCH' }, {});
    assert.equal(empty.status, 400, 'an empty patch is rejected');
    const badId = await app.request('/channel-listings/not-a-uuid', { ...json({ store_id: SITE_A, visibility: 'hidden' }), method: 'PATCH' }, {});
    assert.equal(badId.status, 400);
});

test('GET /channel-listings lists inside the tenant tx, scoped by the resolved site and paginated', async () => {
    const rows = [{ id: LISTING, site_id: SITE_A, status: 'draft' }];
    const { app, sqlCalls } = merchantApp({ rows: (call) => (call.query.startsWith('select count') ? [{ total: 1 }] : rows) });
    const res = await app.request(`/channel-listings?store_id=${SITE_A}&channel=marketplace&limit=10`, undefined, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; meta: { total: number; per_page: number } };
    assert.equal(body.success, true);
    assert.deepEqual(body.data, rows);
    assert.equal(body.meta.total, 1);
    assert.equal(body.meta.per_page, 10);
    assert.equal(sqlCalls.length, 2);
    assert.match(sqlCalls[0].query, /where site_id = \$1/);
    assert.equal(sqlCalls[0].params?.[0], SITE_A);
    assert.equal(sqlCalls[0].params?.[1], 'marketplace');
    assert.equal(sqlCalls[0].params?.[2], null);
});

test('GET /channel-listings supports an optional product filter inside the resolved tenant scope', async () => {
    const rows = [{ id: LISTING, site_id: SITE_A, product_id: PRODUCT, status: 'rejected', rejection_reason: 'Add the required product details.' }];
    const { app, sqlCalls } = merchantApp({ rows: (call) => (call.query.startsWith('select count') ? [{ total: 1 }] : rows) });
    const res = await app.request(`/channel-listings?store_id=${SITE_A}&channel=marketplace&product_id=${PRODUCT}`, undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown[] }).data, rows);
    assert.equal(sqlCalls[0].params?.[0], SITE_A);
    assert.equal(sqlCalls[0].params?.[3], PRODUCT);
    assert.match(sqlCalls[0].query, /product_id = \$4/);
    const invalid = await app.request(`/channel-listings?store_id=${SITE_A}&product_id=not-a-uuid`, undefined, {});
    assert.equal(invalid.status, 400);
});

test('POST /channel-listings/:id/resubmit uses only the resolved tenant and a bound correction request', async () => {
    const result = { listing_id: LISTING, from_status: 'draft', to_status: 'pending_review', event_id: 'e2', replayed: false };
    const { app, sqlCalls, scopeCalls, tenantCalls } = merchantApp({ rows: [result] });
    const response = await app.request(`/channel-listings/${LISTING}/resubmit`, json({
        store_id: SITE_A,
        reason: 'Updated the safety and product details requested by review.',
        idempotency_key: 'merchant-resubmit-1',
    }), {});
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { data: unknown }).data, result);
    assert.equal(sqlCalls[0].query, RESUBMIT_CHANNEL_LISTING_SQL);
    assert.deepEqual(sqlCalls[0].params, [SITE_A, LISTING, 'user-1', 'Updated the safety and product details requested by review.', 'merchant-resubmit-1']);
    assert.deepEqual(scopeCalls, [SITE_A]);
    assert.deepEqual(tenantCalls, [{ siteId: SITE_A, requestId: 'req-1' }]);

    for (const invalidBody of [
        { store_id: SITE_A, reason: 'short', idempotency_key: 'bad' },
        { store_id: SITE_A, reason: 'A sufficiently long response.', idempotency_key: 'bad', to_status: 'approved' },
    ]) {
        assert.equal((await app.request(`/channel-listings/${LISTING}/resubmit`, json(invalidBody), {})).status, 400);
    }
    assert.equal((await app.request('/channel-listings/not-a-uuid/resubmit', json({
        store_id: SITE_A, reason: 'A sufficiently long response.', idempotency_key: 'bad',
    }), {})).status, 400);
    assert.equal(mapChannelListingDatabaseError(new Error('idempotency_key_conflict: resubmission key belongs to a different request'))?.statusCode, 409);
});

test('the listing router is mounted exactly once and holds no service-role path at all', () => {
    assert.match(indexSource, /import channelListingsRouter from '\.\/routes\/channel-listings'/);
    assert.equal(indexSource.match(/api\.route\('\/channel-listings', channelListingsRouter\)/g)?.length, 1);
    assert.doesNotMatch(listingsRouteSource, /getSupabaseAdmin/, 'no admin (service_role) client in the merchant listing routes');
    assert.doesNotMatch(listingsRouteSource, /db\.rpc\(/, 'the transition RPC is never called over REST as service_role');
    assert.doesNotMatch(listingsRouteSource, /\.from\('channel_listings'\)/, 'no PostgREST write path to channel_listings');
    assert.match(listingsRouteSource, /withResolvedTenantTx/, 'every query runs inside the tenant transaction');
});
