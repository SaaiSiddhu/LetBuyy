import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('Task 013 settlements are monolith routes backed by billing-core and the F6 ledger RPC', () => {
    const indexSource = source('index.ts');
    const settlementRoute = source('routes/settlements.ts');
    const billingCore = repositorySource('packages/billing-core/src/index.ts');
    const migration = repositorySource('database/supabase/migrations/151_executable_settlement_ledger.sql');
    const rollback = repositorySource('database/supabase/rollback/151_executable_settlement_ledger.rollback.sql');

    assert.match(indexSource, /import settlementsRouter from '\.\/routes\/settlements'/);
    assert.match(indexSource, /api\.route\('\/settlements', settlementsRouter\)/);
    assert.match(settlementRoute, /router\.post\('\/ingest'/);
    assert.match(settlementRoute, /router\.get\('\/:site'/);
    assert.match(settlementRoute, /SettlementIngestSchema/);
    assert.match(settlementRoute, /planSettlementLedgerPosting/);
    assert.match(settlementRoute, /post_settlement_ledger_transaction/);
    assert.match(settlementRoute, /settlement\.recorded/);
    assert.match(settlementRoute, /settlement\.recon\.break_detected/);
    assert.match(settlementRoute, /payout\.scheduled/);
    assert.match(settlementRoute, /no_custody:\s*true/);

    assert.match(billingCore, /export const SettlementIngestSchema/);
    assert.match(billingCore, /export function planSettlementLedgerPosting/);
    assert.match(billingCore, /cod_receivable/);
    assert.match(billingCore, /reserve/);
    assert.match(billingCore, /export function planPayoutReleaseLedgerPosting/);

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.settlements/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.reserves/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payouts/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payout_items/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.recon_breaks/);
    assert.match(migration, /post_settlement_ledger_transaction/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /site_id = public\.current_site_id\(\)/);
    assert.match(migration, /canonical_ledger_transaction_id/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.settlements/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.post_settlement_ledger_transaction/);
});

test('Task 013 reconciles mobile money compatibility tables to canonical ledger', () => {
    const payoutsRoute = source('routes/payouts.ts');
    const walletRoute = source('routes/wallet.ts');
    const commissionRoute = source('routes/commission.ts');

    assert.match(payoutsRoute, /postCanonicalPayoutLedger/);
    assert.match(payoutsRoute, /payout-fee-assessment:\$\{statement\.id\}/);
    assert.match(payoutsRoute, /payout-release:\$\{claimedStatement\.id\}/);
    assert.match(payoutsRoute, /canonical_ledger_transaction_id/);
    assert.match(payoutsRoute, /release_ledger_transaction_id/);

    assert.match(walletRoute, /loadCanonicalLedgerSummary/);
    assert.match(walletRoute, /ledger_entries/);
    assert.match(walletRoute, /canonical_ledger/);

    assert.match(commissionRoute, /postCommissionLedger/);
    assert.match(commissionRoute, /commission_reconciliation_entries/);
    assert.match(commissionRoute, /canonical_ledger_transaction_id/);
});

test('Task 013 live PA split remains human-gated and no rejected service topology is activated', () => {
    const settlementRoute = source('routes/settlements.ts');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');

    assert.match(settlementRoute, /HR-PA-SPLIT-LIVE/);
    assert.match(settlementRoute, /HumanRequiredError/);
    assert.match(settlementRoute, /SETTLEMENT_PROVIDER_SETUP_REQUIRED/);
    assert.match(humanRequired, /HR-PA-SPLIT-LIVE/);
    assert.match(humanRequired, /services\/api-gateway\/src\/routes\/settlements\.ts/);

    assert.throws(() => repositorySource('services/analytics-pipeline/src/index.ts'), /ENOENT/);
    assert.throws(() => repositorySource('services/event-bus/src/index.ts'), /ENOENT/);
    assert.throws(() => repositorySource('services/checkout-runtime/src/index.ts'), /ENOENT/);
});
