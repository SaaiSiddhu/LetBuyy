import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const payoutsSource = readFileSync(new URL('../routes/payouts.ts', import.meta.url), 'utf8');
const walletSource = readFileSync(new URL('../routes/wallet.ts', import.meta.url), 'utf8');
const commissionSource = readFileSync(new URL('../routes/commission.ts', import.meta.url), 'utf8');
const codSource = readFileSync(new URL('../routes/cod-reconciliation.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/119_mobile_money_ledgers.sql', import.meta.url), 'utf8');
const codMigrationSource = readFileSync(new URL('../../../../database/supabase/migrations/140_mobile_cod_reconciliation.sql', import.meta.url), 'utf8');
const foundationLedgerMigrationSource = readFileSync(new URL('../../../../database/supabase/migrations/139_executable_foundation_ledger_core.sql', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../../../../packages/infrastructure/payout-transfer-adapter/index.ts', import.meta.url), 'utf8');

test('merchant money routes are mounted and mobile allowlisted', () => {
    assert.match(indexSource, /import payoutsRouter from '\.\/routes\/payouts'/);
    assert.match(indexSource, /import walletRouter from '\.\/routes\/wallet'/);
    assert.match(indexSource, /import commissionRouter from '\.\/routes\/commission'/);
    assert.match(indexSource, /import codReconciliationRouter from '\.\/routes\/cod-reconciliation'/);
    assert.match(indexSource, /api\.route\('\/payouts', payoutsRouter\)/);
    assert.match(indexSource, /api\.route\('\/wallet', walletRouter\)/);
    assert.match(indexSource, /api\.route\('\/commission', commissionRouter\)/);
    assert.match(indexSource, /api\.route\('\/cod', codReconciliationRouter\)/);
    assert.match(bffSource, /'\/v1\/payouts'/);
    assert.match(bffSource, /'\/v1\/wallet'/);
    assert.match(bffSource, /'\/v1\/commission'/);
    assert.match(bffSource, /'\/v1\/cod'/);
});

test('payout route creates tenant-scoped statements and settles through the adapter', () => {
    assert.match(payoutsSource, /router\.get\('\/'/);
    assert.match(payoutsSource, /router\.get\('\/summary'/);
    assert.match(payoutsSource, /router\.post\('\/'/);
    assert.match(payoutsSource, /router\.post\('\/:id\/settle'/);
    assert.match(payoutsSource, /resolveTenantContextForOwnedSite\(c,\s*body\.store_id\)/);
    assert.match(payoutsSource, /\.from\('orders'\)[\s\S]*\.eq\('payment_status',\s*'paid'\)/);
    assert.match(payoutsSource, /\.from\('payout_statements'\)[\s\S]*\.insert/);
    assert.match(payoutsSource, /\.from\('wallet_ledger_entries'\)[\s\S]*\.insert/);
    assert.match(payoutsSource, /createPayoutTransferAdapter/);
    assert.doesNotMatch(payoutsSource, /S-018|backend contract|SKIP-NEEDS-BACKEND/);
});

test('wallet and commission routes are tenant scoped and backed by real ledger rows', () => {
    assert.match(walletSource, /resolveTenantContextForOwnedSite\(c,\s*query\.store_id\)/);
    assert.match(walletSource, /\.from\('wallet_ledger_entries'\)/);
    assert.match(walletSource, /available_minor/);
    assert.match(commissionSource, /resolveTenantContextForOwnedSite\(c,\s*query\.store_id\)/);
    assert.match(commissionSource, /router\.post\('\/reconcile'/);
    assert.match(commissionSource, /\.from\('orders'\)[\s\S]*\.eq\('payment_status',\s*'paid'\)/);
    assert.match(commissionSource, /\.from\('commission_reconciliation_entries'\)[\s\S]*\.insert/);
});

test('COD reconciliation route backfills COD orders and posts remittances to wallet', () => {
    assert.match(codSource, /router\.get\('\/reconciliation'/);
    assert.match(codSource, /router\.post\('\/reconciliation'/);
    assert.match(codSource, /router\.post\('\/reconciliation\/:id\/reconcile'/);
    assert.match(codSource, /resolveTenantContextForOwnedSite\(c,\s*query\.store_id\)/);
    assert.match(codSource, /\.from\('orders'\)[\s\S]*\.eq\('payment_method',\s*'cod'\)/);
    assert.match(codSource, /\.from\('cod_reconciliation_entries'\)[\s\S]*\.insert/);
    assert.match(codSource, /\.from\('wallet_ledger_entries'\)[\s\S]*\.insert/);
    assert.match(codSource, /entry_type: 'cod_remittance_credit'/);
    assert.doesNotMatch(codSource, /S-0\d\d|backend contract|coming soon/);
});

test('money migration declares tenant RLS and approved updated_at triggers', () => {
    for (const table of [
        'payout_statements',
        'wallet_ledger_entries',
        'commission_schedules',
        'commission_reconciliation_entries',
    ]) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`CREATE POLICY ${table}_[a-z_]+ ON public\\.${table}[\\s\\S]*FOR ALL TO service_role`));
        assert.match(migrationSource, new RegExp(`CREATE POLICY ${table}_[a-z_]+ ON public\\.${table}[\\s\\S]*FOR ALL TO authenticated`));
        assert.match(migrationSource, new RegExp(`update_${table}_updated_at[\\s\\S]*EXECUTE FUNCTION public\\.update_updated_at\\(\\)`));
    }
});

test('COD reconciliation migration declares tenant RLS, triggers, and wallet remittance type', () => {
    assert.match(codMigrationSource, /CREATE TABLE IF NOT EXISTS public\.cod_reconciliation_entries/);
    assert.match(codMigrationSource, /ALTER TABLE public\.cod_reconciliation_entries ENABLE ROW LEVEL SECURITY/);
    assert.match(codMigrationSource, /CREATE POLICY cod_reconciliation_entries_service_all ON public\.cod_reconciliation_entries[\s\S]*FOR ALL TO service_role/);
    assert.match(codMigrationSource, /CREATE POLICY cod_reconciliation_entries_site_owner_all ON public\.cod_reconciliation_entries[\s\S]*FOR ALL TO authenticated/);
    assert.match(codMigrationSource, /update_cod_reconciliation_entries_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.match(codMigrationSource, /cod_remittance_credit/);
    assert.match(codMigrationSource, /idx_cod_reconciliation_site_order/);
});

test('payout transfer adapter is sandbox-first and credential-gated for live rails', () => {
    assert.match(adapterSource, /export function createPayoutTransferAdapter/);
    assert.match(adapterSource, /mode === 'sandbox'/);
    assert.match(adapterSource, /status: 'released'/);
    assert.match(adapterSource, /live payout mode requires provider credentials/);
});

test('executable foundation ledger migration is append-only, balanced, tenant-GUC scoped, and settlement-owned', () => {
    for (const table of [
        'ledger_accounts',
        'ledger_transactions',
        'ledger_entries',
        'outbox_consumptions',
        'compensation_actions',
    ]) {
        assert.match(foundationLedgerMigrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(foundationLedgerMigrationSource, new RegExp(`ALTER TABLE public\\.%I ENABLE ROW LEVEL SECURITY`));
        assert.match(foundationLedgerMigrationSource, /FORCE ROW LEVEL SECURITY/);
    }

    assert.match(foundationLedgerMigrationSource, /CREATE OR REPLACE FUNCTION public\.current_site_id/);
    assert.match(foundationLedgerMigrationSource, /site_id = public\.current_site_id\(\)/);
    assert.match(foundationLedgerMigrationSource, /CREATE OR REPLACE FUNCTION public\.post_ledger_transaction/);
    assert.match(foundationLedgerMigrationSource, /writer_module text NOT NULL DEFAULT 'settlement' CHECK \(writer_module = 'settlement'\)/);
    assert.match(foundationLedgerMigrationSource, /CREATE CONSTRAINT TRIGGER ledger_entries_balance_enforced/);
    assert.match(foundationLedgerMigrationSource, /RAISE EXCEPTION 'ledger is append-only; use reversing entries'/);
    for (const account of [
        'pa_clearing',
        'merchant_payable',
        'platform_revenue',
        'gst_payable',
        'cod_receivable',
        'reserve',
        'vendor_payable',
        'refund_clearing',
    ]) {
        assert.match(foundationLedgerMigrationSource, new RegExp(account));
    }
});
