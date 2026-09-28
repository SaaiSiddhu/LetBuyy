// Phase 2 / D04 independent preparation (Mandate 6, Section 10) -- characterization tests for the
// EXISTING platform (console) magic-link token, not a new feature. Confirms what already works
// (TTL-based expiry) and honestly documents what does not (single-use enforcement), so D04's
// decision about whether to invest in single-use tracking is made against a demonstrated fact,
// not an assumption either way.

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

test('CHARACTERIZATION (not a guarantee): the identical magic-link token verifies successfully MORE THAN ONCE within its TTL', async () => {
  // This documents a real, currently-existing gap: the token carries no nonce/jti and nothing
  // records it as consumed anywhere, so it is a bearer credential for its whole 15-minute window,
  // not a true single-use link. If this assertion ever starts failing, single-use enforcement has
  // been added -- update this test to assert the NEW, safer behavior instead of treating the
  // failure as a regression.
  const token = await createLetbuyyPlatformMagicLinkToken('operator@example.test', SECRET, { ttlSeconds: 900 });
  assert.ok(token);
  const first = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  const second = await verifyLetbuyyPlatformMagicLinkToken(token, SECRET);
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true, 'documents that reuse is NOT currently prevented -- see D04.5/D04.8');
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
