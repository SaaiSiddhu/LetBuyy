// BUYER-5 (D-8) — linking an authenticated buyer to a per-store customer.
//
// The property this file exists for, above all others: THE BUYER ID COMES FROM THE VERIFIED TOKEN,
// NEVER FROM THE REQUEST BODY. A body-supplied buyer_account_id would let any caller attach any
// buyer to any customer record — the entire cross-store identity, forgeable by typing a uuid. The
// plant for it is a one-line change that would look completely reasonable in review, which is
// exactly why it needs a test rather than a comment.
//
// This also gives BUYER-2's verifier its first production exercise through real middleware: it
// shipped with seven tests and zero callers.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { registerBuyerAccountRoutes, type BuyerAccountRow } from '../routes/storefront/buyer-account-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const STORE = '33333333-3333-4333-8333-333333333333';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function mint(privateKey: CryptoKey, opts: { sub: string; realm?: string; tokenUse?: string; audience?: string }) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: opts.realm ?? 'buyer', token_use: opts.tokenUse ?? 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER)
        .setAudience(opts.audience ?? 'letbuyy:buyer-session')
        .setSubject(opts.sub)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

function harness(existing: BuyerAccountRow) {
    const linked: { buyerAccountId: string; storeCustomerId: string; siteId: string }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (e) => e.trim().toLowerCase(),
        requireStorefrontInternal: async () => null,
        loadBuyerByEmail: async () => ({ data: existing, error: null }),
        insertBuyer: async () => ({ data: existing, error: null }),
        setBuyerPassword: async () => ({ data: existing, error: null }),
        loadBuyerById: async (_c, id) => ({ data: id === existing.id ? existing : null, error: null }),
        findOrCreateStoreCustomer: async () => ({ data: { id: 'store-customer-1' }, error: null }),
        linkBuyerToStoreCustomer: async (_c, link) => { linked.push(link); return { error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    return { app, linked };
}

const account = (over: Partial<BuyerAccountRow> = {}): BuyerAccountRow => ({
    id: BUYER_ID, email: 'shopper@example.com', password_hash: null, email_verified: true, status: 'active', ...over,
});

async function link(h: ReturnType<typeof harness>, jwks: string, token: string | null, body: unknown) {
    return h.app.request(
        '/storefront/buyer/link-store-customer',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'X-LetBuyy-Buyer-Session': token } : {}),
            },
            body: JSON.stringify(body),
        },
        { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env,
    );
}

test('an authenticated buyer is linked to the store customer', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: STORE });
    assert.equal(res.status, 200);
    assert.deepEqual(h.linked, [{ buyerAccountId: BUYER_ID, storeCustomerId: 'store-customer-1', siteId: STORE }]);
});

test('a body-supplied buyer_account_id is IGNORED — identity comes from the token', async () => {
    // The one that matters. If the body could name the buyer, the cross-store identity would be
    // forgeable by typing a uuid.
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), {
        store_id: STORE,
        buyer_account_id: OTHER_BUYER,
    });
    assert.equal(res.status, 200);
    assert.equal(h.linked[0].buyerAccountId, BUYER_ID, 'the token subject must win');
    assert.notEqual(h.linked[0].buyerAccountId, OTHER_BUYER, 'the body must never choose the buyer');
});

test('no buyer session is a 401, and nothing is linked', async () => {
    const { jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, null, { store_id: STORE });
    assert.equal(res.status, 401);
    assert.equal(h.linked.length, 0);
});

test('a MERCHANT token cannot link a buyer', async () => {
    // Realm separation at the middleware, tested rather than inferred from the audiences differing.
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const merchantToken = await mint(privateKey, {
        sub: BUYER_ID, realm: 'merchant', tokenUse: 'merchant_session', audience: 'letbuyy:merchant-session',
    });
    const res = await link(h, jwks, merchantToken, { store_id: STORE });
    assert.equal(res.status, 401);
    assert.equal(h.linked.length, 0);
});

test('a token signed by a DIFFERENT key is refused', async () => {
    const { jwks } = await keys();
    const attacker = await keys();
    const h = harness(account());
    const forged = await mint(attacker.privateKey, { sub: BUYER_ID });
    const res = await link(h, jwks, forged, { store_id: STORE });
    assert.equal(res.status, 401);
    assert.equal(h.linked.length, 0);
});

test('a valid token for an account that no longer exists is 401, not 404', async () => {
    // 404 would confirm the id exists in some other form. Treated as unauthenticated.
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: OTHER_BUYER }), { store_id: STORE });
    assert.equal(res.status, 401);
    assert.equal(h.linked.length, 0);
});

test('a disabled buyer cannot link', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account({ status: 'disabled' }));
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: STORE });
    assert.equal(res.status, 403);
    assert.equal(h.linked.length, 0);
});

test('store_id is required', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), {});
    assert.equal(res.status, 400);
    assert.equal(h.linked.length, 0);
});
