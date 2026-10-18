import assert from 'node:assert/strict';
import test from 'node:test';
import { createRazorpayPaymentProvider, fetchRazorpayOrdersByReceipt } from './index';

test('Razorpay receipt lookup sends an authenticated bounded exact-receipt query', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  let authorization = '';
  const result = await fetchRazorpayOrdersByReceipt(
    { keyId: 'rzp_test_fixture', keySecret: 'synthetic-secret' },
    'cart-123',
    {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = String(input);
        requestedMethod = init?.method || 'GET';
        authorization = new Headers(init?.headers).get('Authorization') || '';
        return Response.json({ count: 1, items: [{ id: 'order_fixture' }] });
      }) as typeof fetch,
    },
  );

  const url = new URL(requestedUrl);
  assert.equal(`${url.origin}${url.pathname}`, 'https://api.razorpay.com/v1/orders');
  assert.equal(url.searchParams.get('receipt'), 'cart-123');
  assert.equal(url.searchParams.get('count'), '2');
  assert.equal(requestedMethod, 'GET');
  assert.equal(authorization, `Basic ${btoa('rzp_test_fixture:synthetic-secret')}`);
  assert.deepEqual(result, { count: 1, items: [{ id: 'order_fixture' }] });
});

test('Razorpay receipt lookup reports a safe status error when provider lookup fails', async () => {
  const result = await fetchRazorpayOrdersByReceipt(
    { keyId: 'rzp_test_fixture', keySecret: 'synthetic-secret' },
    'cart-123',
    { fetch: (async () => new Response('{}', { status: 503 })) as typeof fetch },
  );

  assert.equal(result.error?.description, 'Razorpay order lookup failed with 503');
});

test('Razorpay refund creation remains pending until the provider reports processed', async () => {
  let responseStatus = 'created';
  const provider = createRazorpayPaymentProvider(
    { keyId: 'rzp_test_fixture', keySecret: 'synthetic-secret' },
    { fetch: (async () => Response.json({ id: 'rfnd_fixture', payment_id: 'pay_fixture', amount: 1250, status: responseStatus })) as typeof fetch },
  );
  const input = {
    paymentId: 'pay_fixture',
    storeId: 'store_fixture',
    orderId: 'order_fixture',
    amount: { amountMinor: 1250, currency: 'INR' as const },
    idempotencyKey: 'refund_fixture_001',
  };

  assert.equal((await provider.refund(input)).status, 'pending');
  responseStatus = 'processed';
  assert.equal((await provider.refund(input)).status, 'refunded');
  responseStatus = 'failed';
  assert.equal((await provider.refund(input)).status, 'failed');
});
