// CAP-FB-NOTIF — the buyer inbox's wire contract.
//
// The property everything else here supports: EVERY read and write is scoped to the buyer id from
// the VERIFIED session, never a request parameter. An inbox that takes its owner from the query
// string is an inbox anyone can read, and the failure is invisible — the response looks perfectly
// normal, just addressed to the wrong person.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    registerBuyerNotificationRoutes,
    type BuyerNotificationRow,
} from '../routes/storefront/buyer-notification-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function buyerToken(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER)
        .setAudience('letbuyy:buyer-session')
        .setSubject(sub)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);
}

const NOTIFICATION: BuyerNotificationRow = {
    id: 'n1', type: 'order_shipped', title: 'Your order shipped', body: null,
    data: {}, action_url: null, read_at: null, created_at: '2026-09-05T00:00:00.000Z',
};

function harness() {
    const calls = { list: [] as { buyer: string; limit: number }[], unread: [] as string[], read: [] as { buyer: string; id: string }[], readAll: [] as string[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerNotificationRoutes(router, {
        listNotifications: async (_c, buyer, limit) => { calls.list.push({ buyer, limit }); return { data: [NOTIFICATION], error: null }; },
        countUnread: async (_c, buyer) => { calls.unread.push(buyer); return { count: 3, error: null }; },
        markRead: async (_c, buyer, id) => {
            calls.read.push({ buyer, id });
            // Models the real query: scoped by BOTH ids, so another buyer's row simply does not match.
            return { data: buyer === BUYER && id === 'n1' ? { ...NOTIFICATION, read_at: 'now' } : null, error: null };
        },
        markAllRead: async (_c, buyer) => { calls.readAll.push(buyer); return { error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    return { app, calls };
}

function env(jwks: string) {
    return { LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env;
}

test('the inbox is scoped to the TOKEN subject, not a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    // A caller asks for someone else's inbox explicitly. It must be ignored.
    const res = await h.app.request(
        `/storefront/buyer/notifications?buyer_account_id=${OTHER_BUYER}`,
        { headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.equal(res.status, 200);
    assert.equal(h.calls.list[0].buyer, BUYER, 'the token subject must win');
    assert.notEqual(h.calls.list[0].buyer, OTHER_BUYER);
});

test('marking read is scoped by BOTH the notification id and the buyer', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await h.app.request(
        '/storefront/buyer/notifications/n1/read',
        { method: 'POST', headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.deepEqual(h.calls.read, [{ buyer: BUYER, id: 'n1' }]);
});

test("another buyer's notification is 404, indistinguishable from a missing one", async () => {
    // Telling them apart confirms a given notification id exists, which is an enumeration oracle
    // over other buyers' inboxes.
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(
        '/storefront/buyer/notifications/n1/read',
        { method: 'POST', headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, OTHER_BUYER) } },
        env(jwks),
    );
    assert.equal(res.status, 404);

    const missing = await h.app.request(
        '/storefront/buyer/notifications/does-not-exist/read',
        { method: 'POST', headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.equal(missing.status, 404);
    assert.deepEqual(await res.json(), await missing.json(), 'both must answer identically');
});

test('every route refuses without a buyer session', async () => {
    const { jwks } = await keys();
    for (const [method, path] of [
        ['GET', '/storefront/buyer/notifications'],
        ['GET', '/storefront/buyer/notifications/unread-count'],
        ['POST', '/storefront/buyer/notifications/n1/read'],
        ['POST', '/storefront/buyer/notifications/read-all'],
    ] as const) {
        const h = harness();
        const res = await h.app.request(path, { method }, env(jwks));
        assert.equal(res.status, 401, `${method} ${path} must require a buyer session`);
        assert.equal(h.calls.list.length + h.calls.unread.length + h.calls.read.length + h.calls.readAll.length, 0,
            `${method} ${path} must not touch the database before authorizing`);
    }
});

test('a MERCHANT token cannot read a buyer inbox', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const now = Math.floor(Date.now() / 1000);
    const merchant = await new SignJWT({ realm: 'merchant', token_use: 'merchant_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:merchant-session').setSubject(BUYER)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef')
        .sign(privateKey);

    const res = await h.app.request(
        '/storefront/buyer/notifications',
        { headers: { 'X-LetBuyy-Buyer-Session': merchant } },
        env(jwks),
    );
    assert.equal(res.status, 401);
    assert.equal(h.calls.list.length, 0);
});

test('the page size is capped', async () => {
    // An uncapped limit is a cheap way to make one request expensive for everyone.
    const { privateKey, jwks } = await keys();
    const h = harness();
    await h.app.request(
        '/storefront/buyer/notifications?limit=100000',
        { headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.ok(h.calls.list[0].limit <= 50, `limit must be capped, got ${h.calls.list[0].limit}`);
});

test('the unread count is for the authenticated buyer only', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(
        `/storefront/buyer/notifications/unread-count?buyer_account_id=${OTHER_BUYER}`,
        { headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.unread, [BUYER]);
});

// The tests above drive the ROUTE with fakes, so they prove the route passes the right buyer id to
// its dependency — but not that the real SQL behind that dependency uses it. Planting the removal of
// `.eq('buyer_account_id', ...)` from the live query fails NONE of them, which makes this assertion
// the only thing standing between that omission and every buyer reading every inbox. A fake that
// models the scoping cannot prove the scoping.
test('the REAL queries are scoped by buyer_account_id, not just the fakes', () => {
    const wiring = readFileSync(
        new URL('../routes/storefront/customer-engagement-routes.ts', import.meta.url),
        'utf8',
    );
    const block = wiring.slice(
        wiring.indexOf('registerBuyerNotificationRoutes(router, {'),
        wiring.indexOf('registerBuyerNotificationRoutes(router, {') + 2200,
    );
    assert.ok(block.length > 0, 'the buyer notification wiring should be locatable');

    const scoped = block.match(/\.eq\('buyer_account_id', buyerAccountId\)/g) || [];
    assert.ok(
        scoped.length >= 4,
        `every buyer_notifications query must filter by buyer_account_id — found ${scoped.length}, expected one per operation (list, unread count, mark read, mark all read)`,
    );
});
