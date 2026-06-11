import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
    new URL('../../../../database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql', import.meta.url),
    'utf8',
);
const rollback = readFileSync(
    new URL('../../../../database/supabase/rollback/168_b1_b2_capture_refund_ledgering.rollback.sql', import.meta.url),
    'utf8',
);
const canonicalLedgerValidator = readFileSync(
    new URL('../../../../scripts/validators/canonical-ledger-only-validator.mjs', import.meta.url),
    'utf8',
);

function latestFunctionBody(source: string, functionName: string): string {
    const pattern = new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${functionName}\\b[\\s\\S]*?AS\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
        'gi',
    );
    const matches = [...source.matchAll(pattern)];
    assert.ok(matches.length > 0, `${functionName} not found`);
    return matches.at(-1)?.[1] || '';
}

test('B1 capture hub posts canonical ledger entries in the payment transaction', () => {
    const body = latestFunctionBody(migration, 'confirm_order_payment_with_ledger');

    assert.match(body, /FOR UPDATE/);
    assert.match(body, /public\.post_settlement_ledger_transaction\(/);
    assert.match(body, /'payment_capture'/);
    assert.match(body, /p_provider \|\| ':' \|\| p_provider_payment_id/);
    assert.match(body, /'pa_clearing'[\s\S]*'debit'[\s\S]*v_amount_minor/);
    assert.match(body, /'merchant_payable'[\s\S]*'credit'[\s\S]*v_amount_minor/);
    assert.match(body, /p_provider \|\| ':' \|\| p_provider_payment_id,\s*v_ledger_idempotency_key/);
    assert.match(body, /'canonical_ledger_transaction_id',\s*v_ledger_transaction_id/);
    assert.match(body, /payment_transaction_id/);
    assert.doesNotMatch(body, /capture_posted_to_ledger:\s*true/);
});

test('B2 refund hub posts reversing canonical entries and blocks over-refunds', () => {
    const body = latestFunctionBody(migration, 'complete_order_refund');

    assert.match(body, /FOR UPDATE/);
    assert.match(body, /refund amount exceeds captured order total/);
    assert.match(body, /id <> p_refund_id/);
    assert.match(body, /public\.post_settlement_ledger_transaction\(/);
    assert.match(body, /'refund'/);
    assert.match(body, /'merchant_payable'[\s\S]*'debit'[\s\S]*v_amount_minor/);
    assert.match(body, /'refund_clearing'[\s\S]*'credit'[\s\S]*v_amount_minor/);
    assert.match(body, /v_refund\.site_id,\s*'refund'/);
    assert.match(body, /'refund:' \|\| p_refund_id::text/);
    assert.match(body, /'refund:' \|\| p_refund_id::text,\s*v_ledger_idempotency_key/);
    assert.match(body, /jsonb_build_object\('canonical_ledger_transaction_id', v_ledger_transaction_id\)/);
    assert.doesNotMatch(body, /IF v_refund\.status = 'succeeded' THEN\s*RETURN/);
});

test('B2 refunded payment failure path records a reversing canonical ledger entry only for refunded failures', () => {
    const body = latestFunctionBody(migration, 'record_order_payment_failure_with_ledger');

    assert.match(body, /IF p_payment_status = 'refunded' AND v_amount_minor > 0 THEN/);
    assert.match(body, /public\.post_settlement_ledger_transaction\(/);
    assert.match(body, /'refund'/);
    assert.match(body, /'payment-failure:' \|\| p_order_id::text/);
    assert.match(body, /'merchant_payable'[\s\S]*'debit'[\s\S]*v_amount_minor/);
    assert.match(body, /'refund_clearing'[\s\S]*'credit'[\s\S]*v_amount_minor/);
    assert.match(body, /'canonical_ledger_transaction_id',\s*v_ledger_transaction_id/);
    assert.match(body, /payment_transaction_id/);
});

test('B1/B2 source resolver can derive site ownership from payment transactions', () => {
    const body = latestFunctionBody(migration, 'resolve_money_ledger_source_site_id');

    assert.match(body, /FROM public\.payment_transactions/);
    assert.match(body, /metadata ->> 'payment_transaction_id'/);
    assert.match(body, /provider_payment_id = COALESCE\(NULLIF\(p_metadata ->> 'provider_payment_id', ''\), p_source_id\)/);
    assert.match(body, /metadata ->> 'compatibility_table'/);
});

test('B1/B2 rollback restores the prior non-ledger callable bodies explicitly', () => {
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.confirm_order_payment_with_ledger/);
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.complete_order_refund/);
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.record_order_payment_failure_with_ledger/);
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.resolve_money_ledger_source_site_id/);
    assert.doesNotMatch(latestFunctionBody(rollback, 'confirm_order_payment_with_ledger'), /post_settlement_ledger_transaction/);
    assert.doesNotMatch(latestFunctionBody(rollback, 'complete_order_refund'), /post_settlement_ledger_transaction/);
    assert.doesNotMatch(latestFunctionBody(rollback, 'record_order_payment_failure_with_ledger'), /post_settlement_ledger_transaction/);
});

test('B1/B2 validator requires latest migration function bodies and scans migrations', () => {
    assert.match(canonicalLedgerValidator, /phaseBEntries\(\["database\/supabase\/migrations"\]/);
    assert.match(canonicalLedgerValidator, /latestMigrationFunction/);
    assert.match(canonicalLedgerValidator, /confirm_order_payment_with_ledger/);
    assert.match(canonicalLedgerValidator, /complete_order_refund/);
    assert.match(canonicalLedgerValidator, /record_order_payment_failure_with_ledger/);
    assert.match(canonicalLedgerValidator, /resolve_money_ledger_source_site_id/);
    assert.match(canonicalLedgerValidator, /call-adjacent canonical ledger evidence/);
});
