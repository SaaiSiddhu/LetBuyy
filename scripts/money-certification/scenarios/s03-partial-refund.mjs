#!/usr/bin/env node
// S3 — Partial refund ×2 then attempted over-refund
// Pass condition: over-refund refused; partials sum correctly.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI5ZeroRake,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const AUTH_TOKEN = process.env.STAGING_MERCHANT_AUTH_TOKEN;
if (!SITE_ID || !AUTH_TOKEN) { console.error('STAGING_MERCHANT_SITE_ID and STAGING_MERCHANT_AUTH_TOKEN required'); process.exit(1); }

const SCENARIO = 's03-partial-refund';
const orderId = generateUuid(SCENARIO, 'order');
const providerPaymentId = `pay_sandbox_partial_${Date.now()}`;
const captureKey = `s03-capture-${orderId}`;
const r1Id = generateUuid(SCENARIO, 'r1');
const r2Id = generateUuid(SCENARIO, 'r2');
const r3Id = generateUuid(SCENARIO, 'r3');
const evidence = { scenario: SCENARIO, orderId, providerPaymentId };

try {
  step('Create order ₹500');
  const createRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: `S03-${Date.now()}`, total: 500.00, currency: 'INR', payment_method: 'card', payment_status: 'pending', site_id: SITE_ID }),
  });
  const realOrderId = createRes.body?.data?.id || orderId;
  evidence.realOrderId = realOrderId;
  pass(`order: ${realOrderId}`);

  step('Capture');
  const captureResult = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
    p_order_id: realOrderId, p_provider: 'razorpay', p_provider_payment_id: providerPaymentId, p_idempotency_key: captureKey,
  });
  evidence.captureLedgerTxnId = captureResult?.canonical_ledger_transaction_id;
  await verifyI1Balance(url, key, evidence.captureLedgerTxnId);
  pass(`capture: ${evidence.captureLedgerTxnId}`);

  step('Partial refund 1: ₹200');
  await supabaseInsert(url, key, 'refunds', { id: r1Id, site_id: SITE_ID, order_id: realOrderId, amount: 200.00, currency: 'INR', status: 'pending', provider: 'razorpay', idempotency_key: `s03-r1-${r1Id}`, reason: 'partial-1' });
  const r1Result = await supabaseRpc(url, key, 'complete_order_refund', { p_refund_id: r1Id, p_provider_refund_id: `rfnd_s03_1_${Date.now()}`, p_idempotency_key: `s03-r1-${r1Id}` });
  evidence.refund1LedgerTxnId = r1Result?.canonical_ledger_transaction_id;
  await verifyI1Balance(url, key, evidence.refund1LedgerTxnId);
  pass(`partial refund 1: ${evidence.refund1LedgerTxnId}`);

  step('Partial refund 2: ₹200');
  await supabaseInsert(url, key, 'refunds', { id: r2Id, site_id: SITE_ID, order_id: realOrderId, amount: 200.00, currency: 'INR', status: 'pending', provider: 'razorpay', idempotency_key: `s03-r2-${r2Id}`, reason: 'partial-2' });
  const r2Result = await supabaseRpc(url, key, 'complete_order_refund', { p_refund_id: r2Id, p_provider_refund_id: `rfnd_s03_2_${Date.now()}`, p_idempotency_key: `s03-r2-${r2Id}` });
  evidence.refund2LedgerTxnId = r2Result?.canonical_ledger_transaction_id;
  await verifyI1Balance(url, key, evidence.refund2LedgerTxnId);
  pass(`partial refund 2: ${evidence.refund2LedgerTxnId}`);

  step('Verify partial refund totals sum correctly (₹400 total refunded of ₹500)');
  const refunds = await supabaseSelect(url, key, 'refunds',
    `order_id=eq.${realOrderId}&status=eq.succeeded&deleted_at=is.null&select=amount`);
  const totalRefunded = refunds.reduce((s, r) => s + parseFloat(r.amount), 0);
  if (Math.abs(totalRefunded - 400) > 0.01) fail(`total refunded=${totalRefunded}, expected 400`);
  evidence.totalRefunded = totalRefunded;
  pass(`total refunded: ₹${totalRefunded}`);

  step('Attempt over-refund: ₹150 (would exceed ₹500 order total with ₹400 already refunded)');
  await supabaseInsert(url, key, 'refunds', { id: r3Id, site_id: SITE_ID, order_id: realOrderId, amount: 150.00, currency: 'INR', status: 'pending', provider: 'razorpay', idempotency_key: `s03-r3-${r3Id}`, reason: 'over-refund-attempt' });
  let overRefundRejected = false;
  try {
    await supabaseRpc(url, key, 'complete_order_refund', { p_refund_id: r3Id, p_provider_refund_id: `rfnd_s03_3_${Date.now()}`, p_idempotency_key: `s03-r3-${r3Id}` });
  } catch (overRefundErr) {
    if (/exceed|exceeds/.test(overRefundErr.message)) {
      overRefundRejected = true;
      evidence.overRefundRejected = true;
      pass(`over-refund correctly rejected: "${overRefundErr.message}"`);
    } else {
      fail(`over-refund raised unexpected error: ${overRefundErr.message}`);
    }
  }
  if (!overRefundRejected) fail('over-refund was NOT rejected — constraint violation');

  step('Cleanup: post remaining ₹100 refund to clear balance');
  const r4Id = generateUuid(SCENARIO, 'r4-cleanup');
  await supabaseInsert(url, key, 'refunds', { id: r4Id, site_id: SITE_ID, order_id: realOrderId, amount: 100.00, currency: 'INR', status: 'pending', provider: 'razorpay', idempotency_key: `s03-r4-${r4Id}`, reason: 'cleanup' });
  await supabaseRpc(url, key, 'complete_order_refund', { p_refund_id: r4Id, p_provider_refund_id: `rfnd_s03_4_${Date.now()}`, p_idempotency_key: `s03-r4-${r4Id}` });
  pass('cleanup: ₹100 residual refunded');

  evidence.result = 'PASS';
  console.log(`\nS3 PASS — partial refunds sum correctly; over-refund rejected`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS3 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
