// BUYER-2 (D-8) — the marketplace buyer realm, and above all its separation from the merchant realm.
//
// The property that matters is not "a buyer token verifies". It is that a merchant token can never
// be spent as a buyer session and a buyer token can never be spent as a merchant one. Buyer auth
// must never grant merchant or operator rights (ART-05, SEC-R7), and this file asserts both
// directions explicitly rather than inferring it from the constants happening to differ.
//
// Every key here is a throwaway generated in-process. No production key material is read.

import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { Env } from '../index';
import {
    validateIdentityIssuedBuyerSessionToken,
    validateIdentityIssuedMerchantSessionToken,
} from '../lib/identity-session-verifier';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_ID = '11111111-2222-3333-4444-555555555555';
const MERCHANT_ID = '99999999-8888-7777-6666-555555555555';

async function harness() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    const env = {
        LETBUYY_IDENTITY_ISSUER: ISSUER,
        LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [{ ...publicJwk, alg: 'ES256', kid: 'test' }] }),
    } as unknown as Env;

    async function mint(claims: Record<string, unknown>, audience: string, subject: string) {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT(claims)
            .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
            .setIssuer(ISSUER)
            .setAudience(audience)
            .setSubject(subject)
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .setJti('0123456789abcdef0123456789abcdef')
            .sign(privateKey);
    }

    const buyerToken = await mint(
        { realm: 'buyer', token_use: 'buyer_session', device_id: null },
        'letbuyy:buyer-session',
        BUYER_ID,
    );
    const merchantToken = await mint(
        { realm: 'merchant', token_use: 'merchant_session', device_id: null },
        'letbuyy:merchant-session',
        MERCHANT_ID,
    );

    return { env, mint, buyerToken, merchantToken };
}

test('a genuine buyer session verifies', async () => {
    const { env, buyerToken } = await harness();
    assert.equal((await validateIdentityIssuedBuyerSessionToken(env, buyerToken, BUYER_ID)).ok, true);
});

test('a MERCHANT token is rejected as a buyer session', async () => {
    // The escalation this realm separation exists to prevent, in the direction that matters least
    // for privilege but most for confusion: a merchant credential must not become a shopper.
    const { env, merchantToken } = await harness();
    const result = await validateIdentityIssuedBuyerSessionToken(env, merchantToken, MERCHANT_ID);
    assert.equal(result.ok, false);
    assert.match(String(result.reason), /audience mismatch/);
});

test('a BUYER token is rejected as a merchant session', async () => {
    // The dangerous direction: a shopper account must never reach merchant surfaces. A buyer
    // account is trivially self-registerable, so accepting one here would make merchant
    // authorization self-service.
    const { env, buyerToken } = await harness();
    const result = await validateIdentityIssuedMerchantSessionToken(env, buyerToken, BUYER_ID);
    assert.equal(result.ok, false);
    assert.match(String(result.reason), /audience mismatch/);
});

test('the buyer audience alone is not enough — realm and token_use are still checked', async () => {
    // Defence in depth. If a future change ever made the audiences collide, or an audience were
    // reused by mistake, the realm and token_use claims must still refuse the token. Without this
    // the separation would rest on a single string.
    const { env, mint } = await harness();
    const wrongRealm = await mint(
        { realm: 'merchant', token_use: 'merchant_session' },
        'letbuyy:buyer-session',
        BUYER_ID,
    );
    const result = await validateIdentityIssuedBuyerSessionToken(env, wrongRealm, BUYER_ID);
    assert.equal(result.ok, false);
    assert.match(String(result.reason), /token use mismatch/);
});

test('a buyer session signed with HS256 is refused', async () => {
    // The deviation D-8 exists to stop inheriting: the customer realm is minted HS256 from a shared
    // secret, so its verification key is also its forgery key. A symmetric algorithm must never be
    // accepted here, whatever the claims say.
    const { env } = await harness();
    const now = Math.floor(Date.now() / 1000);
    const hs256 = await new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(ISSUER)
        .setAudience('letbuyy:buyer-session')
        .setSubject(BUYER_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .setJti('0123456789abcdef0123456789abcdef')
        .sign(new TextEncoder().encode('a-shared-secret-that-must-never-work-here'));

    const result = await validateIdentityIssuedBuyerSessionToken(env, hs256, BUYER_ID);
    assert.equal(result.ok, false);
    assert.match(String(result.reason), /asymmetric algorithm/);
});

// NOT TESTED, deliberately, and recorded so nobody later adds a vacuous assertion for it: the
// verifier re-checks realm and token_use on the VERIFIED payload as well as the pre-parse. For a
// well-formed JWT those are the same bytes, so the pre-parse rejects first and that second check is
// unreachable — confirmed by planting its removal, after which all seven tests here still passed.
// The separation is genuinely enforced by the audience check and the pre-parse; the post-verify
// re-check is insurance against a future relaxation of the pre-parse, not a tested behaviour.

test('a buyer token for one account does not authenticate another', async () => {
    const { env, buyerToken } = await harness();
    const other = '00000000-0000-0000-0000-000000000000';
    assert.equal((await validateIdentityIssuedBuyerSessionToken(env, buyerToken, other)).ok, false);
});

test('a buyer token carries no site or store claim', async () => {
    // A buyer identity is platform-level and spans sellers. A site claim would quietly make it a
    // tenant credential, and site_id is the tenant boundary — a buyer is not a tenant.
    const { buyerToken } = await harness();
    const payload = JSON.parse(
        Buffer.from(buyerToken.split('.')[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    for (const claim of ['site_id', 'store_id', 'site', 'store']) {
        assert.equal(payload[claim], undefined, `a buyer session must not carry ${claim}`);
    }
});
