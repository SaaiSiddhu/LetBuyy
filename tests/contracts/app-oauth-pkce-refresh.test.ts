import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    appOAuthGrantType,
    appOAuthPkceS256Challenge,
    appendAppOAuthTokenConfig,
    mintAppOAuthRefreshToken,
    normalizeAppOAuthPkceChallenge,
    verifyAppOAuthPkceVerifier,
} from '../../services/api-gateway/src/routes/app-store/shared';

const testDir = dirname(fileURLToPath(import.meta.url));
const oauthRouteSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/routes/app-store/billing-oauth-routes.ts'),
    'utf8',
);
const sharedTypesSource = readFileSync(join(testDir, '../../packages/shared-types/src/index.ts'), 'utf8');
const apiClientSource = readFileSync(join(testDir, '../../packages/typescript/api-client/src/index.ts'), 'utf8');
const developerSurfaceSource = readFileSync(join(testDir, '../../apps/developer-portal/src/lib/developer-surface.ts'), 'utf8');

test('app OAuth PKCE accepts only S256 challenges and verifies the code verifier', async () => {
    const verifier = 'pkce_verifier_'.repeat(4);
    const challenge = await appOAuthPkceS256Challenge(verifier);
    const normalized = normalizeAppOAuthPkceChallenge(challenge, 'S256');

    assert.equal(normalized.ok, true);
    if (!normalized.ok) throw new Error(normalized.message);
    assert.equal(normalized.value.codeChallenge, challenge);
    assert.equal(normalized.value.codeChallengeMethod, 'S256');
    assert.equal(await verifyAppOAuthPkceVerifier(verifier, challenge, 'S256'), true);
    assert.equal(await verifyAppOAuthPkceVerifier(`${verifier}x`, challenge, 'S256'), false);
    assert.equal(normalizeAppOAuthPkceChallenge(challenge, 'plain').ok, false);
    assert.equal(normalizeAppOAuthPkceChallenge('short', 'S256').ok, false);
});

test('app OAuth refresh tokens are minted and persisted only as hashes', async () => {
    const now = new Date('2026-06-05T20:00:00.000Z');
    const refreshed = await mintAppOAuthRefreshToken({ now, ttlSeconds: 60 });
    const config = appendAppOAuthTokenConfig({
        existingConfig: { oauth: { authorization_code: { code_hash: 'code_hash' } } },
        accessTokenHash: 'access_hash',
        refreshTokenHash: refreshed.hash,
        scopes: ['read_products'],
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 1000).toISOString(),
        refreshExpiresAt: refreshed.expiresAt,
        authorizationCode: { code_hash: 'code_hash', redeemed_at: now.toISOString() },
    });
    const serialized = JSON.stringify(config);

    assert.match(refreshed.token, /^lbapp_refresh_/);
    assert.equal(serialized.includes(refreshed.token), false);
    assert.equal(config.oauth.refresh_token_hash, refreshed.hash);
    assert.equal(config.oauth.refresh_token_expires_at, '2026-06-05T20:01:00.000Z');
    assert.equal(config.oauth.authorization_code.redeemed_at, now.toISOString());
});

test('app OAuth token route requires PKCE, rejects replay, and supports refresh grant rotation', () => {
    assert.equal(appOAuthGrantType('authorization_code'), 'authorization_code');
    assert.equal(appOAuthGrantType('refresh_token'), 'refresh_token');
    assert.match(oauthRouteSource, /normalizeAppOAuthPkceChallenge\(/);
    assert.match(oauthRouteSource, /code_challenge:\s*pkce\.value\.codeChallenge/);
    assert.match(oauthRouteSource, /code_challenge_method:\s*pkce\.value\.codeChallengeMethod/);
    assert.match(oauthRouteSource, /code_verifier/);
    assert.match(oauthRouteSource, /verifyAppOAuthPkceVerifier\(/);
    assert.match(oauthRouteSource, /stringOrNull\(authorizationCodeConfig\.redeemed_at\)/);
    assert.match(oauthRouteSource, /grantType === 'refresh_token'/);
    assert.match(oauthRouteSource, /refresh_token_hash:\s*refreshTokenHash/);
    assert.match(oauthRouteSource, /refreshTokenHash:\s*refreshed\.hash/);
    assert.match(oauthRouteSource, /\.contains\('config', \{ oauth: \{ refresh_token_hash: refreshTokenHash \} \}\)/);
});

test('app OAuth PKCE and refresh contracts are exposed to clients and docs', () => {
    assert.match(sharedTypesSource, /refresh_token: z\.string\(\)\.min\(1\)\.optional\(\)/);
    assert.match(sharedTypesSource, /refresh_expires_at: z\.string\(\)\.datetime\(\)\.optional\(\)/);
    assert.match(apiClientSource, /code_challenge: string/);
    assert.match(apiClientSource, /code_verifier: string/);
    assert.match(apiClientSource, /grant_type: 'refresh_token'/);
    assert.match(apiClientSource, /export type AppOAuthTokenInput = AppOAuthAuthorizationCodeTokenInput \| AppOAuthRefreshTokenInput/);
    assert.match(developerSurfaceSource, /PKCE S256 code_challenge/);
    assert.match(developerSurfaceSource, /refresh_token_hash/);
    assert.doesNotMatch(developerSurfaceSource, /\[SKIP [^\]]*refresh-token/);
});
