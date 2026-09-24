// APPID-P4a — buyer email verification, password recovery, sign-out-everywhere and the session epoch,
// as the gateway serves them.
//
// The database decides (migration 257, proven on real Postgres in
// tests/executable/buyer-email-challenges-postgres.test.mjs). What is asserted here is what only the
// gateway can get wrong:
//   1. No response ever carries a code. The code goes to the mailer and nowhere else.
//   2. Whose account is acted on comes from the verified token, never from a request body.
//   3. Recovery answers identically whether or not the address has an account.
//   4. A token from an older session epoch is refused, and a failed epoch read refuses rather than
//      trusting the signature alone.
//   5. identity-platform, which signs as the 'accounts' app, can reach the buyer routes, and the
//      'storefront' app no longer can.

import assert from 'node:assert/strict';
import test from 'node:test';
import * as bcrypt from 'bcryptjs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import { createLetbuyyInternalAppHeaders } from '@letbuyy/auth-core';
import type { Env } from '../index';
import type { BuyerEmailCodeDelivery } from '../lib/buyer-email-code';
import {
    registerBuyerAccountRoutes,
    type BuyerAccountRow,
    type EmailChallengeOutcome,
    type EmailChallengeStart,
    type SessionRevocation,
} from '../routes/storefront/buyer-account-routes';
import { registerBuyerRealmRoutes } from '../routes/storefront/buyer-realm-wiring';
import type { BuyerSessionState, BuyerSessionStateLoader } from '../middleware/buyer-session';
import { installBuyerSessionState } from './buyer-session-state-fake';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const CODE = '482913';
const IDENTITY = { 'X-Test-Identity-Internal': 'yes' };

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function mint(privateKey: CryptoKey, opts: { sub?: string; sep?: unknown } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = { realm: 'buyer', token_use: 'buyer_session' };
    if (opts.sep !== undefined) claims.sep = opts.sep;
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER)
        .setAudience('letbuyy:buyer-session')
        .setSubject(opts.sub ?? BUYER_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

const account = (over: Partial<BuyerAccountRow> = {}): BuyerAccountRow => ({
    id: BUYER_ID, email: 'shopper@example.com', password_hash: '$2a$04$notarealhashnotarealhashnotarealhashnotarealhashnotare',
    email_verified: false, status: 'active', session_epoch: 1, ...over,
});

interface HarnessOptions {
    buyer?: BuyerAccountRow | null;
    start?: EmailChallengeStart;
    startError?: unknown;
    consume?: EmailChallengeOutcome;
    consumeError?: unknown;
    revoke?: SessionRevocation;
    mailerSent?: boolean;
    sessionState?: BuyerSessionStateLoader | Record<string, BuyerSessionState | null>;
}

function harness(options: HarnessOptions = {}) {
    const buyer = options.buyer === undefined ? account() : options.buyer;
    const calls = {
        lookups: [] as string[],
        started: [] as { buyerAccountId: string; purpose: string }[],
        consumed: [] as { buyerAccountId: string; purpose: string; code: string; newPasswordHash: string | null }[],
        revoked: [] as string[],
        mailed: [] as BuyerEmailCodeDelivery[],
    };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (e) => e.trim().toLowerCase(),
        // Stands in for identity-platform's signed header; the real check is exercised at the end of
        // this file through the production wiring.
        requireIdentityInternal: async (c) => (c.req.header('X-Test-Identity-Internal') === 'yes'
            ? null
            : c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid internal identity signature' } }, 401)),
        loadBuyerByEmail: async (_c, email) => {
            calls.lookups.push(email);
            return { data: buyer && buyer.email === email ? buyer : null, error: null };
        },
        loadBuyerById: async (_c, id) => ({ data: buyer && buyer.id === id ? buyer : null, error: null }),
        insertBuyer: async () => ({ data: null, error: 'not used' }),
        linkStoreCustomer: async () => ({ data: null, error: 'not used' }),
        claimOrders: async () => ({ data: null, error: 'not used' }),
        startEmailChallenge: async (_c, input) => {
            calls.started.push(input);
            if (options.startError) return { data: null, error: options.startError };
            return {
                data: options.start ?? {
                    outcome: 'started', challenge_id: 'challenge-1', code: CODE,
                    email: buyer?.email ?? 'nobody@example.com', expires_at: '2026-09-24T10:10:00Z',
                },
                error: null,
            };
        },
        consumeEmailChallenge: async (_c, input) => {
            calls.consumed.push(input);
            if (options.consumeError) return { data: null, error: options.consumeError };
            return { data: options.consume ?? { outcome: 'invalid' }, error: null };
        },
        revokeSessions: async (_c, buyerAccountId) => {
            calls.revoked.push(buyerAccountId);
            return { data: options.revoke ?? { outcome: 'revoked', session_epoch: 2 }, error: null };
        },
        sendEmailCode: async (_env, delivery) => {
            calls.mailed.push(delivery);
            return { sent: options.mailerSent ?? true };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app, options.sessionState ?? {});
    app.route('/storefront', router);
    return { app, calls };
}

async function post(
    h: ReturnType<typeof harness>,
    jwks: string,
    path: string,
    opts: { token?: string | null; internal?: boolean; body?: unknown } = {},
) {
    return h.app.request(
        `/storefront${path}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(opts.internal === false ? {} : IDENTITY),
                ...(opts.token ? { 'X-LetBuyy-Buyer-Session': opts.token } : {}),
            },
            body: JSON.stringify(opts.body ?? {}),
        },
        { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env,
    );
}

// ---------------------------------------------------------------------------------------------------
// The session epoch, checked by requireBuyerSession on every buyer route
// ---------------------------------------------------------------------------------------------------

test('the epoch: a token is good only in the epoch the account is in now', async () => {
    const { privateKey, jwks } = await keys();
    const cases: { sep: unknown; accountEpoch: number; status: number; why: string }[] = [
        { sep: undefined, accountEpoch: 1, status: 200, why: 'a token from before epochs counts as epoch 1' },
        { sep: undefined, accountEpoch: 2, status: 401, why: 'and ends at the first reset or sign-out-everywhere' },
        { sep: 2, accountEpoch: 2, status: 200, why: 'a token from the current epoch' },
        { sep: 1, accountEpoch: 2, status: 401, why: 'a token from an ended epoch' },
        { sep: 3, accountEpoch: 2, status: 401, why: 'an epoch the account has not reached' },
        { sep: 0, accountEpoch: 1, status: 401, why: 'zero is not an epoch' },
        { sep: 1.5, accountEpoch: 1, status: 401, why: 'nor is a fraction' },
        { sep: '1', accountEpoch: 1, status: 401, why: 'nor a string' },
    ];
    for (const c of cases) {
        const h = harness({ sessionState: { [BUYER_ID]: { status: 'active', session_epoch: c.accountEpoch } } });
        const res = await post(h, jwks, '/buyer/sessions/revoke', { token: await mint(privateKey, { sep: c.sep }) });
        assert.equal(res.status, c.status, `${c.why} (sep=${String(c.sep)}, account epoch ${c.accountEpoch})`);
        assert.equal(h.calls.revoked.length, c.status === 200 ? 1 : 0, `${c.why}: the route runs only for a good token`);
    }
});

test('the epoch read fails closed: an error or a throw is a 503, never a pass', async () => {
    const { privateKey, jwks } = await keys();
    for (const loader of [
        (async () => ({ data: null, error: new Error('database unavailable') })) as BuyerSessionStateLoader,
        (async () => { throw new Error('connection reset'); }) as BuyerSessionStateLoader,
    ]) {
        const h = harness({ sessionState: loader });
        const res = await post(h, jwks, '/buyer/sessions/revoke', { token: await mint(privateKey) });
        assert.equal(res.status, 503);
        assert.equal(h.calls.revoked.length, 0);
    }
});

test('a deleted account is unauthenticated and a disabled one is refused', async () => {
    const { privateKey, jwks } = await keys();
    const deleted = harness({ sessionState: { [BUYER_ID]: null } });
    assert.equal((await post(deleted, jwks, '/buyer/sessions/revoke', { token: await mint(privateKey) })).status, 401);
    const disabled = harness({ sessionState: { [BUYER_ID]: { status: 'disabled', session_epoch: 1 } } });
    const res = await post(disabled, jwks, '/buyer/sessions/revoke', { token: await mint(privateKey) });
    assert.equal(res.status, 403);
    assert.equal((await res.json() as { error: { code: string } }).error.code, 'BUYER_DISABLED');
});

// ---------------------------------------------------------------------------------------------------
// Sign out everywhere
// ---------------------------------------------------------------------------------------------------

test('sign out everywhere revokes the TOKEN\'s account, and that token stops working', async () => {
    const { privateKey, jwks } = await keys();
    const state: Record<string, BuyerSessionState> = { [BUYER_ID]: { status: 'active', session_epoch: 1 } };
    const h = harness({ sessionState: async (_c, id) => ({ data: state[id] ?? null, error: null }) });
    const token = await mint(privateKey, { sep: 1 });

    const res = await post(h, jwks, '/buyer/sessions/revoke', { token, body: { buyer_account_id: OTHER_BUYER } });
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.revoked, [BUYER_ID], 'the body must never choose whose sessions end');
    assert.deepEqual((await res.json() as { data: unknown }).data, { revoked: true, session_epoch: 2 });

    state[BUYER_ID] = { status: 'active', session_epoch: 2 };
    assert.equal((await post(h, jwks, '/buyer/sessions/revoke', { token })).status, 401, 'the revoked token is refused');
});

test('sign out everywhere needs identity-platform AND a session', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    assert.equal((await post(h, jwks, '/buyer/sessions/revoke', { token: await mint(privateKey), internal: false })).status, 401);
    assert.equal((await post(h, jwks, '/buyer/sessions/revoke', { token: null })).status, 401);
    assert.equal(h.calls.revoked.length, 0);
});

// ---------------------------------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------------------------------

test('starting verification mails the code to the account and returns no code', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await post(h, jwks, '/buyer/email-verification/start', {
        token: await mint(privateKey),
        body: { buyer_account_id: OTHER_BUYER, email: 'attacker@example.com' },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(CODE), 'the code must never appear in a response');
    assert.deepEqual(JSON.parse(text).data, { sent: true, expires_at: '2026-09-24T10:10:00Z' });
    assert.deepEqual(h.calls.started, [{ buyerAccountId: BUYER_ID, purpose: 'verify_email' }], 'the token, not the body, names the account');
    assert.deepEqual(h.calls.mailed, [{ email: 'shopper@example.com', code: CODE, purpose: 'verify_email' }], "the code goes to the account's own address");
});

test('verification start: already verified, rate limited, and a mailer that fails', async () => {
    const { privateKey, jwks } = await keys();

    const verified = harness({ buyer: account({ email_verified: true }) });
    const already = await post(verified, jwks, '/buyer/email-verification/start', { token: await mint(privateKey) });
    assert.equal(already.status, 200);
    assert.deepEqual((await already.json() as { data: unknown }).data, { already_verified: true });
    assert.equal(verified.calls.started.length, 0, 'no challenge for an address already proven');

    const limited = harness({ start: { outcome: 'rate_limited' } });
    const tooMany = await post(limited, jwks, '/buyer/email-verification/start', { token: await mint(privateKey) });
    assert.equal(tooMany.status, 429);
    assert.equal(limited.calls.mailed.length, 0);

    const down = harness({ mailerSent: false });
    const unavailable = await post(down, jwks, '/buyer/email-verification/start', { token: await mint(privateKey) });
    assert.equal(unavailable.status, 503);
    assert.ok(!(await unavailable.text()).includes(CODE), 'a failed send must not fall back to returning the code');
});

test('verification start needs identity-platform before it looks at the session', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await post(h, jwks, '/buyer/email-verification/start', { token: await mint(privateKey), internal: false });
    assert.equal(res.status, 401);
    assert.equal((await res.json() as { error: { message: string } }).error.message, 'Invalid internal identity signature');
    assert.equal(h.calls.started.length, 0);
});

test('completing verification consumes the TOKEN\'s challenge and never returns a password hash', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ consume: { outcome: 'verified', buyer_account_id: BUYER_ID, session_epoch: 1 } });
    const res = await post(h, jwks, '/buyer/email-verification/complete', {
        token: await mint(privateKey),
        body: { code: ` ${CODE} `, buyer_account_id: OTHER_BUYER },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes('$2'), 'no bcrypt hash may appear in the response');
    const buyer = (JSON.parse(text) as { data: { buyer: Record<string, unknown> } }).data.buyer;
    assert.equal(buyer.email_verified, true);
    assert.ok(!('password_hash' in buyer));
    assert.deepEqual(h.calls.consumed, [{ buyerAccountId: BUYER_ID, purpose: 'verify_email', code: CODE, newPasswordHash: null }]);
});

test('a malformed code never reaches the database, so it cannot spend an attempt', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    for (const code of ['12345', '1234567', 'abcdef', '', 482913, null]) {
        const res = await post(h, jwks, '/buyer/email-verification/complete', { token: await mint(privateKey), body: { code } });
        assert.equal(res.status, 400, `code ${JSON.stringify(code)}`);
    }
    assert.equal(h.calls.consumed.length, 0);
});

test('every refusal of a code maps to its own answer', async () => {
    const { privateKey, jwks } = await keys();
    const expected: Record<string, [number, string]> = {
        invalid: [400, 'CODE_INVALID'],
        expired: [400, 'CODE_EXPIRED'],
        locked: [429, 'CODE_LOCKED'],
        address_changed: [409, 'ADDRESS_CHANGED'],
        buyer_unavailable: [403, 'BUYER_DISABLED'],
    };
    for (const [outcome, [status, code]] of Object.entries(expected)) {
        const h = harness({ consume: { outcome } as EmailChallengeOutcome });
        const res = await post(h, jwks, '/buyer/email-verification/complete', { token: await mint(privateKey), body: { code: CODE } });
        assert.equal(res.status, status, outcome);
        assert.equal((await res.json() as { error: { code: string } }).error.code, code, outcome);
    }
    const broken = harness({ consumeError: new Error('db down') });
    assert.equal((await post(broken, jwks, '/buyer/email-verification/complete', { token: await mint(privateKey), body: { code: CODE } })).status, 500);
});

// ---------------------------------------------------------------------------------------------------
// Password recovery
// ---------------------------------------------------------------------------------------------------

test('recovery start answers the same for every address, and only an active account is mailed', async () => {
    const { jwks } = await keys();
    const scenarios: { name: string; options: HarnessOptions; email: string; mailed: number }[] = [
        { name: 'no account', options: {}, email: 'nobody@example.com', mailed: 0 },
        { name: 'disabled account', options: { buyer: account({ status: 'disabled' }) }, email: 'shopper@example.com', mailed: 0 },
        { name: 'over the hourly limit', options: { start: { outcome: 'rate_limited' } }, email: 'shopper@example.com', mailed: 0 },
        { name: 'mailer failed', options: { mailerSent: false }, email: 'shopper@example.com', mailed: 1 },
        { name: 'code sent', options: {}, email: '  Shopper@Example.COM ', mailed: 1 },
    ];
    const answers = new Set<string>();
    for (const s of scenarios) {
        const h = harness(s.options);
        const res = await post(h, jwks, '/buyer/password-recovery/start', { body: { email: s.email } });
        const text = await res.text();
        answers.add(`${res.status} ${text}`);
        assert.ok(!text.includes(CODE), `${s.name}: no code in the response`);
        assert.equal(h.calls.mailed.length, s.mailed, `${s.name}: mailed`);
        if (s.mailed) assert.equal(h.calls.mailed[0].purpose, 'reset_password');
    }
    assert.equal(answers.size, 1, `every address must get one answer, got: ${[...answers].join(' | ')}`);
    assert.ok([...answers][0].startsWith('202 '));
});

test('recovery is identity-platform only, and needs an email', async () => {
    const { jwks } = await keys();
    const h = harness();
    assert.equal((await post(h, jwks, '/buyer/password-recovery/start', { internal: false, body: { email: 'shopper@example.com' } })).status, 401);
    assert.equal((await post(h, jwks, '/buyer/password-recovery/complete', { internal: false, body: { email: 'shopper@example.com', code: CODE, password: 'a-new-password' } })).status, 401);
    assert.equal((await post(h, jwks, '/buyer/password-recovery/start', { body: {} })).status, 400);
    assert.equal(h.calls.started.length + h.calls.consumed.length + h.calls.mailed.length, 0);
});

test('a reset stores a bcrypt hash of the new password and returns the new epoch, never the hash', async () => {
    const { jwks } = await keys();
    const h = harness({ consume: { outcome: 'password_reset', buyer_account_id: BUYER_ID, session_epoch: 4 } });
    const res = await post(h, jwks, '/buyer/password-recovery/complete', {
        body: { email: 'Shopper@Example.com', code: CODE, password: 'a-new-password' },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes('$2'), 'no bcrypt hash may appear in the response');
    assert.deepEqual((JSON.parse(text) as { data: { buyer: unknown } }).data.buyer, {
        id: BUYER_ID, email: 'shopper@example.com', email_verified: true, status: 'active', session_epoch: 4,
    });
    const [consumed] = h.calls.consumed;
    assert.equal(consumed.buyerAccountId, BUYER_ID);
    assert.equal(consumed.purpose, 'reset_password');
    assert.equal(consumed.code, CODE);
    assert.ok(consumed.newPasswordHash && consumed.newPasswordHash !== 'a-new-password', 'the password must be hashed before it leaves');
    assert.ok(await bcrypt.compare('a-new-password', consumed.newPasswordHash!), 'and the hash must verify it');
});

test('a reset for an address with no account is refused exactly like a wrong code', async () => {
    const { jwks } = await keys();
    const noAccount = harness();
    const wrongCode = harness({ consume: { outcome: 'invalid' } });
    const a = await post(noAccount, jwks, '/buyer/password-recovery/complete', { body: { email: 'nobody@example.com', code: CODE, password: 'a-new-password' } });
    const b = await post(wrongCode, jwks, '/buyer/password-recovery/complete', { body: { email: 'shopper@example.com', code: CODE, password: 'a-new-password' } });
    assert.equal(a.status, b.status);
    assert.deepEqual(await a.json(), await b.json());
    assert.equal(noAccount.calls.consumed.length, 0);
});

test('a reset validates the code and the password before anything else', async () => {
    const { jwks } = await keys();
    const h = harness();
    for (const body of [
        { email: 'shopper@example.com', code: '12', password: 'a-new-password' },
        { email: 'shopper@example.com', code: CODE, password: 'short' },
        { email: 'shopper@example.com', code: CODE, password: 'x'.repeat(129) },
        { code: CODE, password: 'a-new-password' },
    ]) {
        assert.equal((await post(h, jwks, '/buyer/password-recovery/complete', { body })).status, 400, JSON.stringify(body).slice(0, 60));
    }
    assert.equal(h.calls.lookups.length + h.calls.consumed.length, 0);
});

// ---------------------------------------------------------------------------------------------------
// The caller: identity-platform signs as 'accounts', through the production wiring
// ---------------------------------------------------------------------------------------------------

test("identity-platform's own signed header reaches the buyer routes; the storefront's does not", async () => {
    const secret = 'test-internal-secret';
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerRealmRoutes(router, { normalizeEmail: (e) => e.trim().toLowerCase() });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    const env = { INTERNAL_API_SECRET: secret } as unknown as Env;

    const signedAs = async (appName: string) => {
        const plan = await createLetbuyyInternalAppHeaders({ app: appName, secret });
        assert.ok(plan.ok && plan.headers);
        return plan.headers as Record<string, string>;
    };
    // An empty body stops each route at validation, after the internal check and before any database
    // call, so the status says only whether the caller got past the gate.
    for (const path of ['/buyer/register', '/buyer/verify-credentials', '/buyer/password-recovery/start', '/buyer/password-recovery/complete']) {
        const call = (headers: Record<string, string>) => app.request(
            `/storefront${path}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' },
            env,
        );
        assert.equal((await call(await signedAs('accounts'))).status, 400, `${path}: identity-platform must get through`);
        assert.equal((await call(await signedAs('storefront'))).status, 401, `${path}: the storefront must not`);
        assert.equal((await call({})).status, 401, `${path}: nor an unsigned caller`);
    }
});
