import assert from 'node:assert/strict';
import test from 'node:test';
import { createRazorpayPaymentProvider, fetchRazorpayOrdersByReceipt, fetchRazorpayPlan, fetchRazorpaySubscription, fetchRazorpayInvoice,fetchRazorpayRefund, hmacSha256Hex, verifyRazorpayCredentials } from './index';

test('credential verification distinguishes rejected keys from provider outage', async () => {
  const credentials = { keyId: 'rzp_test_fixture', keySecret: 'synthetic-secret' };
  for (const status of [200, 401, 403, 429, 503]) {
    const verify = verifyRazorpayCredentials(credentials, { fetch: (async (url, init) => {
      assert.equal(String(url), 'https://api.razorpay.com/v1/payments?count=1');
      assert.equal(new Headers(init?.headers).get('Authorization'), `Basic ${btoa('rzp_test_fixture:synthetic-secret')}`);
      return new Response('{}', { status });
    }) as typeof fetch });
    if (status === 200) assert.equal(await verify, true);
    else if (status === 401 || status === 403) assert.equal(await verify, false);
    else await assert.rejects(verify, /temporarily unavailable/);
  }
});

test('Razorpay webhook receipt uses delivery identity and a stable signed-body fallback', async () => {
  const secret = 'synthetic-webhook-secret';
  const provider = createRazorpayPaymentProvider({ keyId: 'rzp_test_fixture', keySecret: 'synthetic-secret' });
  const verify = async (eventType: string, receivedAt: string, eventId?: string) => {
    const rawBody = JSON.stringify({ event: eventType, payload: { payment: { entity: { id: 'pay_fixture' } } } });
    return provider.webhookVerify({ provider: 'razorpay', rawBody,
      headers: { 'x-razorpay-signature': await hmacSha256Hex(secret, rawBody),
        ...(eventId ? { 'x-razorpay-event-id': eventId } : {}) },
      secret, receivedAt });
  };
  const delivered = await verify('payment.captured', '2026-10-30T00:00:00.000Z', 'evt_fixture_1');
  assert.equal(delivered.verified, true);
  assert.equal(delivered.event?.id, 'evt_fixture_1');
  const retry = await verify('payment.captured', '2026-10-31T00:00:00.000Z');
  const laterRetry = await verify('payment.captured', '2026-11-01T00:00:00.000Z');
  assert.equal(retry.event?.id, laterRetry.event?.id);
  const failed = await verify('payment.failed', '2026-10-31T00:00:00.000Z');
  assert.notEqual(retry.event?.id, failed.event?.id);
});

test('refund lookup uses the given historical account, encodes the reference and preserves provider facts',async()=>{
 const result=await fetchRazorpayRefund({keyId:'synthetic-key-id',keySecret:'synthetic-key-secret'},'rfnd_a/b',{
  fetch:async(input,init)=>{assert.equal(String(input),'https://api.razorpay.com/v1/refunds/rfnd_a%2Fb');
   assert.equal(init?.method,'GET');assert.equal(new Headers(init?.headers).get('Authorization'),'Basic '+btoa('synthetic-key-id:synthetic-key-secret'));
   return Response.json({id:'rfnd_a/b',payment_id:'pay_synthetic',amount:1,currency:'INR',status:'created'});},
 });assert.equal(result.status,'created');assert.equal(result.amount,1);
});
test('refund lookup does not manufacture a processed refund on errors or malformed provider JSON',async()=>{
 for(const response of [Response.json({}, {status:503}),Response.json(null),Response.json([])]){
  const result=await fetchRazorpayRefund({keyId:'synthetic-key-id',keySecret:'synthetic-key-secret'},'rfnd_synthetic',{fetch:async()=>response});
  assert.ok(result.error);assert.equal(result.status,undefined);
 }
});

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

test('configured subscription plan lookup uses authenticated fixed-origin GET and preserves amount/currency evidence',async()=>{
 let calls=0;
 const result=await fetchRazorpayPlan({keyId:'synthetic-key',keySecret:'synthetic-secret'},'plan_Synthetic123',{fetch:(async(input,init)=>{
  calls++;assert.equal(String(input),'https://api.razorpay.com/v1/plans/plan_Synthetic123');assert.equal(init?.method,'GET');
  assert.equal(new Headers(init?.headers).get('Authorization'),`Basic ${btoa('synthetic-key:synthetic-secret')}`);
  return Response.json({id:'plan_Synthetic123',period:'monthly',interval:1,item:{amount:69900,currency:'INR',active:true,tax_rate:null,tax_id:null,tax_group_id:null}});
 }) as typeof fetch});
 assert.equal(calls,1);assert.equal(result.item?.amount,69900);assert.equal(result.item?.currency,'INR');
});
test('invalid configured plan cannot redirect transport, and provider failure remains explicit',async()=>{
 let calls=0;const transport=(async()=>{calls++;return new Response('{}',{status:503});}) as typeof fetch;
 for(const id of ['https://foreign.invalid','../plans','plan_a?query',''])assert.ok((await fetchRazorpayPlan({keyId:'synthetic',keySecret:'synthetic'},id,{fetch:transport})).error);
 assert.equal(calls,0);const failed=await fetchRazorpayPlan({keyId:'synthetic',keySecret:'synthetic'},'plan_Synthetic123',{fetch:transport});
 assert.equal(calls,1);assert.ok(failed.error);
});

test('subscription lineage read is fixed-origin authenticated GET and excludes customer/notes',async()=>{
 const result=await fetchRazorpaySubscription({keyId:'synthetic-key',keySecret:'synthetic-secret'},'sub_Synthetic123',{fetch:(async(input,init)=>{
  assert.equal(String(input),'https://api.razorpay.com/v1/subscriptions/sub_Synthetic123');assert.equal(init?.method,'GET');
  assert.equal(new Headers(init?.headers).get('Authorization'),'Basic '+btoa('synthetic-key:synthetic-secret'));
  return Response.json({id:'sub_Synthetic123',entity:'subscription',plan_id:'plan_Synthetic123',status:'active',quantity:1,current_start:100,current_end:200,paid_count:1,customer_id:'private-ignored',notes:{private:'ignored'}});
 }) as typeof fetch});
 assert.equal(result.plan_id,'plan_Synthetic123');assert.equal(result.current_end,200);assert.doesNotMatch(JSON.stringify(result),/private|customer_id|notes/);
});
test('invoice lineage read retains payment/subscription/period/components and excludes party data',async()=>{
 const result=await fetchRazorpayInvoice({keyId:'synthetic-key',keySecret:'synthetic-secret'},'inv_Synthetic123',{fetch:(async(input,init)=>{
  assert.equal(String(input),'https://api.razorpay.com/v1/invoices/inv_Synthetic123');assert.equal(init?.method,'GET');
  assert.equal(new Headers(init?.headers).get('Authorization'),'Basic '+btoa('synthetic-key:synthetic-secret'));
  return Response.json({id:'inv_Synthetic123',entity:'invoice',subscription_id:'sub_Synthetic123',payment_id:'pay_Synthetic123',order_id:'order_Synthetic123',status:'paid',amount:74900,amount_paid:74900,amount_due:0,gross_amount:74900,currency:'INR',billing_start:100,billing_end:200,partial_payment:false,customer_details:{email:'private-ignored'},notes:{private:'ignored'},line_items:[{type:'plan',name:'Synthetic Plan',quantity:1,amount:69900,unit_amount:69900,gross_amount:69900,tax_amount:0,currency:'INR',private:'ignored'},{type:'addon',name:'Synthetic Usage',quantity:1,amount:5000,unit_amount:5000,gross_amount:5000,tax_amount:0,currency:'INR'}]});
 }) as typeof fetch});
 assert.equal(result.payment_id,'pay_Synthetic123');assert.equal(result.subscription_id,'sub_Synthetic123');assert.equal(result.line_items?.length,2);assert.equal(result.amount_paid,74900);assert.doesNotMatch(JSON.stringify(result),/private|customer_details|notes/);
});
test('lineage lookups refuse malformed references before transport and safely report provider failure',async()=>{
 let calls=0;const options={fetch:(async()=>{calls++;return Response.json({error:{description:'private ignored'}},{status:503});}) as typeof fetch};
 assert.ok((await fetchRazorpayInvoice({keyId:'synthetic',keySecret:'synthetic'},'https://elsewhere.invalid',options)).error);
 assert.ok((await fetchRazorpaySubscription({keyId:'synthetic',keySecret:'synthetic'},'sub_x/../foreign',options)).error);assert.equal(calls,0);
 assert.equal((await fetchRazorpayInvoice({keyId:'synthetic',keySecret:'synthetic'},'inv_Synthetic123',options)).error?.description,'Razorpay invoice lookup failed with 503');
 assert.equal((await fetchRazorpaySubscription({keyId:'synthetic',keySecret:'synthetic'},'sub_Synthetic123',options)).error?.description,'Razorpay subscription lookup failed with 503');assert.equal(calls,2);
});
