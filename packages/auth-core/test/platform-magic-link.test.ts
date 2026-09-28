// Phase 2 / D04 independent preparation (Mandate 6, Section 10), updated by Mandate 7 Section 6 --
// characterization tests for the platform (console) magic-link TOKEN's own verify function.
//
// UPDATE (Mandate 7): single-use IS now enforced for the overall login flow -- but deliberately NOT
// inside verifyLetbuyyPlatformMagicLinkToken itself. That function stays a pure, stateless signature
// + expiry check (consistent with every other token verifier in this file); the actual consumption
// tracking lives in a separate, durable layer (console_magic_link_consumptions, migration 263,
// enforced by services/api-gateway's POST /internal/console/magic-link/consume), called once by the
// console app's callback route BEFORE any session is issued. The test below still correctly shows
// that THIS function alone accepts a token twice -- that is by design, not a residual gap, because
// the token's own jti (added this pass) is what the separate consumption layer keys on.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLetbuyyPlatformMagicLinkToken,
  verifyLetbuyyPlatformMagicLinkToken,
} from '../src/index';

const SECRET = 'test-only-platform-console-session-secret-not-a-real-value';

test('a freshly created magic-link token verifies successfully before its TTL elapses', async () => {
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET, { ttlSeconds: 900 });
  assert.ok(token);
  const result = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  assert.equal(result.accepted, true);
  assert.equal(result.payload?.email, 'operator@example.test');
});

test('an expired magic-link token is rejected -- TTL enforcement works', async () => {
  const nowSeconds = 1_000_000;
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET, { ttlSeconds: 900, nowSeconds });
  assert.ok(token);
  const result = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET, { nowSeconds: nowSeconds + 901 });
  assert.equal(result.accepted, false);
});

test('CHARACTERIZATION: this function ALONE verifies the identical token more than once -- single-use is enforced by a separate consumption layer, not here', async () => {
  // Deliberate: this function has no side effects and no persistence, so it cannot itself be the
  // single-use guarantee. See console-magic-link-consume.test.ts for the layer that is.
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET, { ttlSeconds: 900 });
  assert.ok(token);
  const first = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  const second = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true, 'by design -- verify is idempotent; consumption tracking is a separate, stateful layer');
});

test('every created token carries a distinct, sufficiently long jti -- the identity the consumption layer keys on', async () => {
  const tokenA = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET);
  const tokenB = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET);
  const resultA = await verifyLetbuyyPlatformMagicLinkToken(tokenA, SECRET);
  const resultB = await verifyLetbuyyPlatformMagicLinkToken(tokenB, SECRET);
  assert.ok(resultA.payload?.jti && resultA.payload.jti.length >= 16);
  assert.ok(resultB.payload?.jti && resultB.payload.jti.length >= 16);
  assert.notEqual(resultA.payload?.jti, resultB.payload?.jti, 'two independently created tokens for the SAME email must not share a jti');
});

test('a token signed for one email is never accepted as if it were for a different email', async () => {
  const token = await createLetbuyyPlatformMagicLinkToken('real-operator@example.test', SECRET);
  const result = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  assert.notEqual(result.payload?.email, 'attacker@example.test');
  assert.equal(result.payload?.email, 'real-operator@example.test');
});

test('a token verified against the wrong secret is rejected', async () => {
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET);
  const result = await verifyLetbuyyPlatformMagicLinkToken(token, 'a-completely-different-secret-value');
  assert.equal(result.accepted, false);
});

test('token creation fails closed (returns null) when no secret is configured, never signing with an empty/undefined secret', async () => {
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', null);
  assert.equal(token, null);
});
