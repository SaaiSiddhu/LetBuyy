// F-ADS-1c — the signed ad event ingress.
//
// This is a PUBLIC endpoint that spends a merchant's prepaid balance, so the assertions that matter
// are the negative ones: a forged, tampered, expired or malformed token must never reach the money
// RPC at all. Each of those is checked by asserting the spend dependency was NOT called, not merely
// that the status code was unfriendly — a 403 with a charge behind it would pass a status-only test.
//
// The other load-bearing property is subtler and is what the feed test pins: tokens are minted per
// RESPONSE, outside the cached body. Two requests served from the same cache must carry DIFFERENT
// tokens, because the nonce is the idempotency key — shared tokens would bill one event per cache
// period instead of one per impression, and undercount by exactly the cache hit rate.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import {
    adEventIdempotencyKey,
    issueAdPlacementToken,
    verifyAdPlacementToken,
} from '../lib/ad-placement-token';
import { registerSponsoredProductRoutes, type SponsoredPlacementRow } from '../routes/storefront/sponsored-product-routes';

const routeSource = readFileSync(new URL('../routes/storefront/sponsored-product-routes.ts', import.meta.url), 'utf8');

const SECRET = 'ad-placement-secret-for-tests-only';
const SITE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const CAMPAIGN = 'bbbbbbbb-0000-4000-8000-00000000000b';
const PRODUCT = 'cccccccc-0000-4000-8000-00000000000c';

const ROW: SponsoredPlacementRow = {
    campaign_id: CAMPAIGN, product_id: PRODUCT, site_id: SITE, position: 0,
    name: 'Sponsored', slug: 'sponsored', price: 100, image_url: null,
};

interface SpendCall { siteId: string; campaignId: string; eventType: string; idempotencyKey: string }

function app(options: { secret?: string | undefined; withSpend?: boolean; result?: unknown } = {}) {
    const calls: SpendCall[] = [];
    const root = new Hono();
    // The storefront cache reads c.env; a bare object is enough for these handlers.
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = {
            AD_PLACEMENT_SIGNING_SECRET: 'secret' in options ? options.secret : SECRET,
        };
        await next();
    });
    registerSponsoredProductRoutes(root as never, {
        loadSponsored: async () => ({ data: [ROW], error: null }),
        ...(options.withSpend === false ? {} : {
            recordAdSpend: async (_c: unknown, input: SpendCall) => {
                calls.push(input);
                return { data: (options.result ?? { charged: true, charged_minor: 5000 }) as never, error: null };
            },
        }),
    } as never);
    return { app: root, calls };
}

const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('a token round-trips, and every corruption of it is rejected', async () => {
    const token = await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT });
    assert.ok(token);
    const claims = await verifyAdPlacementToken(SECRET, token);
    assert.equal(claims?.siteId, SITE);
    assert.equal(claims?.campaignId, CAMPAIGN);
    assert.equal(claims?.productId, PRODUCT);

    const parts = token.split('.');
    // Forged signature: flip one hex character.
    const forgedSig = [...parts.slice(0, 6), parts[6].replace(/^./, (ch) => (ch === '0' ? '1' : '0'))].join('.');
    assert.equal(await verifyAdPlacementToken(SECRET, forgedSig), null, 'a forged signature must not verify');

    // Tampered payload: point the same signature at a different campaign.
    const tampered = [...parts.slice(0, 2), 'dddddddd-0000-4000-8000-00000000000d', ...parts.slice(3)].join('.');
    assert.equal(await verifyAdPlacementToken(SECRET, tampered), null, 'a signature must not survive its payload changing');

    // A different secret must not verify — the whole point of a dedicated trust domain.
    assert.equal(await verifyAdPlacementToken('some-other-secret', token), null);

    // Wrong version, extra field, missing field, and junk.
    assert.equal(await verifyAdPlacementToken(SECRET, token.replace(/^v1\./, 'v2.')), null);
    assert.equal(await verifyAdPlacementToken(SECRET, `${token}.extra`), null, 'a different field split is a different token');
    assert.equal(await verifyAdPlacementToken(SECRET, parts.slice(0, 6).join('.')), null);
    assert.equal(await verifyAdPlacementToken(SECRET, 'not-a-token'), null);
});

test('an expired token is rejected', async () => {
    const now = 1_800_000_000;
    const token = await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT }, now, 60);
    assert.ok(token);
    assert.ok(await verifyAdPlacementToken(SECRET, token, now + 59), 'still valid inside the window');
    assert.equal(await verifyAdPlacementToken(SECRET, token, now + 61), null, 'and worthless after it');
});

test('a valid token bills the campaign the TOKEN names, with the nonce as the key', async () => {
    const { app: a, calls } = app();
    const token = (await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT }))!;
    const claims = (await verifyAdPlacementToken(SECRET, token))!;

    const res = await a.request('/ads/event', post({ token, event_type: 'click' }), {});
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [{
        siteId: SITE, campaignId: CAMPAIGN, eventType: 'click',
        idempotencyKey: adEventIdempotencyKey(claims),
    }]);
    // Nothing in the request body chose the site or the campaign.
    assert.match(calls[0].idempotencyKey, /^ad\.event:[0-9a-f]{32}$/);
});

test('replaying a token yields the SAME idempotency key, so the RPC suppresses the duplicate', async () => {
    const { app: a, calls } = app();
    const token = (await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT }))!;
    await a.request('/ads/event', post({ token, event_type: 'click' }), {});
    await a.request('/ads/event', post({ token, event_type: 'click' }), {});
    assert.equal(calls.length, 2, 'the route does not dedupe — it must not keep its own state');
    assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey, 'the money RPC is what makes it bill once');
});

test('a rejected token NEVER reaches the money RPC', async () => {
    // The assertion that matters. A 403 with a charge behind it would pass a status-only test.
    const token = (await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT }))!;
    const parts = token.split('.');
    const cases: Array<[string, unknown]> = [
        ['forged signature', [...parts.slice(0, 6), 'deadbeef'.repeat(8)].join('.')],
        ['tampered campaign', [...parts.slice(0, 2), 'dddddddd-0000-4000-8000-00000000000d', ...parts.slice(3)].join('.')],
        ['junk', 'not-a-token'],
        ['empty', ''],
    ];
    for (const [label, badToken] of cases) {
        const { app: a, calls } = app();
        const res = await a.request('/ads/event', post({ token: badToken, event_type: 'click' }), {});
        assert.equal(res.status, 403, label);
        assert.deepEqual(calls, [], `${label}: nothing may be billed`);
        // One answer for every rejection — distinguishing them is a probing oracle on a money endpoint.
        assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'INVALID_PLACEMENT_TOKEN');
    }
});

test('without the secret the endpoint fails CLOSED and bills nothing', async () => {
    const { app: a, calls } = app({ secret: undefined });
    const res = await a.request('/ads/event', post({ token: 'anything', event_type: 'click' }), {});
    assert.equal(res.status, 503);
    assert.deepEqual(calls, [], 'an unverifiable request must not be billed');
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'AD_EVENTS_UNAVAILABLE');
});

test('a malformed body is a 400, and a decline is a 200 rather than an error', async () => {
    const { app: a } = app();
    const token = (await issueAdPlacementToken(SECRET, { siteId: SITE, campaignId: CAMPAIGN, productId: PRODUCT }))!;
    assert.equal((await a.request('/ads/event', post({ token }), {})).status, 400, 'event_type is required');
    assert.equal((await a.request('/ads/event', post({ token, event_type: 'purchase' }), {})).status, 400);
    assert.equal((await a.request('/ads/event', post({ event_type: 'click' }), {})).status, 400, 'a token is required');

    const declined = app({ result: { charged: false, reason: 'budget_exhausted' } });
    const res = await declined.app.request('/ads/event', post({ token, event_type: 'click' }), {});
    assert.equal(res.status, 200, 'out of budget is a correct answer to a well-formed request');
    assert.equal(((await res.json()) as { data: { charged: boolean } }).data.charged, false);
});

test('the feed mints a DIFFERENT token per response, not one shared by the cache', async () => {
    // The core design property. If tokens were minted inside the cached body, both responses would
    // carry the same nonce and the second impression would be free.
    const { app: a } = app();
    const first = (await (await a.request('/marketplace/sponsored-products', undefined, {})).json()) as { data: Array<{ placement_token: string }> };
    const second = (await (await a.request('/marketplace/sponsored-products', undefined, {})).json()) as { data: Array<{ placement_token: string }> };

    assert.ok(first.data[0].placement_token, 'the feed carries a token');
    assert.notEqual(first.data[0].placement_token, second.data[0].placement_token, 'a shared token would bill once per cache period');
    // Both are nonetheless valid and name the same placement.
    for (const body of [first, second]) {
        const claims = await verifyAdPlacementToken(SECRET, body.data[0].placement_token);
        assert.equal(claims?.campaignId, CAMPAIGN);
    }
});

test('without the secret the feed still serves, simply without tokens', async () => {
    const { app: a } = app({ secret: undefined });
    const res = await a.request('/marketplace/sponsored-products', undefined, {});
    assert.equal(res.status, 200, 'the feed is a read and must not go down with the biller');
    const body = (await res.json()) as { data: Array<Record<string, unknown>> };
    assert.equal(body.data[0].placement_token, undefined);
    assert.equal(body.data[0].sponsored, true, 'disclosure is not optional, with or without billing');
});

test('SOURCE: tokens are minted outside the cached region', () => {
    // An injected fake cannot prove this: the cache is real machinery, and the mistake being guarded
    // against is putting one line inside the wrong closure.
    const code = routeSource.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const cacheCall = code.indexOf('cachedJson(');
    const mint = code.indexOf('issueAdPlacementToken(');
    assert.ok(cacheCall > 0 && mint > 0);
    // The cached callback ends at its closing `});` before the token minting begins.
    assert.ok(mint > cacheCall, 'sanity: minting appears after the cache call');
    const between = code.slice(cacheCall, mint);
    assert.match(between, /\}\);/, 'the cached callback must be closed before a token is minted');
});
