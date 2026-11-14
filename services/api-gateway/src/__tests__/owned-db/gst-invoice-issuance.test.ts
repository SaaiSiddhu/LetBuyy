import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

// T14 (CAP-C48/CAP-C49): no gst_invoices row existed for any order, ever. W0 found the real
// cause live (placed an order, read the gateway's log): generateAndPersistGstInvoice's own
// order_items query had no tenant predicate and was rejected by the app-layer tenant guard on
// every single call. Fixing the predicate alone would have unblocked a computation that still
// disagreed with T13's authoritative orders.tax (no discount apportionment, no HSN precedence)
// -- an invoice that disagrees with the order it documents is worse than none. Replaced with
// issue_gst_invoice (migration 214), a SECURITY DEFINER RPC that reads T13's stored figures
// directly and allocates a per-site sequential invoice number under a row lock.
//
// Money-table discipline: NEVER `DELETE FROM` orders/gst_invoices. This test's cascade-behaviour
// assertion runs inside an explicit transaction that is always rolled back, never committed --
// genuine empirical proof of Postgres's real trigger-firing behaviour without persisting any
// deletion.
//
// The two source-level checks that used to sit in this file stay in the fast unit lane, in
// ../gst-invoice-issuance.test.ts (they need no database).
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs): the invoices this file issues are
// immutable by design (triggers refuse UPDATE and DELETE), so they are only ever created in a database that is discarded
// with the suite, never in a developer's own database, and there is no skip path.

const owned = requireOwnedDatabase();
const { psql, psqlAsync, psqlExpectError } = owned;

// A GST-registered store with a default warehouse, built inside this suite's own database.
const tenant = newSyntheticTenant('inv');
const STORE_ID = tenant.siteId;
const LOCATION_ID = tenant.locationId;

before(() => {
    seedSyntheticTenant(psql, tenant, { gst: true });
});

test(
    'a real order produces an invoice matching its order to the paisa, numbering is unique under genuine concurrency, and immutability is refused for real',
    async () => {
        // The invoice RPC needs the supplier's GSTIN; the synthetic tenant was seeded with one.
        const site = psql(`SELECT gstin, gst_state_code FROM sites WHERE id = '${STORE_ID}';`);
        assert.ok(site && site.split('|')[0] !== '', 'the synthetic tenant must carry a GSTIN (seedSyntheticTenant with gst: true)');

        const suffix = Date.now().toString(36);
        const productId = randomUUID();
        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
            VALUES ('${productId}', '${STORE_ID}', 'T14 Autotest Invoice ${suffix}', 1000.00, 'T14-AUTOTEST-${suffix}', true, now(), now());
        `);
        psql(`
            INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
            VALUES (gen_random_uuid(), '${STORE_ID}', '${productId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now());
        `);

        // Two orders, for the concurrency proof.
        const orderAId = psql(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'Autotest A', 't14-autotest-invoice-a-${suffix}@example.invalid', '9000000050',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, NULL, 'standard',
                't14-autotest-invoice-a-idem-${suffix}', NULL, 't14-autotest-invoice-a-req-${suffix}',
                NULL, 180.00, '29',
                '[{"title":"CGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}},{"title":"SGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}}]'::jsonb
            ) ->> 'id';
        `);
        const orderBId = psql(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'Autotest B', 't14-autotest-invoice-b-${suffix}@example.invalid', '9000000051',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, NULL, 'standard',
                't14-autotest-invoice-b-idem-${suffix}', NULL, 't14-autotest-invoice-b-req-${suffix}',
                NULL, 180.00, '29',
                '[{"title":"CGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}},{"title":"SGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}}]'::jsonb
            ) ->> 'id';
        `);

        // Genuinely parallel invoice issuance -- two real, concurrent OS processes launched via
        // spawn (never sequential awaits), racing the SAME site-row FOR UPDATE lock inside
        // Postgres. Promise.all does not serialize them; both `docker exec` processes are live
        // at once.
        const results = await Promise.all([
            psqlAsync(`SELECT issue_gst_invoice('${orderAId}'::uuid, NULL, 't14-autotest-concurrent-a') ->> 'invoice_number';`),
            psqlAsync(`SELECT issue_gst_invoice('${orderBId}'::uuid, NULL, 't14-autotest-concurrent-b') ->> 'invoice_number';`),
        ]);

        assert.notEqual(results[0], results[1], 'two orders must never receive the same invoice number');
        assert.ok(results[0] && results[1], 'both invoice numbers must be non-empty');

        // Reconciliation: the invoice must match its order to the paisa.
        const recon = psql(`
            SELECT o.tax, round(gi.tax_amount_minor / 100.0, 2), o.total, round(gi.total_amount_minor / 100.0, 2)
            FROM orders o JOIN gst_invoices gi ON gi.order_id = o.id
            WHERE o.id = '${orderAId}';
        `);
        const [orderTax, invTax, orderTotal, invTotal] = recon.split('|');
        assert.equal(orderTax, invTax, 'invoice tax must match order tax to the paisa');
        assert.equal(orderTotal, invTotal, 'invoice total must match order total to the paisa');

        // Immutability: both UPDATE and DELETE must be genuinely refused.
        const updateErr = psqlExpectError(`UPDATE gst_invoices SET tax_amount_minor = 1 WHERE order_id = '${orderAId}';`);
        assert.match(updateErr, /gst_invoices are immutable/);
        const deleteErr = psqlExpectError(`DELETE FROM gst_invoices WHERE order_id = '${orderAId}';`);
        assert.match(deleteErr, /gst_invoices are immutable/);

        // Still present after both refused attempts.
        const stillThere = psql(`SELECT count(*) FROM gst_invoices WHERE order_id = '${orderAId}';`);
        assert.equal(stillThere, '1');
    },
);
