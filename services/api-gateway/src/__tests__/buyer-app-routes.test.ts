// APPID-P4d — the routes the marketplace app calls with its platform buyer session.
//
// The session is real: tokens are signed with a test ES256 key and checked by the gateway's own
// requireBuyerSession, epoch and status included. What only these routes can get wrong:
//   1. /buyer/account answers only to a live platform buyer session, and is never cached.
//   2. /buyer/firebase-link links the uid the VERIFIED Firebase token names to the SESSION's buyer,
//      whatever the body says; decides nothing when Google's keys cannot be read; and reports every
//      refusal the database makes without turning any of them into a link.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import type { FirebaseTokenCheck } from '../lib/firebase-id-token';
import type { BuyerAccountRow } from '../routes/storefront/buyer-account-routes';
import { registerBuyerAppRoutes, type FirebaseLinkOutcome } from '../routes/storefront/buyer-app-routes';
import { registerBuyerRealmRoutes } from '../routes/storefront/buyer-realm-wiring';
import type { BuyerSessionState, BuyerSessionStateLoader } from '../middleware/buyer-session';
import { installBuyerSessionState } from './buyer-session-state-fake';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function mint(privateKey: CryptoKey, kind: 'buyer' | 'storefront' | 'merchant' = 'buyer', sep = 1) {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = kind === 'merchant'
        ? { realm: 'merchant', token_use: 'merchant_session' }
        : { realm: 'buyer', token_use: kind === 'buyer' ? 'buyer_session' : 'storefront_session', sep };
    if (kind === 'storefront') claims.site_id = SITE;
    const audience = kind === 'buyer' ? 'letbuyy:buyer-session' : kind === 'storefront' ? 'letbuyy:storefront-session' : 'letbuyy:merchant-session';
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER)
        .setAudience(audience)
        .setSubject(BUYER_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

const buyerRow = (over: Partial<BuyerAccountRow> = {}): BuyerAccountRow => ({
    id: BUYER_ID, email: 'asha@example.com', password_hash: '$2a$04$notarealhashnotarealhashnotarealhashnotarealhashnotare',
    email_verified: true, status: 'active', session_epoch: 1, full_name: null, phone: null, ...over,
});

interface HarnessOptions {
    firebase?: FirebaseTokenCheck;
    link?: FirebaseLinkOutcome | null;
    linkError?: unknown;
    sessionState?: BuyerSessionStateLoader | Record<string, BuyerSessionState | null>;
}

function harness(options: HarnessOptions = {}) {
    const calls = {
        verified: [] as string[],
        linked: [] as { buyerAccountId: string; firebaseUid: string; firebaseProject: string; firebaseEmail: string }[],
    };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAppRoutes(router, {
        loadBuyerById: async (_c, id) => ({ data: id === BUYER_ID ? buyerRow() : null, error: null }),
        verifyFirebaseToken: async (_c, token) => {
            calls.verified.push(token);
            return options.firebase ?? { ok: true, identity: { uid: 'firebase-uid-asha', email: 'asha@example.com', project: 'letbuy-y' } };
        },
        linkFirebaseUid: async (_c, input) => {
            calls.linked.push(input);
            return { data: options.link === undefined ? { outcome: 'linked' } : options.link, error: options.linkError ?? null };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app, options.sessionState ?? {});
    app.route('/storefront', router);
    return { app, calls };
}

function call(h: ReturnType<typeof harness>, jwks: string, method: 'GET' | 'POST', path: string, opts: { token?: string; body?: unknown } = {}) {
    return h.app.request(
        `/storefront${path}`,
        {
            method,
            headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'X-LetBuyy-Buyer-Session': opts.token } : {}) },
            ...(method === 'POST' ? { body: JSON.stringify(opts.body ?? {}) } : {}),
        },
        { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env,
    );
}

// ---------------------------------------------------------------------------------------------------
// /buyer/account
// ---------------------------------------------------------------------------------------------------

test('the account read returns the public view to a live buyer session, uncached', async () => {
    const { privateKey, jwks } = await keys();
    const res = await call(harness(), jwks, 'GET', '/buyer/account', { token: await mint(privateKey) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const text = await res.text();
    assert.ok(!text.includes('$2'), 'no bcrypt hash');
    assert.deepEqual(JSON.parse(text).data.buyer, { id: BUYER_ID, email: 'asha@example.com', email_verified: true, status: 'active', session_epoch: 1, full_name: null, phone: null });
});

test('the account read refuses no session, another realm, an ended epoch and a disabled account, and fails closed', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    assert.equal((await call(h, jwks, 'GET', '/buyer/account')).status, 401, 'no session');
    assert.equal((await call(h, jwks, 'GET', '/buyer/account', { token: await mint(privateKey, 'storefront') })).status, 401, 'a storefront session');
    assert.equal((await call(h, jwks, 'GET', '/buyer/account', { token: await mint(privateKey, 'merchant') })).status, 401, 'a merchant session');
    const ended = harness({ sessionState: { [BUYER_ID]: { status: 'active', session_epoch: 2 } } });
    assert.equal((await call(ended, jwks, 'GET', '/buyer/account', { token: await mint(privateKey) })).status, 401, 'signed out everywhere, or the password was reset');
    const disabled = harness({ sessionState: { [BUYER_ID]: { status: 'disabled', session_epoch: 1 } } });
    assert.equal((await call(disabled, jwks, 'GET', '/buyer/account', { token: await mint(privateKey) })).status, 403, 'a disabled account');
    const broken = harness({ sessionState: async () => ({ data: null, error: new Error('db down') }) });
    assert.equal((await call(broken, jwks, 'GET', '/buyer/account', { token: await mint(privateKey) })).status, 503, 'fails closed');
});

// ---------------------------------------------------------------------------------------------------
// /buyer/firebase-link
// ---------------------------------------------------------------------------------------------------

test("a link joins the VERIFIED token's uid to the SESSION's buyer, whatever the body names", async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'POST', '/buyer/firebase-link', {
        token: await mint(privateKey),
        body: { id_token: 'firebase-id-token', uid: 'someone-elses-uid', buyer_account_id: OTHER_BUYER, email: 'other@example.com' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown }).data, { linked: true, outcome: 'linked' });
    assert.deepEqual(h.calls.verified, ['firebase-id-token']);
    assert.deepEqual(h.calls.linked, [{ buyerAccountId: BUYER_ID, firebaseUid: 'firebase-uid-asha', firebaseProject: 'letbuy-y', firebaseEmail: 'asha@example.com' }]);

    const again = harness({ link: { outcome: 'already_linked' } });
    const repeat = await call(again, jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: { id_token: 't' } });
    assert.deepEqual((await repeat.json() as { data: unknown }).data, { linked: true, outcome: 'already_linked' });
});

test('no session, a bad token, an unprovable address or unreadable keys link nothing', async () => {
    const { privateKey, jwks } = await keys();
    const noSession = harness();
    assert.equal((await call(noSession, jwks, 'POST', '/buyer/firebase-link', { body: { id_token: 't' } })).status, 401);
    assert.equal((await call(noSession, jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey, 'storefront'), body: { id_token: 't' } })).status, 401);
    assert.deepEqual(noSession.calls.verified, [], 'the Firebase token is not even looked at without a buyer session');

    const missing = harness();
    assert.equal((await call(missing, jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: {} })).status, 400);

    const cases: [FirebaseTokenCheck, number, string][] = [
        [{ ok: false, reason: 'invalid' }, 400, 'INVALID_FIREBASE_TOKEN'],
        [{ ok: false, reason: 'unlinkable' }, 422, 'FIREBASE_EMAIL_UNVERIFIED'],
        [{ ok: false, reason: 'unavailable' }, 503, 'FIREBASE_KEYS_UNAVAILABLE'],
    ];
    for (const [firebase, status, code] of cases) {
        const h = harness({ firebase });
        const res = await call(h, jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: { id_token: 't' } });
        assert.equal(res.status, status, code);
        assert.equal((await res.json() as { error: { code: string } }).error.code, code);
        assert.deepEqual(h.calls.linked, [], `${code}: nothing reaches the database`);
    }
    assert.deepEqual(missing.calls.linked, []);
});

test("every refusal the database makes is reported as a refusal, never as a link", async () => {
    const { privateKey, jwks } = await keys();
    const cases: [FirebaseLinkOutcome['outcome'], number, string][] = [
        ['unverified', 403, 'EMAIL_NOT_VERIFIED'],
        ['email_mismatch', 409, 'EMAIL_MISMATCH'],
        ['conflict', 409, 'FIREBASE_LINK_CONFLICT'],
        ['buyer_unavailable', 403, 'BUYER_DISABLED'],
    ];
    for (const [outcome, status, code] of cases) {
        const res = await call(harness({ link: { outcome } }), jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: { id_token: 't' } });
        assert.equal(res.status, status, outcome);
        const body = await res.json() as { success: boolean; error: { code: string } };
        assert.equal(body.success, false, outcome);
        assert.equal(body.error.code, code, outcome);
    }
    const failed = await call(harness({ link: null, linkError: new Error('db down') }), jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: { id_token: 't' } });
    assert.equal(failed.status, 500);
    const unknown = await call(harness({ link: { outcome: 'surprise' } as unknown as FirebaseLinkOutcome }), jwks, 'POST', '/buyer/firebase-link', { token: await mint(privateKey), body: { id_token: 't' } });
    assert.equal(unknown.status, 500, 'an outcome this route does not know is not a link');
});

test('the production wiring mounts both routes behind the buyer session', async () => {
    const { privateKey, jwks } = await keys();
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerRealmRoutes(router, { normalizeEmail: (e) => e.trim().toLowerCase() });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app, {});
    app.route('/storefront', router);
    const env = { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env;
    const request = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => app.request(
        `/storefront${path}`,
        { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
        env,
    );
    assert.equal((await request('GET', '/buyer/account')).status, 401, 'mounted, and closed without a session');
    assert.equal((await request('POST', '/buyer/firebase-link', {}, { id_token: 't' })).status, 401, 'mounted, and closed without a session');
    // With a session and no token the route answers 400 before any Firebase or database call.
    const session = { 'X-LetBuyy-Buyer-Session': await mint(privateKey) };
    assert.equal((await request('POST', '/buyer/firebase-link', session, {})).status, 400);
});
