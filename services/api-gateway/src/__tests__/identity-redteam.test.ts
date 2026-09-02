import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
    createCustomerSessionToken,
    createLetbuyyPlatformSessionToken,
    issueCustomerSession,
    verifyCustomerSession,
    verifyCustomerSessionToken,
    verifyLetbuyyPlatformSessionToken,
} from '@letbuyy/auth-core';
import type { Env } from '../index';
import { validateIdentityIssuedMerchantSessionToken } from '../lib/identity-session-verifier';

// ── Identity red-team suite (Phase I1) ──────────────────────────────────────
//
// Attacks the three LetBuyy auth realms (merchant, customer, operator/
// platform) and records, as executable evidence, exactly which attacks the
// current implementation resists and which it does not. This is additive,
// adversarial test code only — see the gap matrix in the Phase I1 worker
// report for what is already covered elsewhere (federation-token replay,
// opaque-merchant-session rotation reuse) and therefore NOT duplicated here.
//
// Isolation technique: the merchant realm's real signing key lives only in
// apps/identity-platform and is never available to this test (by design —
// verify-only runtimes never hold it). Every merchant-realm case below
// generates its OWN throwaway ES256 keypair via jose.generateKeyPair and
// installs its public half as the trusted LETBUYY_IDENTITY_PUBLIC_JWKS for
// that case's env. This mirrors how tests/auth/session-verifier.test.mjs and
// tests/executable/tenant-redteam-postgres.test.mjs already isolate the
// function under test with synthetic fixtures rather than production
// secrets — it proves the VERIFIER's own claim-checking logic, independent
// of which specific key material is configured. No real secret, key, or
// token is committed anywhere in this file.

const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session';
const IDENTITY_ISSUER = 'https://accounts.letbuyy.com';
const USER_ID = 'merchant-user-11111111-1111-4111-8111-111111111111';
const CUSTOMER_SESSION_SECRET = 'irt-test-customer-session-secret-never-real';

function env(overrides: Partial<Env> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        LETBUYY_IDENTITY_ISSUER: IDENTITY_ISSUER,
        ...overrides,
    } as Env;
}

async function generateMerchantKeyPair() {
    return generateKeyPair('ES256', { extractable: true });
}

async function jwksEnvValue(publicKey: CryptoKey, kid = 'irt-test-key-1') {
    const jwk = await exportJWK(publicKey);
    return JSON.stringify({ keys: [{ ...jwk, kid, alg: 'ES256', use: 'sig' }] });
}

async function mintValidMerchantToken(
    privateKey: CryptoKey,
    overrides: Partial<{
        sub: string;
        aud: string;
        realm: string;
        token_use: string;
        iss: string;
        iat: number;
        exp: number;
        jti: string;
        kid: string;
        alg: 'ES256';
    }> = {},
): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
        sub: overrides.sub ?? USER_ID,
        aud: overrides.aud ?? MERCHANT_SESSION_AUDIENCE,
        realm: overrides.realm ?? 'merchant',
        token_use: overrides.token_use ?? 'merchant_session',
        iss: overrides.iss ?? IDENTITY_ISSUER,
        iat: overrides.iat ?? nowSeconds,
        jti: overrides.jti ?? 'irt-genuine-jti-0000000001',
    };

    return new SignJWT(payload)
        .setProtectedHeader({ alg: overrides.alg ?? 'ES256', kid: overrides.kid ?? 'irt-test-key-1' })
        .setExpirationTime(overrides.exp ?? nowSeconds + 300)
        .sign(privateKey);
}

function base64UrlEncode(value: object | string): string {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return Buffer.from(json, 'utf8').toString('base64url');
}

function hmacSha256Base64Url(secret: string, data: string): string {
    return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Hand-builds a compact JWT with an attacker-chosen alg/secret — jose's SignJWT refuses `alg: "none"` and won't sign with an arbitrary HMAC secret under an asymmetric header, so this bypasses the library entirely, exactly as a real forger would. */
function forgeCompactToken(
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    signer: 'none' | { hmacSecret: string },
): string {
    const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
    const signature = signer === 'none' ? '' : hmacSha256Base64Url(signer.hmacSecret, signingInput);
    return `${signingInput}.${signature}`;
}

function merchantClaims(overrides: Record<string, unknown> = {}) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return {
        sub: USER_ID,
        aud: MERCHANT_SESSION_AUDIENCE,
        realm: 'merchant',
        token_use: 'merchant_session',
        iss: IDENTITY_ISSUER,
        iat: nowSeconds,
        exp: nowSeconds + 300,
        jti: 'irt-forged-jti-0000000001',
        ...overrides,
    };
}

// ── IRT-1: alg confusion on the merchant realm ──────────────────────────────

test('IRT-1a: alg:none merchant token is rejected', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const token = forgeCompactToken({ alg: 'none', typ: 'JWT' }, merchantClaims(), 'none');
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-1a: alg:none must be rejected');
    assert.match(result.reason ?? '', /asymmetric algorithm/);
});

test('IRT-1b: HS256 merchant token signed with the public key material as the HMAC secret is rejected', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });
    const publicJwk = await exportJWK(publicKey);

    // The classic asymmetric->symmetric confusion attack: the attacker knows
    // the PUBLIC key (it is, by definition, public in the JWKS) and gambles
    // that a careless verifier reuses that same key material as an HMAC
    // secret if it can be coerced into accepting alg:HS256.
    const guessedSecret = JSON.stringify(publicJwk);
    const token = forgeCompactToken(
        { alg: 'HS256', typ: 'JWT' },
        merchantClaims(),
        { hmacSecret: guessedSecret },
    );
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-1b: HS256-with-public-key-as-secret must be rejected');
    assert.match(result.reason ?? '', /asymmetric algorithm/);
});

test('IRT-1c positive control: a correctly ES256-signed merchant token is accepted', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const token = await mintValidMerchantToken(privateKey);
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, true, `IRT-1c: a genuinely valid ES256 token must be accepted (reason: ${result.reason ?? 'none'})`);
});

// ── IRT-2: cross-realm presentation ─────────────────────────────────────────

test('IRT-2a: a valid customer-realm session token presented to the merchant verifier is rejected', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const customerToken = await issueCustomerSession(
        { storeId: 'store-1', customerId: 'customer-1' },
        CUSTOMER_SESSION_SECRET,
    );
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, customerToken.token, USER_ID);

    assert.equal(result.ok, false, 'IRT-2a: a customer-realm token must never validate as a merchant session');
});

test('IRT-2b: a valid operator/admin-web session token presented to the merchant verifier is rejected', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const operatorToken = await createLetbuyyPlatformSessionToken(
        { email: 'operator@example.test', userId: 'op-1', mfaVerified: true },
        'platform-secret-irt-test',
    );
    assert.equal(typeof operatorToken, 'string', 'sanity check: token minting must succeed before the attack can proceed');
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, operatorToken as string, USER_ID);

    assert.equal(result.ok, false, 'IRT-2b: an operator/admin-web token must never validate as a merchant session');
});

test('IRT-2c: a valid merchant-realm ES256 token presented to the customer verifier is rejected', async () => {
    const { privateKey } = await generateMerchantKeyPair();
    const merchantToken = await mintValidMerchantToken(privateKey);

    const asCustomer = await verifyCustomerSession(merchantToken, CUSTOMER_SESSION_SECRET);
    assert.equal(asCustomer, null, 'IRT-2c: a merchant token must never validate as a customer session (primary verifier)');

    const asLegacyCustomer = await verifyCustomerSessionToken(merchantToken, CUSTOMER_SESSION_SECRET);
    assert.equal(asLegacyCustomer.accepted, false, 'IRT-2c: a merchant token must never validate as a customer session (legacy verifier)');
});

test('IRT-2d: a valid merchant-realm ES256 token presented to the operator/platform verifier is rejected', async () => {
    const { privateKey } = await generateMerchantKeyPair();
    const merchantToken = await mintValidMerchantToken(privateKey);

    const asOperator = await verifyLetbuyyPlatformSessionToken(merchantToken, 'platform-secret-irt-test');
    assert.equal(asOperator.accepted, false, 'IRT-2d: a merchant token must never validate as an operator/platform session');
});

test('IRT-2e: realm=merchant but token_use mismatched is rejected by the merchant verifier', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const token = await mintValidMerchantToken(privateKey, { token_use: 'platform_session' });
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-2e: realm correct but token_use wrong must be rejected');
    assert.match(result.reason ?? '', /token use mismatch/);
});

test('IRT-2f: token_use=merchant_session but realm mismatched is rejected by the merchant verifier', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const token = await mintValidMerchantToken(privateKey, { realm: 'operator' });
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-2f: token_use correct but realm wrong must be rejected');
    assert.match(result.reason ?? '', /token use mismatch/);
});

// ── IRT-3 / W3: prove AND bound the known HS256 customer-realm deviation ───
//
// Root CLAUDE.md records, as a known, accepted-for-now deviation (never to
// be extended): the customer realm is minted HS256 with CUSTOMER_SESSION_
// SECRET, so for that realm the verification key IS the forgery key. The
// two cases below make that concrete (W3a) and then prove its boundary
// (W3b) — the reassuring half. If W3b ever fails, that is materially worse
// than the recorded deviation and is this suite's designated STOP condition
// (see the worker report's Findings section).

test('IRT-3 / W3(a): with CUSTOMER_SESSION_SECRET known, a valid customer session can be minted from scratch', async () => {
    // Proves the risk concretely rather than asserting it: nothing here
    // reuses a legitimately-issued token. This mints one from nothing, as
    // an attacker who has obtained CUSTOMER_SESSION_SECRET would.
    const forged = await issueCustomerSession(
        { storeId: 'attacker-chosen-store', customerId: 'attacker-chosen-customer' },
        CUSTOMER_SESSION_SECRET,
    );
    const verified = await verifyCustomerSession(forged.token, CUSTOMER_SESSION_SECRET);

    assert.ok(verified, 'IRT-3/W3(a): the verification key really is the forgery key for the customer realm — this is the known, recorded deviation, made concrete');
    assert.equal(verified?.storeId, 'attacker-chosen-store');
    assert.equal(verified?.customerId, 'attacker-chosen-customer');
});

test('IRT-3 / W3(b): a forged customer-realm token, even with merchant claims added, is rejected by the merchant verifier', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    // The attacker holds CUSTOMER_SESSION_SECRET (per W3a) and now tries the
    // natural next move: forge an HS256 token carrying merchant-realm claims,
    // signed with the ONLY secret they actually have.
    const escalationAttempt = forgeCompactToken(
        { alg: 'HS256', typ: 'JWT' },
        merchantClaims(),
        { hmacSecret: CUSTOMER_SESSION_SECRET },
    );
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, escalationAttempt, USER_ID);

    assert.equal(
        result.ok,
        false,
        'IRT-3/W3(b) CRITICAL: a customer-secret-signed token claiming realm=merchant must be rejected. ' +
        'If this assertion ever fails, STOP — this is materially worse than the recorded HS256 deviation ' +
        'and must be escalated, not fixed inline.',
    );
    assert.match(result.reason ?? '', /asymmetric algorithm/, 'the merchant verifier must reject on algorithm alone, before ever inspecting realm/token_use claims');
});

test('IRT-3 / W3(b) continued: a genuinely-issued customer session, re-signed with realm=merchant, is rejected by the merchant verifier', async () => {
    const { publicKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });

    const legitimate = await issueCustomerSession(
        { storeId: 'store-1', customerId: 'customer-1' },
        CUSTOMER_SESSION_SECRET,
    );
    const [encodedHeader, encodedPayload] = legitimate.token.split('.');
    const tamperedPayload = {
        ...JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
        ...merchantClaims(),
    };
    const tampered = forgeCompactToken(
        JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')),
        tamperedPayload,
        { hmacSecret: CUSTOMER_SESSION_SECRET },
    );

    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, tampered, USER_ID);
    assert.equal(result.ok, false, 'IRT-3/W3(b): a tampered-and-resigned real customer session must still be rejected by the merchant verifier');
});

// ── IRT-4: ES256 merchant_session replay — closed at the route layer, not here ─
//
// Phase I3 closed this gap by choosing Fork 1(b) in the ARB packet
// (docs/evidence/identity/2026-08-24-customer-realm-collapse-ARB-packet.md,
// W6): validateIdentityIssuedMerchantSessionToken stays a pure function with
// no DB access and this unchanged signature — consumption is enforced one
// layer up, at its sole call site
// (services/api-gateway/src/routes/auth.ts, POST /custom/sessions/create),
// via an atomic INSERT ... ON CONFLICT DO NOTHING against
// merchant_session_jti_consumptions (205_merchant_session_jti_consumption.sql).
// That is why this test's assertions are UNCHANGED from before Phase I3: the
// pure verifier genuinely still accepts the same token twice — replay
// defense now lives entirely in the route, proven separately by
// tests/executable/merchant-session-jti-consumption-postgres.test.mjs, not
// by this file. Do not read this test passing as "IRT-4 is still open" —
// see that suite, and SKIP-IDN-MERCHANT-SESSION-JTI-CONSUMPTION, for the fix.

test('IRT-4: the pure verifier itself still accepts a valid merchant_session token twice — replay defense lives at the route layer (see merchant-session-jti-consumption-postgres.test.mjs)', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });
    const token = await mintValidMerchantToken(privateKey, { jti: 'irt-4-replay-jti-000000001' });

    const first = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);
    const second = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(first.ok, true, 'IRT-4: first presentation must succeed (sanity check on the token itself)');
    assert.equal(second.ok, true, 'IRT-4: the pure verifier has no consumption store by design (Fork 1b) — this is expected, not a regression');
});

// ── IRT-5: expiry bypass on the merchant ES256 token ────────────────────────

test('IRT-5a: an expired merchant token is rejected', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });
    const nowSeconds = Math.floor(Date.now() / 1000);

    const token = await mintValidMerchantToken(privateKey, { iat: nowSeconds - 600, exp: nowSeconds - 1 });
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-5a: an expired token must be rejected');
    assert.match(result.reason ?? '', /expired/);
});

test('IRT-5b: a merchant token with iat skewed far into the future is rejected', async () => {
    const { publicKey, privateKey } = await generateMerchantKeyPair();
    const gatewayEnv = env({ LETBUYY_IDENTITY_PUBLIC_JWKS: await jwksEnvValue(publicKey) });
    const nowSeconds = Math.floor(Date.now() / 1000);

    const token = await mintValidMerchantToken(privateKey, { iat: nowSeconds + 3600, exp: nowSeconds + 3900 });
    const result = await validateIdentityIssuedMerchantSessionToken(gatewayEnv, token, USER_ID);

    assert.equal(result.ok, false, 'IRT-5b: an iat skewed more than 60s into the future must be rejected');
    assert.match(result.reason ?? '', /issue time is invalid/);
});

// ── IRT-6: legacy customer verifier now matches the primary — closed ───────
//
// Phase I4 closed this gap directly in the function this test exercises:
// packages/auth-core/src/index.ts's isCustomerSessionPayload (the LEGACY
// verifyCustomerSessionToken's payload validator) now calls the exact same
// normalizeCustomerSessionId (packages/auth-core/src/customer-session.ts)
// the PRIMARY verifyCustomerSession already used, reused rather than
// duplicated. Unlike IRT-4 (Phase I3), where the fix landed one layer above
// the pure function IRT-4 exercises and so left that test's assertion
// correctly unchanged, here the fix IS inside isCustomerSessionPayload
// itself — so the assertion below correctly flips from accepted to
// rejected. Phase I4's W1 audit established every live writer of sub/
// storeId sources a Postgres uuid column (store_customers.id/store_id),
// which can never contain a control character or exceed 128 chars, so this
// tightening cannot lock out any legitimate session.

test('IRT-6: the legacy customer verifier now rejects the same oversized/control-character id the primary verifier already rejected', async () => {
    // Same setup as before the fix: packages/auth-core/src/customer-session.ts's
    // normalizeCustomerSessionId caps store_id/customer_id at 128 chars and
    // rejects control characters. This proves both verifiers now agree on
    // the same bad value.
    const oversizedWithControlChar = `${'a'.repeat(200)}\x07`;

    const legacyToken = await createCustomerSessionToken(
        { id: oversizedWithControlChar, storeId: 'store-1', email: 'buyer@example.test', fullName: null },
        CUSTOMER_SESSION_SECRET,
    );
    const legacyResult = await verifyCustomerSessionToken(legacyToken, CUSTOMER_SESSION_SECRET);
    assert.equal(
        legacyResult.accepted,
        false,
        'IRT-6: CLOSED — the legacy verifier must now reject a 200+ char, control-character-bearing customer id, matching the primary',
    );

    // Same bad value, but built in the PRIMARY verifier's own payload shape
    // (store_id/customer_id) and forged with the known secret directly,
    // since issueCustomerSession() itself would reject it before signing —
    // this isolates exactly what normalizeCustomerSessionId enforces at
    // verification time, independent of the minting helper's own checks.
    const primaryShapedToken = forgeCompactToken(
        { alg: 'HS256', typ: 'JWT' },
        { store_id: oversizedWithControlChar, customer_id: 'customer-1', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 },
        { hmacSecret: CUSTOMER_SESSION_SECRET },
    );
    const primaryResult = await verifyCustomerSession(primaryShapedToken, CUSTOMER_SESSION_SECRET);
    assert.equal(
        primaryResult,
        null,
        'IRT-6: the primary verifier must still reject the same oversized/control-character id — unchanged, the legacy path moved toward it',
    );
});

test('IRT-6 positive control: a genuinely uuid-shaped id still verifies through the legacy path after the tightening', async () => {
    const uuidLikeId = '11111111-1111-4111-8111-111111111111';
    const legacyToken = await createCustomerSessionToken(
        { id: uuidLikeId, storeId: '22222222-2222-4222-8222-222222222222', email: 'buyer@example.test', fullName: null },
        CUSTOMER_SESSION_SECRET,
    );
    const legacyResult = await verifyCustomerSessionToken(legacyToken, CUSTOMER_SESSION_SECRET);
    assert.equal(legacyResult.accepted, true, 'IRT-6 positive control: a real uuid-shaped id must still be accepted — this is not a lockout');
});
