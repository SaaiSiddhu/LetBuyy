import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const AUTH_CORE_SOURCE = 'packages/auth-core/src/index.ts';
const APP_ENGINE_SOURCE = 'packages/app-engine/src/index.ts';
const WEBHOOK_DISPATCH_SOURCE = 'services/webhook-service/src/app-lifecycle-dispatch.ts';

function createZodStub() {
  const zChain = new Proxy(function zChain() {}, {
    get: () => zChain,
    apply: () => zChain,
  });

  const z = new Proxy(function z() {}, {
    get: () => () => zChain,
    apply: () => zChain,
  });

  return { z, zChain };
}

function loadTypeScriptModule(sourcePath, requireMap) {
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in requireMap) return requireMap[specifier];
      throw new Error(`Unexpected test require from ${sourcePath}: ${specifier}`);
    },
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    atob: globalThis.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary')),
    btoa: globalThis.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64')),
    fetch: globalThis.fetch,
    Response: globalThis.Response,
    URL,
    Date,
    Math,
    Number,
    Boolean,
    String,
    RegExp,
    JSON,
    Uint8Array,
    Array,
    ArrayBuffer,
    Set,
    Object,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return module.exports;
}

const { z, zChain } = createZodStub();
const authCore = loadTypeScriptModule(AUTH_CORE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { EmailSchema: zChain },
});
const appEngine = loadTypeScriptModule(APP_ENGINE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { UuidSchema: zChain },
});
const webhookDispatch = loadTypeScriptModule(WEBHOOK_DISPATCH_SOURCE, {
  '@letbuyy/auth-core': authCore,
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('app lifecycle issues scoped OAuth tokens and delivers signed app webhooks locally', async () => {
  const tokenSecret = 'app-token-secret';
  const signingSecret = 'app-webhook-signing-secret';
  const app = { id: 'app_loyalty', name: 'Loyalty Rewards', api_scopes: ['read_products', 'write_orders'] };
  const scopesPlan = appEngine.normalizeAppInstallScopes(['write_orders', 'read_products', 'read_products'], app.api_scopes);

  assert.equal(scopesPlan.ok, true);
  assert.deepEqual(Array.from(scopesPlan.value), ['read_products', 'write_orders']);

  const accessToken = await authCore.createAppScopedAccessToken(
    {
      appId: app.id,
      installationId: 'install_loyalty_001',
      storeId: 'site_001',
      installedBy: 'merchant_001',
      scopes: scopesPlan.value,
    },
    tokenSecret,
    { nowSeconds: 1_700_000_000, ttlSeconds: 600, tokenId: 'token_loyalty_001' },
  );

  const acceptedToken = await authCore.verifyAppScopedAccessToken(accessToken, tokenSecret, {
    nowSeconds: 1_700_000_100,
    requiredScopes: ['read_products'],
  });
  assert.equal(acceptedToken.accepted, true);
  assert.equal(acceptedToken.payload.appId, app.id);
  assert.deepEqual(Array.from(acceptedToken.payload.scopes), ['read_products', 'write_orders']);

  const deniedToken = await authCore.verifyAppScopedAccessToken(accessToken, tokenSecret, {
    nowSeconds: 1_700_000_100,
    requiredScopes: ['manage_billing'],
  });
  assert.equal(deniedToken.status, 'insufficient_scope');

  const received = [];
  const receiver = createServer(async (request, response) => {
    const body = await readRequestBody(request);
    const accepted = await webhookDispatch.verifyLetBuyyWebhookHmac({
      rawBody: body,
      timestamp: request.headers['x-letbuyy-timestamp'],
      signature: request.headers['x-letbuyy-hmac-sha256'],
      signingSecret,
    });
    received.push({ headers: request.headers, body, accepted });
    response.writeHead(accepted ? 204 : 401);
    response.end();
  });

  await listen(receiver);

  try {
    const address = receiver.address();
    const targetUrl = `http://127.0.0.1:${address.port}/app-webhook`;
    const definitions = appEngine.normalizeAppWebhookDefinitions(
      [{ event: 'app.installed', url: targetUrl, secret: signingSecret, is_active: true }],
      { allowLocalhost: true },
    );
    const subscriptions = appEngine.planAppWebhookSubscriptions({
      app,
      storeId: 'site_001',
      installationId: 'install_loyalty_001',
      installedBy: 'merchant_001',
      webhookDefinitions: definitions,
      defaultSigningSecret: 'fallback-secret',
    });
    const payload = appEngine.buildAppLifecycleEventPayload({
      app,
      installationId: 'install_loyalty_001',
      storeId: 'site_001',
      installedBy: 'merchant_001',
      scopes: scopesPlan.value,
      occurredAt: '2026-06-01T00:00:00.000Z',
    });

    assert.equal(subscriptions.length, 1);
    assert.equal(subscriptions[0].target_url, targetUrl);
    assert.deepEqual(Array.from(subscriptions[0].event_types), [
      'app.installed',
      'customers/data_request',
      'customers/redact',
      'shop/redact',
    ]);
    assert.deepEqual(
      Array.from(subscriptions[0].metadata.mandatory_compliance_topics),
      Array.from(appEngine.MANDATORY_COMPLIANCE_WEBHOOK_TOPICS),
    );

    const dispatchResult = await webhookDispatch.dispatchAppLifecycleWebhook(
      {
        target_url: subscriptions[0].target_url,
        event_id: 'evt_app_installed_001',
        event_type: 'app.installed',
        payload,
        signing_secret: subscriptions[0].signing_secret,
        request_id: 'req_app_lifecycle_001',
        trace_id: 'trace_app_lifecycle_001',
      },
      fetch,
      { allowLocalhost: true, nowSeconds: 1_780_272_000 },
    );

    assert.equal(dispatchResult.ok, true);
    assert.equal(dispatchResult.status, 204);
    assert.equal(received.length, 1);
    assert.equal(received[0].accepted, true);

    const request = received[0];
    const expectedSignature = await authCore.hmacSha256Hex(
      signingSecret,
      `${request.headers['x-letbuyy-timestamp']}.${request.body}`,
    );
    assert.equal(request.headers['x-letbuyy-event-id'], 'evt_app_installed_001');
    assert.equal(request.headers['x-letbuyy-event-type'], 'app.installed');
    assert.equal(request.headers['x-letbuyy-hmac-sha256'], `v1=${expectedSignature}`);
    assert.equal(request.headers['x-letbuyy-signature'], `v1=${expectedSignature}`);

    const parsed = JSON.parse(request.body);
    assert.equal(parsed.event_type, 'app.installed');
    assert.equal(parsed.payload.app_id, app.id);
    assert.deepEqual(Array.from(parsed.payload.scopes), ['read_products', 'write_orders']);

    const invalidResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LetBuyy-Timestamp': '1780272000',
        'X-LetBuyy-Hmac-SHA256': 'v1=bad',
      },
      body: JSON.stringify({ event_type: 'customers/redact', payload: { customer_id: 'customer_001' } }),
    });

    assert.equal(invalidResponse.status, 401);
  } finally {
    await close(receiver);
  }
});
