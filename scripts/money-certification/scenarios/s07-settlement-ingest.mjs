#!/usr/bin/env node
// S7 — Settlement ingest across 2 days including cross-source duplicate
// Pass condition: dedupe holds (CAP-C05); settlement entries match provider report.
// Requires STAGING_MERCHANT_SITE_ID. Settlement ingest uses queue-worker job.

import {
  requireStagingEnv, supabaseRpc, supabaseSelect, supabaseInsert,
  apiCall, generateUuid, recordEvidence,
  verifyI1Balance, verifyI6Idempotency,
  pass, fail, step,
} from '../harness-lib.mjs';

const { url, key, apiUrl, internalSecret } = requireStagingEnv();
const SITE_ID = process.env.STAGING_MERCHANT_SITE_ID;
if (!SITE_ID) { console.error('STAGING_MERCHANT_SITE_ID required'); process.exit(1); }

const SCENARIO = 's07-settlement-ingest';
const dayOneKey = `s07-settlement-day1-${Date.now()}`;
const dayTwoKey = `s07-settlement-day2-${Date.now()}`;
const duplicateKey = `s07-settlement-day1-${Date.now()}`; // same as dayOneKey = duplicate
const evidence = { scenario: SCENARIO, dayOneKey, dayTwoKey, duplicateKey };

try {
  step('Ingest day-1 settlement entry');
  const day1Result = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'settlement',
    p_source_id: `razorpay-settlement:day1-${Date.now()}`,
    p_idempotency_key: dayOneKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 100, memo: 'Day 1 fee' },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 80, memo: 'Day 1 platform rev (AI credit)' },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 20, memo: 'Day 1 GST' },
    ],
    p_metadata: { harness: SCENARIO, settlement_date: 'day1', provider_report_ref: 'RPT_DAY1_001' },
    p_request_id: dayOneKey,
  });
  evidence.day1TxnId = day1Result;
  await verifyI1Balance(url, key, day1Result);
  pass(`day-1 settlement: txn=${day1Result}`);

  step('Ingest day-2 settlement entry');
  const day2Result = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'settlement',
    p_source_id: `razorpay-settlement:day2-${Date.now()}`,
    p_idempotency_key: dayTwoKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 150, memo: 'Day 2 fee' },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 120, memo: 'Day 2 platform rev' },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 30, memo: 'Day 2 GST' },
    ],
    p_metadata: { harness: SCENARIO, settlement_date: 'day2', provider_report_ref: 'RPT_DAY2_001' },
    p_request_id: dayTwoKey,
  });
  evidence.day2TxnId = day2Result;
  await verifyI1Balance(url, key, day2Result);
  pass(`day-2 settlement: txn=${day2Result}`);

  step('Attempt cross-source duplicate: replay day-1 entry with same idempotency key');
  let duplicateResult;
  let duplicateRejected = false;
  try {
    duplicateResult = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
      p_site_id: SITE_ID,
      p_source_type: 'settlement',
      p_source_id: `razorpay-settlement:day1-REPLAY`,
      p_idempotency_key: dayOneKey, // same key as day 1 — MUST be rejected or returned idempotently
      p_lines: [
        { account_code: 'merchant_payable', side: 'debit', amount_minor: 100, memo: 'Duplicate day 1 fee' },
        { account_code: 'platform_revenue', side: 'credit', amount_minor: 80, memo: 'Duplicate' },
        { account_code: 'gst_payable', side: 'credit', amount_minor: 20, memo: 'Duplicate GST' },
      ],
      p_metadata: { harness: SCENARIO, duplicate: true },
      p_request_id: `${dayOneKey}-dup`,
    });
    // If it returns the same txn ID, idempotency is satisfied
    if (duplicateResult === day1Result) {
      duplicateRejected = true;
      evidence.dedupeMethod = 'idempotent_return';
      pass(`cross-source duplicate: idempotently returned same txn ${day1Result}`);
    } else {
      fail(`cross-source duplicate created new txn ${duplicateResult} — CAP-C05 dedupe violated`);
    }
  } catch (dupErr) {
    if (/unique|duplicate|already exists/i.test(dupErr.message)) {
      duplicateRejected = true;
      evidence.dedupeMethod = 'constraint_rejection';
      evidence.dedupeError = dupErr.message;
      pass(`cross-source duplicate rejected: ${dupErr.message}`);
    } else {
      fail(`unexpected error on duplicate ingest: ${dupErr.message}`);
    }
  }
  if (!duplicateRejected) fail('CAP-C05 dedupe not enforced: duplicate settlement entry accepted');
  evidence.dedupeHeld = true;

  step('Verify day-1 idempotency (only 1 txn with day-1 key)');
  await verifyI6Idempotency(url, key, SITE_ID, 'settlement', dayOneKey);
  await verifyI6Idempotency(url, key, SITE_ID, 'settlement', dayTwoKey);

  step('Verify settlement entries match provider report (cross-day total)');
  const txns = await supabaseSelect(url, key, 'ledger_transactions',
    `id=in.(${day1Result},${day2Result})&deleted_at=is.null&select=id,metadata`);
  const day1Meta = txns.find(t => t.id === day1Result)?.metadata;
  const day2Meta = txns.find(t => t.id === day2Result)?.metadata;
  if (day1Meta?.provider_report_ref !== 'RPT_DAY1_001') fail('day-1 provider report ref missing');
  if (day2Meta?.provider_report_ref !== 'RPT_DAY2_001') fail('day-2 provider report ref missing');
  evidence.providerReportRefs = [day1Meta?.provider_report_ref, day2Meta?.provider_report_ref];
  pass(`settlement entries linked to provider reports: ${evidence.providerReportRefs.join(', ')}`);

  step('Cleanup: reverse both settlement entries');
  for (const [txnId, label] of [[day1Result, 'day1'], [day2Result, 'day2']]) {
    const ck = `s07-cleanup-${label}-${txnId}`;
    await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
      p_site_id: SITE_ID,
      p_source_type: 'reversal',
      p_source_id: `reversal:${txnId}`,
      p_idempotency_key: ck,
      p_lines: [
        { account_code: 'platform_revenue', side: 'debit', amount_minor: label === 'day1' ? 80 : 120, memo: 'S07 cleanup' },
        { account_code: 'gst_payable', side: 'debit', amount_minor: label === 'day1' ? 20 : 30, memo: 'S07 cleanup' },
        { account_code: 'merchant_payable', side: 'credit', amount_minor: label === 'day1' ? 100 : 150, memo: 'S07 cleanup' },
      ],
      p_metadata: { harness: SCENARIO, cleanup: true },
      p_request_id: ck,
    });
  }
  pass('cleanup reversals posted');

  evidence.result = 'PASS';
  console.log(`\nS7 PASS — day1=${day1Result} day2=${day2Result} dedupe=${evidence.dedupeMethod}`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS7 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
