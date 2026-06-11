import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const internalConsoleSource = readFileSync(new URL('../routes/internal-console.ts', import.meta.url), 'utf8');
const internalConsoleMoneySource = readFileSync(
    new URL('../routes/internal-console/money-reconciliation.ts', import.meta.url),
    'utf8',
);
const consoleLayoutSource = readFileSync(
    new URL('../../../../apps/platform-console/src/app/(dashboard)/layout.tsx', import.meta.url),
    'utf8',
);
const consolePageSource = readFileSync(
    new URL('../../../../apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx', import.meta.url),
    'utf8',
);
const canonicalLedgerValidator = readFileSync(
    new URL('../../../../scripts/validators/canonical-ledger-only-validator.mjs', import.meta.url),
    'utf8',
);
const commissionValidator = readFileSync(
    new URL('../../../../scripts/validators/commission-bps-zero-validator.mjs', import.meta.url),
    'utf8',
);
const giftCardCheckoutMigration = readFileSync(
    new URL('../../../../database/supabase/migrations/073_order_item_required_field_compatibility.sql', import.meta.url),
    'utf8',
);

test('B4 exposes an audited platform-console break-resolution queue for money ledger mismatches', () => {
    assert.match(internalConsoleSource, /router\.route\('\/money', internalConsoleMoneyRouter\)/);
    assert.match(internalConsoleMoneySource, /router\.get\('\/reconciliation'/);
    assert.match(internalConsoleMoneySource, /money_ledger_site_reconciliations/);
    assert.match(internalConsoleMoneySource, /validateSensitiveReason\(query\.reason\)/);
    assert.match(internalConsoleMoneySource, /REASON_REQUIRED/);
    assert.match(internalConsoleMoneySource, /money_ledger\.breaks\.read/);
    assert.match(internalConsoleMoneySource, /money_ledger\.reconciliation\.read/);
    assert.match(internalConsoleMoneySource, /router\.post\('\/reconciliation\/:siteId\/resolve'/);
    assert.match(internalConsoleMoneySource, /checkSegregationOfDuty/);
    assert.match(internalConsoleMoneySource, /targetAction:\s*'money\.reconciliation\.resolve'/);
    assert.match(internalConsoleMoneySource, /operator_resolution/);
    assert.match(internalConsoleMoneySource, /money_ledger\.breaks\.resolve/);
    assert.match(internalConsoleMoneySource, /refresh_money_ledger_site_reconciliation/);
    assert.match(consoleLayoutSource, /href:\s*'\/money-reconciliation'/);
    assert.match(consolePageSource, /\/internal\/console\/money\/reconciliation/);
    assert.match(consolePageSource, /Break Resolution Queue/);
    assert.match(consolePageSource, /resolveMoneyBreak/);
    assert.match(consolePageSource, /secondary_approver_id/);
    assert.match(consolePageSource, /variance-0 row/);
});

test('B3 makes partner payout ledger boundary explicit instead of a silent validator exemption', () => {
    assert.match(canonicalLedgerValidator, /SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY/);
    assert.match(canonicalLedgerValidator, /partnerPayoutBoundaryFiles/);
    const legacyBlock = canonicalLedgerValidator
        .split('const legacyAllowedUntilD5 = new Set([')[1]
        ?.split(']);')[0] || '';
    assert.doesNotMatch(legacyBlock, /partner_payout|queue-execution|platform-queue-consumer/);
});

test('B5 commission validator scans migrations and catches arbitrary non-zero commission defaults', () => {
    assert.doesNotMatch(commissionValidator, /file === "database\/supabase\/migrations\/162_phase_a_commission_zero\.sql"/);
    assert.match(commissionValidator, /SET\\s\+DEFAULT\\s\+\(\?!0\\b\)/);
    assert.match(commissionValidator, /commission_bps\\b\[\^;\\n\]\{0,120\}\\bDEFAULT/);
});

test('B5 gift card redemption uses ledger projection instead of mutating account balance', () => {
    assert.match(giftCardCheckoutMigration, /v_gift_card_balance/);
    assert.match(giftCardCheckoutMigration, /FROM gift_card_ledger_entries/);
    assert.match(giftCardCheckoutMigration, /balance_after/);
    assert.doesNotMatch(giftCardCheckoutMigration, /UPDATE gift_card_accounts[\s\S]{0,160}SET balance = balance - v_gift_card_amount/);
    assert.match(canonicalLedgerValidator, /assertLatestFunctionExcludes\("create_checkout_order"/);
});
