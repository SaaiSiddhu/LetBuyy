// BUYER-3 (D-8) — the gateway's buyer register and credential-verification wire contract.
//
// Driven through a real Hono app with injected fakes for the three data operations, so what is
// asserted is what a caller actually receives — and, more importantly, what it never receives.
//
// The three properties worth having tests for at all:
//   1. A password hash never leaves this boundary, on any path.
//   2. Verification answers identically for "no account", "no password set" and "wrong password".
//      Anything else is an email-enumeration oracle.
//   3. Both routes are unreachable without the signed internal header. They take a password; a
//      public credential-verification endpoint is a password oracle.

import assert from 'node:assert/strict';
import test from 'node:test';
import * as bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    registerBuyerAccountRoutes,
    type BuyerAccountRow,
} from '../routes/storefront/buyer-account-routes';

const PASSWORD = 'correct-horse-battery';
const EMAIL = 'Shopper@Example.COM ';
const NORMALIZED = 'shopper@example.com';

async function accountRow(overrides: Partial<BuyerAccountRow> = {}): Promise<BuyerAccountRow> {
    return {
        id: 'bbbbbbbb-0000-0000-0000-000000000001',
        email: NORMALIZED,
        password_hash: await bcrypt.hash(PASSWORD, 4),
        email_verified: false,
        status: 'active',
        session_epoch: 1,
        ...overrides,
    };
}

function app(options: {
    existing?: BuyerAccountRow | null;
    lookupError?: unknown;
    insertError?: unknown;
    internalOk?: boolean;
} = {}) {
    const calls = { insert: [] as unknown[], lookups: [] as string[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (email) => email.trim().toLowerCase(),
        requireIdentityInternal: async (c) =>
            (options.internalOk ?? true)
                ? null
                : (c as unknown as { json: (b: unknown, s: number) => Response }).json(
                      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid internal identity signature' } },
                      401,
                  ),
        loadBuyerByEmail: async (_c, email) => {
            calls.lookups.push(email);
            return { data: options.existing ?? null, error: options.lookupError ?? null };
        },
        insertBuyer: async (_c, row) => {
            calls.insert.push(row);
            if (options.insertError) return { data: null, error: options.insertError };
            return { data: await accountRow({ email: row.email, password_hash: row.password_hash }), error: null };
        },
        // BUYER-5 / APPID-P3 deps. This suite covers register and verify-credentials; the ownership
        // routes have their own file, because their risk is entirely different: whose identity is used.
        loadBuyerById: async () => ({ data: options.existing ?? null, error: null }),
        linkStoreCustomer: async () => ({ data: { outcome: 'unverified' }, error: null }),
        claimOrders: async () => ({ data: { outcome: 'unverified' }, error: null }),
        // APPID-P4a deps; their routes are covered in buyer-email-verification-routes.test.ts.
        startEmailChallenge: async () => ({ data: { outcome: 'rate_limited' }, error: null }),
        consumeEmailChallenge: async () => ({ data: { outcome: 'invalid' }, error: null }),
        revokeSessions: async () => ({ data: { outcome: 'buyer_unavailable' }, error: null }),
        sendEmailCode: async () => ({ sent: false }),
    });
    const outer = new Hono<{ Bindings: Env }>();
    outer.route('/storefront', router);
    return { app: outer, calls };
}

const env = () => ({ ENVIRONMENT: 'test' } as unknown as Env);

function post(harness: ReturnType<typeof app>, path: string, body: unknown) {
    return harness.app.request(
        `/storefront${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        env(),
    );
}

test('register creates a buyer, normalizes the email, and never returns a password hash', async () => {
    const harness = app({ existing: null });
    const res = await post(harness, '/buyer/register', { email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 201);

    const body = await res.json() as { success: boolean; data: { buyer: Record<string, unknown> } };
    assert.equal(body.success, true);
    assert.equal(body.data.buyer.email, NORMALIZED, 'the stored email must satisfy the lower(btrim(email)) CHECK');
    assert.ok(!('password_hash' in body.data.buyer), 'a password hash must never reach a caller');
    assert.ok(!JSON.stringify(body).includes('$2'), 'no bcrypt hash may appear anywhere in the response');

    const inserted = harness.calls.insert[0] as { email: string; password_hash: string };
    assert.equal(inserted.email, NORMALIZED);
    assert.notEqual(inserted.password_hash, PASSWORD, 'the password must be hashed before it is stored');
    assert.ok(await bcrypt.compare(PASSWORD, inserted.password_hash), 'the stored hash must verify the password');
});

test('register carries NO store_id — a buyer is platform-level', async () => {
    const harness = app({ existing: null });
    await post(harness, '/buyer/register', { email: EMAIL, password: PASSWORD, store_id: 'sneaky-store' });
    const inserted = harness.calls.insert[0] as Record<string, unknown>;
    assert.ok(!('store_id' in inserted), 'a store_id supplied by a caller must never reach buyer_accounts');
    assert.ok(!('site_id' in inserted), 'nor a site_id — site_id is the tenant boundary and a buyer is not a tenant');
});

test('register refuses to overwrite an existing password — that would be account takeover', async () => {
    const harness = app({ existing: await accountRow() });
    const res = await post(harness, '/buyer/register', { email: EMAIL, password: 'a-different-password' });
    assert.equal(res.status, 409);
    assert.equal(harness.calls.insert.length, 0, 'no write may happen on the takeover path');
});

test('register refuses an existing PASSWORD-LESS account too — its first credential needs proof (APPID-P3)', async () => {
    // Until APPID-P3 this path set the password, so whoever typed the address first owned the account
    // without ever proving they control it. A first credential on an existing account now goes
    // through identity-platform's verified recovery path.
    const harness = app({ existing: await accountRow({ password_hash: null }) });
    const res = await post(harness, '/buyer/register', { email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 409);
    const body = await res.json() as { error: { code: string } };
    assert.equal(body.error.code, 'ACCOUNT_EXISTS');
    assert.equal(harness.calls.insert.length, 0, 'no account may be written on this path');
});

test('register rejects a password outside 8..128 characters', async () => {
    const harness = app({ existing: null });
    for (const password of ['short', 'x'.repeat(129)]) {
        const res = await post(harness, '/buyer/register', { email: EMAIL, password });
        assert.equal(res.status, 400);
    }
    assert.equal(harness.calls.insert.length, 0);
});

test('verification succeeds on a correct password and returns no hash', async () => {
    const harness = app({ existing: await accountRow() });
    const res = await post(harness, '/buyer/verify-credentials', { email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { buyer: Record<string, unknown> | null } };
    assert.ok(body.data.buyer, 'a correct password must authenticate');
    assert.ok(!('password_hash' in (body.data.buyer as object)));
});

test('a wrong password, a missing account and a password-less account are INDISTINGUISHABLE', async () => {
    // The enumeration property. If these three differ in status or body, the endpoint tells an
    // attacker which email addresses have accounts.
    const wrong = await post(app({ existing: await accountRow() }), '/buyer/verify-credentials', { email: EMAIL, password: 'wrong-password-entirely' });
    const missing = await post(app({ existing: null }), '/buyer/verify-credentials', { email: EMAIL, password: PASSWORD });
    const noPassword = await post(app({ existing: await accountRow({ password_hash: null }) }), '/buyer/verify-credentials', { email: EMAIL, password: PASSWORD });

    const bodies = await Promise.all([wrong.json(), missing.json(), noPassword.json()]);
    assert.deepEqual([wrong.status, missing.status, noPassword.status], [200, 200, 200]);
    assert.deepEqual(bodies[0], bodies[1], 'a wrong password and a missing account must be identical');
    assert.deepEqual(bodies[1], bodies[2], 'a missing account and a password-less one must be identical');
});

test('a disabled account is refused even with the correct password', async () => {
    const harness = app({ existing: await accountRow({ status: 'disabled' }) });
    const res = await post(harness, '/buyer/verify-credentials', { email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 403);
});

test('both routes are unreachable without the signed internal header', async () => {
    for (const path of ['/buyer/register', '/buyer/verify-credentials']) {
        const harness = app({ internalOk: false, existing: null });
        const res = await post(harness, path, { email: EMAIL, password: PASSWORD });
        assert.equal(res.status, 401, `${path} must reject an unsigned caller`);
        assert.equal(harness.calls.lookups.length, 0, `${path} must not touch the database before authorizing`);
    }
});

test('a database failure is a 500, never a silent success', async () => {
    const harness = app({ lookupError: { message: 'connection reset' } });
    const res = await post(harness, '/buyer/verify-credentials', { email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 500);
});
