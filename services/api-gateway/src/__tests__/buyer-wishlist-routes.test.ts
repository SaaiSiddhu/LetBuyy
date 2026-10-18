import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerBuyerWishlistRoutes } from '../routes/storefront/buyer-wishlist-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';
const STORE_CUSTOMER = 'dddddddd-4444-4444-8444-dddddddddddd';

async function setup() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ realm: 'buyer', token_use: 'storefront_session', site_id: SITE, sep: 1 })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:storefront-session').setSubject(BUYER)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef').sign(privateKey);

    const calls: Array<{ op: string; buyer?: string; customer?: string; site: string; product?: string }> = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerWishlistRoutes(router, {
        resolveLinkedCustomer: async (_c, buyer, site) => { calls.push({ op: 'resolve', buyer, site }); return { data: { storeCustomerId: STORE_CUSTOMER, active: true }, error: null }; },
        list: async (_c, customer, site) => { calls.push({ op: 'list', customer, site }); return { data: ['product-1'], error: null }; },
        save: async (_c, customer, site, product) => { calls.push({ op: 'save', customer, site, product }); return { error: null }; },
        remove: async (_c, customer, site, product) => { calls.push({ op: 'remove', customer, site, product }); return { error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const env = { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env;
    const headers = { [LETBUYY_STOREFRONT_SESSION_HEADER]: token, 'Content-Type': 'application/json' };
    return { app, calls, env, headers };
}

test('wishlist reads resolve the store-customer only from the signed buyer and signed site', async () => {
    const h = await setup();
    const response = await h.app.request(`/storefront/buyer/wishlist?store_id=${SITE}&buyer_account_id=bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb`, { headers: h.headers }, h.env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { linked: true, product_ids: ['product-1'] } });
    assert.deepEqual(h.calls, [
        { op: 'resolve', buyer: BUYER, site: SITE },
        { op: 'list', customer: STORE_CUSTOMER, site: SITE },
    ]);
});

test('wishlist writes cannot choose buyer, store-customer or site identifiers', async () => {
    const h = await setup();
    const response = await h.app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, {
        method: 'POST', headers: h.headers,
        body: JSON.stringify({ product_id: 'product-2', buyer_account_id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', customer_id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee', store_id: 'ffffffff-6666-4666-8666-ffffffffffff' }),
    }, h.env);
    assert.equal(response.status, 200);
    assert.deepEqual(h.calls, [
        { op: 'resolve', buyer: BUYER, site: SITE },
        { op: 'save', customer: STORE_CUSTOMER, site: SITE, product: 'product-2' },
    ]);
});

test('a buyer with no verified store relationship cannot write a wishlist', async () => {
    const h = await setup();
    // The route rejects an absent relationship before calling its writer.
    const writes: string[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerWishlistRoutes(router, {
        resolveLinkedCustomer: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
        save: async () => { writes.push('save'); return { error: null }; },
        remove: async () => { writes.push('remove'); return { error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const response = await app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: 'p1' }) }, h.env);
    assert.equal(response.status, 409);
    assert.deepEqual(writes, []);
});

test('a relationship lookup failure is an unavailable response and never a misleading empty wishlist', async () => {
    const h = await setup();
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerWishlistRoutes(router, {
        resolveLinkedCustomer: async () => ({ data: null, error: new Error('private database failure') }),
        list: async () => ({ data: [], error: null }),
        save: async () => ({ error: null }),
        remove: async () => ({ error: null }),
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const response = await app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, { headers: h.headers }, h.env);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /private database failure/);
});

test('an inactive linked store-customer is refused without exposing its identity or attempting a write', async () => {
    const h = await setup();
    const writes: string[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerWishlistRoutes(router, {
        resolveLinkedCustomer: async () => ({ data: { storeCustomerId: STORE_CUSTOMER, active: false }, error: null }),
        list: async () => ({ data: [], error: null }),
        save: async () => { writes.push('save'); return { error: null }; },
        remove: async () => { writes.push('remove'); return { error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const response = await app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: 'p1' }) }, h.env);
    assert.equal(response.status, 409);
    const body = await response.text();
    assert.match(body, /STORE_ACCOUNT_UNAVAILABLE/);
    assert.doesNotMatch(body, new RegExp(STORE_CUSTOMER));
    assert.deepEqual(writes, []);
});

test('wishlist refuses missing sessions, wrong sites, and invalid product identifiers', async () => {
    const h = await setup();
    assert.equal((await h.app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, undefined, h.env)).status, 401);
    assert.equal((await h.app.request(`/storefront/buyer/wishlist?store_id=bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb`, { headers: h.headers }, h.env)).status, 401);
    assert.equal((await h.app.request(`/storefront/buyer/wishlist?store_id=${SITE}`, { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: 'x'.repeat(201) }) }, h.env)).status, 400);
    assert.equal(h.calls.length, 0);
});
