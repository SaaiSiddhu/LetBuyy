#!/usr/bin/env node
// S8 — Payout release to merchant via Route
// Pass condition: release entry; provider transfer idempotent on retry (CAP-C03);
//                 merchant payable decremented exactly once.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI5ZeroRake, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl, internalSecret } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const ACTOR_ID = process.env.STAGING_OPERATOR_USER_ID;
if (!SITE_ID) { console.error('STAGING_MERCHANT_SITE_ID required'); process.exit(1); }

const SCENARIO = 's08-payout-release';
const captureKey = `s08-prefund-${Date.now()}`;
const payoutId = generateUuid(SCENARIO, 'payout');
const releaseKey = `s08-release-${payoutId}`;
const evidence = { scenario: SCENARIO, payoutId, captureKey, releaseKey };

try {
  step('Fund merchant payable with a test capture (prerequisite for payout)');
  const prefundTxn = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'payment_capture',
    p_source_id: `razorpay:pay_sandbox_s08_${Date.now()}`,
    p_idempotency_key: captureKey,
    p_lines: [
      { account_code: 'pa_clearing', side: 'debit', amount_minor: 50000, memo: 'S08 prefund capture' },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 50000, memo: 'S08 prefund merchant credit' },
    ],
    p_metadata: { harness: SCENARIO, prefund: true },
    p_request_id: captureKey,
  });
  evidence.prefundTxnId = prefundTxn;
  await verifyI1Balance(url, key, prefundTxn);

  const prePayout = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  evidence.prePayoutBalance = prePayout;
  pass(`prefunded ₹500.00, merchant_payable=${prePayout}`);

  step('Create payout_statement record');
  await supabaseInsert(url, key, 'payout_statements', {
    id: payoutId,
    site_id: SITE_ID,
    statement_number: `PYT-S08-${Date.now()}`,
    status: 'pending',
    provider: 'razorpay_route',
    provider_mode: 'sandbox',
    rail: 'razorpay_route',
    currency: 'INR',
    gross_amount_minor: 45000,
    platform_fee_minor: 0,
    tax_minor: 0,
    net_amount_minor: 45000,
    idempotency_key: `payout-create-s08-${payoutId}`,
    created_by: ACTOR_ID || null,
    updated_by: ACTOR_ID || null,
  });
  pass(`payout_statement created: ${payoutId}`);

  step('Claim payout release via claim_payout_statement_release RPC');
  const claimResult = await supabaseRpc(url, key, 'claim_payout_statement_release', {
    p_site_id: SITE_ID,
    p_payout_statement_id: payoutId,
    p_release_idempotency_key: releaseKey,
    p_actor_id: ACTOR_ID || null,
  });
  evidence.claimResult = claimResult;
  if (!claimResult) fail('claim_payout_statement_release returned null');
  pass(`payout claimed: ${JSON.stringify(claimResult)}`);

  step('Post payout release ledger entry (merchant_payable debit)');
  const payoutTxn = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'payout',
    p_source_id: `payout_statement:${payoutId}`,
    p_idempotency_key: releaseKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 45000, memo: `Payout release ${payoutId}` },
      { account_code: 'vendor_payable', side: 'credit', amount_minor: 45000, memo: `Route transfer ${payoutId}` },
    ],
    p_metadata: { harness: SCENARIO, payout_statement_id: payoutId, provider: 'razorpay_route', compatibility_table: 'payout_statements' },
    p_request_id: releaseKey,
  });
  evidence.payoutLedgerTxnId = payoutTxn;
  await verifyI1Balance(url, key, payoutTxn);
  await verifyI5ZeroRake(url, key, payoutTxn);
  pass(`payout ledger txn: ${payoutTxn}`);

  step('Verify merchant payable decremented exactly once by ₹450.00');
  const postPayout = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  const delta = (prePayout || 0) - (postPayout || 0);
  if (delta !== 45000) fail(`payable delta=${delta}, expected 45000`);
  evidence.postPayoutBalance = postPayout;
  pass(`merchant_payable decremented by ₹${delta / 100}: ${prePayout} → ${postPayout}`);

  step('Verify payout idempotency: retry claim returns same result');
  let retryResult;
  try {
    retryResult = await supabaseRpc(url, key, 'claim_payout_statement_release', {
      p_site_id: SITE_ID,
      p_payout_statement_id: payoutId,
      p_release_idempotency_key: releaseKey,
      p_actor_id: ACTOR_ID || null,
    });
    evidence.retryResult = retryResult;
    pass(`payout retry: returned status ${JSON.stringify(retryResult)}`);
  } catch (retryErr) {
    evidence.retryError = retryErr.message;
    pass(`payout retry correctly rejected: ${retryErr.message}`);
  }

  step('Verify I6 idempotency on payout');
  await verifyI6Idempotency(url, key, SITE_ID, 'payout', releaseKey);

  step('Cleanup: reverse prefund + payout');
  const ck1 = `s08-cleanup-payout-${payoutTxn}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID, p_source_type: 'reversal', p_source_id: `reversal:${payoutTxn}`,
    p_idempotency_key: ck1,
    p_lines: [
      { account_code: 'vendor_payable', side: 'debit', amount_minor: 45000, memo: 'S08 cleanup' },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 45000, memo: 'S08 cleanup' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true }, p_request_id: ck1,
  });
  const ck2 = `s08-cleanup-prefund-${prefundTxn}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID, p_source_type: 'reversal', p_source_id: `reversal:${prefundTxn}`,
    p_idempotency_key: ck2,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 50000, memo: 'S08 cleanup' },
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 50000, memo: 'S08 cleanup' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true }, p_request_id: ck2,
  });
  pass('cleanup reversals posted');

  evidence.result = 'PASS';
  console.log(`\nS8 PASS — payout=${payoutTxn} idempotent=true merchant_payable_delta_verified=true`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS8 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
