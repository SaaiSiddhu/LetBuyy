import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerBuyerReviewRoutes, type BuyerReviewRoutesDeps } from '../routes/storefront/buyer-review-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';
const OTHER_SITE = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const PRODUCT = 'ffffffff-6666-4666-8666-ffffffffffff';
const CUSTOMER = 'dddddddd-4444-4444-8444-dddddddddddd';

async function harness(options: {
    linked?: { active: boolean } | null;
    turnstile?: boolean;
    product?: { active: boolean } | null;
} = {}) {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ realm: 'buyer', token_use: 'storefront_session', site_id: SITE, sep: 1 })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:storefront-session').setSubject(BUYER)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef').sign(privateKey);

    const calls: Array<{ op: string; buyer?: string; site?: string; customer?: string; email?: string; review?: Record<string, unknown> }> = [];
    const deps: BuyerReviewRoutesDeps = {
        resolveLinkedCustomer: async (_c, buyerId, siteId) => {
            calls.push({ op: 'link', buyer: buyerId, site: siteId });
            return options.linked === null
                ? { data: null, error: null }
                : { data: { customerId: CUSTOMER, customerName: 'Linked Buyer', customerEmail: 'verified@example.test', active: options.linked?.active ?? true }, error: null };
        },
        requireValidTurnstile: async () => options.turnstile === false ? new Response('blocked', { status: 403 }) : null,
        loadProduct: async (_c, productId, siteId) => { calls.push({ op: 'product', site: siteId }); return { data: options.product === null ? null : { active: options.product?.active ?? true }, error: null }; },
        hasDuplicate: async (_c, _productId, siteId, email) => { calls.push({ op: 'duplicate', site: siteId, email }); return { data: false, error: null }; },
        insertReview: async (_c, review) => { calls.push({ op: 'insert', review }); return { data: { id: 'review-1' }, error: null }; },
    };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerReviewRoutes(router, deps);
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const env = { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env;
    const headers = { [LETBUYY_STOREFRONT_SESSION_HEADER]: token, 'Content-Type': 'application/json' };
    return { app, calls, env, headers };
}

const path = (siteId = SITE) => `/storefront/buyer/reviews?store_id=${siteId}`;

test('buyer review derives site, linked customer, email and verified badge from signed state', async () => {
    const h = await harness();
    const response = await h.app.request(path(), {
        method: 'POST', headers: h.headers,
        body: JSON.stringify({
            product_id: PRODUCT, rating: 5, title: 'Great', body: 'Works well',
            store_id: OTHER_SITE, customer_email: 'forged@example.test', customer_name: 'Forged', is_verified: false,
        }),
    }, h.env);
    assert.equal(response.status, 201);
    const responseBody = await response.json();
    assert.deepEqual(responseBody, { success: true, data: { review: { id: 'review-1', status: 'pending' }, message: 'Review submitted! It will appear after approval.' } });
    assert.deepEqual(h.calls, [
        { op: 'link', buyer: BUYER, site: SITE },
        { op: 'product', site: SITE },
        { op: 'duplicate', site: SITE, email: 'verified@example.test' },
        { op: 'insert', review: {
            store_id: SITE, product_id: PRODUCT, customer_name: 'Linked Buyer', customer_email: 'verified@example.test',
            rating: 5, title: 'Great', body: 'Works well', is_verified: true, is_approved: false, status: 'pending',
        } },
    ]);
    assert.doesNotMatch(JSON.stringify(responseBody), /verified@example|Linked Buyer/);
});

test('an unlinked or inactive store account cannot create a review', async () => {
    for (const options of [{ linked: null }, { linked: { active: false } }] as const) {
        const h = await harness(options);
        const response = await h.app.request(path(), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env);
        assert.equal(response.status, 409);
        assert.equal(h.calls.some((call) => call.op === 'insert'), false);
    }
});

test('review requires Turnstile and an active product at the signed site', async () => {
    const challenged = await harness({ turnstile: false });
    assert.equal((await challenged.app.request(path(), { method: 'POST', headers: challenged.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, challenged.env)).status, 403);
    assert.equal(challenged.calls.length, 0);

    const archived = await harness({ product: { active: false } });
    assert.equal((await archived.app.request(path(), { method: 'POST', headers: archived.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, archived.env)).status, 400);
    assert.equal(archived.calls.some((call) => call.op === 'insert'), false);
});

test('buyer review refuses absent sessions, wrong sites and malformed products', async () => {
    const h = await harness();
    assert.equal((await h.app.request(path(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env)).status, 401);
    assert.equal((await h.app.request(path(OTHER_SITE), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env)).status, 401);
    assert.equal((await h.app.request(path(), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: 'not-a-uuid', rating: 5 }) }, h.env)).status, 400);
    assert.equal(h.calls.some((call) => call.op === 'insert'), false);
});
