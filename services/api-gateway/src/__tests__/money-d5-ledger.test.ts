import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    buildPaymentCaptureLedgerPosting,
    buildPaymentRefundLedgerPosting,
    signedLedgerAmountMinor,
} from '@letbuyy/payments';
import {
    planPayoutReleaseLedgerPosting,
    planSettlementLedgerPosting,
    type SettlementLedgerLine,
} from '@letbuyy/billing-core';

const d5Migration = readFileSync(
    new URL('../../../../database/supabase/migrations/165_d5_canonical_money_paths.sql', import.meta.url),
    'utf8',
);
const d5Rollback = readFileSync(
    new URL('../../../../database/supabase/rollback/165_d5_canonical_money_paths.rollback.sql', import.meta.url),
    'utf8',
);
const canonicalLedgerValidator = readFileSync(
    new URL('../../../../scripts/validators/canonical-ledger-only-validator.mjs', import.meta.url),
    'utf8',
);
const paymentRouteSupport = readFileSync(new URL('../lib/payment-route-support.ts', import.meta.url), 'utf8');
const codRoute = readFileSync(new URL('../routes/cod-reconciliation.ts', import.meta.url), 'utf8');

function settlementSignedAmountMinor(line: SettlementLedgerLine): bigint {
    return BigInt(line.amount_minor) * (line.side === 'debit' ? 1n : -1n);
}

test('D5 money builders produce balanced canonical ledger postings', () => {
    const capture = buildPaymentCaptureLedgerPosting({
        siteId: '11111111-1111-4111-8111-111111111111',
        orderId: '22222222-2222-4222-8222-222222222222',
        providerPaymentId: 'pay_capture_001',
        grossAmountMinor: 10_000,
        platformFeeMinor: 0,
        gstMinor: 0,
        idempotencyKey: 'capture-ledger-001',
    });
    assert.equal(capture.lines.reduce((sum, line) => sum + signedLedgerAmountMinor(line), 0n), 0n);
    assert.deepEqual(
        capture.lines.map((line) => [line.accountCode, line.side, line.amountMinor]),
        [
            ['pa_clearing', 'debit', 10_000],
            ['merchant_payable', 'credit', 10_000],
        ],
    );

    const refund = buildPaymentRefundLedgerPosting({
        siteId: capture.siteId,
        paymentId: 'pay_001',
        providerRefundId: 'rfnd_001',
        refundAmountMinor: 2_500,
        idempotencyKey: 'refund-ledger-001',
    });
    assert.equal(refund.lines.reduce((sum, line) => sum + signedLedgerAmountMinor(line), 0n), 0n);
    assert.deepEqual(
        refund.lines.map((line) => [line.accountCode, line.side, line.amountMinor]),
        [
            ['merchant_payable', 'debit', 2_500],
            ['refund_clearing', 'credit', 2_500],
        ],
    );

    const paSettlement = planSettlementLedgerPosting({
        store_id: capture.siteId,
        settlement_reference: 'setl_d5_001',
        idempotency_key: 'setl-d5-001',
        rail: 'pa_split',
        provider: 'razorpay_route',
        provider_mode: 'sandbox',
        currency: 'INR',
        gross_amount_minor: 10_000,
        platform_fee_minor: 0,
        gst_minor: 0,
        net_amount_minor: 10_000,
        reserve_minor: 0,
        metadata: {},
    });
    assert.equal(paSettlement.lines.reduce((sum, line) => sum + settlementSignedAmountMinor(line), 0n), 0n);
    assert.equal(paSettlement.source_type, 'settlement');
    assert.equal(paSettlement.lines[0]?.account_code, 'pa_clearing');

    const codSettlement = planSettlementLedgerPosting({
        store_id: capture.siteId,
        settlement_reference: 'cod_d5_001',
        idempotency_key: 'cod-d5-001',
        rail: 'cod_remittance',
        provider: 'cod',
        provider_mode: 'sandbox',
        currency: 'INR',
        gross_amount_minor: 5_000,
        platform_fee_minor: 0,
        gst_minor: 0,
        net_amount_minor: 5_000,
        reserve_minor: 0,
        metadata: {},
    });
    assert.equal(codSettlement.lines.reduce((sum, line) => sum + settlementSignedAmountMinor(line), 0n), 0n);
    assert.equal(codSettlement.source_type, 'cod_remittance');
    assert.equal(codSettlement.lines[0]?.account_code, 'cod_receivable');

    const payoutRelease = planPayoutReleaseLedgerPosting({ payoutReference: 'payout_d5_001', amountMinor: 5_000 });
    assert.equal(payoutRelease.reduce((sum, line) => sum + settlementSignedAmountMinor(line), 0n), 0n);
});

test('D5 canonical writer derives tenant ownership from source rows', () => {
    assert.match(d5Migration, /CREATE OR REPLACE FUNCTION public\.resolve_money_ledger_source_site_id/);
    assert.match(d5Migration, /FROM public\.payments/);
    assert.match(d5Migration, /FROM public\.refunds/);
    assert.match(d5Migration, /FROM public\.settlements/);
    assert.match(d5Migration, /FROM public\.payout_statements/);
    assert.match(d5Migration, /FROM public\.commission_reconciliation_entries/);
    assert.match(d5Migration, /FROM public\.cod_reconciliation_entries/);
    assert.match(d5Migration, /v_source_site_id := public\.resolve_money_ledger_source_site_id/);
    assert.match(d5Migration, /p_site_id IS NULL OR p_site_id <> v_source_site_id/);
    assert.match(d5Migration, /PERFORM set_config\('app\.site_id', v_source_site_id::text, true\)/);
    assert.doesNotMatch(d5Migration, /PERFORM set_config\('app\.site_id', p_site_id::text, true\)/);
});

test('D5 COD remittance is ledger-first with compatibility-only wallet rows', () => {
    assert.match(codRoute, /reconcile_cod_remittance_with_ledger/);
    assert.doesNotMatch(codRoute, /\.from\('wallet_ledger_entries'\)[\s\S]*\.insert/);
    assert.match(d5Migration, /expected_amount_minor_bigint bigint/);
    assert.match(d5Migration, /collected_amount_minor_bigint bigint/);
    assert.match(d5Migration, /deposited_amount_minor_bigint bigint/);
    assert.match(d5Migration, /difference_amount_minor_bigint bigint/);
    assert.match(d5Migration, /sync_cod_reconciliation_money_bigint/);
    assert.match(d5Migration, /CREATE OR REPLACE FUNCTION public\.reconcile_cod_remittance_with_ledger/);
    assert.match(d5Migration, /public\.post_settlement_ledger_transaction\(/);
    assert.match(d5Migration, /'cod_receivable'[\s\S]*'debit'/);
    assert.match(d5Migration, /'merchant_payable'[\s\S]*'credit'/);
    assert.match(d5Migration, /canonical_ledger_transaction_id = v_ledger_transaction_id/);
    assert.match(d5Migration, /INSERT INTO public\.wallet_ledger_entries[\s\S]*'compatibility_only'[\s\S]*true/);
    assert.match(d5Migration, /WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL/);
});

test('D5 ratchets capture refund COD and wallet surfaces out of legacy allowance', () => {
    assert.match(paymentRouteSupport, /post_settlement_ledger_transaction/);
    assert.doesNotMatch(canonicalLedgerValidator, /"services\/api-gateway\/src\/routes\/payments\.ts"/);
    assert.doesNotMatch(canonicalLedgerValidator, /"services\/api-gateway\/src\/routes\/cod-reconciliation\.ts"/);
    assert.doesNotMatch(canonicalLedgerValidator, /"services\/api-gateway\/src\/routes\/wallet\.ts"/);
    assert.match(canonicalLedgerValidator, /"cod_reconciliation_entries"/);
    assert.match(d5Migration, /REVOKE UPDATE, DELETE ON public\.ledger_transactions/);
    assert.match(d5Migration, /REVOKE UPDATE, DELETE ON public\.ledger_entries/);
});

test('D5 rollback restores prior callable surface explicitly', () => {
    assert.match(d5Rollback, /DROP FUNCTION IF EXISTS public\.reconcile_cod_remittance_with_ledger/);
    assert.match(d5Rollback, /CREATE OR REPLACE FUNCTION public\.post_settlement_ledger_transaction/);
    assert.match(d5Rollback, /PERFORM set_config\('app\.site_id', p_site_id::text, true\)/);
    assert.match(d5Rollback, /DROP FUNCTION IF EXISTS public\.resolve_money_ledger_source_site_id/);
    assert.match(d5Rollback, /DROP FUNCTION IF EXISTS public\.sync_cod_reconciliation_money_bigint/);
    assert.match(d5Rollback, /DROP COLUMN IF EXISTS canonical_ledger_transaction_id/);
    assert.match(d5Rollback, /DROP COLUMN IF EXISTS deposited_amount_minor_bigint/);
});
