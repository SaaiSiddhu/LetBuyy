import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateAppBillingChargeSchema,
  VerifySubscriptionSchema,
  planAppBillingCharge,
  planIndiaAppChargePayout,
  razorpayBillingSignaturePayload,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const INSTALLATION_ID = '22222222-2222-4222-8222-222222222222';
const CHARGE_ID = '33333333-3333-4333-8333-333333333333';

test('app billing charge input is INR, positive, and idempotent', () => {
  const parsed = CreateAppBillingChargeSchema.parse({
    store_id: STORE_ID,
    installation_id: INSTALLATION_ID,
    name: 'Starter app plan',
    amount_minor: 10_000,
    idempotency_key: 'app-charge-001',
  });

  assert.equal(parsed.currency, 'INR');
  assert.equal(parsed.billing_mode, 'recurring');
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, amount_minor: 0 }).success, false);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, currency: 'USD' }).success, false);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, idempotency_key: 'short' }).success, false);
});

test('India app charge payout plan records revenue share, GST, and provider mode', () => {
  assert.deepEqual(planIndiaAppChargePayout({ amountMinor: 10_000 }), {
    amount_minor: 10_000,
    currency: 'INR',
    revenue_share_bps: 8_000,
    partner_amount_minor: 8_000,
    platform_fee_minor: 2_000,
    partner_gst_bps: 1_800,
    partner_gst_minor: 1_440,
    payout_rail: 'razorpay_route',
    provider: 'razorpay_route',
    provider_mode: 'test',
  });

  const charge = planAppBillingCharge({
    appId: 'app_1',
    installationId: INSTALLATION_ID,
    storeId: STORE_ID,
    partnerId: 'partner_1',
    billingMode: 'usage',
    name: 'Usage credits',
    amountMinor: 5_555,
    idempotencyKey: 'usage-credit-001',
    approvalUrl: 'https://apps.example.test/approve',
    providerMode: 'live',
  });

  assert.equal(charge.status, 'pending_merchant_approval');
  assert.equal(charge.currency, 'INR');
  assert.equal(charge.metadata.india_payout, charge.payout);
  assert.equal(charge.payout.provider_mode, 'live');
});

test('subscription verification requires provider proof for order or subscription signature payloads', () => {
  assert.equal(
    VerifySubscriptionSchema.safeParse({
      store_id: STORE_ID,
      plan_slug: 'starter',
      site_type: 'store',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig',
    }).success,
    false,
  );
  assert.equal(razorpayBillingSignaturePayload({ orderId: 'order_123', paymentId: 'pay_123' }), 'order_123|pay_123');
  assert.equal(
    razorpayBillingSignaturePayload({ subscriptionId: 'sub_123', paymentId: 'pay_123' }),
    'pay_123|sub_123',
  );
  assert.throws(() => razorpayBillingSignaturePayload({ paymentId: CHARGE_ID }), /order id or subscription id/);
});
