import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T12 (CAP-C43): the defect this phase closed (a committed reservation behind an abandoned online payment had no
// automatic release path) can only be proven by actually reserving, committing, sweeping and observing inventory_levels
// change. That real-database proof lives in owned-db/inventory-reservation-lifecycle.test.ts and runs only in the owned
// database lane (`pnpm --filter @letbuyy/api-gateway run test:db`), against a database the runner created for it.
//
// This file is the part of that suite that needs no database: three source-level checks of migrations 211 and 212 and
// of the webhook service's payment.failed release.

const repoRoot = process.cwd();
const migrationSource = readFileSync(
    join(repoRoot, 'database/supabase/migrations/211_expire_unpaid_committed_reservations.sql'),
    'utf8',
);
const releaseFixSource = readFileSync(
    join(repoRoot, 'database/supabase/migrations/212_fix_release_order_inventory_variant_type_mismatch.sql'),
    'utf8',
);

test('migration 211 releases via the existing ledger-aware RPC, excludes COD, and locks safely', () => {
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.expire_unpaid_committed_reservations/);
    assert.match(migrationSource, /o\.payment_method <> 'cod'/);
    assert.match(migrationSource, /o\.payment_status IS DISTINCT FROM 'paid'/);
    assert.match(migrationSource, /o\.inventory_released_at IS NULL/);
    assert.match(migrationSource, /FOR UPDATE OF o SKIP LOCKED/);
    assert.match(migrationSource, /release_order_inventory_with_ledger/);
});

test('migration 212 fixes the release_order_inventory variant_id uuid/text mismatch', () => {
    assert.match(releaseFixSource, /NULLIF\(variant_id, ''\)::uuid AS variant_id/);
    assert.match(releaseFixSource, /NULLIF\(oi\.variant_id, ''\)::uuid/);
});

test('webhook-service releases inventory on an explicit payment.failed signal', () => {
    const indexSource = readFileSync(
        join(repoRoot, 'services/webhook-service/src/index.ts'),
        'utf8',
    );
    const markOrderFailed = indexSource.slice(
        indexSource.indexOf('async function markOrderFailed'),
        indexSource.indexOf('async function markOrderRefunded'),
    );
    assert.match(markOrderFailed, /releaseInventory: Boolean\(order\.inventory_reserved_at && !order\.inventory_released_at\)/);
    assert.doesNotMatch(markOrderFailed, /releaseInventory: false/);
});
