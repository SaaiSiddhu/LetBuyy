import assert from 'node:assert/strict';
import test from 'node:test';

import { constantTimeEqual } from '../src/security/constant_time';

test('constantTimeEqual compares equal and different secrets', () => {
  assert.equal(constantTimeEqual('secret-value', 'secret-value'), true);
  assert.equal(constantTimeEqual('secret-value', 'secret-other'), false);
  assert.equal(constantTimeEqual('secret-value', 'secret-value-longer'), false);
});
