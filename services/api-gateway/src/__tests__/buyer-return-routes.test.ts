// CAP-FB-RETURNS — a buyer opening a return on their OWN order.
//
// The route's job is narrow: authenticate the buyer, validate the reason, and hand everything else to
// request_order_return (migration 225). The ownership walk lives in SQL precisely so it cannot be
// half-applied here, so these tests cover what the ROUTE can still get wrong — the buyer it names,
// the fields it forwards, and the answers it gives back. The ownership chain itself is proven by
// execution against a real database, which no fake can stand in for.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import {
    registerBuyerReturnRoutes,
    type BuyerReturnRequestRow,
} from '../routes/storefront/buyer-return-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ORDER = 'cccccccc-3333-4333-8333-cccccccccccc';

const CREATED: BuyerReturnRequestRow = {
    id: 'r1', order_id: ORDER, reason: 'defective', description: null,
    status: 'pending', created_at: '2026-09-05T00:00:00.000Z',
};

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function token(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
}

function harness(options: { owns?: boolean; alreadyOpen?: boolean } = {}) {
    const calls: { buyerAccountId: string; orderId: string; reason: string; description: string | null }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerReturnRoutes(router, {
        requestOrderReturn: async (_c, input) => {
            calls.push(input);
            if (options.alreadyOpen) return { data: null, error: null, alreadyOpen: true };
            // The RPC returns no row when the order is not this buyer's — it does not raise.
            return { data: (options.owns ?? true) ? CREATED : null, error: null };
        },
        listBuyerReturnRequests: async () => ({ data: [CREATED], error: null }),
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}

const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

function open(h: ReturnType<typeof harness>, jwks: string, tok: string | null, body: unknown, orderId = ORDER) {
    return h.app.request(
        `/storefront/buyer/orders/${orderId}/return-request`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-LetBuyy-Buyer-Session': tok } : {}) },
            body: JSON.stringify(body),
        },
        env(jwks),
    );
}

test('a buyer opens a return on their own order', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ owns: true });
    const res = await open(h, jwks, await token(privateKey, BUYER), { reason: 'defective' });
    assert.equal(res.status, 201);
    const body = await res.json() as { data: { return_request: BuyerReturnRequestRow } };
    assert.equal(body.data.return_request.status, 'pending');
});

test('the buyer id comes from the TOKEN, never the body', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await open(h, jwks, await token(privateKey, BUYER), {
        reason: 'defective',
        buyer_account_id: OTHER_BUYER,
    });
    assert.equal(h.calls[0].buyerAccountId, BUYER);
    assert.notEqual(h.calls[0].buyerAccountId, OTHER_BUYER);
});

test('merchant-owned fields are NEVER forwarded', async () => {
    // return_requests carries status, refund_amount, approved_at, refunded_at, processed_by and
    // admin_notes. A buyer body reaching any of them would let a shopper file a return already marked
    // refunded, for an amount of their choosing.
    const { privateKey, jwks } = await keys();
    const h = harness();
    await open(h, jwks, await token(privateKey, BUYER), {
        reason: 'defective',
        status: 'refunded',
        refund_amount: 99999,
        approved_at: '2020-01-01',
        processed_by: OTHER_BUYER,
        admin_notes: 'approved by me',
    });
    const forwarded = Object.keys(h.calls[0]);
    assert.deepEqual(forwarded.sort(), ['buyerAccountId', 'description', 'orderId', 'reason']);
});

test("another buyer's order is 404, indistinguishable from a missing one", async () => {
    const { privateKey, jwks } = await keys();
    const notOurs = await open(harness({ owns: false }), jwks, await token(privateKey, OTHER_BUYER), { reason: 'defective' });
    const missing = await open(harness({ owns: false }), jwks, await token(privateKey, BUYER), { reason: 'defective' }, 'dddddddd-4444-4444-8444-dddddddddddd');
    assert.equal(notOurs.status, 404);
    assert.equal(missing.status, 404);
    assert.deepEqual(await notOurs.json(), await missing.json());
});

test('a second open return is refused with 409', async () => {
    const { privateKey, jwks } = await keys();
    const res = await open(harness({ alreadyOpen: true }), jwks, await token(privateKey, BUYER), { reason: 'defective' });
    assert.equal(res.status, 409);
});

test('an unknown reason is refused before the round trip', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await open(h, jwks, await token(privateKey, BUYER), { reason: 'because_i_said_so' });
    assert.equal(res.status, 400);
    assert.equal(h.calls.length, 0, 'a bad reason must not reach the database');
});

test('both routes refuse without a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    assert.equal((await open(h, jwks, null, { reason: 'defective' })).status, 401);
    const list = await h.app.request('/storefront/buyer/return-requests', undefined, env(jwks));
    assert.equal(list.status, 401);
    assert.equal(h.calls.length, 0);
});

test('a MERCHANT token cannot open a buyer return', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const now = Math.floor(Date.now() / 1000);
    const merchant = await new SignJWT({ realm: 'merchant', token_use: 'merchant_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:merchant-session').setSubject(BUYER)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
    assert.equal((await open(h, jwks, merchant, { reason: 'defective' })).status, 401);
    assert.equal(h.calls.length, 0);
});
