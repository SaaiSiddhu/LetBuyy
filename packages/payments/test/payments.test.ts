import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromInrMinorUnits,
  assertBalancedLedgerLines,
  buildPaymentCaptureLedgerPosting,
  buildPaymentRefundLedgerPosting,
  buildSandboxPaymentSessionPlan,
  buildReversalLedgerPosting,
  inrMoney,
  isValidLivePASplitApprovalReference,
  isLivePASplitProviderReady,
  livePASplitProviderHasApproval,
  isProductionRuntime,
  livePaymentCredentialsAreRequired,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  resolvePaymentProviderMode,
  toInrMinorUnits,
} from '../src/index.ts';

test('INR helpers only accept safe minor-unit money', () => {
  assert.deepEqual(inrMoney(12_345), { amountMinor: 12_345, currency: 'INR' });
  assert.equal(toInrMinorUnits('99.50'), 9_950);
  assert.equal(toInrMinorUnits(99), 9_900);
  assert.equal(fromInrMinorUnits(9_905), '99.05');

  assert.throws(() => toInrMinorUnits('99.999'), /at most two paise digits/);
  assert.throws(() => inrMoney(-1), /INR amount/);
  assert.throws(
    () => normalizePaymentMoney({ amountMinor: 100, currency: 'USD' } as Parameters<typeof normalizePaymentMoney>[0]),
    /INR only/,
  );
});

test('payment side-effect idempotency keys are normalized and bounded', () => {
  assert.equal(normalizeIdempotencyKey(' order_123:attempt-1 '), 'order_123:attempt-1');
  assert.throws(() => normalizeIdempotencyKey('short'), /Idempotency key/);
  assert.throws(() => normalizeIdempotencyKey('order 123'), /Idempotency key/);
  assert.throws(() => normalizeIdempotencyKey('x'.repeat(201)), /Idempotency key/);
});

test('live PA split eligibility fails closed without provider-specific approval evidence references', () => {
  assert.equal(isValidLivePASplitApprovalReference(undefined), false);
  assert.equal(isValidLivePASplitApprovalReference('SKIP_NEEDS_HUMAN_PROVIDER'), false);
  assert.equal(isValidLivePASplitApprovalReference('bad ref with spaces'), false);
  assert.equal(isValidLivePASplitApprovalReference('provider-approval-2026'), true);
  assert.equal(livePASplitProviderHasApproval('razorpay_route', {
    razorpay_route: 'razorpay-eligibility-approval',
    cashfree: undefined,
  }), true);
  assert.equal(livePASplitProviderHasApproval('cashfree', {
    razorpay_route: 'razorpay-eligibility-approval',
    cashfree: undefined,
  }), false, 'approval evidence for one provider cannot authorize another');
  assert.equal(isLivePASplitProviderReady('razorpay_route', {
    razorpay_route: 'route-approval-evidence',
  }, false), false, 'an evidence reference cannot replace required provider configuration');
  assert.equal(isLivePASplitProviderReady('razorpay_route', {
    razorpay_route: 'route-approval-evidence',
  }, true), true);
});

test('ledger posting helpers enforce double-entry balance and reversal-only correction', () => {
  const posting = buildPaymentCaptureLedgerPosting({
    siteId: '11111111-1111-4111-8111-111111111111',
    orderId: '22222222-2222-4222-8222-222222222222',
    providerPaymentId: 'pay_test_001',
    grossAmountMinor: 10_000,
    platformFeeMinor: 300,
    gstMinor: 54,
    idempotencyKey: 'payment:pay_test_001',
  });

  assert.equal(posting.lines.length, 4);
  assert.doesNotThrow(() => assertBalancedLedgerLines(posting.lines));
  assert.throws(
    () => assertBalancedLedgerLines([
      { accountCode: 'pa_clearing', side: 'debit', amountMinor: 10_000, currency: 'INR' },
      { accountCode: 'merchant_payable', side: 'credit', amountMinor: 9_000, currency: 'INR' },
    ]),
    /must balance/,
  );

  const reversal = buildReversalLedgerPosting(posting, 'reversal-pay-test-001', 'reversal:pay_test_001');
  assert.equal(reversal.sourceType, 'reversal');
  assert.equal(reversal.lines[0]?.side, 'credit');
  assert.doesNotThrow(() => assertBalancedLedgerLines(reversal.lines));

  const refund = buildPaymentRefundLedgerPosting({
    siteId: '11111111-1111-4111-8111-111111111111',
    paymentId: 'payrow_001',
    providerRefundId: 'rfnd_test_001',
    refundAmountMinor: 1_250,
    idempotencyKey: 'refund:rfnd_test_001',
  });
  assert.equal(refund.sourceType, 'refund');
  assert.deepEqual(
    refund.lines.map((line) => [line.accountCode, line.side, line.amountMinor]),
    [
      ['merchant_payable', 'debit', 1_250],
      ['refund_clearing', 'credit', 1_250],
    ],
  );
  assert.doesNotThrow(() => assertBalancedLedgerLines(refund.lines));
});

test('V1 payment session plans default to sandbox mode and reject mock mode', () => {
  const plan = buildSandboxPaymentSessionPlan({
    provider: 'upi',
    orderId: 'order-123',
    amount: inrMoney(12_500),
    idempotencyKey: 'payment_session:order-123',
    metadata: { channel: 'web' },
  });

  assert.equal(plan.mode, 'sandbox');
  assert.equal(plan.provider, 'upi');
  assert.equal(plan.clientAction, 'upi_collect');
  assert.equal(plan.status, 'pending');
  assert.equal(plan.metadata.channel, 'web');
  assert.equal(resolvePaymentProviderMode('LIVE'), 'live');
  assert.equal(resolvePaymentProviderMode(), 'sandbox');
  assert.equal(resolvePaymentProviderMode(null, { productionRuntime: true }), 'live');
  assert.equal(isProductionRuntime({ nodeEnv: 'production' }), true);
  assert.throws(() => resolvePaymentProviderMode('mock', { productionRuntime: true }), /sandbox or live/);
  assert.throws(() => resolvePaymentProviderMode('mock'), /sandbox or live/);
  assert.throws(() => resolvePaymentProviderMode('production'), /sandbox or live/);
  assert.equal(livePaymentCredentialsAreRequired({ provider: 'razorpay', mode: 'live' }), true);
  assert.equal(livePaymentCredentialsAreRequired({ provider: 'razorpay', mode: 'sandbox' }), false);
  assert.equal(livePaymentCredentialsAreRequired({ provider: 'razorpay', mode: 'live', merchantCredentialPresent: true }), false);
});
