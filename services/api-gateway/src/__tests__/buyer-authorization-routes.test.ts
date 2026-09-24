// APPID-P4b — first-party authorization codes and storefront sessions, as the gateway serves them.
//
// The database decides whether a code is good (migration 258, proven on real Postgres in
// tests/executable/buyer-authorization-codes-postgres.test.mjs). What only the gateway can get wrong:
//   1. Where a code may be sent: the callback's exact shape, and a host that is a published store's
//      primary host. Nothing is issued, and nothing is looked up, for a callback that fails.
//   2. Whose code it is: the buyer session's, never a body field.
//   3. Where a storefront session works: at its own store only, through the storefront's own server,
//      in the account's current epoch; and it is not a platform buyer session, nor the reverse.
//   4. Which internal caller may do what: identity-platform issues and redeems, the storefront reads.
//   5. The marketplace app (APPID-P4d, migration 259): its one exact callback, a code with no site,
//      and a redemption identity-platform can tell apart from a storefront's.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import { createLetbuyyInternalAppHeaders } from '@letbuyy/auth-core';
import type { Env } from '../index';
import type { BuyerAccountRow } from '../routes/storefront/buyer-account-routes';
import {
    parseStorefrontCallback,
    registerBuyerAuthorizationRoutes,
    type AuthorizationCodeIssue,
    type AuthorizationCodeRedemption,
    type RedirectSite,
} from '../routes/storefront/buyer-authorization-routes';
import { registerBuyerRealmRoutes } from '../routes/storefront/buyer-realm-wiring';
import type { BuyerSessionState, BuyerSessionStateLoader } from '../middleware/buyer-session';
import { installBuyerSessionState } from './buyer-session-state-fake';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';
const OTHER_SITE = 'dddddddd-4444-4444-8444-dddddddddddd';
const CALLBACK = 'https://store-one.letbuyy.com/api/buyer-auth/callback';
const APP_CLIENT = 'letbuyy-marketplace-app';
const APP_CALLBACK = 'com.letbuyy.letbuyy:/oauth/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CODE = 'A'.repeat(43);

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function mint(privateKey: CryptoKey, kind: 'buyer' | 'storefront', over: { sub?: string; site?: string | null; sep?: unknown } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = { realm: 'buyer', token_use: kind === 'buyer' ? 'buyer_session' : 'storefront_session' };
    // Present with the given value, 1 by default; `sep: undefined` leaves the claim out entirely.
    if (!('sep' in over)) claims.sep = 1;
    else if (over.sep !== undefined) claims.sep = over.sep;
    if (kind === 'storefront' && over.site !== null) claims.site_id = over.site ?? SITE;
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER)
        .setAudience(kind === 'buyer' ? 'letbuyy:buyer-session' : 'letbuyy:storefront-session')
        .setSubject(over.sub ?? BUYER_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

const buyerRow = (over: Partial<BuyerAccountRow> = {}): BuyerAccountRow => ({
    id: BUYER_ID, email: 'shopper@example.com', password_hash: '$2a$04$notarealhashnotarealhashnotarealhashnotarealhashnotare',
    email_verified: true, status: 'active', session_epoch: 1, ...over,
});

interface HarnessOptions {
    site?: RedirectSite | null;
    issue?: AuthorizationCodeIssue;
    redeem?: AuthorizationCodeRedemption;
    buyer?: BuyerAccountRow | null;
    sessionState?: BuyerSessionStateLoader | Record<string, BuyerSessionState | null>;
}

function harness(options: HarnessOptions = {}) {
    const calls = {
        resolved: [] as string[],
        issued: [] as { buyerAccountId: string; clientId: string; redirectUri: string; siteId: string | null; codeChallenge: string }[],
        redeemed: [] as { code: string; codeVerifier: string; clientId: string; redirectUri: string }[],
    };
    const gate = (header: string, message: string) => async (c: Parameters<Parameters<typeof registerBuyerAuthorizationRoutes>[1]['requireIdentityInternal']>[0]) =>
        (c.req.header(header) === 'yes' ? null : c.json({ success: false, error: { code: 'UNAUTHORIZED', message } }, 401));
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAuthorizationRoutes(router, {
        requireIdentityInternal: gate('X-Test-Identity', 'Invalid internal identity signature'),
        requireStorefrontInternal: gate('X-Test-Storefront', 'Invalid internal storefront signature'),
        resolveRedirectSite: async (_c, host) => {
            calls.resolved.push(host);
            return { data: options.site === undefined ? { id: SITE, name: 'Store One' } : options.site, error: null };
        },
        issueCode: async (_c, input) => {
            calls.issued.push(input);
            return { data: options.issue ?? { outcome: 'issued', code: CODE, expires_at: '2026-09-24T10:01:00Z' }, error: null };
        },
        redeemCode: async (_c, input) => {
            calls.redeemed.push(input);
            return {
                data: options.redeem ?? { outcome: 'redeemed', buyer_account_id: BUYER_ID, site_id: SITE, client_id: 'letbuyy-storefront', session_epoch: 1 },
                error: null,
            };
        },
        loadBuyerById: async (_c, id) => {
            const buyer = options.buyer === undefined ? buyerRow() : options.buyer;
            return { data: buyer && buyer.id === id ? buyer : null, error: null };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app, options.sessionState ?? {});
    app.route('/storefront', router);
    return { app, calls };
}

function call(
    h: ReturnType<typeof harness>,
    jwks: string,
    method: 'GET' | 'POST',
    path: string,
    opts: { identity?: boolean; storefront?: boolean; buyerToken?: string; storefrontToken?: string; body?: unknown } = {},
) {
    return h.app.request(
        `/storefront${path}`,
        {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(opts.identity ? { 'X-Test-Identity': 'yes' } : {}),
                ...(opts.storefront ? { 'X-Test-Storefront': 'yes' } : {}),
                ...(opts.buyerToken ? { 'X-LetBuyy-Buyer-Session': opts.buyerToken } : {}),
                ...(opts.storefrontToken ? { 'X-LetBuyy-Storefront-Session': opts.storefrontToken } : {}),
            },
            ...(method === 'POST' ? { body: JSON.stringify(opts.body ?? {}) } : {}),
        },
        { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env,
    );
}

const codeRequest = (over: Record<string, unknown> = {}) => ({
    client_id: 'letbuyy-storefront', redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: 'S256', ...over,
});

// ---------------------------------------------------------------------------------------------------
// Where a code may go
// ---------------------------------------------------------------------------------------------------

test('a callback is exactly https://<store host>/api/buyer-auth/callback, or http on localhost', () => {
    for (const ok of [
        CALLBACK,
        'https://shop.asha-handloom.in/api/buyer-auth/callback',
        'http://store-one.localhost:9000/api/buyer-auth/callback',
        'http://localhost:9000/api/buyer-auth/callback',
    ]) {
        assert.ok(parseStorefrontCallback(ok), ok);
    }
    for (const bad of [
        'http://store-one.letbuyy.com/api/buyer-auth/callback',
        'https://store-one.letbuyy.com/api/buyer-auth/callback?next=/x',
        'https://store-one.letbuyy.com/api/buyer-auth/callback#x',
        'https://store-one.letbuyy.com/api/buyer-auth/callback/',
        'https://store-one.letbuyy.com/api/buyer-auth/other',
        'https://store-one.letbuyy.com:8443/api/buyer-auth/callback',
        'https://user:pw@store-one.letbuyy.com/api/buyer-auth/callback',
        'https://Store-One.letbuyy.com/api/buyer-auth/callback',
        'https://store-one.letbuyy.com/api/buyer-auth/%63allback',
        'https://store-one.letbuyy.com/api/x/../buyer-auth/callback',
        'javascript:alert(1)',
        '/api/buyer-auth/callback',
        '',
    ]) {
        assert.equal(parseStorefrontCallback(bad), null, bad);
    }
});

test('check names the store for a good callback, and refuses a bad one before any lookup', async () => {
    const { jwks } = await keys();
    const h = harness();
    const good = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: 'letbuyy-storefront', redirect_uri: CALLBACK } });
    assert.equal(good.status, 200);
    assert.deepEqual((await good.json() as { data: unknown }).data, { client: 'storefront', site: { id: SITE, name: 'Store One' } });
    assert.deepEqual(h.calls.resolved, ['store-one.letbuyy.com']);

    const shape = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: 'letbuyy-storefront', redirect_uri: 'https://evil.example/cb' } });
    assert.equal((await shape.json() as { error: { code: string } }).error.code, 'INVALID_REDIRECT');
    const client = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: 'letbuyy-admin', redirect_uri: CALLBACK } });
    assert.equal((await client.json() as { error: { code: string } }).error.code, 'UNAUTHORIZED_CLIENT');
    assert.equal(h.calls.resolved.length, 1, 'a malformed callback or unknown client never reaches the host lookup');

    const notAStore = harness({ site: null });
    const unknownHost = await call(notAStore, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: 'letbuyy-storefront', redirect_uri: CALLBACK } });
    assert.equal(unknownHost.status, 400);
    assert.equal((await unknownHost.json() as { error: { code: string } }).error.code, 'INVALID_REDIRECT');
    assert.equal((await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { body: { client_id: 'letbuyy-storefront', redirect_uri: CALLBACK } })).status, 401);
});

// ---------------------------------------------------------------------------------------------------
// Whose code it is
// ---------------------------------------------------------------------------------------------------

test("a code is issued for the SESSION's buyer, to the resolved store, for the exact callback", async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'POST', '/buyer/authorization-codes', {
        identity: true,
        buyerToken: await mint(privateKey, 'buyer'),
        body: codeRequest({ buyer_account_id: OTHER_BUYER, site_id: OTHER_SITE }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown }).data, { code: CODE, expires_at: '2026-09-24T10:01:00Z', site: { id: SITE, name: 'Store One' } });
    assert.deepEqual(h.calls.issued, [{ buyerAccountId: BUYER_ID, clientId: 'letbuyy-storefront', redirectUri: CALLBACK, siteId: SITE, codeChallenge: CHALLENGE }]);
});

test('no code without S256 PKCE, a buyer session, identity-platform, or a store callback', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const token = await mint(privateKey, 'buyer');
    for (const over of [{ code_challenge_method: 'plain' }, { code_challenge_method: undefined }, { code_challenge: 'short' }]) {
        assert.equal((await call(h, jwks, 'POST', '/buyer/authorization-codes', { identity: true, buyerToken: token, body: codeRequest(over) })).status, 400, JSON.stringify(over));
    }
    assert.equal((await call(h, jwks, 'POST', '/buyer/authorization-codes', { identity: true, body: codeRequest() })).status, 401, 'no session');
    assert.equal((await call(h, jwks, 'POST', '/buyer/authorization-codes', { buyerToken: token, body: codeRequest() })).status, 401, 'not identity-platform');
    assert.equal((await call(h, jwks, 'POST', '/buyer/authorization-codes', { identity: true, buyerToken: await mint(privateKey, 'storefront'), body: codeRequest() })).status, 401, 'a storefront session cannot mint codes for other stores');
    const notAStore = harness({ site: null });
    assert.equal((await call(notAStore, jwks, 'POST', '/buyer/authorization-codes', { identity: true, buyerToken: token, body: codeRequest() })).status, 400);
    assert.equal(h.calls.issued.length + notAStore.calls.issued.length, 0);
});

// ---------------------------------------------------------------------------------------------------
// Redemption
// ---------------------------------------------------------------------------------------------------

test('redemption returns the buyer, site and epoch, and never a password hash', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'POST', '/buyer/authorization-codes/redeem', {
        identity: true,
        body: { code: CODE, code_verifier: 'v'.repeat(43), client_id: 'letbuyy-storefront', redirect_uri: CALLBACK },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes('$2'), 'no bcrypt hash in the response');
    assert.deepEqual(JSON.parse(text).data, {
        buyer: { id: BUYER_ID, email: 'shopper@example.com', email_verified: true, status: 'active', session_epoch: 1 },
        client_id: 'letbuyy-storefront',
        site_id: SITE,
        session_epoch: 1,
    });
    assert.deepEqual(h.calls.redeemed, [{ code: CODE, codeVerifier: 'v'.repeat(43), clientId: 'letbuyy-storefront', redirectUri: CALLBACK }]);
});

test('an invalid grant, a disabled buyer, a malformed body or a non-identity caller gets nothing', async () => {
    const { jwks } = await keys();
    const body = { code: CODE, code_verifier: 'v'.repeat(43), client_id: 'letbuyy-storefront', redirect_uri: CALLBACK };
    const refused = harness({ redeem: { outcome: 'invalid_grant' } });
    assert.equal((await call(refused, jwks, 'POST', '/buyer/authorization-codes/redeem', { identity: true, body })).status, 400);
    const disabled = harness({ buyer: buyerRow({ status: 'disabled' }) });
    assert.equal((await call(disabled, jwks, 'POST', '/buyer/authorization-codes/redeem', { identity: true, body })).status, 400);
    const malformed = harness();
    assert.equal((await call(malformed, jwks, 'POST', '/buyer/authorization-codes/redeem', { identity: true, body: { code: CODE } })).status, 400);
    assert.equal(malformed.calls.redeemed.length, 0);
    const storefront = harness();
    assert.equal((await call(storefront, jwks, 'POST', '/buyer/authorization-codes/redeem', { storefront: true, body })).status, 401, 'the storefront cannot redeem directly');
    assert.equal(storefront.calls.redeemed.length, 0);
});

// ---------------------------------------------------------------------------------------------------
// The marketplace app (APPID-P4d)
// ---------------------------------------------------------------------------------------------------

test('the app has exactly one callback, compared exactly, and no host is ever looked up for it', async () => {
    const { jwks } = await keys();
    const h = harness();
    const good = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: APP_CLIENT, redirect_uri: APP_CALLBACK } });
    assert.equal(good.status, 200);
    assert.deepEqual((await good.json() as { data: unknown }).data, { client: 'app', site: null });

    for (const bad of [
        'com.letbuyy.letbuyy://oauth/callback',
        'com.letbuyy.letbuyy:/oauth/callback/',
        'com.letbuyy.letbuyy:/oauth/callback?next=x',
        'com.letbuyy.letbuyy:/oauth/callback#x',
        'COM.LETBUYY.LETBUYY:/oauth/callback',
        'com.letbuyy.letbuyy:/oauth/Callback',
        'com.letbuyy.evil:/oauth/callback',
        'letbuyy://open/oauth/callback',
        CALLBACK,
        '',
    ]) {
        const res = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: APP_CLIENT, redirect_uri: bad } });
        assert.equal(res.status, 400, bad);
        assert.equal((await res.json() as { error: { code: string } }).error.code, 'INVALID_REDIRECT', bad);
    }
    const storefrontWithAppCallback = await call(h, jwks, 'POST', '/buyer/authorization-codes/check', { identity: true, body: { client_id: 'letbuyy-storefront', redirect_uri: APP_CALLBACK } });
    assert.equal((await storefrontWithAppCallback.json() as { error: { code: string } }).error.code, 'INVALID_REDIRECT', 'the storefront cannot borrow the app callback');
    assert.deepEqual(h.calls.resolved, [], 'no host lookup for any of these');
});

test("an app code is the SESSION's buyer, names no site whatever the body says, and goes only to the app callback", async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'POST', '/buyer/authorization-codes', {
        identity: true,
        buyerToken: await mint(privateKey, 'buyer'),
        body: codeRequest({ client_id: APP_CLIENT, redirect_uri: APP_CALLBACK, buyer_account_id: OTHER_BUYER, site_id: OTHER_SITE }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown }).data, { code: CODE, expires_at: '2026-09-24T10:01:00Z', site: null });
    assert.deepEqual(h.calls.issued, [{ buyerAccountId: BUYER_ID, clientId: APP_CLIENT, redirectUri: APP_CALLBACK, siteId: null, codeChallenge: CHALLENGE }]);
    assert.deepEqual(h.calls.resolved, []);

    const storefrontToken = await call(h, jwks, 'POST', '/buyer/authorization-codes', {
        identity: true,
        buyerToken: await mint(privateKey, 'storefront'),
        body: codeRequest({ client_id: APP_CLIENT, redirect_uri: APP_CALLBACK }),
    });
    assert.equal(storefrontToken.status, 401, 'a storefront session cannot get an app code');
    const noPkce = await call(h, jwks, 'POST', '/buyer/authorization-codes', {
        identity: true,
        buyerToken: await mint(privateKey, 'buyer'),
        body: codeRequest({ client_id: APP_CLIENT, redirect_uri: APP_CALLBACK, code_challenge_method: 'plain' }),
    });
    assert.equal(noPkce.status, 400, 'a public client without S256 PKCE gets nothing');
    assert.equal(h.calls.issued.length, 1);
});

test('an app redemption says it is the app and names no site; a redemption whose client and site disagree is refused', async () => {
    const { jwks } = await keys();
    const body = { code: CODE, code_verifier: 'v'.repeat(43), client_id: APP_CLIENT, redirect_uri: APP_CALLBACK };
    const app = harness({ redeem: { outcome: 'redeemed', buyer_account_id: BUYER_ID, site_id: null, client_id: APP_CLIENT, session_epoch: 3 } });
    const res = await call(app, jwks, 'POST', '/buyer/authorization-codes/redeem', { identity: true, body });
    assert.equal(res.status, 200);
    const data = (await res.json() as { data: { client_id: string; site_id: string | null; session_epoch: number } }).data;
    assert.equal(data.client_id, APP_CLIENT);
    assert.equal(data.site_id, null);
    assert.equal(data.session_epoch, 3);

    for (const redeem of [
        { outcome: 'redeemed', buyer_account_id: BUYER_ID, site_id: SITE, client_id: APP_CLIENT, session_epoch: 1 },
        { outcome: 'redeemed', buyer_account_id: BUYER_ID, site_id: null, client_id: 'letbuyy-storefront', session_epoch: 1 },
        { outcome: 'redeemed', buyer_account_id: BUYER_ID, site_id: null, client_id: 'letbuyy-admin', session_epoch: 1 },
    ] as AuthorizationCodeRedemption[]) {
        const h = harness({ redeem });
        const refused = await call(h, jwks, 'POST', '/buyer/authorization-codes/redeem', { identity: true, body });
        assert.equal(refused.status, 400, JSON.stringify(redeem));
        assert.equal((await refused.json() as { error: { code: string } }).error.code, 'INVALID_GRANT');
    }
});

// ---------------------------------------------------------------------------------------------------
// Where a storefront session works
// ---------------------------------------------------------------------------------------------------

test('a storefront session reads its buyer at its own store, through the storefront server', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: await mint(privateKey, 'storefront') });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown }).data, {
        buyer: { id: BUYER_ID, email: 'shopper@example.com', email_verified: true },
        site_id: SITE,
    });
});

test('a storefront session is refused at another store, in an ended epoch, without the storefront server, or unbound', async () => {
    const { privateKey, jwks } = await keys();
    const token = await mint(privateKey, 'storefront');
    const h = harness();
    assert.equal((await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${OTHER_SITE}`, { storefront: true, storefrontToken: token })).status, 401, 'another store');
    assert.equal((await call(h, jwks, 'GET', '/buyer/storefront-session', { storefront: true, storefrontToken: token })).status, 401, 'no store named');
    assert.equal((await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefrontToken: token })).status, 401, 'not through the storefront server');
    assert.equal((await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: await mint(privateKey, 'storefront', { site: null }) })).status, 401, 'no site claim');
    assert.equal((await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: await mint(privateKey, 'storefront', { sep: undefined }) })).status, 401, 'no epoch claim');
    const ended = harness({ sessionState: { [BUYER_ID]: { status: 'active', session_epoch: 2 } } });
    assert.equal((await call(ended, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: token })).status, 401, 'an ended epoch');
    const broken = harness({ sessionState: async () => ({ data: null, error: new Error('db down') }) });
    assert.equal((await call(broken, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: token })).status, 503, 'fails closed');
});

test('the realms do not mix: a platform buyer session is not a storefront session, nor the reverse', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    assert.equal(
        (await call(h, jwks, 'GET', `/buyer/storefront-session?store_id=${SITE}`, { storefront: true, storefrontToken: await mint(privateKey, 'buyer') })).status,
        401,
        'a platform buyer token presented as a storefront session',
    );
    assert.equal(
        (await call(h, jwks, 'POST', '/buyer/authorization-codes', { identity: true, buyerToken: await mint(privateKey, 'storefront'), body: codeRequest() })).status,
        401,
        'a storefront token presented as a platform buyer session',
    );
});

// ---------------------------------------------------------------------------------------------------
// The internal callers, through the production wiring
// ---------------------------------------------------------------------------------------------------

test('identity-platform may check and redeem; the storefront may only read its session', async () => {
    const secret = 'test-internal-secret';
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerRealmRoutes(router, { normalizeEmail: (e) => e.trim().toLowerCase() });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    const env = { INTERNAL_API_SECRET: secret } as unknown as Env;
    const signedAs = async (name: string) => {
        const plan = await createLetbuyyInternalAppHeaders({ app: name, secret });
        assert.ok(plan.ok && plan.headers);
        return plan.headers as Record<string, string>;
    };
    const post = async (path: string, headers: Record<string, string>, body: unknown) => app.request(
        `/storefront${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) },
        env,
    );
    // An unknown client stops /check after the internal gate and before any lookup; an empty body
    // stops /redeem the same way. The status says only whether the caller got through the gate.
    assert.equal((await post('/buyer/authorization-codes/check', await signedAs('accounts'), { client_id: 'nope' })).status, 400);
    assert.equal((await post('/buyer/authorization-codes/check', await signedAs('storefront'), { client_id: 'nope' })).status, 401);
    assert.equal((await post('/buyer/authorization-codes/redeem', await signedAs('accounts'), {})).status, 400);
    assert.equal((await post('/buyer/authorization-codes/redeem', await signedAs('storefront'), {})).status, 401);
    // No token stops the session read after the storefront gate and before any lookup.
    const read = async (headers: Record<string, string>) => app.request(`/storefront/buyer/storefront-session?store_id=${SITE}`, { headers }, env);
    assert.equal((await read(await signedAs('storefront'))).status, 401);
    assert.equal(
        ((await (await read(await signedAs('storefront'))).json()) as { error: { message: string } }).error.message,
        'A storefront sign-in is required.',
        'the storefront got past its gate to the session check',
    );
    assert.equal(
        ((await (await read(await signedAs('accounts'))).json()) as { error: { message: string } }).error.message,
        'Invalid internal storefront signature',
        'identity-platform is not the storefront',
    );
});
