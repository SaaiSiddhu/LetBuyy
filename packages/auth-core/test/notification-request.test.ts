import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationRequestHeaders, verifyNotificationRequest, NOTIFICATION_REQUEST_PATH, NOTIFICATION_REQUEST_MAX_BYTES } from '../src/index';
const input = { secret: 'synthetic-notification-transport-secret-only', environment: 'production' as const,
  method: 'POST', url: 'https://gateway.test' + NOTIFICATION_REQUEST_PATH,
  body: new TextEncoder().encode('{"operation":"claim","worker_id":"synthetic-worker","payload":{"limit":1}}'), nowMs: 1793000000000 };
test('notification capability binds body, path, method, environment and freshness without sending the shared secret', async () => {
  const headers = await createNotificationRequestHeaders(input);
  assert.equal(Object.values(headers).includes(input.secret), false);
  assert.equal((await verifyNotificationRequest({ ...input, headers: new Headers(headers) })).status, 'accepted');
  for (const extra of [{ method: 'GET' }, { url: input.url + '?rpc=anything' }, { url: 'https://gateway.test/v1/internal/events/domain' },
    { body: new TextEncoder().encode('{}') }, { environment: 'staging' as const }, { nowMs: input.nowMs + 120001 }, { nowMs: input.nowMs - 120001 }]) {
    assert.notEqual((await verifyNotificationRequest({ ...input, ...extra, headers: new Headers(headers) })).status, 'accepted');
  }
  const forged = new Headers(headers); forged.set('X-LetBuyy-Notification-Signature', '0'.repeat(64));
  assert.equal((await verifyNotificationRequest({ ...input, headers: forged })).status, 'denied');
});
test('weak/missing keys, arbitrary endpoints and oversized requests cannot acquire a notification signature', async () => {
  for (const secret of ['', 'short', 'SKIP_NEEDS_HUMAN_NOTIFICATION_SECRET']) await assert.rejects(createNotificationRequestHeaders({ ...input, secret }));
  await assert.rejects(createNotificationRequestHeaders({ ...input, url: 'https://gateway.test/v1/internal/console' }));
  await assert.rejects(createNotificationRequestHeaders({ ...input, body: new Uint8Array(NOTIFICATION_REQUEST_MAX_BYTES + 1) }));
});
