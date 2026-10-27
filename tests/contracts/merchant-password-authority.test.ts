import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const authRoutePath = join(testDir, '../../services/api-gateway/src/routes/auth.ts');
const merchantPasswordPath = join(testDir, '../../services/api-gateway/src/lib/merchant-password.ts');
const identityLoginPath = join(testDir, '../../apps/platform/identity/src/app/api/auth/login/route.ts');
const identityLookupPath = join(testDir, '../../apps/platform/identity/src/app/api/auth/lookup/route.ts');
const identitySetPasswordPath = join(testDir, '../../apps/platform/identity/src/app/api/auth/set-password/route.ts');
const identityResetPasswordPath = join(testDir, '../../apps/platform/identity/src/app/api/auth/reset-password/route.ts');
const identityPasswordPath = join(testDir, '../../apps/platform/identity/src/lib/auth/password.ts');
const domainValidatorPath = join(testDir, '../../scripts/validators/domain-boundary-validator.mjs');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

function routeBlock(source: string, route: string): string {
    const marker = `auth.post('${route}'`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${route} must exist`);
    const next = source.indexOf("\nauth.", start + marker.length);
    return next === -1 ? source.slice(start) : source.slice(start, next);
}

test('gateway owns merchant password hashing and comparison behind internal auth', () => {
    const route = read(authRoutePath);
    const password = read(merchantPasswordPath);
    const authenticateBlock = routeBlock(route, '/custom/users/authenticate');
    const byEmailBlock = routeBlock(route, '/custom/users/by-email');
    const setPasswordBlock = routeBlock(route, '/custom/users/set-password');

    assert.match(password, /MERCHANT_PASSWORD_BCRYPT_ROUNDS = 12/);
    assert.match(password, /hashMerchantPassword/);
    assert.match(password, /verifyMerchantPassword/);
    assert.match(route, /from '\.\.\/lib\/merchant-password'/);
    assert.match(authenticateBlock, /requireAccountsInternal/);
    assert.match(authenticateBlock, /password_hash/);
    assert.match(authenticateBlock, /verifyMerchantPassword\(password,\s*String\(user\.password_hash\)/);
    assert.match(authenticateBlock, /email_verified/);
    assert.match(setPasswordBlock, /hashMerchantPassword\(password\)/);
    assert.doesNotMatch(setPasswordBlock, /body\.password_hash/);
    assert.doesNotMatch(byEmailBlock, /password_hash/);
    assert.match(byEmailBlock, /has_password/);
});

test('identity login, lookup, and password routes never receive or create password hashes', () => {
    const login = read(identityLoginPath);
    const lookup = read(identityLookupPath);
    const setPassword = read(identitySetPasswordPath);
    const resetPassword = read(identityResetPasswordPath);
    const identityPassword = read(identityPasswordPath);

    assert.match(login, /identityApiRequest\('\/auth\/custom\/users\/authenticate'/);
    assert.doesNotMatch(login, /password_hash/);
    assert.doesNotMatch(login, /verifyPassword/);
    assert.doesNotMatch(login, /@\/lib\/auth\/password/);
    assert.match(lookup, /has_password/);
    assert.doesNotMatch(lookup, /password_hash/);
    assert.doesNotMatch(setPassword, /hashPassword/);
    assert.doesNotMatch(setPassword, /password_hash/);
    assert.match(setPassword, /password,\s*\n\s*\}\)/);
    assert.doesNotMatch(resetPassword, /hashPassword/);
    assert.doesNotMatch(resetPassword, /password_hash/);
    assert.match(resetPassword, /JSON\.stringify\(\{ \.\.\.parsed\.data, purpose: 'password_reset' \}\)/);
    assert.match(resetPassword, /MerchantPasswordResetSchema\.safeParse/);
    assert.doesNotMatch(resetPassword, /validateToken\(|users\/by-email|destroyAllUserSessions\(/);
    assert.doesNotMatch(resetPassword, /setSessionCookie\(|createSession\(/);
    assert.doesNotMatch(identityPassword, /bcrypt/);
    assert.doesNotMatch(identityPassword, /hashPassword/);
    assert.doesNotMatch(identityPassword, /verifyPassword/);
    assert.match(identityPassword, /validatePasswordStrength/);
});

test('domain boundary validator forbids password hash handling in every app-local API and lib file', () => {
    const validator = read(domainValidatorPath);

    assert.match(validator, /appLocalCredentialStoragePattern/);
    assert.match(validator, /must not handle password hashes in app-local API\/lib files/);
    assert.doesNotMatch(validator, /appLocalCredentialStoragePattern\.test\(content\) \|\| isAuthOwnedLocalFile/);
});


test('Merchant reset is an internally guarded atomic capability redemption, with no privileged recovery session', () => {
    const block = routeBlock(read(authRoutePath), '/custom/users/set-password');
    const sql = read(join(testDir, '../../database/supabase/migrations/399_verified_merchant_buyer_connection.sql'));
    assert.match(block, /requireAccountsInternal/);
    assert.match(block, /MerchantPasswordResetCommitSchema\.safeParse/);
    assert.match(block, /rpc\('complete_merchant_password_reset'/);
    assert.match(block, /hashMerchantPassword\(parsedReset\.data\.password\)/);
    assert.match(sql, /t\.user_id IS DISTINCT FROM u\.id/);
    assert.match(sql, /t\.used IS DISTINCT FROM false OR t\.expires_at<=v_now/);
    assert.match(sql, /UPDATE public\.users_custom SET password_hash=p_password_hash/);
    assert.match(sql, /UPDATE public\.sessions SET revoked_at=v_now,revoked_reason='password_reset'/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.complete_merchant_password_reset\(text,text\) FROM PUBLIC,anon,authenticated,app_tenant/);
});
