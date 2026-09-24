// APPID-P4d — the Firebase ID token check behind buyer_firebase_links (migration 259).
//
// Real RS256 keys and real jose verification; only Google's key endpoint is replaced, by a local key
// set holding this test's own public key. What must hold: a token is accepted only for the one
// project, from Google's signing keys, unexpired and issued in the past, with a proven address from a
// provider that proves one; and a key endpoint that cannot be reached decides nothing.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { FIREBASE_PROJECT_ID, verifyFirebaseIdToken } from '../lib/firebase-id-token';

const NOW = new Date('2026-09-24T12:00:00Z');
const NOW_S = Math.floor(NOW.getTime() / 1000);

async function signer() {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    const keys = createLocalJWKSet({ keys: [{ ...jwk, alg: 'RS256', kid: 'google-1', use: 'sig' }] });
    return { privateKey, keys };
}

function token(
    privateKey: CryptoKey,
    over: { claims?: Record<string, unknown>; iss?: string; aud?: string; sub?: string; iat?: number; exp?: number; kid?: string } = {},
) {
    const claims: Record<string, unknown> = {
        auth_time: NOW_S - 600,
        email: 'Asha@Example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password', identities: { email: ['asha@example.com'] } },
        ...over.claims,
    };
    for (const [key, value] of Object.entries(claims)) if (value === undefined) delete claims[key];
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: over.kid ?? 'google-1', typ: 'JWT' })
        .setIssuer(over.iss ?? `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`)
        .setAudience(over.aud ?? FIREBASE_PROJECT_ID)
        .setSubject(over.sub ?? 'firebase-uid-asha')
        .setIssuedAt(over.iat ?? NOW_S - 60)
        .setExpirationTime(over.exp ?? NOW_S + 3000)
        .sign(privateKey);
}

test('a valid ID token yields its uid, the lowercased verified address and the project', async () => {
    const { privateKey, keys } = await signer();
    const checked = await verifyFirebaseIdToken(await token(privateKey), keys, { now: NOW });
    assert.deepEqual(checked, { ok: true, identity: { uid: 'firebase-uid-asha', email: 'asha@example.com', project: 'letbuy-y' } });

    const google = await verifyFirebaseIdToken(await token(privateKey, { claims: { firebase: { sign_in_provider: 'google.com' } } }), keys, { now: NOW });
    assert.equal(google.ok, true, 'Google sign-in proves the address too');
});

test('another project, another issuer, an expired token or one from the future is invalid', async () => {
    const { privateKey, keys } = await signer();
    const cases: [string, Promise<string>][] = [
        ['another project audience', token(privateKey, { aud: 'someone-elses-project' })],
        ['another project issuer', token(privateKey, { iss: 'https://securetoken.google.com/someone-elses-project' })],
        ['a non-Firebase issuer', token(privateKey, { iss: 'https://accounts.google.com' })],
        ['expired', token(privateKey, { exp: NOW_S - 120, iat: NOW_S - 4000 })],
        ['issued in the future', token(privateKey, { iat: NOW_S + 600 })],
        ['signed in in the future', token(privateKey, { claims: { auth_time: NOW_S + 600 } })],
        ['no auth_time', token(privateKey, { claims: { auth_time: undefined } })],
        ['an empty uid', token(privateKey, { sub: '' })],
        ['a uid longer than 128', token(privateKey, { sub: 'u'.repeat(129) })],
        ['a key Google does not publish', token(privateKey, { kid: 'not-google' })],
    ];
    for (const [name, pending] of cases) {
        assert.deepEqual(await verifyFirebaseIdToken(await pending, keys, { now: NOW }), { ok: false, reason: 'invalid' }, name);
    }
});

test('a token signed by anyone but Google, or with another algorithm, is invalid', async () => {
    const { keys } = await signer();
    const impostor = await signer();
    assert.deepEqual(await verifyFirebaseIdToken(await token(impostor.privateKey), keys, { now: NOW }), { ok: false, reason: 'invalid' }, 'another key, same kid');

    const hmac = await new SignJWT({ email: 'asha@example.com', email_verified: true, auth_time: NOW_S - 600, firebase: { sign_in_provider: 'password' } })
        .setProtectedHeader({ alg: 'HS256', kid: 'google-1' })
        .setIssuer(`https://securetoken.google.com/${FIREBASE_PROJECT_ID}`)
        .setAudience(FIREBASE_PROJECT_ID)
        .setSubject('firebase-uid-asha')
        .setIssuedAt(NOW_S - 60)
        .setExpirationTime(NOW_S + 3000)
        .sign(new TextEncoder().encode('a'.repeat(32)));
    assert.deepEqual(await verifyFirebaseIdToken(hmac, keys, { now: NOW }), { ok: false, reason: 'invalid' }, 'HS256');
    for (const garbage of ['', 'not-a-jwt', 'a.b.c', 'x'.repeat(9000)]) {
        assert.deepEqual(await verifyFirebaseIdToken(garbage, keys, { now: NOW }), { ok: false, reason: 'invalid' }, garbage.slice(0, 12));
    }
});

test('a valid token with no proven address cannot be linked', async () => {
    const { privateKey, keys } = await signer();
    const cases: [string, Record<string, unknown>][] = [
        ['email not verified', { email_verified: false }],
        ['email_verified as a string', { email_verified: 'true' }],
        ['no email', { email: undefined }],
        ['anonymous', { firebase: { sign_in_provider: 'anonymous' } }],
        ['phone', { email: undefined, email_verified: undefined, firebase: { sign_in_provider: 'phone' } }],
        ['a custom token that asserts an address', { firebase: { sign_in_provider: 'custom' } }],
        ['no provider', { firebase: undefined }],
    ];
    for (const [name, claims] of cases) {
        assert.deepEqual(await verifyFirebaseIdToken(await token(privateKey, { claims }), keys, { now: NOW }), { ok: false, reason: 'unlinkable' }, name);
    }
});

test("an unreachable key endpoint decides nothing: it is 'unavailable', not 'invalid'", async () => {
    const { privateKey } = await signer();
    const unreachable: JWTVerifyGetKey = async () => {
        throw new TypeError('fetch failed');
    };
    assert.deepEqual(await verifyFirebaseIdToken(await token(privateKey), unreachable, { now: NOW }), { ok: false, reason: 'unavailable' });
});
