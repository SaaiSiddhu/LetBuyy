import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyWebhookHmac } from '../src/handlers/api';

test('verifyWebhookHmac accepts valid Razorpay signatures and rejects bad ones', async () => {
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } });
  const secret = 'webhook-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  assert.equal(await verifyWebhookHmac(payload, signature, secret), true);
  const badSignature = `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
  assert.equal(await verifyWebhookHmac(payload, badSignature, secret), false);
});
