// D2 (SUSTAINED-J) — GET/POST/PATCH/DELETE /buyer/addresses: the buyer's own cross-store address book.
//
// The properties worth testing:
//   1. The buyer id comes from the verified TOKEN, never a request parameter or body field.
//   2. An address id alone is never enough -- ownership is checked with buyer_account_id on every
//      read, write and delete, which the deps' own signature enforces (no addressId-only overload
//      exists to call).
//   3. Required fields are validated before any deps function runs.
//   4. A PATCH/DELETE for an address the buyer does not own answers 404, not another buyer's row.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import {
    registerBuyerAddressRoutes,
    type BuyerAddressRow,
} from '../routes/storefront/buyer-address-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const BUYER_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ADDR_A = 'cccccccc-3333-4333-8333-cccccccccccc';

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

function addressRow(over: Partial<BuyerAddressRow> = {}): BuyerAddressRow {
    return {
        id: ADDR_A, buyer_account_id: BUYER_A, label: 'home', full_name: 'Asha Verma', phone: null,
        address_line1: '12 MG Road', address_line2: null, city: 'Bengaluru', state: 'Karnataka',
        postal_code: '560001', country: 'IN', landmark: null, is_default: true, gstin: null,
        state_code: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        ...over,
    };
}

function harness(existing: BuyerAddressRow[] = [addressRow()]) {
    const calls = {
        list: [] as string[],
        create: [] as { buyerAccountId: string; address: unknown }[],
        update: [] as { buyerAccountId: string; addressId: string; address: unknown }[],
        del: [] as { buyerAccountId: string; addressId: string }[],
    };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAddressRoutes(router, {
        listAddresses: async (_c, buyerAccountId) => {
            calls.list.push(buyerAccountId);
            return { data: existing.filter((a) => a.buyer_account_id === buyerAccountId), error: null };
        },
        createAddress: async (_c, input) => {
            calls.create.push(input);
            return { data: addressRow({ buyer_account_id: input.buyerAccountId, ...input.address }), error: null };
        },
        updateAddress: async (_c, input) => {
            calls.update.push(input);
            const found = existing.find((a) => a.id === input.addressId && a.buyer_account_id === input.buyerAccountId);
            if (!found) return { data: null, error: null, notFound: true };
            return { data: { ...found, ...input.address }, error: null };
        },
        deleteAddress: async (_c, input) => {
            calls.del.push(input);
            const found = existing.find((a) => a.id === input.addressId && a.buyer_account_id === input.buyerAccountId);
            return { error: null, notFound: !found };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
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

test('every route refuses without a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    for (const [method, path] of [
        ['GET', '/buyer/addresses'],
        ['POST', '/buyer/addresses'],
        ['PATCH', `/buyer/addresses/${ADDR_A}`],
        ['DELETE', `/buyer/addresses/${ADDR_A}`],
    ]) {
        const res = await call(h, jwks, method, path, null, method === 'GET' || method === 'DELETE' ? undefined : {});
        assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal(h.calls.list.length + h.calls.create.length + h.calls.update.length + h.calls.del.length, 0);
});

test('GET /buyer/addresses: the buyer id comes from the TOKEN, never a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await call(h, jwks, 'GET', `/buyer/addresses?buyer_account_id=${BUYER_B}`, await buyerToken(privateKey, BUYER_A));
    assert.equal(h.calls.list[0], BUYER_A);
});

test('GET /buyer/addresses only ever returns the caller\'s own addresses', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness([addressRow(), addressRow({ id: 'dddddddd-4444-4444-8444-dddddddddddd', buyer_account_id: BUYER_B })]);
    const res = await call(h, jwks, 'GET', '/buyer/addresses', await buyerToken(privateKey, BUYER_A));
    const body = await res.json() as { data: { addresses: BuyerAddressRow[] } };
    assert.equal(body.data.addresses.length, 1);
    assert.equal(body.data.addresses[0].buyer_account_id, BUYER_A);
});

test('POST /buyer/addresses validates required fields before calling deps', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'POST', '/buyer/addresses', await buyerToken(privateKey, BUYER_A), { full_name: 'Asha' });
    assert.equal(res.status, 400);
    assert.equal(h.calls.create.length, 0);
});

test('POST /buyer/addresses: the buyer id comes from the TOKEN, never a body field', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await call(h, jwks, 'POST', '/buyer/addresses', await buyerToken(privateKey, BUYER_A), {
        buyer_account_id: BUYER_B,
        full_name: 'Asha Verma', address_line1: '1 Road', city: 'Pune', state: 'Maharashtra', postal_code: '411001',
    });
    assert.equal(h.calls.create[0].buyerAccountId, BUYER_A);
});

test('PATCH /buyer/addresses/:id for an address the caller does not own answers 404, not another buyer\'s row', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness([addressRow({ buyer_account_id: BUYER_B })]);
    const res = await call(h, jwks, 'PATCH', `/buyer/addresses/${ADDR_A}`, await buyerToken(privateKey, BUYER_A), { full_name: 'Attacker' });
    assert.equal(res.status, 404);
});

test('DELETE /buyer/addresses/:id for an address the caller does not own answers 404, not another buyer\'s row', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness([addressRow({ buyer_account_id: BUYER_B })]);
    const res = await call(h, jwks, 'DELETE', `/buyer/addresses/${ADDR_A}`, await buyerToken(privateKey, BUYER_A));
    assert.equal(res.status, 404);
});

test('PATCH /buyer/addresses/:id rejects a malformed address id before calling deps', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'PATCH', '/buyer/addresses/not-a-uuid', await buyerToken(privateKey, BUYER_A), { full_name: 'X' });
    assert.equal(res.status, 400);
    assert.equal(h.calls.update.length, 0);
});
