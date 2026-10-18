import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { getStorefrontBuyerSession } from '../middleware/storefront-buyer-session';
import type { BuyerReviewOutcome } from '../execution/buyer-review-execution.adapter';
import { registerBuyerReviewRoutes, type BuyerReviewRoutesDeps } from '../routes/storefront/buyer-review-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';
const OTHER_SITE = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const PRODUCT = 'ffffffff-6666-4666-8666-ffffffffffff';
const REVIEW = 'dddddddd-4444-4444-8444-dddddddddddd';

async function harness(options: {
    linked?: { active: boolean } | null;
    turnstile?: boolean;
    product?: { active: boolean } | null;
    failure?: boolean;
    refusal?: Extract<BuyerReviewOutcome, { accepted: false }>['code'];
} = {}) {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ realm: 'buyer', token_use: 'storefront_session', site_id: SITE, sep: 1 })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:storefront-session').setSubject(BUYER)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef').sign(privateKey);

    const calls: Array<Record<string, unknown>> = [];
    const effects: string[] = [];
    const deps: BuyerReviewRoutesDeps = {
        requireValidTurnstile: async () => options.turnstile === false ? new Response('blocked', { status: 403 }) : null,
        createReview: async (c, input) => {
            const session = getStorefrontBuyerSession(c);
            calls.push({ op: 'atomic-review', buyer: session?.buyerAccountId, site: session?.siteId, epoch: session?.sessionEpoch, input });
            if (options.failure) return { data: null, error: { message: 'private database detail', buyer: BUYER } };
            const code = options.linked === null ? 'STORE_ACCOUNT_NOT_LINKED'
                : options.linked?.active === false ? 'STORE_ACCOUNT_UNAVAILABLE'
                : options.product === null ? 'NOT_FOUND'
                : options.product?.active === false ? 'PRODUCT_UNAVAILABLE' : options.refusal;
            if (code) return { data: { accepted: false, code }, error: null };
            effects.push(REVIEW);
            return { data: { accepted: true, review_id: REVIEW }, error: null };
        },
    };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerReviewRoutes(router, deps);
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    const env = { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env;
    const headers = { [LETBUYY_STOREFRONT_SESSION_HEADER]: token, 'Content-Type': 'application/json' };
    return { app, calls, effects, env, headers };
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
    assert.deepEqual(responseBody, { success: true, data: { review: { id: REVIEW, status: 'pending' }, message: 'Review submitted! It will appear after approval.' } });
    assert.deepEqual(h.calls, [{ op: 'atomic-review', buyer: BUYER, site: SITE, epoch: 1,
        input: { product_id: PRODUCT, rating: 5, title: 'Great', body: 'Works well' } }]);
    assert.deepEqual(h.effects, [REVIEW]);
    assert.doesNotMatch(JSON.stringify(responseBody), /verified@example|Linked Buyer/);
});

test('an unlinked or inactive store account cannot create a review', async () => {
    for (const options of [{ linked: null }, { linked: { active: false } }] as const) {
        const h = await harness(options);
        const response = await h.app.request(path(), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env);
        assert.equal(response.status, 409);
        assert.equal(h.effects.length, 0);
    }
});

test('review requires Turnstile and an active product at the signed site', async () => {
    const challenged = await harness({ turnstile: false });
    assert.equal((await challenged.app.request(path(), { method: 'POST', headers: challenged.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, challenged.env)).status, 403);
    assert.equal(challenged.calls.length, 0);

    const archived = await harness({ product: { active: false } });
    assert.equal((await archived.app.request(path(), { method: 'POST', headers: archived.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, archived.env)).status, 400);
    assert.equal(archived.effects.length, 0);
});

test('buyer review refuses absent sessions, wrong sites and malformed products', async () => {
    const h = await harness();
    assert.equal((await h.app.request(path(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env)).status, 401);
    assert.equal((await h.app.request(path(OTHER_SITE), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env)).status, 401);
    assert.equal((await h.app.request(path(), { method: 'POST', headers: h.headers, body: JSON.stringify({ product_id: 'not-a-uuid', rating: 5 }) }, h.env)).status, 400);
    assert.equal(h.effects.length, 0);
});


test('atomic duplicate, session, scope and busy refusals keep their safe transport status', async () => {
    for (const [refusal, status] of [['CONFLICT', 409], ['BUYER_SESSION_INVALID', 401],
        ['BUYER_DISABLED', 403], ['BUYER_SCOPE_MISMATCH', 403], ['REVIEW_SOURCE_BUSY', 503]] as const) {
        const h = await harness({ refusal });
        const response = await h.app.request(path(), { method: 'POST', headers: h.headers,
            body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env);
        assert.equal(response.status, status);
        const body = await response.json() as { error: { code: string } };
        assert.equal(body.error.code, refusal);
        assert.equal(h.effects.length, 0);
    }
});

test('a database failure returns no private source, author or database diagnostics', async () => {
    const h = await harness({ failure: true });
    const response = await h.app.request(path(), { method: 'POST', headers: h.headers,
        body: JSON.stringify({ product_id: PRODUCT, rating: 5 }) }, h.env);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), new RegExp('private database detail|' + BUYER));
    assert.equal(h.effects.length, 0);
});
