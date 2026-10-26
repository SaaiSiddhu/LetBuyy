import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBoundStorefrontRequestSignature } from '@letbuyy/auth-core';
import { storefrontInternalHeaders } from './storefront-internal-headers';
const names = ['STOREFRONT_INTERNAL_PERIMETER', 'STOREFRONT_INTERNAL_REQUEST_SECRET', 'INTERNAL_API_SECRET'] as const;

test('Commerce signs both callers with only its dedicated key and refuses broken explicit configuration', async () => {
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.STOREFRONT_INTERNAL_PERIMETER = 'bound-request-v1';
    process.env.STOREFRONT_INTERNAL_REQUEST_SECRET = 'synthetic-commerce-dedicated-key-0123456789';
    process.env.INTERNAL_API_SECRET = 'synthetic-shared-key-that-must-not-be-sent';
    for (const [method, path, body] of [['GET', '/resolve?host=syn.letbuyy.store', ''], ['POST', '/verify', '{"password":"synthetic"}']] as const) {
      const url = 'https://api.letbuyy.test/v1/internal/store-access' + path;
      const headers = new Headers(await storefrontInternalHeaders(method, url, body));
      assert.equal(headers.has('x-internal-api-secret'), false);
      assert.equal((await verifyBoundStorefrontRequestSignature({ secret: process.env.STOREFRONT_INTERNAL_REQUEST_SECRET, method, url, body: new TextEncoder().encode(body), headers })).status, 'accepted');
      assert.notEqual((await verifyBoundStorefrontRequestSignature({ secret: process.env.INTERNAL_API_SECRET, method, url, body: new TextEncoder().encode(body), headers })).status, 'accepted');
    }
    delete process.env.STOREFRONT_INTERNAL_REQUEST_SECRET;
    await assert.rejects(storefrontInternalHeaders('GET', 'https://api.letbuyy.test/v1/internal/store-access/resolve'));
    process.env.STOREFRONT_INTERNAL_PERIMETER = 'unknown-policy';
    await assert.rejects(storefrontInternalHeaders('GET', 'https://api.letbuyy.test/v1/internal/store-access/resolve'));
  } finally { for (const name of names) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; } }
});
