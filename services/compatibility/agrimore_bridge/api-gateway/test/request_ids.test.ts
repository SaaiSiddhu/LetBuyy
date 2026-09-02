import assert from 'node:assert/strict';
import test from 'node:test';

import { getRequestIds } from '../src/middleware/request_ids';

test('getRequestIds accepts safe propagated headers', () => {
  const request = new Request('https://api.example.test', {
    headers: {
      'x-request-id': 'req_12345678',
      'x-trace-id': 'trace_12345678',
      'x-correlation-id': 'corr_12345678',
    },
  });

  assert.deepEqual(getRequestIds(request), {
    requestId: 'req_12345678',
    traceId: 'trace_12345678',
    correlationId: 'corr_12345678',
  });
});

test('getRequestIds replaces unsafe request IDs', () => {
  const request = new Request('https://api.example.test', {
    headers: { 'x-request-id': '../bad' },
  });

  const ids = getRequestIds(request);
  assert.notEqual(ids.requestId, '../bad');
  assert.equal(ids.traceId, ids.requestId);
});
