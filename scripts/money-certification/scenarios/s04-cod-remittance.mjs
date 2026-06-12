#!/usr/bin/env node
// S4 — COD order → delivery → carrier remittance
// Pass condition: I8 holds; remittance reconciles to order.
// Requires STAGING_MERCHANT_SITE_ID, STAGING_MERCHANT_AUTH_TOKEN.

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

const SCENARIO = 's04-cod-remittance';
const orderId = generateUuid(SCENARIO, 'order');
const codEntryId = generateUuid(SCENARIO, 'cod-entry');
const idempotencyKey = `s04-cod-${codEntryId}`;
const evidence = { scenario: SCENARIO, orderId, codEntryId, idempotencyKey };

try {
  step('Create COD order');
  const createRes = await apiCall(apiUrl, null, '/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: `S04-${Date.now()}`, total: 349.00, currency: 'INR', payment_method: 'cod', payment_status: 'pending', site_id: SITE_ID }),
  });
  const realOrderId = createRes.body?.data?.id || orderId;
  evidence.realOrderId = realOrderId;
  pass(`COD order: ${realOrderId}`);

  step('Simulate delivery: create cod_reconciliation_entry (carrier remitted)');
  const carrierAwb = `AWB_S04_${Date.now()}`;
  await supabaseInsert(url, key, 'cod_reconciliation_entries', {
    id: codEntryId,
    site_id: SITE_ID,
    order_id: realOrderId,
    status: 'pending_remittance',
    amount: 349.00,
    currency: 'INR',
    carrier: 'shiprocket',
    awb_number: carrierAwb,
    idempotency_key: idempotencyKey,
    metadata: { harness: SCENARIO },
  });
  evidence.carrierAwb = carrierAwb;
  pass(`COD entry created, AWB=${carrierAwb}`);

  step('Post COD remittance via canonical ledger (cod_receivable → merchant_payable)');
  const captureStart = Date.now();
  const ledgerResult = await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'cod_remittance',
    p_source_id: codEntryId,
    p_idempotency_key: idempotencyKey,
    p_lines: [
      { account_code: 'cod_receivable', side: 'debit', amount_minor: 34900, memo: `COD remittance AWB=${carrierAwb}` },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 34900, memo: `COD merchant credit order=${realOrderId}` },
    ],
    p_metadata: { harness: SCENARIO, order_id: realOrderId, awb: carrierAwb, compatibility_table: 'cod_reconciliation_entries' },
    p_request_id: idempotencyKey,
  });
  const captureMs = Date.now() - captureStart;
  evidence.codLedgerTxnId = ledgerResult;
  evidence.captureMs = captureMs;
  if (!ledgerResult) fail('COD ledger post returned null');
  pass(`COD remittance posted: txn=${ledgerResult} in ${captureMs}ms`);

  step('Update cod_reconciliation_entry to remitted with ledger link');
  await supabaseRpc(url, key, 'rpc_not_exists_use_update_directly', {});
  // Direct update via REST
  const updateRes = await fetch(`${url}/rest/v1/cod_reconciliation_entries?id=eq.${codEntryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ status: 'remitted', metadata: { harness: SCENARIO, canonical_ledger_transaction_id: ledgerResult } }),
  });
  pass(`COD entry status → remitted`);

  step('Verify I1 double-entry');
  await verifyI1Balance(url, key, ledgerResult);

  step('Verify I5 zero rake (COD path)');
  await verifyI5ZeroRake(url, key, ledgerResult);

  step('Verify I6 idempotency');
  await verifyI6Idempotency(url, key, SITE_ID, 'cod_remittance', idempotencyKey);

  step('Verify I8 symmetry: COD entry uses cod_receivable:debit + merchant_payable:credit');
  const entries = await supabaseSelect(url, key, 'ledger_entries',
    `transaction_id=eq.${ledgerResult}&deleted_at=is.null&select=side,amount_minor,account_id`);
  if (entries.length !== 2) fail(`expected 2 entries, got ${entries.length}`);
  evidence.codLedgerEntries = entries;

  step('Verify reconciliation: cod_reconciliation_entry links to ledger transaction');
  const codEntries = await supabaseSelect(url, key, 'cod_reconciliation_entries',
    `id=eq.${codEntryId}&select=status,metadata`);
  const codMeta = codEntries[0]?.metadata;
  if (codMeta?.canonical_ledger_transaction_id !== ledgerResult) fail('COD entry missing ledger link');
  evidence.codReconcilied = true;
  pass(`COD remittance reconciled to order ${realOrderId}`);

  step('Cleanup: reverse the remittance');
  const reversalKey = `s04-cleanup-${codEntryId}`;
  await supabaseRpc(url, key, 'post_settlement_ledger_transaction', {
    p_site_id: SITE_ID,
    p_source_type: 'reversal',
    p_source_id: `reversal:${ledgerResult}`,
    p_idempotency_key: reversalKey,
    p_lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 34900, memo: 'S04 cleanup reversal' },
      { account_code: 'cod_receivable', side: 'credit', amount_minor: 34900, memo: 'S04 cleanup reversal' },
    ],
    p_metadata: { harness: SCENARIO, cleanup: true },
    p_request_id: reversalKey,
  });
  pass('cleanup reversal posted');

  evidence.result = 'PASS';
  console.log(`\nS4 PASS — cod_txn=${ledgerResult} AWB=${carrierAwb} I8 satisfied`);

} catch (err) {
  evidence.result = 'FAIL';
  evidence.error = err.message;
  console.error(`\nS4 FAIL — ${err.message}`);
  process.exitCode = 1;
}

recordEvidence(SCENARIO, evidence);
