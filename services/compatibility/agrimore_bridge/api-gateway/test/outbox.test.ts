import assert from 'node:assert/strict';
import test from 'node:test';

import { enqueuePendingOutbox } from '../src/outbox/relay';
import type { Env } from '../src/runtime/types';

test('enqueuePendingOutbox skips when queue binding is absent', async () => {
  const result = await enqueuePendingOutbox({
    APP_ENV: 'test',
    ALLOWED_ORIGINS: '',
    UPSTREAM_BASE_URL: 'http://localhost',
    SUPABASE_URL: 'http://localhost',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  });

  assert.equal(result.queued, 0);
  assert.match(result.skippedReason ?? '', /OUTBOX_QUEUE/);
});

test('enqueuePendingOutbox locks pending events before queueing them', async () => {
  const originalFetch = globalThis.fetch;
  const requests: [string, RequestInit | undefined][] = [];
  let sentBatchLength = 0;
  const pendingEvent = {
    id: 'event-1',
    aggregate_type: 'order',
    aggregate_id: 'order-1',
    event_type: 'order.delivered',
    payload: { user_id: 'user-1' },
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push([String(input), init]);
    if (init?.method === 'GET') {
      return Response.json([pendingEvent]);
    }
    return Response.json([{ ...pendingEvent, status: 'processing', attempts: 1 }]);
  };

  try {
    const result = await enqueuePendingOutbox({
      APP_ENV: 'test',
      ALLOWED_ORIGINS: '',
      UPSTREAM_BASE_URL: 'http://localhost',
      SUPABASE_URL: 'http://localhost',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      OUTBOX_QUEUE: {
        async sendBatch(messages: Iterable<unknown>) {
          sentBatchLength = [...messages].length;
          return { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };
        },
      } as Queue,
    } as Env);

    assert.equal(result.queued, 1);
    assert.equal(sentBatchLength, 1);
    assert.equal(requests.some(([, init]) => init?.method === 'PATCH'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
