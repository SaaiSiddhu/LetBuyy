import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromInrMinorUnits,
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  toInrMinorUnits,
} from '../src/index.ts';

test('INR helpers only accept safe minor-unit money', () => {
  assert.deepEqual(inrMoney(12_345), { amountMinor: 12_345, currency: 'INR' });
  assert.equal(toInrMinorUnits('99.50'), 9_950);
  assert.equal(toInrMinorUnits(99), 9_900);
  assert.equal(fromInrMinorUnits(9_905), '99.05');

  assert.throws(() => toInrMinorUnits('99.999'), /at most two paise digits/);
  assert.throws(() => inrMoney(-1), /INR amount/);
  assert.throws(
    () => normalizePaymentMoney({ amountMinor: 100, currency: 'USD' } as Parameters<typeof normalizePaymentMoney>[0]),
    /INR only/,
  );
});

test('payment side-effect idempotency keys are normalized and bounded', () => {
  assert.equal(normalizeIdempotencyKey(' order_123:attempt-1 '), 'order_123:attempt-1');
  assert.throws(() => normalizeIdempotencyKey('short'), /Idempotency key/);
  assert.throws(() => normalizeIdempotencyKey('order 123'), /Idempotency key/);
  assert.throws(() => normalizeIdempotencyKey('x'.repeat(201)), /Idempotency key/);
});
