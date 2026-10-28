import assert from 'node:assert/strict';
import test from 'node:test';
import { PLATFORM_TRANSACTION_FEE_BPS, requireZeroPlatformTransactionFee } from '../src/platform-transaction-fee';

test('permanent zero rake accepts only exact zero values', () => {
  assert.equal(PLATFORM_TRANSACTION_FEE_BPS, 0);
  assert.equal(requireZeroPlatformTransactionFee(0), 0);
  assert.equal(requireZeroPlatformTransactionFee('0'), 0);
  for (const value of [undefined, null, true, false, '', ' ', '0.0', '0x0', [], {}, NaN, Infinity, 0.01, -1]) {
    assert.throws(() => requireZeroPlatformTransactionFee(value));
  }
  for (let basisPoints = 1; basisPoints <= 10000; basisPoints += 1) {
    assert.throws(() => requireZeroPlatformTransactionFee(basisPoints));
    assert.throws(() => requireZeroPlatformTransactionFee(String(basisPoints)));
  }
});
