import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PushProviderConfigurationError,
  dispatchPushNotificationToDevices,
} from '../src/push-dispatcher.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const workerRoot = join(testDir, '..');

function fakeDb(rows, preferences = [], preferenceError = null) {
  return {
    from(table) {
      if (table === 'notification_preferences') {
        const query = {select:()=>query,eq:()=>query,in:()=>query,or:()=>({data:preferences,error:preferenceError}),is:()=>({data:preferences,error:preferenceError})};
        return query;
      }
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
  const privateKeyLabel = 'PRIVATE KEY';
  return [
    `-----BEGIN ${privateKeyLabel}-----`,
    ...lines,
    `-----END ${privateKeyLabel}-----`,
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

async function ecPrivateKeyPem() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
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
  assert.equal(result.dryRun, false);
  assert.deepEqual(result.providers, ['fcm']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input, 'https://fcm.googleapis.com/v1/projects/project-1/messages:send');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer fcm-access-token');
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.message.token, 'android-token');
  assert.equal(body.message.notification, undefined, 'Android must not bypass the current-actor display fence');
  assert.equal(body.message.data.title, 'New order received');
  assert.equal(body.message.data.user_id, 'user-1');
  assert.equal(body.message.android.priority, 'high');
  assert.equal(body.message.data.action_url, '/orders/order-1');
});

test('push dispatcher dry-run exercises eligible device tokens without provider credentials', async () => {
  const calls = [];
  const result = await dispatchPushNotificationToDevices(
    fakeDb([
      { token: 'android-token', platform: 'android' },
      { token: 'ios-token', platform: 'ios' },
      { token: '', platform: 'android' },
      { token: 'unknown-token', platform: 'blackberry' },
    ]),
    { PUSH_DISPATCH_MODE: 'dry-run' },
    {
      userId: 'user-1',
      title: 'New order received',
      message: 'A new storefront order needs review.',
      data: { event_type: 'order.created' },
    },
    {
      fetcher: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true });
      },
    },
  );

  assert.equal(result.dryRun, true);
  assert.equal(result.attempted, 2);
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 2);
  assert.deepEqual(result.providers, ['fcm', 'apns']);
  assert.equal(calls.length, 0);
});

test('push dispatcher sends APNs badge from open order count', async () => {
  const privateKey = await ecPrivateKeyPem();
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json({ ok: true });
  };

  const result = await dispatchPushNotificationToDevices(
    fakeDb([{ token: 'ios-token', platform: 'ios' }]),
    {
      APNS_KEY_ID: 'apns-key',
      APNS_TEAM_ID: 'team-id',
      APNS_BUNDLE_ID: 'com.letbuyy.store',
      APNS_PRIVATE_KEY: privateKey,
      APNS_ENVIRONMENT: 'sandbox',
    },
    {
      userId: 'user-1',
      title: 'New order received',
      message: 'A new storefront order needs review.',
      data: { event_type: 'order.created', open_order_count: 4 },
      actionUrl: '/orders/order-1',
    },
    { fetcher, nowSeconds: () => 1_700_000_000 },
  );

  assert.equal(result.attempted, 1);
  assert.equal(result.sent, 1);
  assert.deepEqual(result.providers, ['apns']);
  assert.equal(calls.length, 1);
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.aps.badge, 4);
  assert.equal(body.aps.alert.title, 'New order received');
  assert.equal(body.action_url, '/orders/order-1');
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

test('push dispatcher returns sanitized provider failure details', async () => {
  const privateKey = await rsaPrivateKeyPem();
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ input: String(input), init });
    if (String(input).includes('oauth2.googleapis.com')) {
      return Response.json({ access_token: 'fcm-access-token' });
    }
    return new Response(JSON.stringify({ error: 'provider rejected android-token' }), { status: 500 });
  };

  const result = await dispatchPushNotificationToDevices(
    fakeDb([{ token: 'android-token', platform: 'android', device_name: 'Shop phone' }]),
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
    },
    { fetcher, nowSeconds: () => 1_700_000_000 },
  );

  assert.equal(result.attempted, 1);
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.failureDetails.length, 1);
  assert.deepEqual(result.failureDetails[0], {
    provider: 'fcm',
    platform: 'android',
    deviceName: 'Shop phone',
    code: 'FCM_SEND_FAILED',
    message: 'Push provider delivery failed.',
  });
  assert.doesNotMatch(JSON.stringify(result.failureDetails), /android-token/);
});

test('queue consumer persists push dispatch failure evidence', () => {
  const consumerSource = readFileSync(join(workerRoot, 'src/platform-queue-consumer.ts'), 'utf8');

  assert.match(consumerSource, /recordPushDispatchFailureLog/);
  assert.match(consumerSource, /\.from\('notification_logs'\)\s*[\s\S]*\.upsert\(/);
  assert.match(consumerSource, /status:\s*'failed'/);
  assert.match(consumerSource, /channel:\s*'push'/);
  assert.match(consumerSource, /idempotency_key:\s*`push\.failure:/);
  assert.match(consumerSource, /failure_details:\s*pushResult\.failureDetails/);
});

test('disabled store/category preferences suppress every provider call; failed preference reads fail closed', async () => {
  let calls=0;
  const input={userId:'user-1',siteId:'00000000-0000-4000-8000-000000000001',category:'order_created',title:'Synthetic',message:'Synthetic',data:{}};
  const db=fakeDb([{token:'synthetic-token',platform:'android'}],[{store_id:input.siteId,category:'system',enabled:false}]);
  const result=await dispatchPushNotificationToDevices(db,{PUSH_DISPATCH_MODE:'live'},input,{fetcher:async()=>{calls++;throw Error('must not send');}});
  assert.equal(result.sent,0);assert.equal(result.skipped,1);assert.equal(calls,0);
  await assert.rejects(()=>dispatchPushNotificationToDevices(fakeDb([],[],{message:'synthetic DB failure'}),{},input),/preferences are unavailable/);
});
