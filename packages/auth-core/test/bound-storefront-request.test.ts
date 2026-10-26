import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoundStorefrontRequestHeaders, verifyBoundStorefrontRequestSignature } from '../src/index';
const secret = 'synthetic-dedicated-storefront-key-0123456789';
const resolve = 'https://api.letbuyy.test/v1/internal/store-access/resolve?host=synthetic.letbuyy.store';
const verify = 'https://api.letbuyy.test/v1/internal/store-access/verify';
const nowMs = 1793000000000;
const bytes = (body: string) => new TextEncoder().encode(body);

test('both fixed Commerce operations sign and verify without a shared raw secret', async () => {
  for (const [method, url, body] of [['GET', resolve, ''], ['POST', verify, '{"site_id":"synthetic","password":"synthetic-input"}']]) {
    const headers = new Headers(await createBoundStorefrontRequestHeaders({ secret, method, url, body, nowMs }));
    assert.equal(headers.has('X-Internal-API-Secret'), false);
    assert.equal((await verifyBoundStorefrontRequestSignature({ secret, method, url, body: bytes(body), headers, nowMs })).status, 'accepted');
    assert.equal(headers.get('X-LetBuyy-Internal-Caller'), 'commerce-storefront');
  }
});

test('method, exact path, query, payload, caller and app are inseparable from the signature', async () => {
  const body = '{"password":"synthetic-A","site_id":"synthetic-A"}';
  const original = await createBoundStorefrontRequestHeaders({ secret, method: 'POST', url: verify, body, nowMs });
  for (const change of [
    { method: 'GET' }, { url: resolve }, { url: verify + '?extra=1' }, { body: bytes(body.replace('synthetic-A', 'synthetic-B')) },
    { headers: new Headers({ ...original, 'X-LetBuyy-Internal-Caller': 'another-app' }) },
    { headers: new Headers({ ...original, 'X-LetBuyy-Internal-App': 'identity' }) },
    { headers: new Headers({ ...original, 'X-LetBuyy-Internal-Version': 'legacy' }) },
  ]) {
    const result = await verifyBoundStorefrontRequestSignature({ secret, method: 'POST', url: verify, body: bytes(body), headers: new Headers(original), nowMs, ...change });
    assert.notEqual(result.status, 'accepted');
  }
  const signed = new Headers(await createBoundStorefrontRequestHeaders({ secret, method: 'GET', url: resolve, nowMs }));
  assert.equal((await verifyBoundStorefrontRequestSignature({ secret, method: 'GET', url: resolve.replace('synthetic.', 'foreign.'), headers: signed, nowMs })).status, 'invalid');
});

for (const age of [-60001, 60001]) test('old or future signatures outside the finite window are denied: ' + age, async () => {
  const headers = new Headers(await createBoundStorefrontRequestHeaders({ secret, method: 'GET', url: resolve, nowMs: nowMs + age }));
  assert.equal((await verifyBoundStorefrontRequestSignature({ secret, method: 'GET', url: resolve, headers, nowMs })).status, 'expired');
});

test('missing/wrong keys and malformed metadata never authenticate', async () => {
  const h = await createBoundStorefrontRequestHeaders({ secret, method: 'GET', url: resolve, nowMs });
  for (const key of [undefined, '', 'short', secret + 'foreign']) {
    assert.notEqual((await verifyBoundStorefrontRequestSignature({ secret: key, method: 'GET', url: resolve, headers: new Headers(h), nowMs })).status, 'accepted');
  }
  for (const [key, value] of [['X-LetBuyy-Internal-JTI', 'short'], ['X-LetBuyy-Internal-Timestamp', 'Infinity'], ['X-LetBuyy-Internal-Signature', 'bad']]) {
    assert.notEqual((await verifyBoundStorefrontRequestSignature({ secret, method: 'GET', url: resolve, headers: new Headers({ ...h, [key]: value }), nowMs })).status, 'accepted');
  }
});

test('the signer cannot authorize other internal APIs or oversized/get bodies', async () => {
  for (const input of [
    { method: 'GET', url: verify }, { method: 'POST', url: resolve },
    { method: 'POST', url: 'https://api.letbuyy.test/v1/internal/billing/subscriptions/activate' },
    { method: 'POST', url: verify, body: 'x'.repeat(8193) }, { method: 'GET', url: resolve, body: 'x' },
  ]) await assert.rejects(createBoundStorefrontRequestHeaders({ secret, nowMs, ...input }));
});
