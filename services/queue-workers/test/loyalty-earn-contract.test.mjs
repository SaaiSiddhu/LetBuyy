// F-LOY-2 — where the loyalty accrual runs, and why it is not in the payment RPC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const sweeper = strip(readFileSync(join(root, 'services/queue-workers/src/loyalty-earn.ts'), 'utf8'));
const index = strip(readFileSync(join(root, 'services/queue-workers/src/index.ts'), 'utf8'));
const capture = readFileSync(join(root, 'database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql'), 'utf8');

test('the accrual is SCHEDULED, not dead code', () => {
    assert.match(index, /runLoyaltyEarnSweeper\(env, \{/, 'importing it without calling it would be dead code');
    assert.match(index, /scheduled\.loyalty_earn/);
});

test('loyalty is NOT awarded inside the payment capture RPC', () => {
    // That function runs in one transaction: a raise there would roll back a capture the provider
    // has already settled, and a persistently broken programme would make payments unretryable.
    assert.doesNotMatch(capture, /award_loyalty_points/, 'the capture path must not award points');
});

test('the sweeper awards through the RPC with an ORDER-DERIVED idempotency key', () => {
    assert.match(sweeper, /\.rpc\('award_loyalty_points'/, 'points move only through the SECURITY DEFINER RPC');
    assert.match(sweeper, /p_idempotency_key: `loyalty\.earn:\$\{order\.id\}`/, 'a re-run must award once');
    assert.doesNotMatch(sweeper, /\.from\('loyalty_ledger_entries'\)[\s\S]{0,200}\.insert\(/, 'the ledger must never be written from TypeScript');
});

test('the ledger entry is the marker — the sweeper keeps no cursor', () => {
    // A cursor is state that can be wrong; an existing 'earned' entry cannot be.
    assert.match(sweeper, /\.eq\('entry_type', 'earned'\)/);
    assert.doesNotMatch(sweeper, /cursor|checkpoint|last_processed/i, 'no cursor state');
});

test('the buyer is the order\'s EXPLICIT owner, never an email match (APPID-P3, migration 255)', () => {
    // buyer_order_links is written only by the buyer\'s own authenticated checkout, a verified claim or
    // an operator resolution. The email chain this replaced credited whoever registered an address.
    assert.match(sweeper, /\.from\('buyer_order_links'\)/);
    assert.match(sweeper, /\.eq\('order_id', order\.id\)/, 'ownership is looked up by the order itself');
    assert.doesNotMatch(sweeper, /buyer_store_customers|store_customers|customer_email|ilike/, 'no email or store-customer matching may decide who is credited');
});

test('only PAID orders on ACTIVE programmes are scanned', () => {
    assert.match(sweeper, /\.eq\('payment_status', 'paid'\)/);
    assert.match(sweeper, /\.eq\('is_active', true\)/);
});
