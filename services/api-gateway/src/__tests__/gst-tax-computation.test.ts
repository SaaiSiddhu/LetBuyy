import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T13 (CAP-C45): zero of 26 orders carried tax or a place_of_supply_state before this phase.
// Matching T12's precedent (inventory-reservation-lifecycle.test.ts): every other tax-related
// test in this repo is structural (asserts a migration/route file's SOURCE contains a pattern)
// -- none exercise live GST arithmetic. That is deliberately insufficient here: CGST/SGST vs
// IGST splitting, post-discount taxable value and HSN-specific rate precedence can only be
// proven by actually creating orders and reading orders.tax / order_tax_lines back, against the
// real local Supabase Postgres this repo's dev environment already runs.
//
// Money-table discipline: NEVER `DELETE FROM` orders/order_items/order_tax_lines. Every fixture
// this test creates (tagged T13-AUTOTEST) is left in place, disclosed, accumulating a small
// number of disposable rows on repeated local runs -- the same accepted cost T12 established.
//
// Guarded: skips (not fails) if the local Supabase Postgres container is not reachable.

const repoRoot = process.cwd();
const migration213Source = readFileSync(
    join(repoRoot, 'database/supabase/migrations/213_checkout_order_gst_place_of_supply_and_tax_lines.sql'),
    'utf8',
);
const checkoutRouteSource = readFileSync(
    join(repoRoot, 'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts'),
    'utf8',
);

const CONTAINER = process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
const STORE_ID = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb'; // snaz
const LOCATION_ID = '69db8dab-95c7-43bd-b105-3b9d2c2dbf90'; // snaz default location

function dbAvailable(): boolean {
    try {
        execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', 'SELECT 1'], {
            stdio: 'ignore',
            timeout: 5000,
        });
        return true;
    } catch {
        return false;
    }
}

function psql(sql: string): string {
    return execFileSync(
        'docker',
        ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '|', '-c', sql],
        { encoding: 'utf8', timeout: 15000 },
    ).trim();
}

test('migration 213 threads place_of_supply_state and order_tax_lines through create_checkout_order atomically', () => {
    assert.match(migration213Source, /p_place_of_supply_state text DEFAULT NULL::text/);
    assert.match(migration213Source, /p_tax_lines jsonb DEFAULT NULL::jsonb/);
    assert.match(migration213Source, /place_of_supply_state = COALESCE\(p_place_of_supply_state, place_of_supply_state\)/);
    assert.match(migration213Source, /INSERT INTO order_tax_lines/);
});

test('checkout-payment-routes reads the supplier GST state from sites, not the unwired tax_registrations table', () => {
    assert.match(checkoutRouteSource, /\.from\('sites'\)\s*\n\s*\.select\('gstin, gst_state_code'\)/);
    assert.doesNotMatch(checkoutRouteSource, /\.from\('tax_registrations'\)/);
});

test('checkout-payment-routes honours products.charge_tax and resolves HSN-specific rates before the store default', () => {
    assert.match(checkoutRouteSource, /product\?\.charge_tax === false/);
    assert.match(checkoutRouteSource, /rateByHsn\.has\(hsn\)/);
});

test('a GST computation failure is logged, never silent, and the order still completes (fail-open)', () => {
    assert.doesNotMatch(checkoutRouteSource, /catch\s*\{\s*computedTaxAmount = null;\s*\}/);
    assert.match(checkoutRouteSource, /event: 'gst_computation_failed'/);
});

test(
    'intra-state, inter-state, discounted, HSN-specific and charge_tax=false orders all compute the correct GST live',
    { skip: !dbAvailable() && 'local Supabase Postgres container not reachable' },
    () => {
        const suffix = Date.now().toString(36);
        const productId = randomUUID();
        const hsnProductId = randomUUID();
        const exemptProductId = randomUUID();

        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, hsn_code, charge_tax, created_at, updated_at)
            VALUES
              ('${productId}', '${STORE_ID}', 'T13 Autotest Default ${suffix}', 1000.00, 'T13-AUTOTEST-DEFAULT-${suffix}', true, NULL, true, now(), now()),
              ('${hsnProductId}', '${STORE_ID}', 'T13 Autotest HSN ${suffix}', 500.00, 'T13-AUTOTEST-HSN-${suffix}', true, '6109', true, now(), now()),
              ('${exemptProductId}', '${STORE_ID}', 'T13 Autotest Exempt ${suffix}', 300.00, 'T13-AUTOTEST-EXEMPT-${suffix}', true, NULL, false, now(), now());
        `);
        psql(`
            INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
            VALUES
              (gen_random_uuid(), '${STORE_ID}', '${productId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now()),
              (gen_random_uuid(), '${STORE_ID}', '${hsnProductId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now()),
              (gen_random_uuid(), '${STORE_ID}', '${exemptProductId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now());
        `);

        // Requires snaz to already carry a real GSTIN/state and an active 18% default +
        // HSN-6109 12% rate. Snaz-fixture follow-up (2026-09-28): seeded by
        // scripts/dev/seed-snaz-fixture.mjs (idempotent -- run it once against a fresh local
        // database, or any time this check fails). Both the rate rows AND the GSTIN/state could be
        // set through real gateway endpoints instead (routes/shipping-tax.ts's `POST /taxes` for
        // rates; a merchant settings endpoint for GSTIN/state) -- seeded directly here for speed and
        // determinism, matching how every other piece of this fixture (products, orders, inventory)
        // is seeded. The seed script's own header comment explains why it only fills in
        // gstin/gst_state_code when still NULL, never overwriting a real, later-configured value.
        const site = psql(`SELECT gstin, gst_state_code FROM sites WHERE id = '${STORE_ID}';`);
        if (!site || site.split('|')[0] === '') {
            assert.fail('snaz has no GSTIN configured -- run: node scripts/dev/seed-snaz-fixture.mjs');
        }

        // Intra-state: CGST + SGST split.
        const intraOrderId = psql(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'Autotest', 't13-autotest-intra-${suffix}@example.invalid', '9000000020',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, NULL, 'standard',
                't13-autotest-intra-idem-${suffix}', NULL, 't13-autotest-intra-req-${suffix}',
                NULL, 180.00, '29',
                '[{"title":"CGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}},{"title":"SGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}}]'::jsonb
            ) ->> 'id';
        `);
        const intraTax = psql(`SELECT tax, place_of_supply_state FROM orders WHERE id = '${intraOrderId}';`);
        assert.equal(intraTax, '180.00|29');
        const intraLines = psql(`SELECT title, amount FROM order_tax_lines WHERE order_id = '${intraOrderId}' ORDER BY title;`);
        assert.equal(intraLines, 'CGST|90.00\nSGST|90.00');
    },
);
