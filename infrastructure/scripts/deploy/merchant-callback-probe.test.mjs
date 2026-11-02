import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyMerchantCallbackIngress } from './merchant-callback-probe.mjs';

test('merchant callback probe sends no body or credentials and accepts only the exact route response', async () => {
  let calls = 0;
  const status = await verifyMerchantCallbackIngress('https://webhooks.staging.letbuyy.com', async (url, options) => {
    calls++;
    assert.equal(url.href, 'https://webhooks.staging.letbuyy.com/razorpay/merchant/not-a-site/not-a-credential');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual');
    assert.equal('body' in options, false);
    assert.equal('headers' in options, false);
    return Response.json({ error: 'Invalid callback scope' }, { status: 400 });
  });
  assert.equal(calls, 1);
  assert.equal(status, 400);
});

test('merchant callback probe refuses healthy host with missing or wrong route', async () => {
  for (const response of [
    new Response('404 Not Found', { status: 404 }),
    Response.json({ error: 'Wrong callback' }, { status: 400 }),
    new Response(null, { status: 302, headers: { location: '/login' } }),
  ]) {
    await assert.rejects(
      verifyMerchantCallbackIngress('https://webhooks.staging.letbuyy.com', async () => response),
      /Merchant Razorpay callback ingress is not deployed/,
    );
  }
});
