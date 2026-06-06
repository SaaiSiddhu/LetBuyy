import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PasswordUpdateSchema,
  issueCustomerSession,
  verifyCustomerSession,
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
