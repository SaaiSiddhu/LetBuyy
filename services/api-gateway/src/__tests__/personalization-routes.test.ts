// CAP-FB-PERSONALIZE — recently-viewed and curated search suggestions.
//
// The property that matters most: a recorded view is NOT a permission. A buyer can POST any product
// id, so the read must join products and return only publicly-visible ones — otherwise posting ids
// and reading the list back turns a browsing history into a name-and-price oracle for unpublished
// catalogue.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerPersonalizationRoutes, isUnknownProductError } from '../routes/storefront/personalization-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const PRODUCT = 'cccccccc-3333-4333-8333-cccccccccccc';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] }) };
}
async function token(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

function harness(o: { recordError?: unknown; trendingError?: unknown } = {}) {
    const calls = { record: [] as { buyer: string; product: string }[], list: [] as { buyer: string; limit: number }[], cleared: [] as string[] };
    const router = new Hono<{ Bindings: Env }>();
    registerPersonalizationRoutes(router, {
        recordView: async (_c, buyer, product) => { calls.record.push({ buyer, product }); return { error: o.recordError ?? null }; },
        listRecentlyViewed: async (_c, buyer, limit) => {
            calls.list.push({ buyer, limit });
            return { data: [{ product_id: PRODUCT, viewed_at: '2026-09-05T00:00:00.000Z', name: 'Shoe', slug: 'shoe', price: 100, image_url: null, site_id: 'site' }], error: null };
        },
        clearRecentlyViewed: async (_c, buyer) => { calls.cleared.push(buyer); return { error: null }; },
        listTrendingSearches: async () => ({ data: [{ id: 't1', term: 'shoes', position: 0 }], error: o.trendingError ? null : null, ...(o.trendingError ? { error: o.trendingError } : {}) } as any),
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}
const env = (jwks: string) => ({ ENVIRONMENT: 'test', STOREFRONT_CACHE: 'off', LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);
const post = (body: unknown, t: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': t }, body: JSON.stringify(body) });

test('a recorded view is attributed to the TOKEN subject, not a body field', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/product-views', post({ product_id: PRODUCT, buyer_account_id: OTHER }, await token(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.record, [{ buyer: BUYER, product: PRODUCT }]);
});

test('recording without a buyer session is refused and never reaches the database', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/product-views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: PRODUCT }) }, env(jwks));
    assert.equal(res.status, 401);
    assert.deepEqual(h.calls.record, []);
});

test('an unknown product is a 422 that does not say whether it exists', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ recordError: { code: '23503', message: 'violates foreign key constraint' } });
    const res = await h.app.request('/storefront/buyer/product-views', post({ product_id: PRODUCT }, await token(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 422);
    const raw = await res.text();
    assert.doesNotMatch(raw, /foreign key|23503|does not exist/i, 'must not become an existence oracle for the catalogue');
});

test('a genuine database failure is a 500, not a 422', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ recordError: { code: '08006', message: 'connection failure' } });
    const res = await h.app.request('/storefront/buyer/product-views', post({ product_id: PRODUCT }, await token(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 500);
});

test('the history is read for the token subject only, and the limit is capped', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/product-views?buyer_account_id=${OTHER}&limit=9999`, { headers: { 'X-LetBuyy-Buyer-Session': await token(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.list, [{ buyer: BUYER, limit: 50 }], 'the owner comes from the token and the limit is bounded');
});

test('a buyer can clear their own history', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/product-views', { method: 'DELETE', headers: { 'X-LetBuyy-Buyer-Session': await token(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.cleared, [BUYER]);
});

test('trending searches are public and need no session', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/marketplace/trending-searches', undefined, env(jwks));
    assert.equal(res.status, 200);
    const raw = await res.text();
    assert.match(raw, /"term":"shoes"/);
    assert.doesNotMatch(raw, /is_active/, 'the publication flag is not the client\'s business');
});

test('isUnknownProductError matches the SQLSTATE, not only the wording', () => {
    assert.equal(isUnknownProductError({ code: '23503' }), true);
    assert.equal(isUnknownProductError(new Error('violates foreign key constraint x')), true);
    assert.equal(isUnknownProductError({ code: '08006', message: 'connection failure' }), false);
    assert.equal(isUnknownProductError(null), false);
});

// ── Source contracts ──────────────────────────────────────────────────────────
function code(s: string) {
    return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ').replace(/`(?:[^`\\]|\\.)*`/g, '` `');
}
const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const block = (() => {
    const at = wiring.indexOf('registerPersonalizationRoutes(router');
    assert.ok(at > 0);
    return wiring.slice(at, wiring.indexOf('registerSellerFollowRoutes(router', at));
})();
const KEYS = ['recordView', 'listRecentlyViewed', 'clearRecentlyViewed', 'listTrendingSearches'];
function dep(name: string) {
    const at = block.indexOf(`${name}:`);
    assert.ok(at > 0, `${name} should be wired`);
    const rest = block.slice(at + name.length + 1);
    const ends = KEYS.filter((k) => k !== name).map((k) => rest.indexOf(`${k}:`)).filter((i) => i > 0);
    return ends.length ? rest.slice(0, Math.min(...ends)) : rest;
}

test('the dependency extractor stops at the next dependency', () => {
    // The same instrument check the follow tests needed: a window that overruns reads a neighbour's
    // query and the assertions below then pass for the wrong reason.
    const body = dep('clearRecentlyViewed');
    assert.match(body, /\.delete\(\)/);
    assert.doesNotMatch(body, /marketplace_trending_searches/, 'must not run past into the next dependency');
});

test('SOURCE: the history read filters to publicly-visible products', () => {
    const body = dep('listRecentlyViewed');
    assert.match(body, /products!inner/, 'an inner join is what drops rows whose product is not visible');
    assert.match(body, /\.eq\('products\.is_active', true\)/);
    assert.match(body, /\.is\('products\.deleted_at', null\)/);
    assert.match(body, /\.eq\('buyer_account_id', buyerAccountId\)/);
});

test('SOURCE: every recently-viewed query is scoped by the buyer', () => {
    for (const op of ['listRecentlyViewed', 'clearRecentlyViewed']) {
        assert.match(dep(op), /\.eq\('buyer_account_id', buyerAccountId\)/, `${op} must scope by the buyer`);
    }
});

test('SOURCE: re-viewing updates one row rather than appending', () => {
    const body = dep('recordView');
    assert.match(body, /onConflict:\s*'buyer_account_id,product_id'/, 'the PK is what keeps one row per product');
});

test('SOURCE: the trending read returns only ACTIVE suggestions, in curated order', () => {
    const body = dep('listTrendingSearches');
    assert.match(body, /\.eq\('is_active', true\)/, 'inactive suggestions are unpublished editorial work');
    assert.match(body, /\.order\('position'/);
});

test('SOURCE: no rival popularity counter was introduced', () => {
    // analytics_events / analytics_rollups_daily already own product-view analytics. A counter here
    // would be a second source of truth for the same number.
    const migration = readFileSync(join(SRC, '../../../database/supabase/migrations/230_personalization_signals.sql'), 'utf8');
    const ddl = migration.replace(/--[^\n]*/g, ' ');
    assert.doesNotMatch(ddl, /view_count|viewcount|popularity_score/i, '230 must not add a rival counter');
    assert.doesNotMatch(block, /view_count|viewcount/i, 'the wiring must not maintain one either');
});
