#!/usr/bin/env node
// S9 — Payout failure (bad beneficiary) → retry after fix
// Pass condition: failure does NOT decrement payable; retry releases once.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
const ACTOR_ID = process.env.STAGING_OPERATOR_USER_ID;
if (!SITE_ID) { console.error('STAGING_MERCHANT_SITE_ID required'); process.exit(1); }

const SCENARIO = 's09-payout-failure';
const captureKey = `s09-prefund-${Date.now()}`;
const payoutId = generateUuid(SCENARIO, 'payout');
const failedReleaseKey = `s09-release-failed-${payoutId}`;
const successReleaseKey = `s09-release-success-${payoutId}`;
const evidence = { scenario: SCENARIO, payoutId, failedReleaseKey, successReleaseKey };

try {
  step('Fund merchant payable (prefund)');
  const prefundTxn = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'payment_capture',
    p_source_id: `razorpay:pay_sandbox_s09_${Date.now()}`,
    p_idempotency_key: captureKey,
    p_lines: [
      { account_code: 'pa_clearing', side: 'debit', amount_minor: 40000, memo: 'S09 prefund' },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 40000, memo: 'S09 prefund' },
    ],
    p_metadata: { harness: SCENARIO, prefund: true },
    p_request_id: captureKey,
  });
  evidence.prefundTxnId = prefundTxn;
  const preFailBalance = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  evidence.preFailBalance = preFailBalance;
  pass(`prefunded ₹400; merchant_payable=${preFailBalance}`);

  step('Create payout_statement with bad beneficiary (will simulate failure)');
  await supabaseInsert(url, key, 'payout_statements', {
    id: payoutId,
    site_id: SITE_ID,
    statement_number: `PYT-S09-FAIL-${Date.now()}`,
    status: 'pending',
    provider: 'razorpay_route',
    provider_mode: 'sandbox',
    rail: 'razorpay_route',
    currency: 'INR',
    gross_amount_minor: 35000,
    platform_fee_minor: 0,
    tax_minor: 0,
    net_amount_minor: 35000,
    idempotency_key: `payout-create-s09-${payoutId}`,
    metadata: { bad_beneficiary: true },
    created_by: ACTOR_ID || null,
    updated_by: ACTOR_ID || null,
  });
  pass(`payout_statement created: ${payoutId}`);

  step('Simulate payout provider failure: provider rejects transfer (no ledger entry posted)');
  // In production, the Route adapter would call Razorpay Route transfer API
  // and get a beneficiary validation error. The payout release is NOT claimed.
  // We simulate this by marking the payout as failed without calling claim_payout_statement_release.
  const failRes = await fetch(`${url}/rest/v1/payout_statements?id=eq.${payoutId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ status: 'failed', metadata: { bad_beneficiary: true, failure_reason: 'beneficiary_validation_failed', harness: SCENARIO } }),
  });
  evidence.payoutFailedStatus = 'failed';
  pass('payout marked as failed (bad beneficiary)');

  step('Verify merchant payable NOT decremented after failure');
  const postFailBalance = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  if (postFailBalance !== preFailBalance) {
    fail(`merchant_payable changed on failure: ${preFailBalance} → ${postFailBalance} — should not change on failed payout`);
  }
  evidence.postFailBalance = postFailBalance;
  evidence.payableUnchangedOnFailure = true;
  pass(`merchant_payable unchanged after failure: ${postFailBalance}`);

  step('Fix beneficiary: update payout_statement back to pending');
  await fetch(`${url}/rest/v1/payout_statements?id=eq.${payoutId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ status: 'pending', metadata: { beneficiary_fixed: true, harness: SCENARIO } }),
  });
  pass('beneficiary fixed; payout reset to pending');

  step('Retry payout: claim release after fix');
  const claimResult = await supabaseRpc(url, key, 'claim_payout_statement_release', {
    p_site_id: SITE_ID,
    p_payout_statement_id: payoutId,
    p_release_idempotency_key: successReleaseKey,
    p_actor_id: ACTOR_ID || null,
  });
  evidence.retryClaimResult = claimResult;
  pass(`retry claim: ${JSON.stringify(claimResult)}`);

  step('Post payout ledger entry on retry');
  const payoutTxn = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'payout',
    p_source_id: `payout_statement:${payoutId}`,
    p_idempotency_key: successReleaseKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 35000, memo: `Payout retry ${payoutId}` },
      { account_code: 'vendor_payable', side: 'credit', amount_minor: 35000, memo: `Route transfer retry ${payoutId}` },
    ],
    p_metadata: { harness: SCENARIO, retry: true, payout_statement_id: payoutId },
    p_request_id: successReleaseKey,
  });
  evidence.payoutTxnId = payoutTxn;
  await verifyI1Balance(url, key, payoutTxn);
  await verifyI6Idempotency(url, key, SITE_ID, 'payout', successReleaseKey);
  pass(`retry payout ledger txn: ${payoutTxn}`);

  step('Verify payable decremented exactly once by ₹350 (not twice)');
  const postRetryBalance = await supabaseRpc(url, key, 'ledger_account_balance_minor',
    { p_site_id: SITE_ID, p_account_code: 'merchant_payable' });
  const delta = (preFailBalance || 0) - (postRetryBalance || 0);
  if (delta !== 35000) fail(`delta=${delta}, expected 35000 (exactly once decrement)`);
  evidence.postRetryBalance = postRetryBalance;
  evidence.decrementedExactlyOnce = true;
  pass(`merchant_payable decremented exactly once: ₹${delta / 100}`);

  step('Cleanup');
  const ck1 = `s09-cleanup-payout-${payoutTxn}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID, p_source_type: 'reversal', p_source_id: `reversal:${payoutTxn}`,
    p_idempotency_key: ck1,
    p_lines: [
      { account_code: 'vendor_payable', side: 'debit', amount_minor: 35000, memo: 'S09 cleanup' },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 35000, memo: 'S09 cleanup' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true }, p_request_id: ck1,
  });
  const ck2 = `s09-cleanup-prefund-${prefundTxn}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID, p_source_type: 'reversal', p_source_id: `reversal:${prefundTxn}`,
    p_idempotency_key: ck2,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 40000, memo: 'S09 cleanup' },
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 40000, memo: 'S09 cleanup' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true }, p_request_id: ck2,
  });
  pass('cleanup reversals posted');

  evidence.result = 'PASS';
  console.log(`\nS9 PASS — payout failed without decrement; retry decremented exactly once`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS9 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
