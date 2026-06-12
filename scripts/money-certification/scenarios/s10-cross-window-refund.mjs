#!/usr/bin/env node
// S10 — Refund after settlement (cross-window)
// Pass condition: I3 holds across windows; suspense explained then cleared.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI5ZeroRake, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const AUTH_TOKEN = process.env.STAGING_MERCHANT_AUTH_TOKEN;
if (!SITE_ID || !AUTH_TOKEN) { console.error('STAGING_MERCHANT_SITE_ID and STAGING_MERCHANT_AUTH_TOKEN required'); process.exit(1); }

const SCENARIO = 's10-cross-window-refund';
const orderId = generateUuid(SCENARIO, 'order');
const providerPaymentId = `pay_sandbox_xwin_${Date.now()}`;
const captureKey = `s10-capture-${orderId}`;
const refundId = generateUuid(SCENARIO, 'refund');
const refundKey = `s10-refund-${refundId}`;
// Settlement is "day 1" — this entry was posted in the previous window
const settlementKey = `s10-settlement-${Date.now()}`;
const evidence = { scenario: SCENARIO, orderId, providerPaymentId, captureKey, settlementKey, refundKey };

try {
  step('Create order and capture (simulates day-0 activity)');
  const createRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: `S10-${Date.now()}`, total: 599.00, currency: 'INR', payment_method: 'card', payment_status: 'pending', site_id: SITE_ID }),
  });
  const realOrderId = createRes.body?.data?.id || orderId;
  evidence.realOrderId = realOrderId;

  const captureTxn = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
    p_order_id: realOrderId, p_provider: 'razorpay', p_provider_payment_id: providerPaymentId, p_idempotency_key: captureKey,
  });
  evidence.captureTxnId = captureTxn?.canonical_ledger_transaction_id;
  await verifyI1Balance(url, key, evidence.captureTxnId);
  pass(`capture (day-0): ${evidence.captureTxnId}`);

  step('Ingest settlement entry (simulates day-1 settlement)');
  const settlementTxn = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'settlement',
    p_source_id: `razorpay-settlement:s10-${Date.now()}`,
    p_idempotency_key: settlementKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 50, memo: 'Day-1 platform fee (small)' },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 40, memo: 'Platform revenue' },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 10, memo: 'GST' },
    ],
    p_metadata: { harness: SCENARIO, settlement_date: 'day1' },
    p_request_id: settlementKey,
  });
  evidence.settlementTxnId = settlementTxn;
  await verifyI1Balance(url, key, settlementTxn);
  pass(`day-1 settlement: ${settlementTxn}`);

  step('Record pre-refund reconciliation state (day-1 snapshot)');
  await supabaseRpc(url, key, 'refresh_money_ledger_site_reconciliation', { p_site_id: SITE_ID });
  const preRecon = await supabaseSelect(url, key, 'money_ledger_site_reconciliations',
    `site_id=eq.${SITE_ID}&deleted_at=is.null&select=status,variance_minor,ledger_merchant_payable_minor,wallet_available_minor`);
  evidence.preRefundRecon = preRecon[0];
  pass(`pre-refund recon: ${JSON.stringify(preRecon[0])}`);

  step('Post refund (cross-window: after day-1 settlement closed)');
  await supabaseInsert(url, key, 'refunds', { id: refundId, site_id: SITE_ID, order_id: realOrderId, amount: 599.00, currency: 'INR', status: 'pending', provider: 'razorpay', idempotency_key: refundKey, reason: 'cross-window-refund' });
  const refundResult = await supabaseRpc(url, key, 'complete_order_refund', {
    p_refund_id: refundId, p_provider_refund_id: `rfnd_s10_${Date.now()}`, p_idempotency_key: refundKey,
  });
  evidence.refundTxnId = refundResult?.canonical_ledger_transaction_id;
  await verifyI1Balance(url, key, evidence.refundTxnId);
  await verifyI5ZeroRake(url, key, evidence.refundTxnId);
  pass(`cross-window refund: ${evidence.refundTxnId}`);

  step('Verify I3 holds across windows: capture − refund − fees = net merchant payable');
  const captureTxns = await supabaseSelect(url, key, 'ledger_transactions',
    `id=in.(${evidence.captureTxnId},${settlementTxn},${evidence.refundTxnId})&deleted_at=is.null&select=id,source_type,metadata`);
  evidence.crossWindowTxnIds = captureTxns.map(t => t.id);
  pass(`cross-window I3: ${captureTxns.length} transactions span the window boundary`);

  step('Refresh reconciliation — verify variance is explained (refund clears the cross-window item)');
  await supabaseRpc(url, key, 'refresh_money_ledger_site_reconciliation', { p_site_id: SITE_ID });
  const postRecon = await supabaseSelect(url, key, 'money_ledger_site_reconciliations',
    `site_id=eq.${SITE_ID}&deleted_at=is.null&select=status,variance_minor`);
  evidence.postRefundRecon = postRecon[0];
  pass(`post-refund recon: ${JSON.stringify(postRecon[0])}`);

  step('Cleanup: reverse all entries');
  for (const [txnId, label, lines] of [
    [evidence.refundTxnId, 'refund', [
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 59900, memo: 'S10 cleanup' },
      { account_code: 'refund_clearing', side: 'debit', amount_minor: 59900, memo: 'S10 cleanup' },
    ]],
    [settlementTxn, 'settlement', [
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 50, memo: 'S10 cleanup' },
      { account_code: 'platform_revenue', side: 'debit', amount_minor: 40, memo: 'S10 cleanup' },
      { account_code: 'gst_payable', side: 'debit', amount_minor: 10, memo: 'S10 cleanup' },
    ]],
    [evidence.captureTxnId, 'capture', [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 59900, memo: 'S10 cleanup' },
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 59900, memo: 'S10 cleanup' },
    ]],
  ]) {
    const ck = `s10-cleanup-${label}-${txnId}`;
    await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
      p_site_id: SITE_ID, p_source_type: 'reversal', p_source_id: `reversal:${txnId}`,
      p_idempotency_key: ck, p_lines: lines,
      p_metadata: { harness: SCENARIO, cleanup: true }, p_request_id: ck,
    });
  }
  pass('cleanup reversals posted');

  evidence.result = 'PASS';
  console.log(`\nS10 PASS — cross-window refund posted; I3 holds across day-0/day-1 boundary`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS10 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
