import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

// T13 (CAP-C45): zero of 26 orders carried tax or a place_of_supply_state before this phase.
// Matching T12's precedent (inventory-reservation-lifecycle.test.ts): every other tax-related
// test in this repo is structural (asserts a migration/route file's SOURCE contains a pattern)
// -- none exercise live GST arithmetic. That is deliberately insufficient here: CGST/SGST vs
// IGST splitting, post-discount taxable value and HSN-specific rate precedence can only be
// proven by actually creating orders and reading orders.tax / order_tax_lines back, against the
// real local Supabase Postgres this repo's dev environment already runs.
//
// The four source-level checks that used to sit in this file stay in the fast unit lane, in
// ../gst-tax-computation.test.ts (they need no database).
//
// Money-table discipline: NEVER `DELETE FROM` orders/order_items/order_tax_lines. This file runs only in the
// owned database lane (scripts/governance/run-executable-suites.mjs): its orders are created in a database the
// runner cloned for this suite alone and discards with it, so nothing accumulates anywhere, no protected record
// is removed by hand, and there is no skip path.

const owned = requireOwnedDatabase();
const { psql } = owned;

// A GST-registered store with an 18% default and a 12% HSN-6109 rate, built inside this suite's own database.
const tenant = newSyntheticTenant('gst');
const STORE_ID = tenant.siteId;
const LOCATION_ID = tenant.locationId;

before(() => {
    seedSyntheticTenant(psql, tenant, { gst: true, taxRates: true });
});

test(
    'intra-state, inter-state, discounted, HSN-specific and charge_tax=false orders all compute the correct GST live',
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

        // The synthetic tenant carries a real GSTIN/state and the two rates (seedSyntheticTenant), the way the
        // merchant settings and `POST /taxes` would have set them.
        const site = psql(`SELECT gstin, gst_state_code FROM sites WHERE id = '${STORE_ID}';`);
        assert.ok(site && site.split('|')[0] !== '', 'the synthetic tenant must carry a GSTIN (seedSyntheticTenant with gst: true)');

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
