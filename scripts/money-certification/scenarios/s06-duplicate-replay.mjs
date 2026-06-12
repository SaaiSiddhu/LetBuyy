#!/usr/bin/env node
// S6 — Duplicate webhook replay ×3
// Pass condition: exactly one entry set (I6). DB UNIQUE constraint enforces idempotency;
//                 this script proves the constraint holds under ×3 replay stress.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const AUTH_TOKEN = process.env.STAGING_MERCHANT_AUTH_TOKEN;
if (!SITE_ID || !AUTH_TOKEN) { console.error('STAGING_MERCHANT_SITE_ID and STAGING_MERCHANT_AUTH_TOKEN required'); process.exit(1); }

const SCENARIO = 's06-duplicate-replay';
const orderId = generateUuid(SCENARIO, 'order');
const providerPaymentId = `pay_sandbox_dup_${Date.now()}`;
const idempotencyKey = `s06-capture-${orderId}`;
const evidence = { scenario: SCENARIO, orderId, providerPaymentId, idempotencyKey };

try {
  step('Create order');
  const createRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: `S06-${Date.now()}`, total: 199.00, currency: 'INR', payment_method: 'card', payment_status: 'pending', site_id: SITE_ID }),
  });
  const realOrderId = createRes.body?.data?.id || orderId;
  evidence.realOrderId = realOrderId;
  pass(`order: ${realOrderId}`);

  step('First capture (replay 1/3)');
  const r1 = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
    p_order_id: realOrderId, p_provider: 'razorpay', p_provider_payment_id: providerPaymentId, p_idempotency_key: idempotencyKey,
  });
  const txnId = r1?.canonical_ledger_transaction_id;
  if (!txnId) fail('first capture returned no ledger txn ID');
  await verifyI1Balance(url, key, txnId);
  evidence.firstCaptureTxnId = txnId;
  pass(`replay 1: ledger txn=${txnId}`);

  step('Duplicate capture (replay 2/3) — must be idempotent');
  let replay2TxnId;
  try {
    const r2 = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
      p_order_id: realOrderId, p_provider: 'razorpay', p_provider_payment_id: providerPaymentId, p_idempotency_key: idempotencyKey,
    });
    replay2TxnId = r2?.canonical_ledger_transaction_id;
  } catch (dupErr) {
    // UNIQUE constraint violation or idempotency shortcut — both acceptable
    evidence.replay2Error = dupErr.message;
    pass(`replay 2: idempotency enforced via error: ${dupErr.message}`);
  }
  if (replay2TxnId && replay2TxnId !== txnId) fail(`replay 2 created a NEW ledger txn ${replay2TxnId} — I6 violated`);
  if (replay2TxnId === txnId) pass('replay 2: returned same txn ID (idempotent)');

  step('Duplicate capture (replay 3/3) — must still produce only one entry set');
  let replay3TxnId;
  try {
    const r3 = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
      p_order_id: realOrderId, p_provider: 'razorpay', p_provider_payment_id: providerPaymentId, p_idempotency_key: idempotencyKey,
    });
    replay3TxnId = r3?.canonical_ledger_transaction_id;
  } catch (dupErr) {
    evidence.replay3Error = dupErr.message;
    pass(`replay 3: idempotency enforced via error: ${dupErr.message}`);
  }
  if (replay3TxnId && replay3TxnId !== txnId) fail(`replay 3 created a NEW ledger txn ${replay3TxnId} — I6 violated`);
  if (replay3TxnId === txnId) pass('replay 3: returned same txn ID (idempotent)');

  step('Verify exactly one ledger transaction for this idempotency key');
  await verifyI6Idempotency(url, key, SITE_ID, 'payment_capture', idempotencyKey);

  step('Verify exactly one entry set (2 ledger_entries: one debit + one credit)');
  const entries = await supabaseSelect(url, key, 'ledger_entries',
    `transaction_id=eq.${txnId}&deleted_at=is.null&select=side,amount_minor`);
  if (entries.length !== 2) fail(`expected 2 entries, got ${entries.length} (duplicates may exist)`);
  evidence.entryCount = entries.length;
  pass(`exactly ${entries.length} ledger entries for txn ${txnId}`);

  step('Verify total ledger transactions with this provider payment ID');
  const txns = await supabaseSelect(url, key, 'ledger_transactions',
    `site_id=eq.${SITE_ID}&source_id=like.razorpay:${providerPaymentId}*&deleted_at=is.null&select=id,idempotency_key`);
  if (txns.length > 1) fail(`I6 violated: ${txns.length} transactions for provider_payment_id=${providerPaymentId}`);
  evidence.totalTransactionsForProviderRef = txns.length;
  pass(`exactly ${txns.length} transaction for provider_payment_id=${providerPaymentId}`);

  step('Cleanup: reverse the capture');
  const cleanupKey = `s06-cleanup-${txnId}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'reversal',
    p_source_id: `reversal:${txnId}`,
    p_idempotency_key: cleanupKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 19900, memo: 'S06 cleanup' },
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 19900, memo: 'S06 cleanup' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true },
    p_request_id: cleanupKey,
  });
  pass('cleanup reversal posted');

  evidence.result = 'PASS';
  console.log(`\nS6 PASS — txn=${txnId} replayed x3, exactly one entry set produced`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS6 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
