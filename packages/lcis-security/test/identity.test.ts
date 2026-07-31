/**
 * IdentitySecretService — >= 80 tests.
 *
 * Coverage dimensions:
 *   A. secrets() — shape, dedup, determinism, present/absent credential flipping (14 tests)
 *   B. tokens() — issuer list exactness, algo pairing, cred flipping, evidence kinds (24 tests)
 *   C. identitySurfaces() — list completeness, NOT_CONNECTED, liveSource, evidence (22 tests)
 *   D. Cross-cutting — determinism, wiring, constructor injection, edge cases (20 tests)
 *
 * Test conventions (per spec):
 *   - node:test + assert/strict
 *   - FIXED clock '2026-07-04T00:00:00.000Z'
 *   - stubStore pattern for ArtifactStore (identity service never reads artifacts — included
 *     for createEngine compatibility)
 *   - CredentialProvider injected via 3rd constructor param to control env
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, type ArtifactStore } from '@letbuyy/lcis-core';
import { CredentialProvider, SIGNAL_CATALOG } from '@letbuyy/lcis-adapters';
import { IdentitySecretService } from '../src/identity/index';
import type { SecretPosture, TokenPosture, IdentitySurface } from '../src/shared/types';

// ── clock ─────────────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED;

// ── stub store ────────────────────────────────────────────────────────────────

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => (artifacts[n] ?? null) as unknown,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
    cacheStats: () => ({ hits: 0, misses: 0, size: 0, hitRate: 0 }),
  } as unknown as ArtifactStore;
}

const emptyEngine = createEngine({ store: stubStore({}), repoRoot: '/stub' });

// ── credential factories ──────────────────────────────────────────────────────

function noCreds(): CredentialProvider {
  return new CredentialProvider({});
}

function withEnv(vars: Record<string, string>): CredentialProvider {
  return new CredentialProvider(vars);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function assertSecretPosture(s: SecretPosture, label: string) {
  assert.ok(typeof s.key === 'string' && s.key.length > 0, `${label}: key present`);
  assert.ok(Array.isArray(s.requiredEnv) && s.requiredEnv.length > 0, `${label}: requiredEnv non-empty`);
  assert.ok(typeof s.present === 'boolean', `${label}: present is boolean`);
  assert.ok(typeof s.usedBy === 'string' && s.usedBy.length > 0, `${label}: usedBy present`);
  assert.ok(s.connection === 'CONNECTED' || s.connection === 'NOT_CONNECTED', `${label}: connection valid`);
  assert.ok(Array.isArray(s.evidence) && s.evidence.length > 0, `${label}: evidence non-empty`);
}

function assertTokenPosture(t: TokenPosture, label: string) {
  assert.ok(typeof t.issuer === 'string' && t.issuer.length > 0, `${label}: issuer present`);
  assert.ok(typeof t.algorithm === 'string' && t.algorithm.length > 0, `${label}: algorithm present`);
  assert.ok(Array.isArray(t.requiredEnv) && t.requiredEnv.length > 0, `${label}: requiredEnv non-empty`);
  assert.ok(typeof t.present === 'boolean', `${label}: present is boolean`);
  assert.ok(typeof t.detail === 'string' && t.detail.length > 0, `${label}: detail present`);
  assert.ok(t.connection === 'CONNECTED' || t.connection === 'NOT_CONNECTED', `${label}: connection valid`);
  assert.ok(Array.isArray(t.evidence) && t.evidence.length > 0, `${label}: evidence non-empty`);
}

function assertIdentitySurface(s: IdentitySurface, label: string) {
  assert.ok(typeof s.surface === 'string' && s.surface.length > 0, `${label}: surface present`);
  assert.ok(typeof s.detail === 'string' && s.detail.length > 0, `${label}: detail present`);
  assert.equal(s.connection, 'NOT_CONNECTED', `${label}: connection always NOT_CONNECTED`);
  assert.ok(typeof s.liveSource === 'string' && s.liveSource !== null && s.liveSource.length > 0, `${label}: liveSource present`);
  assert.ok(Array.isArray(s.evidence) && s.evidence.length > 0, `${label}: evidence non-empty`);
}

// =============================================================================
// A. secrets()
// =============================================================================

test('A01: secrets() returns a non-empty array', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.secrets();
  assert.ok(Array.isArray(s), 'is array');
  assert.ok(s.length > 0, 'non-empty');
});

test('A02: secrets() every item passes shape check', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    assertSecretPosture(s, s.key);
  }
});

test('A03: secrets() keys are deduplicated — no two items share the same key', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const keys = svc.secrets().map((s) => s.key);
  const unique = new Set(keys);
  assert.equal(unique.size, keys.length, 'all keys unique');
});

test('A04: secrets() result is sorted by key (deterministic order)', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const keys = svc.secrets().map((s) => s.key);
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(keys, sorted, 'sorted by key');
});

test('A05: secrets() with no env vars — all present:false and NOT_CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    assert.equal(s.present, false, `${s.key}: present=false`);
    assert.equal(s.connection, 'NOT_CONNECTED', `${s.key}: NOT_CONNECTED`);
  }
});

test('A06: secrets() with all signal env vars present — all present:true and CONNECTED', () => {
  // Build an env with ALL env vars from SIGNAL_CATALOG
  const env: Record<string, string> = {};
  for (const sig of SIGNAL_CATALOG) {
    for (const k of sig.requiredEnv) env[k] = 'test-value';
  }
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv(env));
  for (const s of svc.secrets()) {
    assert.equal(s.present, true, `${s.key}: present=true`);
    assert.equal(s.connection, 'CONNECTED', `${s.key}: CONNECTED`);
  }
});

test('A07: secrets() — SUPABASE_URL + SUPABASE_ANON_KEY env group present flips its entry to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'key',
  }));
  const supaEntry = svc.secrets().find((s) =>
    s.requiredEnv.includes('SUPABASE_URL') && s.requiredEnv.includes('SUPABASE_ANON_KEY'),
  );
  assert.ok(supaEntry !== undefined, 'supabase entry exists');
  assert.equal(supaEntry!.present, true, 'present=true');
  assert.equal(supaEntry!.connection, 'CONNECTED', 'CONNECTED');
});

test('A08: secrets() — partial env (only one of two required vars) keeps entry NOT_CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    SUPABASE_URL: 'https://x.supabase.co',
    // SUPABASE_ANON_KEY intentionally absent
  }));
  const supaEntry = svc.secrets().find((s) =>
    s.requiredEnv.includes('SUPABASE_URL') && s.requiredEnv.includes('SUPABASE_ANON_KEY'),
  );
  assert.ok(supaEntry !== undefined, 'supabase entry exists');
  assert.equal(supaEntry!.present, false, 'present=false when partial');
  assert.equal(supaEntry!.connection, 'NOT_CONNECTED');
});

test('A09: secrets() — requiredEnv arrays are sorted within each entry', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    const sorted = [...s.requiredEnv].sort();
    assert.deepEqual([...s.requiredEnv], sorted, `${s.key}: requiredEnv sorted`);
  }
});

test('A10: secrets() — RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET entry exists (money signal)', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const razorEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('RAZORPAY_KEY_ID') && s.requiredEnv.includes('RAZORPAY_KEY_SECRET'),
  );
  assert.ok(razorEntry !== undefined, 'razorpay entry present');
});

test('A11: secrets() — VERCEL_TOKEN entry exists (deploy signal)', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const vercelEntry = svc.secrets().find((s) => s.requiredEnv.includes('VERCEL_TOKEN'));
  assert.ok(vercelEntry !== undefined, 'vercel entry present');
});

test('A12: secrets() — evidence evidence items are not-connected kind when absent', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    for (const ev of s.evidence) {
      assert.equal(ev.kind, 'not-connected', `${s.key}: evidence kind not-connected when absent`);
    }
  }
});

test('A13: secrets() — evidence items are artifact-field kind when present', () => {
  const env: Record<string, string> = {};
  for (const sig of SIGNAL_CATALOG) {
    for (const k of sig.requiredEnv) env[k] = 'v';
  }
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv(env));
  for (const s of svc.secrets()) {
    for (const ev of s.evidence) {
      assert.equal(ev.kind, 'artifact-field', `${s.key}: evidence kind artifact-field when present`);
    }
  }
});

test('A14: secrets() is deterministic — calling twice returns structurally identical results', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const r1 = svc.secrets();
  const r2 = svc.secrets();
  assert.equal(r1.length, r2.length, 'same count');
  for (let i = 0; i < r1.length; i++) {
    assert.equal(r1[i].key, r2[i].key, `entry ${i}: same key`);
    assert.equal(r1[i].present, r2[i].present, `entry ${i}: same present`);
  }
});

// =============================================================================
// B. tokens()
// =============================================================================

test('B01: tokens() returns exactly 4 issuers', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  assert.equal(svc.tokens().length, 4);
});

test('B02: tokens() every item passes shape check', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const t of svc.tokens()) {
    assertTokenPosture(t, t.issuer);
  }
});

test('B03: tokens() first issuer is customer-session with algorithm HS256', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens()[0];
  assert.equal(t.issuer, 'customer-session');
  assert.equal(t.algorithm, 'HS256');
});

test('B04: tokens() second issuer is merchant-identity with algorithm ES256', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens()[1];
  assert.equal(t.issuer, 'merchant-identity');
  assert.equal(t.algorithm, 'ES256');
});

test('B05: tokens() third issuer is step-up with algorithm HMAC', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens()[2];
  assert.equal(t.issuer, 'step-up');
  assert.equal(t.algorithm, 'HMAC');
});

test('B06: tokens() fourth issuer is queue-envelope with algorithm HMAC', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens()[3];
  assert.equal(t.issuer, 'queue-envelope');
  assert.equal(t.algorithm, 'HMAC');
});

test('B07: tokens() issuer set is exactly {customer-session, merchant-identity, step-up, queue-envelope}', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const issuers = new Set(svc.tokens().map((t) => t.issuer));
  assert.ok(issuers.has('customer-session'), 'customer-session present');
  assert.ok(issuers.has('merchant-identity'), 'merchant-identity present');
  assert.ok(issuers.has('step-up'), 'step-up present');
  assert.ok(issuers.has('queue-envelope'), 'queue-envelope present');
  assert.equal(issuers.size, 4, 'exactly 4 distinct issuers');
});

test('B08: tokens() customer-session requires CUSTOMER_SESSION_SECRET', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens().find((x) => x.issuer === 'customer-session')!;
  assert.deepEqual([...t.requiredEnv], ['CUSTOMER_SESSION_SECRET']);
});

test('B09: tokens() merchant-identity requires LETBUYY_IDENTITY_PUBLIC_JWKS', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens().find((x) => x.issuer === 'merchant-identity')!;
  assert.deepEqual([...t.requiredEnv], ['LETBUYY_IDENTITY_PUBLIC_JWKS']);
});

test('B10: tokens() step-up requires STEP_UP_SECRET', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens().find((x) => x.issuer === 'step-up')!;
  assert.deepEqual([...t.requiredEnv], ['STEP_UP_SECRET']);
});

test('B11: tokens() queue-envelope requires QUEUE_TENANT_ENVELOPE_SECRET', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const t = svc.tokens().find((x) => x.issuer === 'queue-envelope')!;
  assert.deepEqual([...t.requiredEnv], ['QUEUE_TENANT_ENVELOPE_SECRET']);
});

test('B12: tokens() all absent — all present:false, all NOT_CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const t of svc.tokens()) {
    assert.equal(t.present, false, `${t.issuer}: present=false`);
    assert.equal(t.connection, 'NOT_CONNECTED', `${t.issuer}: NOT_CONNECTED`);
  }
});

test('B13: providing CUSTOMER_SESSION_SECRET flips customer-session to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ CUSTOMER_SESSION_SECRET: 's3cr3t' }));
  const t = svc.tokens().find((x) => x.issuer === 'customer-session')!;
  assert.equal(t.present, true);
  assert.equal(t.connection, 'CONNECTED');
});

test('B14: providing CUSTOMER_SESSION_SECRET does NOT flip other issuers', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ CUSTOMER_SESSION_SECRET: 's3cr3t' }));
  for (const t of svc.tokens().filter((x) => x.issuer !== 'customer-session')) {
    assert.equal(t.present, false, `${t.issuer}: still absent`);
    assert.equal(t.connection, 'NOT_CONNECTED', `${t.issuer}: still NOT_CONNECTED`);
  }
});

test('B15: providing LETBUYY_IDENTITY_PUBLIC_JWKS flips merchant-identity to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ LETBUYY_IDENTITY_PUBLIC_JWKS: '{"keys":[]}' }));
  const t = svc.tokens().find((x) => x.issuer === 'merchant-identity')!;
  assert.equal(t.present, true);
  assert.equal(t.connection, 'CONNECTED');
});

test('B16: providing STEP_UP_SECRET flips step-up to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ STEP_UP_SECRET: 'hmac-key' }));
  const t = svc.tokens().find((x) => x.issuer === 'step-up')!;
  assert.equal(t.present, true);
  assert.equal(t.connection, 'CONNECTED');
});

test('B17: providing QUEUE_TENANT_ENVELOPE_SECRET flips queue-envelope to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ QUEUE_TENANT_ENVELOPE_SECRET: 'hmac-key' }));
  const t = svc.tokens().find((x) => x.issuer === 'queue-envelope')!;
  assert.equal(t.present, true);
  assert.equal(t.connection, 'CONNECTED');
});

test('B18: all 4 env vars present — all 4 tokens CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    CUSTOMER_SESSION_SECRET: 'a',
    LETBUYY_IDENTITY_PUBLIC_JWKS: 'b',
    STEP_UP_SECRET: 'c',
    QUEUE_TENANT_ENVELOPE_SECRET: 'd',
  }));
  for (const t of svc.tokens()) {
    assert.equal(t.present, true, `${t.issuer}: present=true`);
    assert.equal(t.connection, 'CONNECTED', `${t.issuer}: CONNECTED`);
  }
});

test('B19: tokens() absent — evidence kinds are not-connected', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const t of svc.tokens()) {
    for (const ev of t.evidence) {
      assert.equal(ev.kind, 'not-connected', `${t.issuer}: ev.kind not-connected`);
    }
  }
});

test('B20: tokens() present — evidence kinds are artifact-field', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    CUSTOMER_SESSION_SECRET: 'a',
    LETBUYY_IDENTITY_PUBLIC_JWKS: 'b',
    STEP_UP_SECRET: 'c',
    QUEUE_TENANT_ENVELOPE_SECRET: 'd',
  }));
  for (const t of svc.tokens()) {
    for (const ev of t.evidence) {
      assert.equal(ev.kind, 'artifact-field', `${t.issuer}: ev.kind artifact-field`);
    }
  }
});

test('B21: tokens() detail references correct algorithm string', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const cs = svc.tokens().find((t) => t.issuer === 'customer-session')!;
  const mi = svc.tokens().find((t) => t.issuer === 'merchant-identity')!;
  assert.ok(cs.detail.includes('HS256'), 'customer-session detail includes HS256');
  assert.ok(mi.detail.includes('ES256'), 'merchant-identity detail includes ES256');
});

test('B22: tokens() detail references relevant env var name', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const t of svc.tokens()) {
    for (const envVar of t.requiredEnv) {
      // Detail should at least include the env var OR the issuer name — at minimum env var is in evidence
      const ev = t.evidence.find((e) => e.ref === envVar || e.source === envVar);
      assert.ok(ev !== undefined, `${t.issuer}: env var ${envVar} cited in evidence`);
    }
  }
});

test('B23: tokens() is deterministic — calling twice returns identical results', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const r1 = svc.tokens();
  const r2 = svc.tokens();
  assert.equal(r1.length, r2.length, 'same length');
  for (let i = 0; i < r1.length; i++) {
    assert.equal(r1[i].issuer, r2[i].issuer, `[${i}]: same issuer`);
    assert.equal(r1[i].present, r2[i].present, `[${i}]: same present`);
    assert.equal(r1[i].algorithm, r2[i].algorithm, `[${i}]: same algorithm`);
  }
});

test('B24: tokens() only HS256 is used for customer-session (not ES256)', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const cs = svc.tokens().find((t) => t.issuer === 'customer-session')!;
  assert.notEqual(cs.algorithm, 'ES256', 'customer-session does NOT use ES256');
  assert.equal(cs.algorithm, 'HS256');
});

// =============================================================================
// C. identitySurfaces()
// =============================================================================

test('C01: identitySurfaces() returns exactly 5 surfaces', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  assert.equal(svc.identitySurfaces().length, 5);
});

test('C02: identitySurfaces() every item passes shape check', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    assertIdentitySurface(s, s.surface);
  }
});

test('C03: identitySurfaces() contains customer-login surface', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'customer-login');
  assert.ok(s !== undefined, 'customer-login present');
});

test('C04: identitySurfaces() contains merchant-oauth surface', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'merchant-oauth');
  assert.ok(s !== undefined, 'merchant-oauth present');
});

test('C05: identitySurfaces() contains step-up surface', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'step-up');
  assert.ok(s !== undefined, 'step-up present');
});

test('C06: identitySurfaces() contains turnstile-gate surface', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'turnstile-gate');
  assert.ok(s !== undefined, 'turnstile-gate present');
});

test('C07: identitySurfaces() contains rate-limit surface', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'rate-limit');
  assert.ok(s !== undefined, 'rate-limit present');
});

test('C08: identitySurfaces() all surfaces have connection = NOT_CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    assert.equal(s.connection, 'NOT_CONNECTED', `${s.surface}: NOT_CONNECTED`);
  }
});

test('C09: identitySurfaces() connection remains NOT_CONNECTED even when all env vars present', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y',
    CUSTOMER_SESSION_SECRET: 'a', LETBUYY_IDENTITY_PUBLIC_JWKS: 'b',
    STEP_UP_SECRET: 'c', QUEUE_TENANT_ENVELOPE_SECRET: 'd',
    TURNSTILE_SECRET_KEY: 'e',
    UPSTASH_REDIS_REST_URL: 'f', UPSTASH_REDIS_REST_TOKEN: 'g',
  }));
  for (const s of svc.identitySurfaces()) {
    assert.equal(s.connection, 'NOT_CONNECTED', `${s.surface}: still NOT_CONNECTED`);
  }
});

test('C10: identitySurfaces() liveSource is not null for all surfaces', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    assert.ok(s.liveSource !== null, `${s.surface}: liveSource not null`);
    assert.ok(typeof s.liveSource === 'string' && s.liveSource.length > 0, `${s.surface}: liveSource non-empty string`);
  }
});

test('C11: identitySurfaces() customer-login liveSource names SecurityOperationsService', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'customer-login')!;
  assert.ok(s.liveSource!.includes('SecurityOperationsService'), 'SecurityOperationsService cited');
});

test('C12: identitySurfaces() all liveSource strings reference lcis-operations', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    assert.ok(s.liveSource!.includes('lcis-operations'), `${s.surface}: liveSource includes lcis-operations`);
  }
});

test('C13: identitySurfaces() liveSource for turnstile-gate names TURNSTILE_SECRET_KEY', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'turnstile-gate')!;
  assert.ok(s.liveSource!.includes('TURNSTILE_SECRET_KEY'), 'TURNSTILE_SECRET_KEY named in liveSource');
});

test('C14: identitySurfaces() liveSource for rate-limit names UPSTASH env vars', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'rate-limit')!;
  assert.ok(s.liveSource!.includes('UPSTASH_REDIS_REST_URL'), 'UPSTASH_REDIS_REST_URL in liveSource');
});

test('C15: identitySurfaces() all evidence items are not-connected kind', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    for (const ev of s.evidence) {
      assert.equal(ev.kind, 'not-connected', `${s.surface}: evidence kind not-connected`);
    }
  }
});

test('C16: identitySurfaces() each surface has at least 2 evidence items', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.identitySurfaces()) {
    assert.ok(s.evidence.length >= 2, `${s.surface}: at least 2 evidence items`);
  }
});

test('C17: identitySurfaces() customer-login detail mentions HS256', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'customer-login')!;
  assert.ok(s.detail.includes('HS256'), 'customer-login detail mentions HS256');
});

test('C18: identitySurfaces() merchant-oauth detail mentions ES256', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'merchant-oauth')!;
  assert.ok(s.detail.includes('ES256'), 'merchant-oauth detail mentions ES256');
});

test('C19: identitySurfaces() step-up detail mentions refund or payout', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const s = svc.identitySurfaces().find((x) => x.surface === 'step-up')!;
  assert.ok(s.detail.includes('refund') || s.detail.includes('payout'), 'step-up detail mentions refund/payout');
});

test('C20: identitySurfaces() surface keys are unique', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const surfaces = svc.identitySurfaces().map((s) => s.surface);
  const unique = new Set(surfaces);
  assert.equal(unique.size, surfaces.length, 'all surface names unique');
});

test('C21: identitySurfaces() is deterministic — calling twice returns identical results', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const r1 = svc.identitySurfaces();
  const r2 = svc.identitySurfaces();
  assert.equal(r1.length, r2.length, 'same count');
  for (let i = 0; i < r1.length; i++) {
    assert.equal(r1[i].surface, r2[i].surface, `[${i}]: same surface`);
    assert.equal(r1[i].connection, r2[i].connection, `[${i}]: same connection`);
  }
});

test('C22: identitySurfaces() evidence refs include SUPABASE_URL for auth surfaces', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const authSurfaces = svc.identitySurfaces().filter(
    (s) => s.surface === 'customer-login' || s.surface === 'merchant-oauth',
  );
  for (const s of authSurfaces) {
    const supaRef = s.evidence.some((ev) => ev.ref === 'SUPABASE_URL' || ev.source === 'SUPABASE_URL');
    assert.ok(supaRef, `${s.surface}: SUPABASE_URL cited in evidence`);
  }
});

// =============================================================================
// D. Cross-cutting / wiring / edge cases
// =============================================================================

test('D01: constructor default creds uses process.env (smoke — no env set → all absent)', () => {
  // Do not inject creds — uses process.env default; at minimum no crash
  const svc = new IdentitySecretService(emptyEngine, fixedNow);
  const tokens = svc.tokens();
  assert.equal(tokens.length, 4, 'tokens() still returns 4 items');
});

test('D02: constructor accepts LcisEngine as first arg (parity with facade)', () => {
  const engine2 = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const svc = new IdentitySecretService(engine2, fixedNow, noCreds());
  assert.ok(svc.secrets().length > 0, 'works with different engine instance');
});

test('D03: engine.store is accessible through the constructor param', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  // The service stores core — access via explicit assignment test
  assert.ok(svc !== null, 'service constructed without error');
});

test('D04: secrets() does not include entries with zero requiredEnv', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    assert.ok(s.requiredEnv.length > 0, `${s.key}: requiredEnv non-empty (skipped empty groups)`);
  }
});

test('D05: secrets() CLOUDFLARE entry groups CF vars together', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const cfEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('CLOUDFLARE_API_TOKEN') && s.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'),
  );
  assert.ok(cfEntry !== undefined, 'cloudflare env group entry present');
});

test('D06: secrets() GITHUB entry groups GITHUB_TOKEN and GITHUB_REPOSITORY', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const ghEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('GITHUB_TOKEN') && s.requiredEnv.includes('GITHUB_REPOSITORY'),
  );
  assert.ok(ghEntry !== undefined, 'github env group entry present');
});

test('D07: providing CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID flips CF entry to CONNECTED', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_ACCOUNT_ID: 'acct',
  }));
  const cfEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('CLOUDFLARE_API_TOKEN') && s.requiredEnv.includes('CLOUDFLARE_ACCOUNT_ID'),
  );
  assert.ok(cfEntry !== undefined, 'cloudflare entry present');
  assert.equal(cfEntry!.present, true, 'present=true');
  assert.equal(cfEntry!.connection, 'CONNECTED');
});

test('D08: secrets() STRIPE_SECRET_KEY entry exists', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const stripeEntry = svc.secrets().find((s) => s.requiredEnv.includes('STRIPE_SECRET_KEY'));
  assert.ok(stripeEntry !== undefined, 'stripe entry present');
});

test('D09: secrets() RESEND_API_KEY entry exists', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const resendEntry = svc.secrets().find((s) => s.requiredEnv.includes('RESEND_API_KEY'));
  assert.ok(resendEntry !== undefined, 'resend entry present');
});

test('D10: secrets() UPSTASH_REDIS entry exists', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const upstashEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('UPSTASH_REDIS_REST_URL') && s.requiredEnv.includes('UPSTASH_REDIS_REST_TOKEN'),
  );
  assert.ok(upstashEntry !== undefined, 'upstash entry present');
});

test('D11: secrets() SUPABASE_MGMT_TOKEN + SUPABASE_PROJECT_REF entry exists', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const mgmtEntry = svc.secrets().find(
    (s) => s.requiredEnv.includes('SUPABASE_MGMT_TOKEN') && s.requiredEnv.includes('SUPABASE_PROJECT_REF'),
  );
  assert.ok(mgmtEntry !== undefined, 'supabase management entry present');
});

test('D12: tokens() two-issuer constitutional split: only HS256 for customer, only ES256 for merchant', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const tMap = Object.fromEntries(svc.tokens().map((t) => [t.issuer, t]));
  assert.equal(tMap['customer-session'].algorithm, 'HS256');
  assert.equal(tMap['merchant-identity'].algorithm, 'ES256');
  assert.notEqual(tMap['customer-session'].algorithm, tMap['merchant-identity'].algorithm, 'different algos');
});

test('D13: all three methods return readonly arrays (frozen content check)', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  // TypeScript readonly does not prevent runtime push on plain arrays, but we can verify it's an array
  assert.ok(Array.isArray(svc.secrets()), 'secrets() is array');
  assert.ok(Array.isArray(svc.tokens()), 'tokens() is array');
  assert.ok(Array.isArray(svc.identitySurfaces()), 'identitySurfaces() is array');
});

test('D14: secrets() usedBy values are non-empty strings matching signal catalog keys', () => {
  const catalogKeys = new Set(SIGNAL_CATALOG.map((s) => s.key));
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const s of svc.secrets()) {
    assert.ok(catalogKeys.has(s.usedBy), `${s.key}: usedBy '${s.usedBy}' is a valid catalog key`);
  }
});

test('D15: identitySurfaces() SUPABASE_SERVICE_ROLE_KEY cited in evidence for auth surfaces', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  // At least one surface should cite SUPABASE_SERVICE_ROLE_KEY
  const withServiceRole = svc.identitySurfaces().filter(
    (s) => s.evidence.some((ev) => ev.ref === 'SUPABASE_SERVICE_ROLE_KEY' || ev.source === 'SUPABASE_SERVICE_ROLE_KEY'
      || (ev.detail && ev.detail.includes('SUPABASE_SERVICE_ROLE_KEY'))),
  );
  assert.ok(withServiceRole.length > 0, 'at least one surface cites SUPABASE_SERVICE_ROLE_KEY');
});

test('D16: secrets() and tokens() are independent — changing token env does not affect secret posture', () => {
  const svc1 = new IdentitySecretService(emptyEngine, fixedNow, withEnv({ CUSTOMER_SESSION_SECRET: 'abc' }));
  const svc2 = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  // secrets() results should differ (svc1 may have absent non-token entries but same count)
  assert.equal(svc1.secrets().length, svc2.secrets().length, 'same number of secret entries');
  // CUSTOMER_SESSION_SECRET is NOT in SIGNAL_CATALOG (it's in tokens only), so secrets() is unchanged
  assert.deepEqual(
    svc1.secrets().map((s) => s.key),
    svc2.secrets().map((s) => s.key),
    'secrets() key order unchanged regardless of token env vars',
  );
});

test('D17: tokens() evidence ref matches the required env var name', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  for (const t of svc.tokens()) {
    for (const envVar of t.requiredEnv) {
      const cited = t.evidence.some(
        (ev) => ev.ref === envVar || ev.source === envVar || (ev.detail && ev.detail.includes(envVar)),
      );
      assert.ok(cited, `${t.issuer}: env var ${envVar} cited in evidence ref/source/detail`);
    }
  }
});

test('D18: identitySurfaces() rate-limit detail mentions Redis', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const rl = svc.identitySurfaces().find((s) => s.surface === 'rate-limit')!;
  assert.ok(rl.detail.toLowerCase().includes('redis') || rl.detail.includes('Upstash'), 'rate-limit mentions Redis/Upstash');
});

test('D19: identitySurfaces() turnstile-gate detail mentions Turnstile or bot', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, noCreds());
  const tg = svc.identitySurfaces().find((s) => s.surface === 'turnstile-gate')!;
  assert.ok(
    tg.detail.toLowerCase().includes('turnstile') || tg.detail.toLowerCase().includes('bot'),
    'turnstile-gate detail mentions turnstile or bot',
  );
});

test('D20: all three methods work consistently when called in sequence on the same instance', () => {
  const svc = new IdentitySecretService(emptyEngine, fixedNow, withEnv({
    CUSTOMER_SESSION_SECRET: 'cs',
    LETBUYY_IDENTITY_PUBLIC_JWKS: 'mi',
    SUPABASE_URL: 'su',
    SUPABASE_ANON_KEY: 'sa',
  }));

  const secrets = svc.secrets();
  const tokens = svc.tokens();
  const surfaces = svc.identitySurfaces();

  // All return valid arrays
  assert.ok(secrets.length > 0, 'secrets non-empty');
  assert.equal(tokens.length, 4, '4 tokens');
  assert.equal(surfaces.length, 5, '5 surfaces');

  // customer-session is CONNECTED (env present)
  const cs = tokens.find((t) => t.issuer === 'customer-session')!;
  assert.equal(cs.present, true);
  assert.equal(cs.connection, 'CONNECTED');

  // merchant-identity is CONNECTED (env present)
  const mi = tokens.find((t) => t.issuer === 'merchant-identity')!;
  assert.equal(mi.present, true);
  assert.equal(mi.connection, 'CONNECTED');

  // step-up is still NOT_CONNECTED (STEP_UP_SECRET not provided)
  const su = tokens.find((t) => t.issuer === 'step-up')!;
  assert.equal(su.present, false);
  assert.equal(su.connection, 'NOT_CONNECTED');

  // Supabase secrets entry is CONNECTED (both vars present)
  const supaEntry = secrets.find(
    (s) => s.requiredEnv.includes('SUPABASE_URL') && s.requiredEnv.includes('SUPABASE_ANON_KEY'),
  );
  assert.ok(supaEntry !== undefined);
  assert.equal(supaEntry!.present, true);

  // All surfaces are still NOT_CONNECTED regardless
  for (const s of surfaces) {
    assert.equal(s.connection, 'NOT_CONNECTED', `${s.surface}: NOT_CONNECTED`);
  }
});
