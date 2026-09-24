import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PasswordUpdateSchema,
  issueCustomerSession,
  verifyCustomerSession,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
  normalizeCustomerSessionId,
} from '../src/index.ts';

test('customer gateway sessions require a secret and reject tampering or expiry', async () => {
  await assert.rejects(
    () => issueCustomerSession({ storeId: 'store_1', customerId: 'cust_1' }, '', { nowSeconds: 1_000 }),
    /secret is required/,
  );

  const issued = await issueCustomerSession(
    { storeId: ' store_1 ', customerId: ' cust_1 ' },
    'session-secret',
    { nowSeconds: 1_000, ttlSeconds: 60 },
  );

  assert.equal(issued.expiresAt, new Date(1_060_000).toISOString());
  assert.deepEqual(await verifyCustomerSession(issued.token, 'session-secret', { nowSeconds: 1_010 }), {
    storeId: 'store_1',
    customerId: 'cust_1',
  });
  assert.equal(await verifyCustomerSession(issued.token, 'wrong-secret', { nowSeconds: 1_010 }), null);
  assert.equal(await verifyCustomerSession(issued.token, 'session-secret', { nowSeconds: 1_060 }), null);

  const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(await verifyCustomerSession(tampered, 'session-secret', { nowSeconds: 1_010 }), null);
});

test('merchant password update schema enforces complexity without accepting empty secrets', () => {
  assert.equal(PasswordUpdateSchema.safeParse({ password: 'Correct#123' }).success, true);
  assert.equal(PasswordUpdateSchema.safeParse({ password: 'correct#123' }).success, false);
  assert.equal(PasswordUpdateSchema.safeParse({ password: 'Correct123' }).success, false);
  assert.equal(PasswordUpdateSchema.safeParse({ password: 'Correct#' }).success, false);
});

// Phase I4 (IRT-6): the legacy customer verifier (verifyCustomerSessionToken,
// index.ts's isCustomerSessionPayload) now reuses normalizeCustomerSessionId
// -- the exact same guard the primary verifier (verifyCustomerSession,
// customer-session.ts) already enforced -- instead of a second, weaker
// hand-written check. These cases prove the boundary in both directions and
// confirm the tightening does not break a real login, not just that it
// rejects a deliberately bad value.

const IRT6_SECRET = 'irt6-boundary-test-secret-never-real';

async function legacyAccepts(id: string): Promise<boolean> {
  const token = await createCustomerSessionToken(
    { id, storeId: '22222222-2222-4222-8222-222222222222', email: 'buyer@example.test', fullName: null },
    IRT6_SECRET,
  );
  const result = await verifyCustomerSessionToken(token, IRT6_SECRET);
  return result.accepted;
}

test('IRT-6 boundary: a 128-char id is still accepted, a 129-char id is rejected', async () => {
  const id128 = 'a'.repeat(128);
  const id129 = 'a'.repeat(129);

  assert.equal(await legacyAccepts(id128), true, 'exactly 128 chars must remain the accepted boundary');
  assert.equal(await legacyAccepts(id129), false, '129 chars must now be rejected — this is the tightened guard, not the old one');
});

test('IRT-6 boundary: a control character anywhere in the id is rejected', async () => {
  assert.equal(await legacyAccepts('customer-1\x00trailing'), false, 'a NUL byte mid-string must be rejected');
  assert.equal(await legacyAccepts('\x1Fcustomer-1'), false, 'a leading control character must be rejected');
  assert.equal(await legacyAccepts('customer-1\x7F'), false, 'a trailing DEL character must be rejected');
});

test('IRT-6: the primary verifier is unchanged by the reuse (regression check)', async () => {
  const issued = await issueCustomerSession(
    { storeId: 'store_1', customerId: 'cust_1' },
    IRT6_SECRET,
    { nowSeconds: 1_000, ttlSeconds: 60 },
  );
  assert.deepEqual(await verifyCustomerSession(issued.token, IRT6_SECRET, { nowSeconds: 1_010 }), {
    storeId: 'store_1',
    customerId: 'cust_1',
  });

  // normalizeCustomerSessionId itself, called directly, still behaves exactly
  // as it did before this phase -- the fix only added a new CALLER, it did
  // not change the function.
  assert.equal(normalizeCustomerSessionId('a'.repeat(128)), 'a'.repeat(128));
  assert.equal(normalizeCustomerSessionId('a'.repeat(129)), null);
  assert.equal(normalizeCustomerSessionId('bad\x00id'), null);
});

test('IRT-6: all three customer-web mint paths (login/register/set-password) round-trip through the tightened legacy verifier', async () => {
  // login, register, and set-password (apps/commerce/web/src/app/api/
  // customer/{login,register,set-password}/route.ts) all call the SAME
  // createSession() -> createHostOnlyShopperIdentityProvider() ->
  // createCustomerSessionToken() chain with a customer.id/customer.storeId
  // sourced directly from store_customers.id/store_customers.store_id --
  // real Postgres uuid columns (verified in this phase's W1 audit). This
  // proves that shared chain round-trips for exactly the shape all three
  // routes produce; it does not re-exercise each route's own HTTP handler,
  // which is out of this package's scope.
  const realisticCustomerId = '11111111-1111-4111-8111-111111111111';
  const realisticStoreId = '22222222-2222-4222-8222-222222222222';

  const token = await createCustomerSessionToken(
    { id: realisticCustomerId, storeId: realisticStoreId, email: 'buyer@example.test', fullName: 'Buyer Example' },
    IRT6_SECRET,
  );
  const result = await verifyCustomerSessionToken(token, IRT6_SECRET);

  assert.equal(result.accepted, true, 'a uuid-shaped customer/store id, exactly what login/register/set-password produce, must still verify');
  assert.equal(result.payload?.sub, realisticCustomerId);
  assert.equal(result.payload?.storeId, realisticStoreId);
});
