// CAP-FB-SOCIAL — the follower graph's wire contract.
//
// The property everything here supports: a follow is scoped to the buyer id from the VERIFIED
// session, never a request parameter. The seller profile's old button flipped a local boolean and
// stored nothing, so the failure this replaces was silent by construction — the UI said "Following"
// and no row existed anywhere.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { registerSellerFollowRoutes, isNotFollowableError } from '../routes/storefront/seller-follow-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER_BUYER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';

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

type Overrides = { followError?: unknown; created?: boolean; removed?: boolean; count?: number | null; countError?: unknown };

function harness(o: Overrides = {}) {
    const calls = {
        follow: [] as { buyer: string; site: string }[],
        unfollow: [] as { buyer: string; site: string }[],
        list: [] as { buyer: string; limit: number }[],
        count: [] as string[],
    };
    const router = new Hono<{ Bindings: Env }>();
    registerSellerFollowRoutes(router, {
        follow: async (_c, buyer, site) => {
            calls.follow.push({ buyer, site });
            return { created: o.created ?? true, error: o.followError ?? null };
        },
        unfollow: async (_c, buyer, site) => {
            calls.unfollow.push({ buyer, site });
            return { removed: o.removed ?? true, error: null };
        },
        listFollowing: async (_c, buyer, limit) => {
            calls.list.push({ buyer, limit });
            return { data: [{ site_id: SITE, followed_at: '2026-09-05T00:00:00.000Z', store_name: 'Live Store', subdomain: 'livestore' }], error: null };
        },
        isFollowing: async (_c, buyer) => ({ following: buyer === BUYER, error: null }),
        countFollowers: async (_c, site) => {
            calls.count.push(site);
            return { count: o.count === undefined ? 7 : o.count, error: o.countError ?? null };
        },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    return { app, calls };
}

const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);
const post = (body: unknown, token: string) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': token },
    body: JSON.stringify(body),
});

test('a follow is attributed to the TOKEN subject, not a body field', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    // The caller tries to follow on someone else's behalf. It must be ignored.
    const res = await h.app.request(
        '/storefront/buyer/follows',
        post({ site_id: SITE, buyer_account_id: OTHER_BUYER }, await buyerToken(privateKey, BUYER)),
        env(jwks),
    );
    assert.equal(res.status, 201);
    assert.deepEqual(h.calls.follow, [{ buyer: BUYER, site: SITE }]);
});

test('following without a buyer session is refused', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request(
        '/storefront/buyer/follows',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: SITE }) },
        env(jwks),
    );
    assert.equal(res.status, 401);
    assert.deepEqual(h.calls.follow, [], 'an unauthenticated follow must never reach the database');
});

test('following again is idempotent: 200 and created=false, never a duplicate or an error', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ created: false });
    const res = await h.app.request('/storefront/buyer/follows', post({ site_id: SITE }, await buyerToken(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { following: boolean; created: boolean } };
    assert.equal(body.data.following, true);
    assert.equal(body.data.created, false, 'the caller can still tell "now following" from "already following"');
});

test('a follow refused by the database trigger is a 422 that does not say WHY', async () => {
    const { privateKey, jwks } = await keys();
    // 229 refuses a follow of an unpublished or deleted site. Distinguishing "no such seller" from
    // "seller is not published" would turn this into an existence oracle for unpublished stores.
    const h = harness({ followError: { code: '23514', message: 'site ... is not followable' } });
    const res = await h.app.request('/storefront/buyer/follows', post({ site_id: SITE }, await buyerToken(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 422);
    const raw = await res.text();
    assert.doesNotMatch(raw, /published|deleted|not followable|23514/i, 'the response must not leak the reason');
});

test('a genuine database failure is a 500, not a 422', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ followError: { code: '08006', message: 'connection failure' } });
    const res = await h.app.request('/storefront/buyer/follows', post({ site_id: SITE }, await buyerToken(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 500, 'an outage must not be reported as a rejected request');
});

test('a non-UUID site_id is rejected before any database call', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/follows', post({ site_id: 'not-a-uuid' }, await buyerToken(privateKey, BUYER)), env(jwks));
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.follow, []);
});

test('unfollowing is scoped to the token subject and is not a 404 when absent', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ removed: false });
    const res = await h.app.request(
        `/storefront/buyer/follows/${SITE}`,
        { method: 'DELETE', headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    // Unfollowing something you do not follow is the state you asked for.
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { following: boolean; removed: boolean } };
    assert.equal(body.data.following, false);
    assert.equal(body.data.removed, false, 'it still reports what actually happened');
    assert.deepEqual(h.calls.unfollow, [{ buyer: BUYER, site: SITE }]);
});

test('the follow list is scoped to the token subject, not a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(
        `/storefront/buyer/follows?buyer_account_id=${OTHER_BUYER}&limit=10`,
        { headers: { 'X-LetBuyy-Buyer-Session': await buyerToken(privateKey, BUYER) } },
        env(jwks),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.list, [{ buyer: BUYER, limit: 10 }]);
});

test('the follower count is PUBLIC and exposes no follower identities', async () => {
    const { jwks } = await keys();
    const h = harness({ count: 7 });
    const res = await h.app.request(`/storefront/marketplace/sellers/${SITE}/follower-count`, undefined, env(jwks));
    assert.equal(res.status, 200);
    const raw = await res.text();
    assert.match(raw, /"follower_count":7/);
    assert.doesNotMatch(raw, /buyer_account_id|followers"\s*:\s*\[/, 'a count route must never carry who the followers are');
});

test('a count failure is a 500, never a zero', async () => {
    const { jwks } = await keys();
    // Zero is a real answer — a seller genuinely has no followers — so serving it for an outage
    // makes the profile quietly wrong instead of visibly broken.
    const h = harness({ countError: { message: 'connection refused' } });
    const res = await h.app.request(`/storefront/marketplace/sellers/${SITE}/follower-count`, undefined, env(jwks));
    assert.equal(res.status, 500);
});

test('isNotFollowableError matches the SQLSTATE, not only the wording', () => {
    assert.equal(isNotFollowableError({ code: '23514' }), true, 'the SQLSTATE alone must be enough');
    assert.equal(isNotFollowableError(new Error('site x is not followable (must be published)')), true, 'a bare Error must still match');
    assert.equal(isNotFollowableError({ code: '08006', message: 'connection failure' }), false, 'an outage is not a rejection');
    assert.equal(isNotFollowableError(null), false);
});

// ── Source contracts ──────────────────────────────────────────────────────────────────────────
// The tests above inject the queries, so they prove what the ROUTE does with an answer, never what
// the real query asks. These read the wiring's own SQL.

function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/`(?:[^`\\]|\\.)*`/g, '` `');
}

const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const followBlock = (() => {
    const at = wiring.indexOf('registerSellerFollowRoutes(router');
    assert.ok(at > 0, 'the follow routes should be wired');
    return wiring.slice(at, wiring.indexOf('registerMobileReleaseRoutes(router', at));
})();

test('SOURCE: every follow query is scoped by the buyer id, not by the site alone', () => {
    // unfollow and isFollowing must carry BOTH predicates. Scoping by site alone would let any
    // buyer unfollow, or read the follow state of, another buyer.
    for (const op of ['unfollow', 'isFollowing']) {
        const at = followBlock.indexOf(`${op}:`);
        assert.ok(at > 0, `${op} should be wired`);
        const body = followBlock.slice(at, at + 700);
        assert.match(body, /\.eq\('buyer_account_id', buyerAccountId\)/, `${op} must scope by the buyer`);
        assert.match(body, /\.eq\('site_id', siteId\)/, `${op} must scope by the site`);
    }
});

test('SOURCE: the follower count is a projection and transfers no rows', () => {
    const at = followBlock.indexOf('countFollowers:');
    const body = followBlock.slice(at, at + 700);
    assert.match(body, /count:\s*'exact'/, 'the count must come from the database');
    assert.match(body, /head:\s*true/, 'head:true keeps follower rows — the identities — from being transferred');
    assert.match(body, /\.eq\('site_id', siteId\)/);
});

test('SOURCE: no denormalised follower counter is maintained anywhere', () => {
    // The Firestore implementation incremented a counter on the seller document AND counted the
    // subcollection. Two authorities for one number drift the moment one write lands alone.
    assert.doesNotMatch(followBlock, /follower_count|followers_count/, 'the count must have exactly one source');
    const migration = readFileSync(join(SRC, '../../../database/supabase/migrations/229_seller_follow_graph.sql'), 'utf8');
    const ddl = migration.slice(migration.indexOf('CREATE TABLE'), migration.indexOf('CREATE INDEX'));
    assert.doesNotMatch(ddl, /follower_count|followers_count/, '229 must not add a counter column');
});

test('SOURCE: the follow list filters to currently-published sellers', () => {
    const at = followBlock.indexOf('listFollowing:');
    const body = followBlock.slice(at, at + 1400);
    // 229's trigger governs CREATING a follow; a site unpublished afterwards keeps its rows and must
    // disappear from reads instead — deleting a buyer's follows on a merchant's action would destroy
    // the buyer's data.
    assert.match(body, /\.eq\('sites\.status', 'published'\)/);
    assert.match(body, /\.is\('sites\.deleted_at', null\)/);
});
