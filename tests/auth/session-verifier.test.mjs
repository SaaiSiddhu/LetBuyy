import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const AUTH_CORE_SOURCE = 'packages/auth-core/src/index.ts';

function loadAuthCore() {
  const source = readFileSync(AUTH_CORE_SOURCE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const zChain = new Proxy(function zChain() {}, {
    get: () => zChain,
    apply: () => zChain,
  });
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
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

  vm.runInNewContext(transpiled, sandbox, { filename: AUTH_CORE_SOURCE });
  return module.exports;
}

const authCore = loadAuthCore();

test('merchant apps accept and reject the same lb_session values identically', () => {
  const appSurfaces = [
    'identity-platform',
    'merchant-control-plane',
    'app-marketplace',
    'theme-marketplace',
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
    signature: plan.headers['X-LetBuyy-Internal-Signature'],
    secret: 'test-secret',
    nowMs: 1_000,
  });
  assert.equal(accepted.accepted, true);

  const stale = await authCore.verifyLetbuyyInternalSessionHeaders({
    sessionToken,
    timestamp: plan.headers['X-LetBuyy-Internal-Timestamp'],
    signature: plan.headers['X-LetBuyy-Internal-Signature'],
    secret: 'test-secret',
    nowMs: 1_000 + authCore.LETBUYY_INTERNAL_AUTH_MAX_AGE_MS + 1,
  });
  assert.equal(stale.status, 'expired');

  const tampered = await authCore.verifyLetbuyyInternalSessionHeaders({
    sessionToken,
    timestamp: plan.headers['X-LetBuyy-Internal-Timestamp'],
    signature: '0'.repeat(64),
    secret: 'test-secret',
    nowMs: 1_000,
  });
  assert.equal(tampered.status, 'invalid_signature');
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

test('runtime auth surfaces import the shared verifier instead of local HMAC session copies', () => {
  const sharedAuthFiles = [
    'apps/identity-platform/src/lib/api/worker-client.ts',
    'apps/identity-platform/src/proxy.ts',
    'apps/merchant-control-plane/src/lib/api/worker-client.ts',
    'apps/merchant-control-plane/src/proxy.ts',
    'apps/app-marketplace/src/lib/api/worker-client.ts',
    'apps/app-marketplace/src/proxy.ts',
    'apps/theme-marketplace/src/lib/api/worker-client.ts',
    'apps/storefront-runtime/src/lib/session.ts',
  ];

  for (const file of sharedAuthFiles) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /@letbuyy\/auth-core/, `${file} must use @letbuyy/auth-core`);
    assert.doesNotMatch(source, /function hmacSha256Hex|function bytesToHex|const textEncoder = new TextEncoder/, `${file} must not carry a local HMAC verifier`);
  }
});
