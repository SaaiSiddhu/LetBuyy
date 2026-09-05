import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { validateIdentityIssuedMerchantSessionToken } from '../lib/identity-session-verifier';

const gatewayAuthRoute = readFileSync(new URL('../routes/auth.ts', import.meta.url), 'utf8');
const identitySessionVerifier = readFileSync(
    new URL('../lib/identity-session-verifier.ts', import.meta.url),
    'utf8',
);
const identitySession = readFileSync(
    new URL('../../../../apps/identity-platform/src/lib/auth/session.ts', import.meta.url),
    'utf8',
);
const identityIssuedSession = readFileSync(
    new URL('../../../../apps/identity-platform/src/lib/auth/identity-issued-session.ts', import.meta.url),
    'utf8',
);
const identityCookies = readFileSync(
    new URL('../../../../apps/identity-platform/src/lib/auth/cookies.ts', import.meta.url),
    'utf8',
);
const apiGatewayPackage = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
const productionDeploy = readFileSync(new URL('../../../../.github/workflows/production-deploy.yml', import.meta.url), 'utf8');
const stagingDeploy = readFileSync(new URL('../../../../.github/workflows/staging-deploy.yml', import.meta.url), 'utf8');
const nextAppEnvTemplate = readFileSync(
    new URL('../../../../config/env/templates/next-app.env.example', import.meta.url),
    'utf8',
);
const productionEnvExample = readFileSync(
    new URL('../../../../config/env/production.env.example', import.meta.url),
    'utf8',
);
const stagingEnvExample = readFileSync(
    new URL('../../../../config/env/staging.env.example', import.meta.url),
    'utf8',
);

test('D3 identity app issues merchant session tokens before gateway persistence', () => {
    assert.match(identitySession, /createIdentityIssuedMerchantSessionToken/);
    assert.match(identitySession, /token: identityIssuedToken \|\| undefined/);
    assert.match(identityIssuedSession, /new SignJWT/);
    assert.match(identityIssuedSession, /setAudience\(MERCHANT_SESSION_AUDIENCE\)/);
    assert.match(identityIssuedSession, /setProtectedHeader\(\{[\s\S]*alg,[\s\S]*typ: 'JWT'/);
    // BUYER-2 (2026-09-05): match CODE, not prose. This asserted the source never contains the
    // string HS256 anywhere, which cannot tell a use from a mention — it fired on a comment
    // explaining WHY HS256 is forbidden here, i.e. on exactly the documentation the rule wants to
    // exist. Comments and strings are stripped first, so the assertion means what it always claimed
    // to: this issuer never signs with a symmetric algorithm.
    const identityIssuedSessionCode = identityIssuedSession
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(identityIssuedSessionCode, /HS256/);
});

test('D3 gateway production path is verify/store-only for merchant sessions', () => {
    assert.match(apiGatewayPackage, /"jose": "\^6\.1\.3"/);
    assert.match(gatewayAuthRoute, /IDENTITY_ISSUER_REQUIRED/);
    assert.match(identitySessionVerifier, /jwtVerify/);
    assert.match(identitySessionVerifier, /createLocalJWKSet/);
    assert.match(identitySessionVerifier, /LETBUYY_IDENTITY_PUBLIC_JWKS/);
    assert.match(gatewayAuthRoute, /validateIdentityIssuedMerchantSessionToken\(c\.env,\s*providedToken,\s*userId\)/);
    assert.match(identitySessionVerifier, /header\.alg !== 'ES256' && header\.alg !== 'EdDSA'/);
    assert.match(identitySessionVerifier, /algorithms: \['ES256', 'EdDSA'\]/);
    assert.match(gatewayAuthRoute, /const token = providedToken \|\| randomHex\(32\)/);
});

test('CAP-C07 merchant session logout preserves durable revocation evidence', () => {
    assert.match(gatewayAuthRoute, /revoked_at: new Date\(\)\.toISOString\(\)/);
    assert.match(gatewayAuthRoute, /revoked_reason: 'logout'/);
    assert.match(gatewayAuthRoute, /revoked_reason: 'logout_everywhere'/);
    assert.match(gatewayAuthRoute, /\.is\('revoked_at', null\)/);
    assert.doesNotMatch(gatewayAuthRoute, /\.from\('sessions'\)\.delete\(\)/);
});

test('D3 lb_accounts cookie lifetime is capped to 90 days', () => {
    assert.match(identityCookies, /const ACCOUNTS_COOKIE_TTL_SECONDS = 90 \* 24 \* 60 \* 60/);
    assert.match(identityCookies, /setExpirationTime\(`\$\{ACCOUNTS_COOKIE_TTL_SECONDS\}s`\)/);
    assert.doesNotMatch(identityCookies, /365 \* 24 \* 60 \* 60/);
    assert.doesNotMatch(identityCookies, /setExpirationTime\('365d'\)/);
});

test('D3 deployment contracts separate identity signing and service verification keys', () => {
    assert.match(productionDeploy, /HAS_PRODUCTION_IDENTITY_PRIVATE_JWK/);
    assert.match(productionDeploy, /HAS_PRODUCTION_IDENTITY_PUBLIC_JWKS/);
    assert.match(productionDeploy, /LETBUYY_IDENTITY_PRIVATE_JWK: \$\{\{ matrix\.app == 'identity-platform' && secrets\.PRODUCTION_IDENTITY_PRIVATE_JWK \|\| '' \}\}/);
    assert.match(productionDeploy, /wrangler secret put LETBUYY_IDENTITY_PUBLIC_JWKS --env production/);

    assert.match(stagingDeploy, /LETBUYY_IDENTITY_PRIVATE_JWK: \$\{\{ matrix\.app == 'identity-platform' && secrets\.STAGING_IDENTITY_PRIVATE_JWK \|\| '' \}\}/);
    assert.match(stagingDeploy, /wrangler secret put LETBUYY_IDENTITY_PUBLIC_JWKS --env staging/);

    for (const envFile of [nextAppEnvTemplate, productionEnvExample, stagingEnvExample]) {
        assert.match(envFile, /LETBUYY_IDENTITY_ISSUER=/);
        assert.match(envFile, /LETBUYY_IDENTITY_PRIVATE_JWK=/);
    }
    assert.match(productionEnvExample, /LETBUYY_IDENTITY_PUBLIC_JWKS=/);
    assert.match(stagingEnvExample, /LETBUYY_IDENTITY_PUBLIC_JWKS=/);
});

test('D3 gateway verifier accepts signed identity tokens and rejects forgery or replay gaps', async () => {
    const issuer = 'https://accounts.letbuyy.com';
    const userId = 'user_d3';
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'd3-test-key';
    publicJwk.alg = 'ES256';

    const env = {
        LETBUYY_IDENTITY_ISSUER: issuer,
        LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [publicJwk] }),
    } as never;

    const validToken = await new SignJWT({
        realm: 'merchant',
        token_use: 'merchant_session',
        device_id: 'device_d3',
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'd3-test-key' })
        .setIssuer(issuer)
        .setAudience('letbuyy:merchant-session')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('30d')
        .setJti('d3-replay-proof-id')
        .sign(privateKey);

    assert.deepEqual(await validateIdentityIssuedMerchantSessionToken(env, validToken, userId), { ok: true });

    const forgedParts = validToken.split('.');
    forgedParts[2] = `${forgedParts[2].startsWith('A') ? 'B' : 'A'}${forgedParts[2].slice(1)}`;
    const forgedToken = forgedParts.join('.');
    assert.equal((await validateIdentityIssuedMerchantSessionToken(env, forgedToken, userId)).ok, false);

    const hs256Token = await new SignJWT({
        realm: 'merchant',
        token_use: 'merchant_session',
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(issuer)
        .setAudience('letbuyy:merchant-session')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('30d')
        .setJti('d3-replay-proof-id')
        .sign(new TextEncoder().encode('shared-secret-is-not-accepted'));
    assert.equal((await validateIdentityIssuedMerchantSessionToken(env, hs256Token, userId)).ok, false);

    const missingReplayToken = await new SignJWT({
        realm: 'merchant',
        token_use: 'merchant_session',
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'd3-test-key' })
        .setIssuer(issuer)
        .setAudience('letbuyy:merchant-session')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(privateKey);
    assert.equal((await validateIdentityIssuedMerchantSessionToken(env, missingReplayToken, userId)).ok, false);
});
