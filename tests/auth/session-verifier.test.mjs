import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const AUTH_CORE_SOURCE = 'packages/auth-core/src/index.ts';
const AUTH_CORE_CUSTOMER_SESSION_SOURCE = 'packages/auth-core/src/customer-session.ts';
const AUTH_CORE_STOREFRONT_ACCESS_SOURCE = 'packages/auth-core/src/storefront-access.ts';

function transpileTypeScript(sourcePath) {
  return ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadAuthCore() {
  const moduleCache = new Map();
  const zChain = new Proxy(function zChain() {}, {
    get: () => zChain,
    apply: () => zChain,
  });

  function evaluateModule(sourcePath) {
    const cached = moduleCache.get(sourcePath);
    if (cached) return cached.exports;

    const module = { exports: {} };
    moduleCache.set(sourcePath, module);
    const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === './customer-session') return evaluateModule(AUTH_CORE_CUSTOMER_SESSION_SOURCE);
      if (specifier === './storefront-access') return evaluateModule(AUTH_CORE_STOREFRONT_ACCESS_SOURCE);
      if (specifier === 'zod') return { z: { string: () => zChain, object: () => zChain } };
      if (specifier === '@letbuyy/shared-types') return { EmailSchema: zChain };
      throw new Error(`Unexpected test require: ${specifier}`);
    },
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    atob: globalThis.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary')),
    btoa: globalThis.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64')),
    Date,
    Math,
    Number,
    Boolean,
    String,
    RegExp,
    JSON,
    Uint8Array,
    ArrayBuffer,
  };

    vm.runInNewContext(transpileTypeScript(sourcePath), sandbox, { filename: sourcePath });
    return module.exports;
  }

  return evaluateModule(AUTH_CORE_SOURCE);
}

const authCore = loadAuthCore();

test('merchant apps accept and reject the same lb_session values identically', () => {
  const appSurfaces = [
    'identity-platform',
    'merchant-control-plane',
    'storefront-runtime',
    'app-marketplace',
    'theme-marketplace',
    'platform-console',
    'platform-operations-portal',
  ];
  const cases = [
    { token: 's'.repeat(32), accepted: true, status: 'accepted' },
    { token: undefined, accepted: false, status: 'missing' },
    { token: 'short', accepted: false, status: 'malformed' },
    { token: `${'s'.repeat(31)} `, accepted: false, status: 'malformed' },
    { token: 'invalid token with spaces'.repeat(2), accepted: false, status: 'malformed' },
  ];

  for (const scenario of cases) {
    const results = appSurfaces.map((surface) => ({
      surface,
      result: authCore.verifyLetbuyySessionCookieValue('merchant', scenario.token),
    }));

    for (const { result } of results) {
      assert.equal(result.accepted, scenario.accepted);
      assert.equal(result.status, scenario.status);
    }
    assert.equal(new Set(results.map(({ result }) => result.status)).size, 1);
  }
});

test('internal session forwarding signatures round-trip through the shared verifier', async () => {
  const sessionToken = 'm'.repeat(48);
  const plan = await authCore.createLetbuyyInternalSessionHeaders(sessionToken, 'test-secret', 1_000);

  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'accepted');

  const accepted = await authCore.verifyLetbuyyInternalSessionHeaders({
    sessionToken: plan.headers['X-LetBuyy-Internal-Session-Token'],
    timestamp: plan.headers['X-LetBuyy-Internal-Timestamp'],
    jti: plan.headers['X-LetBuyy-Internal-JTI'],
    signature: plan.headers['X-LetBuyy-Internal-Signature'],
    secret: 'test-secret',
    nowMs: 1_000,
  });
  assert.equal(accepted.accepted, true);

  const stale = await authCore.verifyLetbuyyInternalSessionHeaders({
    sessionToken,
    timestamp: plan.headers['X-LetBuyy-Internal-Timestamp'],
    jti: plan.headers['X-LetBuyy-Internal-JTI'],
    signature: plan.headers['X-LetBuyy-Internal-Signature'],
    secret: 'test-secret',
    nowMs: 1_000 + authCore.LETBUYY_INTERNAL_AUTH_MAX_AGE_MS + 1,
  });
  assert.equal(stale.status, 'expired');

  const tampered = await authCore.verifyLetbuyyInternalSessionHeaders({
    sessionToken,
    timestamp: plan.headers['X-LetBuyy-Internal-Timestamp'],
    jti: plan.headers['X-LetBuyy-Internal-JTI'],
    signature: '0'.repeat(64),
    secret: 'test-secret',
    nowMs: 1_000,
  });
  assert.equal(tampered.status, 'invalid_signature');
});

test('internal auth secrets are isolated from AUTH_SECRET and app headers carry a JTI', async () => {
  assert.equal(authCore.getLetbuyyInternalAuthSecret({ AUTH_SECRET: 'legacy-auth-secret' }), undefined);
  assert.equal(
    authCore.getLetbuyyInternalAuthSecret({
      INTERNAL_API_SECRET: 'internal-secret',
      AUTH_SECRET: 'legacy-auth-secret',
    }),
    'internal-secret',
  );
  assert.equal(
    authCore.getLetbuyyInternalAuthSecret({
      LETBUYY_INTERNAL_API_SECRET: 'dedicated-secret',
      AUTH_SECRET: 'legacy-auth-secret',
    }),
    'dedicated-secret',
  );

  const plan = await authCore.createLetbuyyInternalAppHeaders({
    app: 'accounts',
    secret: 'dedicated-secret',
    nowMs: 1_000,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.headers['X-LetBuyy-Internal-App'], 'accounts');
  assert.ok(authCore.isSafeLetbuyyInternalJti(plan.headers['X-LetBuyy-Internal-JTI']));
  assert.equal(
    await authCore.verifyLetbuyySignedPayload(
      'dedicated-secret',
      authCore.internalAppSigningPayload(
        'accounts',
        plan.headers['X-LetBuyy-Internal-Timestamp'],
        plan.headers['X-LetBuyy-Internal-JTI'],
      ),
      plan.headers['X-LetBuyy-Internal-Signature'],
    ),
    true,
  );
});

test('customer session JWTs are signed and verified only by auth-core', async () => {
  const token = await authCore.createCustomerSessionToken(
    {
      id: 'customer_123',
      storeId: 'store_123',
      email: 'buyer@example.com',
      fullName: 'Buyer Example',
    },
    'customer-secret',
    { nowSeconds: 100, ttlSeconds: 60 },
  );

  const accepted = await authCore.verifyCustomerSessionToken(token, 'customer-secret', { nowSeconds: 120 });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.payload.email, 'buyer@example.com');

  const expired = await authCore.verifyCustomerSessionToken(token, 'customer-secret', { nowSeconds: 161 });
  assert.equal(expired.status, 'expired');

  const tampered = await authCore.verifyCustomerSessionToken(`${token.slice(0, -1)}x`, 'customer-secret', { nowSeconds: 120 });
  assert.equal(tampered.status, 'invalid_signature');
});

test('gateway customer sessions are short-lived, signed, and body-independent', async () => {
  assert.equal(authCore.LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, 30 * 60);

  const issued = await authCore.issueCustomerSession(
    {
      storeId: 'store_123',
      customerId: 'customer_123',
    },
    'gateway-customer-session-secret',
    { nowSeconds: 1_000 },
  );

  assert.equal(issued.expiresAt, new Date((1_000 + 30 * 60) * 1000).toISOString());

  const accepted = await authCore.verifyCustomerSession(
    issued.token,
    'gateway-customer-session-secret',
    { nowSeconds: 2_799 },
  );
  assert.equal(accepted.storeId, 'store_123');
  assert.equal(accepted.customerId, 'customer_123');

  const expired = await authCore.verifyCustomerSession(
    issued.token,
    'gateway-customer-session-secret',
    { nowSeconds: 2_800 },
  );
  assert.equal(expired, null);

  const tampered = await authCore.verifyCustomerSession(
    `${issued.token.slice(0, -1)}x`,
    'gateway-customer-session-secret',
    { nowSeconds: 1_100 },
  );
  assert.equal(tampered, null);

  const wrongSecret = await authCore.verifyCustomerSession(
    issued.token,
    'different-secret',
    { nowSeconds: 1_100 },
  );
  assert.equal(wrongSecret, null);
});

test('customer federation tokens mint, redeem once, and expire after 15 minutes', async () => {
  const token = await authCore.createCustomerFederationToken(
    {
      id: 'customer_123',
      storeId: 'store_123',
      email: 'buyer@example.com',
      fullName: 'Buyer Example',
      origin: 'https://accounts.letbuyy.store',
      returnTo: 'https://demo.letbuyy.store/account',
    },
    'customer-secret',
    { nowSeconds: 100, tokenId: 'federation_123' },
  );

  assert.equal(typeof token, 'string');

  const verified = await authCore.verifyCustomerFederationToken(token, 'customer-secret', { nowSeconds: 999 });
  assert.equal(verified.accepted, true);
  assert.equal(verified.payload.type, 'customer_federation');
  assert.equal(verified.payload.exp, 1000);
  assert.equal(verified.payload.jti, 'federation_123');

  const consumedIds = new Set();
  const tokenStore = {
    consume(tokenId, expiresAt) {
      assert.equal(expiresAt, 1000);
      if (consumedIds.has(tokenId)) return false;
      consumedIds.add(tokenId);
      return true;
    },
  };

  const firstRedeem = await authCore.redeemCustomerFederationToken(token, 'customer-secret', tokenStore, {
    nowSeconds: 120,
  });
  assert.equal(firstRedeem.accepted, true);
  assert.equal(firstRedeem.customer.id, 'customer_123');
  assert.equal(firstRedeem.customer.storeId, 'store_123');

  const replay = await authCore.redeemCustomerFederationToken(token, 'customer-secret', tokenStore, {
    nowSeconds: 121,
  });
  assert.equal(replay.accepted, false);
  assert.equal(replay.status, 'replayed');

  const expiredToken = await authCore.createCustomerFederationToken(
    {
      id: 'customer_expired',
      storeId: 'store_123',
      email: 'expired@example.com',
      fullName: null,
    },
    'customer-secret',
    { nowSeconds: 100, ttlSeconds: 1, tokenId: 'federation_expired' },
  );
  const expired = await authCore.redeemCustomerFederationToken(expiredToken, 'customer-secret', tokenStore, {
    nowSeconds: 102,
  });
  assert.equal(expired.accepted, false);
  assert.equal(expired.status, 'expired');
  assert.equal(consumedIds.has('federation_expired'), false);
});

test('platform console session and magic-link tokens are signed and verified only by auth-core', async () => {
  const token = await authCore.createLetbuyyPlatformSessionToken(
    {
      email: 'operator@example.com',
      userId: 'user_123',
      mfaVerified: true,
    },
    'platform-secret',
    { nowSeconds: 200, ttlSeconds: 60 },
  );

  const accepted = await authCore.verifyLetbuyyPlatformSessionToken(token, 'platform-secret', { nowSeconds: 220 });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.payload.type, 'platform_session');
  assert.equal(accepted.payload.email, 'operator@example.com');

  const expired = await authCore.verifyLetbuyyPlatformSessionToken(token, 'platform-secret', { nowSeconds: 261 });
  assert.equal(expired.status, 'expired');

  const tampered = await authCore.verifyLetbuyyPlatformSessionToken(`${token.slice(0, -1)}x`, 'platform-secret', { nowSeconds: 220 });
  assert.equal(tampered.status, 'invalid_signature');

  const magicLink = await authCore.createLetbuyyPlatformMagicLinkToken('Operator@Example.com', 'platform-secret', {
    nowSeconds: 300,
    ttlSeconds: 60,
  });
  const verifiedMagicLink = await authCore.verifyLetbuyyPlatformMagicLinkToken(magicLink, 'platform-secret', {
    nowSeconds: 320,
  });
  assert.equal(verifiedMagicLink.accepted, true);
  assert.equal(verifiedMagicLink.payload.email, 'operator@example.com');
});

test('runtime auth surfaces import the shared verifier instead of local HMAC session copies', () => {
  const sharedAuthFiles = [
    'apps/identity-platform/src/lib/api/client.ts',
    'apps/identity-platform/src/proxy.ts',
    'apps/merchant-control-plane/src/lib/api/client.ts',
    'apps/merchant-control-plane/src/proxy.ts',
    'apps/app-marketplace/src/lib/api/client.ts',
    'apps/app-marketplace/src/proxy.ts',
    'apps/theme-marketplace/src/lib/api/client.ts',
    'apps/storefront-runtime/src/lib/session.ts',
    'apps/platform-console/src/lib/console-session.ts',
    'apps/platform-console/src/proxy.ts',
    'apps/platform-operations-portal/src/proxy.ts',
  ];

  for (const file of sharedAuthFiles) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /@letbuyy\/auth-core/, `${file} must use @letbuyy/auth-core`);
    assert.doesNotMatch(
      source,
      /function hmacSha256Hex|function bytesToHex|function hmacSha256|constantTimeEqual|base64UrlEncode|base64UrlDecode|crypto\.subtle\.sign|const textEncoder = new TextEncoder/,
      `${file} must not carry a local HMAC verifier`,
    );
  }
});

test('storefront exposes customer federation redemption through the shared verifier', () => {
  const source = readFileSync('apps/storefront-runtime/src/lib/session.ts', 'utf8');

  assert.match(source, /createSessionFromFederationToken/);
  assert.match(source, /redeemCustomerFederationToken/);
  assert.match(source, /CustomerFederationTokenStore/);
});
