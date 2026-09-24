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
import { installBuyerSessionState } from './buyer-session-state-fake';
import {
    registerBuyerAccountRoutes,
    type BuyerAccountRow,
    type OrderClaimOutcome,
    type StoreLinkOutcome,
} from '../routes/storefront/buyer-account-routes';

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

// The database decides (migration 255); these fakes stand in for its outcomes so the route's mapping
// and, above all, the identity it passes can be asserted. The decisions themselves are proven on real
// Postgres in tests/executable/buyer-verified-ownership-postgres.test.mjs.
function harness(
    existing: BuyerAccountRow,
    outcomes: { link?: StoreLinkOutcome; claim?: OrderClaimOutcome } = {},
) {
    const linked: { buyerAccountId: string; siteId: string }[] = [];
    const claimed: { buyerAccountId: string; siteId: string | null }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (e) => e.trim().toLowerCase(),
        requireIdentityInternal: async () => null,
        loadBuyerByEmail: async () => ({ data: existing, error: null }),
        insertBuyer: async () => ({ data: existing, error: null }),
        loadBuyerById: async (_c, id) => ({ data: id === existing.id ? existing : null, error: null }),
        linkStoreCustomer: async (_c, input) => {
            linked.push(input);
            return { data: outcomes.link ?? { outcome: 'linked', store_customer_id: 'store-customer-1' }, error: null };
        },
        claimOrders: async (_c, input) => {
            claimed.push(input);
            return { data: outcomes.claim ?? { outcome: 'claimed', linked: 2, already_linked: 1, conflicts: 0 }, error: null };
        },
        startEmailChallenge: async () => ({ data: { outcome: 'rate_limited' }, error: null }),
        consumeEmailChallenge: async () => ({ data: { outcome: 'invalid' }, error: null }),
        revokeSessions: async () => ({ data: { outcome: 'buyer_unavailable' }, error: null }),
        sendEmailCode: async () => ({ sent: false }),
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, linked, claimed };
}

const account = (over: Partial<BuyerAccountRow> = {}): BuyerAccountRow => ({
    id: BUYER_ID, email: 'shopper@example.com', password_hash: null, email_verified: true, status: 'active', session_epoch: 1, ...over,
});

async function link(h: ReturnType<typeof harness>, jwks: string, token: string | null, body: unknown, path = '/storefront/buyer/link-store-customer') {
    return h.app.request(
        path,
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
    assert.deepEqual(h.linked, [{ buyerAccountId: BUYER_ID, siteId: STORE }]);
    const body = await res.json() as { data: { linked: { buyer_account_id: string; store_customer_id: string } } };
    assert.deepEqual(body.data.linked, { buyer_account_id: BUYER_ID, store_customer_id: 'store-customer-1' });
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

// ---- APPID-P3: the database's decisions, mapped without leaking whose record it is ----------------

test('an unverified buyer is refused with EMAIL_UNVERIFIED', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account({ email_verified: false }), { link: { outcome: 'unverified' } });
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: STORE });
    assert.equal(res.status, 403);
    assert.equal((await res.json() as { error: { code: string } }).error.code, 'EMAIL_UNVERIFIED');
});

test('a record another buyer holds is a 409 that names nobody', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account(), { link: { outcome: 'conflict' } });
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: STORE });
    assert.equal(res.status, 409);
    const text = await res.text();
    assert.match(text, /LINK_CONFLICT/);
    assert.doesNotMatch(text, new RegExp(OTHER_BUYER), 'the holder of the record must never be disclosed');
});

test('a site that is not a live store is a 404', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account(), { link: { outcome: 'store_unavailable' } });
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: STORE });
    assert.equal(res.status, 404);
});

test('a store_id that is not a uuid is a 400 and reaches no database', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { store_id: "x'; drop table sites; --" });
    assert.equal(res.status, 400);
    assert.equal(h.linked.length, 0);
});

const CLAIM = '/storefront/buyer/orders/claim';

test('claiming orders needs a buyer session: none, a merchant token or a forged one is 401', async () => {
    const { privateKey, jwks } = await keys();
    const attacker = await keys();
    const h = harness(account());
    const merchant = await mint(privateKey, { sub: BUYER_ID, realm: 'merchant', tokenUse: 'merchant_session', audience: 'letbuyy:merchant-session' });
    const forged = await mint(attacker.privateKey, { sub: BUYER_ID });
    for (const token of [null, merchant, forged]) {
        const res = await link(h, jwks, token, {}, CLAIM);
        assert.equal(res.status, 401);
    }
    assert.equal(h.claimed.length, 0);
});

test('a claim uses the session\'s buyer, never one named in the body', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), { buyer_account_id: OTHER_BUYER }, CLAIM);
    assert.equal(res.status, 200);
    assert.deepEqual(h.claimed, [{ buyerAccountId: BUYER_ID, siteId: null }]);
    const body = await res.json() as { data: { claimed: Record<string, number> } };
    assert.deepEqual(body.data.claimed, { linked: 2, already_linked: 1, conflicts: 0 });
});

test('a claim can be narrowed to one store, and a malformed store_id is a 400', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account());
    const token = await mint(privateKey, { sub: BUYER_ID });
    assert.equal((await link(h, jwks, token, { store_id: STORE }, CLAIM)).status, 200);
    assert.deepEqual(h.claimed, [{ buyerAccountId: BUYER_ID, siteId: STORE }]);
    assert.equal((await link(h, jwks, token, { store_id: 'not-a-store' }, CLAIM)).status, 400);
    assert.equal(h.claimed.length, 1);
});

test('an unverified buyer cannot claim orders placed with the address', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account({ email_verified: false }), { claim: { outcome: 'unverified' } });
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), {}, CLAIM);
    assert.equal(res.status, 403);
    assert.equal((await res.json() as { error: { code: string } }).error.code, 'EMAIL_UNVERIFIED');
});

test('a disabled buyer cannot claim', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(account({ status: 'disabled' }));
    const res = await link(h, jwks, await mint(privateKey, { sub: BUYER_ID }), {}, CLAIM);
    assert.equal(res.status, 403);
    assert.equal(h.claimed.length, 0);
});
