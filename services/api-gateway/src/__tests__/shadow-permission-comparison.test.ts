// Phase 2 / D03 approved local slice (Mandate 7, Section 11) -- shadow-comparison tests. Confirms
// the comparison ITSELF is honest about what it can and cannot compare; does not (and structurally
// cannot, since nothing calls it from a real route) affect any live authorization decision.

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareStaffPermissionDecision } from '../identity-foundation/shadow-permission-comparison';

test('owner case: always its own named outcome, never silently folded into MATCH or a generic mismatch', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: true, granted: [], requiredKey: 'products:read' });
  assert.equal(result.outcome, 'OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL');
  assert.equal(result.legacyAllowed, true);
  assert.equal(result.newAllowed, null, 'the new model has no answer to compare against for an owner -- null, not a guess');
});

test('a mapped permission the staff member holds directly: both models agree (MATCH)', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['products:read'], requiredKey: 'products:read' });
  assert.equal(result.outcome, 'MATCH');
  assert.equal(result.legacyAllowed, true);
  assert.equal(result.newAllowed, true);
  assert.equal(result.canonicalAction, 'product.read');
});

test('a mapped permission the staff member does NOT hold: both models agree on denial (MATCH)', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['orders:read'], requiredKey: 'products:read' });
  assert.equal(result.outcome, 'MATCH');
  assert.equal(result.legacyAllowed, false);
  assert.equal(result.newAllowed, false);
});

test('write-implies-read: the legacy model allows via the implication; the new model has no such rule -- a NAMED, explained divergence, not a silent one', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['products:write'], requiredKey: 'products:read' });
  assert.equal(result.outcome, 'DIVERGE_LEGACY_ALLOWS_NEW_DENIES');
  assert.equal(result.legacyAllowed, true);
  assert.equal(result.newAllowed, false);
  assert.match(result.detail, /write-implies-read/i);
});

test('a staff permission key with no declared canonical alias (e.g. a not-yet-declared "legal:read") is UNMAPPED, not silently assumed equivalent to anything', async () => {
  // D03 permission equivalence (auth hardening follow-up, 2026-09-28) mapped every key currently
  // declared in StaffPermissionKey (including customers:read, this test's PRIOR example) --
  // superseded, not broadened: LEGACY_PERMISSION_ALIASES now names a canonical action for all 11
  // real StaffPermissionKey values. This still proves the UNMAPPED path is real, using a plausible
  // future key that genuinely has no alias -- requiredKey is a plain string here (not the strict
  // union), so this is a legitimate exercise of the same code path, not a contrived one.
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['legal:read'], requiredKey: 'legal:read' });
  assert.equal(result.outcome, 'UNMAPPED_NO_CANONICAL_ALIAS');
  assert.equal(result.canonicalAction, null);
  assert.equal(result.newAllowed, null);
  assert.equal(result.legacyAllowed, true, 'the legacy decision is still computed and reported even when the new model has no opinion');
});

test('customers:read (mapped by D03 permission equivalence, 2026-09-28) now resolves through the real alias instead of UNMAPPED', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['customers:read'], requiredKey: 'customers:read' });
  assert.equal(result.canonicalAction, 'customer.read');
  assert.notEqual(result.outcome, 'UNMAPPED_NO_CANONICAL_ALIAS');
});

test('absent/malformed permissions (empty granted array): both models deny (MATCH)', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: [], requiredKey: 'products:read' });
  assert.equal(result.outcome, 'MATCH');
  assert.equal(result.legacyAllowed, false);
  assert.equal(result.newAllowed, false);
});

test('a revoked/removed membership is modeled the same way as any non-owner with no relevant grant -- denial in both models (MATCH), never an accidental allow', async () => {
  // A revoked membership has no representation as a special case in evaluateStaffPermission itself
  // (revocation is enforced by the caller no longer finding an active employees row at all -- see
  // SECURITY_ACCEPTANCE.md Section 9); simulated here as the natural consequence: no grants at all.
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: [], requiredKey: 'orders:write' });
  assert.equal(result.outcome, 'MATCH');
  assert.equal(result.legacyAllowed, false);
});

test('a wildcard grant ("*") is not translated into any canonical permission -- the new model sees an actor with zero permissions, a NAMED gap, not a false grant', async () => {
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['*'], requiredKey: 'products:read' });
  // Legacy: '*' allows everything -> legacyAllowed true. New: the actor gets no translated
  // permissions at all (wildcards are not in LEGACY_PERMISSION_ALIASES), so the new engine denies.
  assert.equal(result.legacyAllowed, true);
  assert.equal(result.outcome, 'DIVERGE_LEGACY_ALLOWS_NEW_DENIES');
});

test('cross-site is out of this function\'s scope by construction: it takes no site/store identifiers at all, so it cannot conflate two sites\' grants', async () => {
  // This is a structural property, not a runtime behavior to assert on -- documented here so a
  // future reader does not assume cross-site comparison was silently dropped rather than never
  // being this function's job (site scoping already happens before evaluateStaffPermission is ever
  // called, in the caller's own store-membership lookup).
  const result = await compareStaffPermissionDecision({ isOwner: false, granted: ['products:read'], requiredKey: 'products:read' });
  assert.ok(!('siteId' in result));
});
