// D1 (SUSTAINED-J) — GET/PATCH /buyer/profile: the buyer's own cross-store profile fields.
//
// Through a real signed buyer-session JWT, the same harness buyer-order-routes.test.ts established
// for a requireBuyerSession-only route (no identityInternal -- that gate is /buyer/me's alone).
//
// The properties worth testing:
//   1. The buyer id comes from the verified TOKEN, never a request parameter or body field.
//   2. The update allowlist is real: email, password_hash, status and session_epoch can never be
//      set through this route, whatever the body claims.
//   3. Unauthenticated requests are refused before any deps function runs.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import {
    registerBuyerAccountRoutes,
    type BuyerAccountRow,
} from '../routes/storefront/buyer-account-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const BUYER_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function buyerToken(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
}

const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

function accountRow(over: Partial<BuyerAccountRow> = {}): BuyerAccountRow {
    return {
        id: BUYER_A, email: 'shopper@example.com', password_hash: null,
        email_verified: true, status: 'active', session_epoch: 1,
        full_name: null, phone: null, ...over,
    };
}

function harness(existing: BuyerAccountRow = accountRow()) {
    const updates: { buyerAccountId: string; fullName?: string | null; phone?: string | null }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (e) => e.trim().toLowerCase(),
        requireIdentityInternal: async () => null,
        loadBuyerByEmail: async () => ({ data: null, error: null }),
        insertBuyer: async () => ({ data: null, error: null }),
        loadBuyerById: async (_c, id) => ({ data: id === existing.id ? existing : null, error: null }),
        linkStoreCustomer: async () => ({ data: { outcome: 'unverified' }, error: null }),
        claimOrders: async () => ({ data: { outcome: 'unverified' }, error: null }),
        startEmailChallenge: async () => ({ data: { outcome: 'rate_limited' }, error: null }),
        consumeEmailChallenge: async () => ({ data: { outcome: 'invalid' }, error: null }),
        revokeSessions: async () => ({ data: { outcome: 'buyer_unavailable' }, error: null }),
        sendEmailCode: async () => ({ sent: false }),
        updateBuyerProfile: async (_c, input) => {
            updates.push(input);
            return { data: { ...existing, full_name: input.fullName ?? existing.full_name, phone: input.phone ?? existing.phone }, error: null };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, updates };
}

function call(h: ReturnType<typeof harness>, jwks: string, method: string, path: string, tok: string | null, body?: unknown) {
    return h.app.request(
        `/storefront${path}`,
        {
            method,
            headers: { ...(tok ? { 'X-LetBuyy-Buyer-Session': tok } : {}), 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
        env(jwks),
    );
}

test('GET /buyer/profile refuses without a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'GET', '/buyer/profile', null);
    assert.equal(res.status, 401);
});

test('GET /buyer/profile returns full_name/phone but never password_hash', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(accountRow({ full_name: 'Asha Verma', phone: '+919999999999' }));
    const res = await call(h, jwks, 'GET', '/buyer/profile', await buyerToken(privateKey, BUYER_A));
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { buyer: Record<string, unknown> } };
    assert.equal(body.data.buyer.full_name, 'Asha Verma');
    assert.equal(body.data.buyer.phone, '+919999999999');
    assert.equal('password_hash' in body.data.buyer, false);
});

test('PATCH /buyer/profile: the buyer id comes from the TOKEN, never a body field', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await call(h, jwks, 'PATCH', '/buyer/profile', await buyerToken(privateKey, BUYER_A), {
        full_name: 'Asha Verma',
        id: BUYER_B,
        buyer_account_id: BUYER_B,
    });
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].buyerAccountId, BUYER_A);
    assert.notEqual(h.updates[0].buyerAccountId, BUYER_B);
});

test('PATCH /buyer/profile: only full_name and phone are ever forwarded, whatever the body claims', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'PATCH', '/buyer/profile', await buyerToken(privateKey, BUYER_A), {
        full_name: 'Asha Verma',
        phone: '+919999999999',
        email: 'attacker@example.com',
        password_hash: 'hijacked',
        email_verified: true,
        status: 'active',
        session_epoch: 999,
    });
    assert.equal(res.status, 200);
    assert.equal(h.updates.length, 1);
    assert.deepEqual(Object.keys(h.updates[0]).sort(), ['buyerAccountId', 'fullName', 'phone'].sort());
});

test('PATCH /buyer/profile rejects an empty update', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'PATCH', '/buyer/profile', await buyerToken(privateKey, BUYER_A), {});
    assert.equal(res.status, 400);
    assert.equal(h.updates.length, 0);
});

test('PATCH /buyer/profile rejects an oversized full_name rather than truncating it silently', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'PATCH', '/buyer/profile', await buyerToken(privateKey, BUYER_A), {
        full_name: 'x'.repeat(201),
    });
    assert.equal(res.status, 400);
    assert.equal(h.updates.length, 0);
});

test('PATCH /buyer/profile can clear a field by sending null', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness(accountRow({ phone: '+919999999999' }));
    await call(h, jwks, 'PATCH', '/buyer/profile', await buyerToken(privateKey, BUYER_A), { phone: null });
    assert.equal(h.updates[0].phone, null);
});
