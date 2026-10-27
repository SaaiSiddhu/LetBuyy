import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    getInternalApiKeyring,
    getSecretsForCaller,
    isLegacyAcceptEnabled,
} from '../lib/internal-auth';
import type { Env } from '../index';

function fakeEnv(overrides: Record<string, string> = {}): Env {
    return overrides as unknown as Env;
}

// --- getInternalApiKeyring ---

test('getInternalApiKeyring returns empty object when unset', () => {
    assert.deepEqual(getInternalApiKeyring(fakeEnv()), {});
});

test('getInternalApiKeyring parses valid JSON keyring', () => {
    const env = fakeEnv({ INTERNAL_API_KEYRING: JSON.stringify({ 'api-gateway': 'secret-a', 'queue-workers': 'secret-b' }) });
    assert.deepEqual(getInternalApiKeyring(env), { 'api-gateway': 'secret-a', 'queue-workers': 'secret-b' });
});

test('getInternalApiKeyring returns empty on malformed JSON', () => {
    const env = fakeEnv({ INTERNAL_API_KEYRING: '{not-valid-json' });
    assert.deepEqual(getInternalApiKeyring(env), {});
});

test('getInternalApiKeyring returns empty when JSON is not an object', () => {
    assert.deepEqual(getInternalApiKeyring(fakeEnv({ INTERNAL_API_KEYRING: '"a string"' })), {});
    assert.deepEqual(getInternalApiKeyring(fakeEnv({ INTERNAL_API_KEYRING: '[1,2]' })), {});
    assert.deepEqual(getInternalApiKeyring(fakeEnv({ INTERNAL_API_KEYRING: 'null' })), {});
});

test('getInternalApiKeyring drops entries with empty-string values', () => {
    const env = fakeEnv({ INTERNAL_API_KEYRING: JSON.stringify({ 'a': 'real-secret', 'b': '' }) });
    const result = getInternalApiKeyring(env);
    assert.equal(result['a'], 'real-secret');
    assert.equal(result['b'], undefined);
});

// --- isLegacyAcceptEnabled ---

test('isLegacyAcceptEnabled defaults ON when env var is unset', () => {
    assert.equal(isLegacyAcceptEnabled(fakeEnv()), true);
});

test('isLegacyAcceptEnabled defaults ON when env var is empty string', () => {
    assert.equal(isLegacyAcceptEnabled(fakeEnv({ INTERNAL_AUTH_LEGACY_ACCEPT: '' })), true);
});

test('isLegacyAcceptEnabled is OFF for explicit disable values', () => {
    for (const val of ['false', 'False', 'FALSE', '0', 'off', 'OFF', 'no', 'NO', 'disabled', 'DISABLED']) {
        assert.equal(isLegacyAcceptEnabled(fakeEnv({ INTERNAL_AUTH_LEGACY_ACCEPT: val })), false, `expected OFF for "${val}"`);
    }
});

test('isLegacyAcceptEnabled remains ON for truthy-ish values', () => {
    for (const val of ['true', '1', 'on', 'yes', 'enabled']) {
        assert.equal(isLegacyAcceptEnabled(fakeEnv({ INTERNAL_AUTH_LEGACY_ACCEPT: val })), true, `expected ON for "${val}"`);
    }
});

// --- getSecretsForCaller ---

test('getSecretsForCaller returns only legacy secrets when no keyring is set', () => {
    const env = fakeEnv({ INTERNAL_API_SECRET: 'legacy-secret' });
    const secrets = getSecretsForCaller(env, 'api-gateway');
    // Legacy enabled by default; no keyring entry → only legacy
    assert.ok(secrets.length > 0);
});

test('getSecretsForCaller puts caller secret first when keyring entry exists', () => {
    const env = fakeEnv({
        INTERNAL_API_KEYRING: JSON.stringify({ 'api-gateway': 'per-caller-secret' }),
        INTERNAL_API_SECRET: 'legacy-secret',
    });
    const secrets = getSecretsForCaller(env, 'api-gateway');
    assert.equal(secrets[0], 'per-caller-secret');
    assert.ok(secrets.includes('legacy-secret'));
});

test('getSecretsForCaller excludes legacy when INTERNAL_AUTH_LEGACY_ACCEPT=false', () => {
    const env = fakeEnv({
        INTERNAL_API_KEYRING: JSON.stringify({ 'api-gateway': 'per-caller-secret' }),
        INTERNAL_API_SECRET: 'legacy-secret',
        INTERNAL_AUTH_LEGACY_ACCEPT: 'false',
    });
    const secrets = getSecretsForCaller(env, 'api-gateway');
    assert.ok(secrets.includes('per-caller-secret'));
    assert.ok(!secrets.includes('legacy-secret'));
});

test('getSecretsForCaller returns empty when legacy disabled and no keyring match', () => {
    const env = fakeEnv({
        INTERNAL_API_KEYRING: JSON.stringify({ 'other-caller': 'per-caller-secret' }),
        INTERNAL_API_SECRET: 'legacy-secret',
        INTERNAL_AUTH_LEGACY_ACCEPT: 'false',
    });
    const secrets = getSecretsForCaller(env, 'api-gateway');
    assert.equal(secrets.length, 0);
});

test('getSecretsForCaller deduplicates when keyring and legacy share the same secret', () => {
    const env = fakeEnv({
        INTERNAL_API_KEYRING: JSON.stringify({ 'api-gateway': 'shared-secret' }),
        INTERNAL_API_SECRET: 'shared-secret',
    });
    const secrets = getSecretsForCaller(env, 'api-gateway');
    assert.equal(secrets.filter(s => s === 'shared-secret').length, 1);
});

// --- Source-level assertion: verifyInternalAppRequest reads X-LetBuyy-Internal-Caller ---

const internalAuthSource = readFileSync(new URL('../lib/internal-auth.ts', import.meta.url), 'utf8');

test('verifyInternalAppRequest reads X-LetBuyy-Internal-Caller header', () => {
    assert.match(internalAuthSource, /X-LetBuyy-Internal-Caller/);
});

test('verifyInternalAppRequest delegates to getSecretsForCaller', () => {
    assert.match(internalAuthSource, /getSecretsForCaller\(c\.env,\s*callerId\)/);
});

test('single-use internal credentials use the shared replay-claim RPC, never an isolate-local Map', () => {
    assert.doesNotMatch(internalAuthSource, /new Map\s*</);
    assert.match(internalAuthSource, /claimInternalAuthReplayJti\(input\.env,/);
    assert.match(internalAuthSource, /kind: 'session'/);
    assert.match(internalAuthSource, /kind: 'identity'/);
    assert.match(internalAuthSource, /kind: `app:\$\{app\}`/);
    const supabaseSource = readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8');
    assert.match(supabaseSource, /rpc\('consume_internal_auth_replay_jti'/);
    assert.match(supabaseSource, /data === true/);
    assert.match(supabaseSource, /data === false/);
    const migration = readFileSync(new URL('../../../../database/supabase/migrations/307_internal_auth_replay_claims.sql', import.meta.url), 'utf8');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.internal_auth_replay_claims/);
    assert.match(migration, /PRIMARY KEY \(auth_kind, jti\)/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /SECURITY DEFINER\s+SET search_path TO pg_catalog, public/);
    assert.match(migration, /ON CONFLICT \(auth_kind, jti\) DO UPDATE/);
    assert.match(migration, /LIMIT 100/);
    assert.match(migration, /REVOKE ALL ON TABLE public\.internal_auth_replay_claims FROM PUBLIC, anon, authenticated, app_tenant, service_role/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_internal_auth_replay_jti\(text, text, integer\) TO service_role/);
});

test('sunset comment present on INTERNAL_AUTH_LEGACY_ACCEPT', () => {
    assert.match(internalAuthSource, /HR-SECRET-ROTATION/);
});


test('caller names cannot resolve inherited object properties as signing credentials', () => {
    const env = fakeEnv({ INTERNAL_API_KEYRING: JSON.stringify({ 'queue-workers-domain-reconcile': 'synthetic-job-only-key' }), INTERNAL_AUTH_LEGACY_ACCEPT: 'false' });
    for (const caller of ['__proto__', 'constructor', 'toString', 'valueOf']) assert.deepEqual(getSecretsForCaller(env, caller), []);
});
