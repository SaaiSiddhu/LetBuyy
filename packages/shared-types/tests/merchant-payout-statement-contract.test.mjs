import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MerchantPayoutStatusSchema, MerchantPayoutStatementSchema } from '../src/index.ts';
import { PAYOUT_STATUS_VALUES, PAYOUT_STATUS_PRESENTATION, MERCHANT_PAYOUT_STATUS_PRESENTATION } from '../src/status-presentation.ts';

const migrations = new URL('../../../database/supabase/migrations/', import.meta.url);
function checkValues(file, constraint) {
    const sql = readFileSync(new URL(file, migrations), 'utf8');
    const body = sql.slice(sql.indexOf(`CONSTRAINT ${constraint}`));
    const check = body.slice(0, body.indexOf('\n', body.indexOf('CHECK')));
    return [...check.matchAll(/'([a-z_]+)'(?:::text)?/g)].map(match => match[1]);
}

const statement = {
    id: '11111111-1111-4111-8111-111111111111',
    site_id: '22222222-2222-4222-8222-222222222222',
    statement_number: 'PYT-SYNTHETIC-1', status: 'pending',
    provider: 'razorpay_route', provider_mode: 'sandbox', rail: 'razorpay_route', currency: 'INR',
    gross_amount_minor: 10000, platform_fee_minor: 0, tax_minor: 0, net_amount_minor: 10000,
    created_at: '2026-10-16T10:00:00.000Z', updated_at: '2026-10-16T10:00:00.000Z',
};

test('merchant statement Zod vocabulary matches its own database CHECK and pending writer', () => {
    const statuses = checkValues('119_mobile_money_ledgers.sql', 'payout_statements_status_check');
    assert.deepEqual(statuses, ['pending', 'processing', 'released', 'failed']);
    assert.deepEqual(MerchantPayoutStatusSchema.options, statuses);
    for (const status of statuses) {
        assert.equal(MerchantPayoutStatementSchema.parse({ ...statement, status }).status, status);
    }
    const creation = readFileSync(new URL('295_atomic_payout_statement_creation.sql', migrations), 'utf8');
    assert.match(creation, /p_site_id, p_statement_number, 'pending'/);
});

test('provider payouts retain their separate CHECK vocabulary; foreign states never parse as merchant statements', () => {
    const statuses = checkValues('151_executable_settlement_ledger.sql', 'payouts_status_check');
    assert.deepEqual(statuses, ['scheduled', 'processing', 'paid', 'failed', 'cancelled']);
    assert.deepEqual([...PAYOUT_STATUS_VALUES], statuses);
    assert.deepEqual(Object.keys(PAYOUT_STATUS_PRESENTATION), statuses);
    for (const status of ['scheduled', 'paid', 'cancelled', 'unpaid', '', null]) {
        assert.equal(MerchantPayoutStatusSchema.safeParse(status).success, false, String(status));
        assert.equal(MerchantPayoutStatementSchema.safeParse({ ...statement, status }).success, false, String(status));
    }
});

test('canonical PostgREST timestamp offsets remain readable on merchant statements', () => {
    const row = {
        ...statement, status: 'released',
        created_at: '2026-10-16T10:00:00+00:00', updated_at: '2026-10-16T10:02:00+00:00',
        processing_at: '2026-10-16T10:01:00+00:00', released_at: '2026-10-16T10:02:00+00:00',
        failed_at: null, deleted_at: null,
    };
    assert.deepEqual(MerchantPayoutStatementSchema.parse(row), { ...row, metadata: {} });
    assert.equal(MerchantPayoutStatementSchema.safeParse({ ...row, released_at: 'not-a-timestamp' }).success, false);
});

test('statement status accessibility describes recorded state without inferring provider or bank evidence', () => {
    assert.equal(MERCHANT_PAYOUT_STATUS_PRESENTATION.processing.a11yLabel, 'Release remains unconfirmed');
    assert.equal(MERCHANT_PAYOUT_STATUS_PRESENTATION.released.a11yLabel, 'Release recorded in the statement');
    for (const rail of ['manual', 'razorpay_route']) {
        assert.equal(MerchantPayoutStatementSchema.parse({ ...statement, status: 'released', provider: rail, rail }).status, 'released');
    }
    assert.doesNotMatch(JSON.stringify(MERCHANT_PAYOUT_STATUS_PRESENTATION), /provider|bank|settled|paid/i);
});
