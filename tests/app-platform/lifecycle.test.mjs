import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
const customerSessionCore = loadTypeScriptModule('packages/auth-core/src/customer-session.ts', {});
const authCore = loadTypeScriptModule(AUTH_CORE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { EmailSchema: zChain },
  './customer-session': customerSessionCore,
});
const appEngine = loadTypeScriptModule(APP_ENGINE_SOURCE, {
  zod: { z },
  '@letbuyy/shared-types': { UuidSchema: zChain },
});
const webhookDispatch = loadTypeScriptModule(WEBHOOK_DISPATCH_SOURCE, {
  '@letbuyy/auth-core': authCore,
});

test('app OAuth authorization codes bind client, redirect URI, scopes, and expiry', async () => {
  const tokenSecret = 'app-token-secret';
  const app = {
    id: 'app_loyalty',
    name: 'Loyalty Rewards',
    oauth_client_id: 'client_loyalty',
    oauth_redirect_uris: ['https://partner.example/callback'],
    api_scopes: ['read_products', 'write_orders'],
  };
  const scopesPlan = appEngine.normalizeAppInstallScopes(['write_orders', 'read_products'], app.api_scopes);
  const redirectPlan = appEngine.normalizeAppOAuthRedirectUri('https://partner.example/callback', app.oauth_redirect_uris);

  assert.equal(scopesPlan.ok, true);
  assert.equal(redirectPlan.ok, true);
  assert.equal(appEngine.appOAuthClientId(app), 'client_loyalty');

  const authorizationCode = await authCore.createAppAuthorizationCode(
    {
      appId: app.id,
      clientId: appEngine.appOAuthClientId(app),
      installationId: 'install_loyalty_001',
      storeId: 'site_001',
      installedBy: 'merchant_001',
      scopes: scopesPlan.value,
      redirectUri: redirectPlan.value,
      state: 'csrf-state-001',
    },
    tokenSecret,
    { nowSeconds: 1_700_000_000, ttlSeconds: 900, tokenId: 'oauth_code_001' },
  );

  const acceptedCode = await authCore.verifyAppAuthorizationCode(authorizationCode, tokenSecret, {
    nowSeconds: 1_700_000_100,
  });
  assert.equal(acceptedCode.accepted, true);
  assert.equal(acceptedCode.payload.clientId, 'client_loyalty');
  assert.equal(acceptedCode.payload.redirectUri, 'https://partner.example/callback');
  assert.deepEqual(Array.from(acceptedCode.payload.scopes), ['read_products', 'write_orders']);

  const redirectTo = appEngine.buildAppOAuthRedirectUrl(acceptedCode.payload.redirectUri, {
    code: authorizationCode,
    state: acceptedCode.payload.state,
  });
  const redirectUrl = new URL(redirectTo);
  assert.equal(redirectUrl.searchParams.get('code'), authorizationCode);
  assert.equal(redirectUrl.searchParams.get('state'), 'csrf-state-001');

  const expiredCode = await authCore.verifyAppAuthorizationCode(authorizationCode, tokenSecret, {
    nowSeconds: 1_700_001_000,
  });
  assert.equal(expiredCode.status, 'expired');

  const stagingRedirect = appEngine.normalizeAppOAuthRedirectUri(
    'https://partner.staging.letbuyy.store/callback',
    ['https://partner.staging.letbuyy.store/callback'],
  );
  assert.equal(stagingRedirect.ok, true);

  const rejectedRedirect = appEngine.normalizeAppOAuthRedirectUri('http://partner.example/callback', app.oauth_redirect_uris);
  assert.equal(rejectedRedirect.ok, false);
});

test('app bridge internal identity headers can be signed for gateway proxy calls', async () => {
  const secret = 'internal-bridge-secret';
  const userId = '11111111-1111-4111-8111-111111111111';
  const storeId = '22222222-2222-4222-8222-222222222222';
  const plan = await authCore.createLetbuyyInternalIdentityHeaders({
    userId,
    email: 'merchant@example.com',
    storeId,
    secret,
    nowMs: 1_700_000_000_000,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.headers['X-LetBuyy-Internal-User-ID'], userId);
  assert.equal(plan.headers['X-LetBuyy-Internal-Email'], 'merchant@example.com');
  assert.equal(plan.headers['X-LetBuyy-Internal-Store-ID'], storeId);
  assert.equal(
    await authCore.verifyLetbuyySignedPayload(
      secret,
      `${userId}.merchant@example.com.${storeId}.${plan.timestamp}`,
      plan.signature,
    ),
    true,
  );
});

test('Built-for-LetBuyy quality gate blocks weak app listings', () => {
  const failingGate = appEngine.evaluateBuiltForLetBuyyQualityGate({
    performance_score: 42,
    rating_avg: 2.8,
    review_count: 1,
    install_count: 0,
    app_extensions: [],
    app_url: 'https://weak.example',
    privacy_policy_url: 'https://weak.example/privacy',
  });

  assert.equal(failingGate.passed, false);
  assert.equal(failingGate.checks.find((check) => check.key === 'performance').passed, false);
  assert.equal(failingGate.checks.find((check) => check.key === 'app_blocks').passed, false);

  const passingGate = appEngine.evaluateBuiltForLetBuyyQualityGate({
    performance_score: 95,
    rating_avg: 4.7,
    review_count: 12,
    install_count: 30,
    app_extensions: [{ type: 'storefront_block' }],
    app_url: 'https://loyalty.example',
    privacy_policy_url: 'https://loyalty.example/privacy',
  });

  assert.equal(passingGate.passed, true);
  assert.equal(passingGate.score, 100);

  const blockedSubmission = appEngine.planMarketplaceAppSubmission(
    {
      name: 'Weak Loyalty',
      tagline: 'Weak app',
      description: 'A listing that should not pass the quality gate.',
      category_id: 'marketing',
      app_url: 'https://weak.example',
      privacy_url: 'https://weak.example/privacy',
      quality_gate: {
        performance_score: 50,
        rating_avg: 3.5,
        review_count: 1,
        install_count: 0,
      },
      app_extensions: [],
    },
    'developer_001',
  );

  assert.equal(blockedSubmission.ok, false);
  assert.match(blockedSubmission.message, /Built-for-LetBuyy quality gate failed/);
});

test('app lifecycle issues scoped OAuth tokens and delivers signed app webhooks to HTTPS targets', async () => {
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
  const targetUrl = 'https://partner.staging.letbuyy.store/app-webhook';
  const definitions = appEngine.normalizeAppWebhookDefinitions([
    { event: 'app.installed', url: targetUrl, secret: signingSecret, is_active: true },
  ]);
  const rejectedDefinitions = appEngine.normalizeAppWebhookDefinitions([
    { event: 'app.installed', url: 'http://partner.example/app-webhook', secret: signingSecret, is_active: true },
  ]);

  assert.equal(rejectedDefinitions.length, 0);

  const fakeFetcher = async (url, init) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = String(init.body || '');
    const accepted = await webhookDispatch.verifyLetBuyyWebhookHmac({
      rawBody: body,
      timestamp: headers['x-letbuyy-timestamp'],
      signature: headers['x-letbuyy-hmac-sha256'],
      signingSecret,
    });
    received.push({ url: String(url), headers, body, accepted });
    return new Response(null, { status: accepted ? 204 : 401 });
  };

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
    fakeFetcher,
    { nowSeconds: 1_780_272_000 },
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

  assert.equal(
    await webhookDispatch.verifyLetBuyyWebhookHmac({
      rawBody: JSON.stringify({ event_type: 'customers/redact', payload: { customer_id: 'customer_001' } }),
      timestamp: '1780272000',
      signature: 'v1=bad',
      signingSecret,
    }),
    false,
  );

  const invalidBody = JSON.stringify({ event_type: 'customers/redact', payload: { customer_id: 'customer_001' } });
  const invalidResponse = await fakeFetcher(targetUrl, {
    headers: {
      'X-LetBuyy-Timestamp': '1780272000',
      'X-LetBuyy-Hmac-SHA256': 'v1=bad',
    },
    body: invalidBody,
  });
  assert.equal(invalidResponse.status, 401);
});
