import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PushProviderConfigurationError,
  dispatchPushNotificationToDevices,
} from '../src/push-dispatcher.ts';

function fakeDb(rows) {
  return {
    from(table) {
      assert.equal(table, 'device_tokens');
      return {
        select(columns) {
          assert.equal(columns, 'token, platform, device_name');
          return {
            eq(column, value) {
              assert.equal(column, 'user_id');
              assert.equal(value, 'user-1');
              return { data: rows, error: null };
            },
          };
        },
      };
    },
  };
}

function pkcs8Pem(bytes) {
  const base64 = Buffer.from(bytes).toString('base64');
  const lines = base64.match(/.{1,64}/g) || [];
  return [
    '-----BEGIN PRIVATE KEY-----',
    ...lines,
    '-----END PRIVATE KEY-----',
  ].join('\n');
}

async function rsaPrivateKeyPem() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  return pkcs8Pem(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
}

test('push dispatcher sends Android device tokens through FCM', async () => {
  const privateKey = await rsaPrivateKeyPem();
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ input: String(input), init });
    if (String(input).includes('oauth2.googleapis.com')) {
      return Response.json({ access_token: 'fcm-access-token' });
    }
    return Response.json({ name: 'projects/project-1/messages/message-1' });
  };

  const result = await dispatchPushNotificationToDevices(
    fakeDb([{ token: 'android-token', platform: 'android' }]),
    {
      FCM_PROJECT_ID: 'project-1',
      FCM_CLIENT_EMAIL: 'queue-worker@example.test',
      FCM_PRIVATE_KEY: privateKey,
    },
    {
      userId: 'user-1',
      title: 'New order received',
      message: 'A new storefront order needs review.',
      data: { event_type: 'order.created' },
      actionUrl: '/orders/order-1',
    },
    { fetcher, nowSeconds: () => 1_700_000_000 },
  );

  assert.equal(result.attempted, 1);
  assert.equal(result.sent, 1);
  assert.deepEqual(result.providers, ['fcm']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input, 'https://fcm.googleapis.com/v1/projects/project-1/messages:send');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer fcm-access-token');
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.message.token, 'android-token');
  assert.equal(body.message.notification.title, 'New order received');
  assert.equal(body.message.data.action_url, '/orders/order-1');
});

test('push dispatcher fails closed when APNs provider config is missing', async () => {
  await assert.rejects(
    () => dispatchPushNotificationToDevices(
      fakeDb([{ token: 'ios-token', platform: 'ios' }]),
      {},
      {
        userId: 'user-1',
        title: 'Order fulfilled',
        message: 'An order fulfilment was recorded.',
        data: { event_type: 'order.fulfilled' },
      },
    ),
    (error) => error instanceof PushProviderConfigurationError
      && error.code === 'SKIP_NEEDS_HUMAN_PUSH_APNS_BUNDLE_ID',
  );
});
