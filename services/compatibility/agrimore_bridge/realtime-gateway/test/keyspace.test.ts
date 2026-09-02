import assert from 'node:assert/strict';
import test from 'node:test';

import { keyspace } from '../src/redis/keyspace';
import { RedisTtl } from '../src/redis/ttl';

test('keyspace prefixes keys by environment', () => {
  const keys = keyspace({ environment: 'Staging East' });

  assert.equal(keys.riderPresence('r1'), 'agrimore:staging-east:rider:presence:r1');
  assert.equal(keys.dispatchOffer('d1', 'r1'), 'agrimore:staging-east:dispatch:offer:d1:r1');
});

test('ttl policy keeps volatile realtime state short lived', () => {
  assert.equal(RedisTtl.riderPresence, 45);
  assert.equal(RedisTtl.dispatchCandidates, 90);
  assert.equal(RedisTtl.deliveryLive, 300);
});
