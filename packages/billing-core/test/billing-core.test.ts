import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateAppBillingChargeSchema,
  CreateAppUsageEventSchema,
  VerifySubscriptionSchema,
  applyStorePlanTierDefaults,
  appUsageBillingPeriod,
  appBillingModeForPricingModel,
  getStoreBillingTierDefinitions,
  isAppBillingTrialExpired,
  planBillingDunning,
  planMockUpiAutopayMandate,
  planAppBillingCharge,
  planAppBillingTrialWindow,
  planAppUsageMetering,
  planIndiaAppChargePayout,
  planPayoutReleaseLedgerPosting,
  planSettlementLedgerPosting,
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
  assert.equal(parsed.trial_days, 0);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, amount_minor: 0 }).success, false);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, currency: 'USD' }).success, false);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, trial_days: 366 }).success, false);
  assert.equal(CreateAppBillingChargeSchema.safeParse({ ...parsed, idempotency_key: 'short' }).success, false);
});

test('India app charge payout plan records revenue share, GST, and provider mode', () => {
  assert.deepEqual(planIndiaAppChargePayout({ amountMinor: 10_000 }), {
    amount_minor: 10_000,
    currency: 'INR',
    revenue_share_bps: 8_500,
    partner_amount_minor: 8_500,
    platform_fee_minor: 1_500,
    partner_gst_bps: 1_800,
    partner_gst_minor: 1_530,
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
    trialDays: 14,
    idempotencyKey: 'usage-credit-001',
    approvalUrl: 'https://apps.example.test/approve',
    providerMode: 'live',
  });

  assert.equal(charge.status, 'pending_merchant_approval');
  assert.equal(charge.currency, 'INR');
  assert.equal(charge.trial_days, 14);
  assert.equal(charge.metadata.india_payout, charge.payout);
  assert.equal(charge.payout.provider_mode, 'live');
});

test('app billing trial windows defer activation until the trial ends', () => {
  const nowMs = Date.parse('2026-06-01T00:00:00.000Z');
  const trial = planAppBillingTrialWindow({ trialDays: 7, nowMs });

  assert.equal(trial.status, 'trialing');
  assert.equal(trial.trial_starts_at, '2026-06-01T00:00:00.000Z');
  assert.equal(trial.trial_ends_at, '2026-06-08T00:00:00.000Z');
  assert.equal(trial.billing_starts_at, trial.trial_ends_at);
  assert.equal(trial.activated_at, null);
  assert.equal(isAppBillingTrialExpired({ status: 'trialing', trialEndsAt: trial.trial_ends_at, nowMs }), false);
  assert.equal(isAppBillingTrialExpired({ status: 'trialing', trialEndsAt: trial.trial_ends_at, nowMs: Date.parse('2026-06-08T00:00:00.000Z') }), true);

  const immediate = planAppBillingTrialWindow({ trialDays: 0, nowMs });
  assert.equal(immediate.status, 'active');
  assert.equal(immediate.activated_at, '2026-06-01T00:00:00.000Z');
});

test('app usage metering applies included allowance and trial billing', () => {
  const usage = CreateAppUsageEventSchema.parse({
    meter_name: 'usage_events',
    quantity: 25,
    idempotency_key: 'usage-event-001',
  });
  assert.equal(usage.source, 'app_api');

  const period = appUsageBillingPeriod({ nowMs: Date.parse('2026-06-18T12:30:00.000Z') });
  assert.equal(period.period_start, '2026-06-01T00:00:00.000Z');
  assert.equal(period.period_end, '2026-07-01T00:00:00.000Z');

  const metered = planAppUsageMetering({
    quantity: 25,
    previousQuantity: 90,
    includedQuantity: 100,
    unitAmountMinor: 200,
  });
  assert.equal(metered.billable_quantity, 15);
  assert.equal(metered.amount_minor, 3_000);
  assert.equal(metered.billing_status, 'metered');

  const trial = planAppUsageMetering({
    quantity: 25,
    previousQuantity: 200,
    includedQuantity: 100,
    unitAmountMinor: 200,
    trialing: true,
  });
  assert.equal(trial.billable_quantity, 0);
  assert.equal(trial.amount_minor, 0);
  assert.equal(trial.billing_status, 'trial_included');
});

test('app pricing models map to charge billing modes when paid', () => {
  assert.equal(appBillingModeForPricingModel('recurring'), 'recurring');
  assert.equal(appBillingModeForPricingModel('one_time'), 'one_time');
  assert.equal(appBillingModeForPricingModel('usage'), 'usage');
  assert.equal(appBillingModeForPricingModel('free'), null);
  assert.equal(appBillingModeForPricingModel('freemium'), null);
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

test('settlement ledger plan balances PA split and explains breaks through reserve', () => {
  const plan = planSettlementLedgerPosting({
    store_id: STORE_ID,
    settlement_reference: 'setl_001',
    idempotency_key: 'settlement-001',
    rail: 'pa_split',
    provider: 'razorpay_route',
    provider_mode: 'mock',
    currency: 'INR',
    gross_amount_minor: 10_000,
    platform_fee_minor: 300,
    gst_minor: 54,
    net_amount_minor: 9_600,
    reserve_minor: 0,
    metadata: {},
  });

  assert.equal(plan.source_type, 'settlement');
  assert.equal(plan.recon_break_minor, 46);
  assert.deepEqual(
    plan.lines.map((line) => [line.account_code, line.side, line.amount_minor]),
    [
      ['pa_clearing', 'debit', 10_000],
      ['merchant_payable', 'credit', 9_600],
      ['platform_revenue', 'credit', 300],
      ['gst_payable', 'credit', 54],
      ['reserve', 'credit', 46],
    ],
  );
});

test('settlement ledger plan models COD remittance and payout release', () => {
  const cod = planSettlementLedgerPosting({
    store_id: STORE_ID,
    settlement_reference: 'cod_001',
    idempotency_key: 'cod-settlement-001',
    rail: 'cod_remittance',
    provider: 'cod',
    provider_mode: 'mock',
    currency: 'INR',
    gross_amount_minor: 5_000,
    platform_fee_minor: 150,
    gst_minor: 27,
    reserve_minor: 0,
    metadata: {},
  });

  assert.equal(cod.source_type, 'cod_remittance');
  assert.equal(cod.recon_break_minor, 0);
  assert.equal(cod.lines[0]?.account_code, 'cod_receivable');

  assert.deepEqual(
    planPayoutReleaseLedgerPosting({ payoutReference: 'payout_001', amountMinor: 4_823 }).map((line) => [line.account_code, line.side, line.amount_minor]),
    [
      ['merchant_payable', 'debit', 4_823],
      ['pa_clearing', 'credit', 4_823],
    ],
  );
});

test('store billing tiers permanently remove GMV rake and plan mock UPI AutoPay mandates', () => {
  const tiers = getStoreBillingTierDefinitions();
  assert.equal(tiers.every((tier) => tier.gmv_percentage === 0), true);
  assert.equal(
    applyStorePlanTierDefaults({
      id: 'plan_1',
      slug: 'starter',
      name: 'Starter',
      site_type: 'store',
      gmv_percentage: 2.5,
    }).gmv_percentage,
    0,
  );

  const mandate = planMockUpiAutopayMandate({
    plan: applyStorePlanTierDefaults({
      id: 'plan_2',
      slug: 'business',
      name: 'Business',
      site_type: 'store',
      price_monthly_inr: 99900,
    }),
    billingPeriod: 'monthly',
    providerMode: 'mock',
    idempotencyKey: 'mandate-001',
  });

  assert.equal(mandate.provider, 'upi_autopay');
  assert.equal(mandate.status, 'active');
  assert.equal(mandate.mock, true);
  assert.equal(mandate.amount_minor, 99900);
});

test('billing dunning plans charged and failed states deterministically', () => {
  assert.deepEqual(planBillingDunning({ paymentStatus: 'paid' }), {
    status: 'none',
    dunning_attempts: 0,
    next_dunning_at: null,
    event_type: 'billing.charged',
  });

  const failed = planBillingDunning({
    paymentStatus: 'failed',
    previousAttempts: 1,
    nowMs: Date.parse('2026-06-08T00:00:00.000Z'),
  });
  assert.equal(failed.status, 'past_due');
  assert.equal(failed.dunning_attempts, 2);
  assert.equal(failed.next_dunning_at, '2026-06-12T00:00:00.000Z');
  assert.equal(failed.event_type, 'billing.failed');
});
