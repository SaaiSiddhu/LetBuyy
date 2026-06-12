#!/usr/bin/env node
// S1 — UPI order → auth → capture → ledger
// Pass condition (beyond I1–I8):
//   capture entry within SLA; capture_posted_to_ledger = true and provably true.
// Requires: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY,
//           STAGING_API_URL, STAGING_INTERNAL_API_SECRET,
//           STAGING_MERCHANT_SITE_ID (an existing staging merchant site),
//           STAGING_MERCHANT_AUTH_TOKEN (merchant JWT for the API gateway).
// Usage: node s01-upi-capture.mjs

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI5ZeroRake, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl, internalSecret } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const AUTH_TOKEN = process.env.STAGING_MERCHANT_AUTH_TOKEN;
if (!SITE_ID || !AUTH_TOKEN) {
  console.error('STAGING_MERCHANT_SITE_ID and STAGING_MERCHANT_AUTH_TOKEN are required');
  process.exit(1);
}

const SCENARIO = 's01-upi-capture';
const orderId = generateUuid(SCENARIO, 'order');
const providerOrderId = `order_sandbox_upi_${Date.now()}`;
const providerPaymentId = `pay_sandbox_upi_${Date.now()}`;
const idempotencyKey = `s01-capture-${orderId}`;
const evidence = { scenario: SCENARIO, orderId, providerPaymentId, providerOrderId, idempotencyKey };

try {
  step('Create test order via API gateway');
  const createOrderRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_number: `S01-${Date.now()}`,
      total: 99.00,
      currency: 'INR',
      payment_method: 'upi',
      payment_status: 'pending',
      site_id: SITE_ID,
    }),
  });
  if (!createOrderRes.ok) fail(`order create failed: ${JSON.stringify(createOrderRes.body)}`);
  const createdOrder = createOrderRes.body?.data || createOrderRes.body;
  const realOrderId = createdOrder?.id || orderId;
  evidence.realOrderId = realOrderId;
  pass(`order created: ${realOrderId}`);

  step('Simulate Razorpay UPI payment authorization (webhook: payment.authorized)');
  const authorizedRes = await apiCall(apiUrl, internalSecret, '/v1/payments/razorpay/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'staging-bypass' },
    body: JSON.stringify({
      event: 'payment.authorized',
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: providerOrderId,
            amount: 9900,
            currency: 'INR',
            status: 'authorized',
            method: 'upi',
          },
        },
        order: { entity: { id: providerOrderId, receipt: realOrderId } },
      },
    }),
  });
  evidence.authorizedWebhookStatus = authorizedRes.status;
  pass(`payment.authorized webhook: status ${authorizedRes.status}`);

  step('Post capture via confirm_order_payment_with_ledger RPC');
  const captureStart = Date.now();
  const captureResult = await supabaseRpc(url, key, 'confirm_order_payment_with_ledger', {
    p_order_id: realOrderId,
    p_provider: 'razorpay',
    p_provider_payment_id: providerPaymentId,
    p_provider_order_id: providerOrderId,
    p_idempotency_key: idempotencyKey,
  });
  const captureSla = Date.now() - captureStart;
  evidence.captureRpcMs = captureSla;
  evidence.canonicalLedgerTransactionId = captureResult?.canonical_ledger_transaction_id;
  if (!evidence.canonicalLedgerTransactionId) fail('capture RPC did not return canonical_ledger_transaction_id');
  if (captureSla > 5000) fail(`capture SLA exceeded: ${captureSla}ms > 5000ms`);
  pass(`capture posted in ${captureSla}ms, ledger txn: ${evidence.canonicalLedgerTransactionId}`);

  step('Verify capture_posted_to_ledger provably true');
  const payments = await supabaseSelect(url, key, 'payment_transactions',
    `order_id=eq.${realOrderId}&deleted_at=is.null&select=id,status,provider_payment_id,metadata`);
  const pt = payments.find(p => p.provider_payment_id === providerPaymentId);
  if (!pt) fail('payment_transaction record not found');
  const ledgerTxnFromMeta = pt.metadata?.canonical_ledger_transaction_id;
  if (!ledgerTxnFromMeta) fail('payment_transaction.metadata missing canonical_ledger_transaction_id');
  if (pt.status !== 'captured') fail(`payment_transaction.status=${pt.status}, expected captured`);
  evidence.paymentTransactionId = pt.id;
  evidence.capturePostedToLedger = true;
  pass(`payment_transaction ${pt.id}: status=captured, ledger_txn=${ledgerTxnFromMeta}`);

  step('Verify I1 double-entry balance');
  await verifyI1Balance(url, key, evidence.canonicalLedgerTransactionId);

  step('Verify I5 zero rake');
  await verifyI5ZeroRake(url, key, evidence.canonicalLedgerTransactionId);

  step('Verify I6 idempotency');
  await verifyI6Idempotency(url, key, SITE_ID, 'payment_capture', idempotencyKey);

  step('Verify ledger entries: pa_clearing debit + merchant_payable credit = ₹99.00');
  const entries = await supabaseSelect(url, key, 'ledger_entries',
    `transaction_id=eq.${evidence.canonicalLedgerTransactionId}&deleted_at=is.null&select=side,amount_minor,account_id`);
  const totalDebits = entries.filter(e => e.side === 'debit').reduce((s, e) => s + e.amount_minor, 0);
  const totalCredits = entries.filter(e => e.side === 'credit').reduce((s, e) => s + e.amount_minor, 0);
  if (totalDebits !== 9900) fail(`debit total=${totalDebits}, expected 9900`);
  if (totalCredits !== 9900) fail(`credit total=${totalCredits}, expected 9900`);
  evidence.ledgerEntries = entries;
  pass(`ledger: ${entries.length} entries, debits=₹${totalDebits/100} credits=₹${totalCredits/100}`);

  step('Cleanup: create reversing refund entry to leave zero net balance');
  const reversalKey = `s01-cleanup-${orderId}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'reversal',
    p_source_id: `reversal:${evidence.canonicalLedgerTransactionId}`,
    p_idempotency_key: reversalKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 9900, memo: 'S01 cleanup reversal' },
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 9900, memo: 'S01 cleanup reversal' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true },
    p_request_id: reversalKey,
  });
  evidence.cleanupReversalKey = reversalKey;
  pass('cleanup reversal posted');

  evidence.result = 'PASS';
  console.log(`\nS1 PASS — provider_id=${providerPaymentId} ledger_txn=${evidence.canonicalLedgerTransactionId}`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS1 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
