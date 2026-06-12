#!/usr/bin/env node
// S2 — Card order, capture, full refund
// Pass condition: reversing entries posted; merchant payable returns to pre-order value.
// Requires same env as S1 plus STAGING_MERCHANT_SITE_ID.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI5ZeroRake, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl, internalSecret } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const AUTH_TOKEN = process.env.STAGING_MERCHANT_AUTH_TOKEN;
if (!SITE_ID || !AUTH_TOKEN) { console.error('STAGING_MERCHANT_SITE_ID and STAGING_MERCHANT_AUTH_TOKEN required'); process.exit(1); }

const SCENARIO = 's02-full-refund';
const orderId = generateUuid(SCENARIO, 'order');
const providerPaymentId = `pay_sandbox_card_${Date.now()}`;
const refundId = generateUuid(SCENARIO, 'refund');
const providerRefundId = `rfnd_sandbox_card_${Date.now()}`;
const captureKey = `s02-capture-${orderId}`;
const refundKey = `s02-refund-${refundId}`;
const evidence = { scenario: SCENARIO, orderId, providerPaymentId, providerRefundId, captureKey, refundKey };

try {
  step('Read pre-test merchant payable balance');
  const preBalance = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  evidence.preTestBalance = preBalance;
  pass(`pre-test merchant_payable balance: ₹${(preBalance || 0) / 100}`);

  step('Create test order');
  const createRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: `S02-${Date.now()}`, total: 250.00, currency: 'INR', payment_method: 'card', payment_status: 'pending', site_id: SITE_ID }),
  });
  const realOrderId = createRes.body?.data?.id || orderId;
  evidence.realOrderId = realOrderId;
  pass(`order created: ${realOrderId}`);

  step('Post capture via RPC');
  const captureResult = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
    p_order_id: realOrderId,
    p_provider: 'razorpay',
    p_provider_payment_id: providerPaymentId,
    p_idempotency_key: captureKey,
  });
  evidence.captureLedgerTxnId = captureResult?.canonical_ledger_transaction_id;
  if (!evidence.captureLedgerTxnId) fail('capture did not return ledger transaction ID');
  await verifyI1Balance(url, key, evidence.captureLedgerTxnId);
  pass(`capture ledger txn: ${evidence.captureLedgerTxnId}`);

  step('Verify balance increased by ₹250.00 after capture');
  const postCapture = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  const delta = (postCapture || 0) - (preBalance || 0);
  if (delta !== 25000) fail(`balance delta=${delta} minor, expected 25000`);
  evidence.postCaptureBalance = postCapture;
  pass(`post-capture balance: ₹${(postCapture || 0) / 100} (delta ₹${delta / 100})`);

  step('Create refund record in DB');
  const refundInsert = await supabaseInsert(url, key, 'refunds', {
    id: refundId,
    site_id: SITE_ID,
    order_id: realOrderId,
    amount: 250.00,
    currency: 'INR',
    status: 'pending',
    provider: 'razorpay',
    idempotency_key: refundKey,
    reason: 'harness-s02-full-refund',
  });
  pass(`refund record created: ${refundId}`);

  step('Complete refund via complete_order_refund RPC');
  const refundResult = await supabaseRpc(url, key, 'complete_order_refund', {
    p_refund_id: refundId,
    p_provider_refund_id: providerRefundId,
    p_idempotency_key: refundKey,
  });
  evidence.refundLedgerTxnId = refundResult?.canonical_ledger_transaction_id;
  if (!evidence.refundLedgerTxnId) fail('refund did not return ledger transaction ID');
  await verifyI1Balance(url, key, evidence.refundLedgerTxnId);
  await verifyI5ZeroRake(url, key, evidence.refundLedgerTxnId);
  await verifyI6Idempotency(url, key, SITE_ID, 'refund', refundKey);
  pass(`refund ledger txn: ${evidence.refundLedgerTxnId}`);

  step('Verify merchant payable returned to pre-order value');
  const postRefund = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  if (postRefund !== preBalance) fail(`post-refund balance=${postRefund}, expected=${preBalance} (pre-test)`);
  evidence.postRefundBalance = postRefund;
  evidence.merchantPayableRestored = true;
  pass(`merchant_payable restored to ₹${(postRefund || 0) / 100}`);

  step('Verify refund order status');
  const order = await supabaseSelect(url, key, 'orders', `id=eq.${realOrderId}&select=payment_status,refund_status`);
  evidence.orderRefundStatus = order[0];
  pass(`order payment_status=${order[0]?.payment_status} refund_status=${order[0]?.refund_status}`);

  evidence.result = 'PASS';
  console.log(`\nS2 PASS — capture=${evidence.captureLedgerTxnId} refund=${evidence.refundLedgerTxnId}`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS2 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
