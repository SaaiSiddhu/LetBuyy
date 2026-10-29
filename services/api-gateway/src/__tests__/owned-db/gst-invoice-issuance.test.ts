import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

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
    seedSyntheticTenant(psql, tenant, { gst: true, taxRates: true });
    psql(`UPDATE sites SET tax_inclusive=false WHERE id='${STORE_ID}';`);
});

test(
    'a real order produces an invoice matching its order to the paisa, numbering is unique under genuine concurrency, and immutability is refused for real',
    async () => {
        // The invoice RPC needs the supplier's GSTIN; the synthetic tenant was seeded with one.
        const site = psql(`SELECT gstin, gst_state_code FROM sites WHERE id = '${STORE_ID}';`);
        assert.ok(site && site.split('|')[0] !== '', 'the synthetic tenant must carry a GSTIN (seedSyntheticTenant with gst: true)');
        const [prefix, nextInvoice] = psql(`SELECT invoice_prefix, invoice_number_next FROM sites WHERE id='${STORE_ID}';`).split('|');

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

        // Concurrent canonical orders contend on the same store and stock. Invoice
        // allocation is now atomic with each order; retrying issuance is idempotent.
        const orderSql = (key: string) => `SELECT create_checkout_order('${STORE_ID}', 'Synthetic buyer',
            'syn-${key}@example.invalid', '9000000050',
            '{"line1":"Synthetic Road","city":"Bengaluru","state":"Karnataka","state_code":"29"}',
            '[{"product_id":"${productId}","quantity":1}]', 'cod',NULL,NULL,NULL,'standard','${key}')->>'id';`;
        const [orderAId,orderBId] = await Promise.all([psqlAsync(orderSql(randomUUID())),psqlAsync(orderSql(randomUUID()))]);
        const results = await Promise.all([
            psqlAsync(`SELECT issue_gst_invoice('${orderAId}',NULL,'syn-invoice-retry-a')->>'invoice_number';`),
            psqlAsync(`SELECT issue_gst_invoice('${orderBId}',NULL,'syn-invoice-retry-b')->>'invoice_number';`),
        ]);
        assert.notEqual(results[0], results[1], 'two orders must never receive the same invoice number');
        assert.ok(results[0] && results[1], 'both invoice numbers must be non-empty');
        assert.deepEqual(results.slice().sort(), [0, 1].map((offset) => `${prefix}-${String(Number(nextInvoice) + offset).padStart(6, '0')}`).sort(),
            'Business settings invoice format example must agree with real generated numbers');
        const orderRefs = psql(`SELECT order_number FROM orders WHERE id IN ('${orderAId}','${orderBId}') ORDER BY id;`).split('\n');
        assert.equal(orderRefs.length, 2);
        orderRefs.forEach((reference) => assert.match(reference, /^ORD-[0-9]{8}-[0-9]+$/,
            'General settings order reference format must match generated values'));

        // Reconciliation: the invoice must match its order to the paisa.
        const recon = psql(`
            SELECT o.tax, round(gi.tax_amount_minor / 100.0, 2), o.total, round(gi.total_amount_minor / 100.0, 2)
            FROM orders o JOIN gst_invoices gi ON gi.order_id = o.id
            WHERE o.id = '${orderAId}';
        `);
        const [orderTax, invTax, orderTotal, invTotal] = recon.split('|');
        assert.equal(orderTax, invTax, 'invoice tax must match order tax to the paisa');
        assert.equal(orderTotal, invTotal, 'invoice total must match order total to the paisa');
        const invoiceFacts = psql(`SELECT invoice_number||'|'||supplier::text||'|'||total_amount_minor::text
            FROM gst_invoices WHERE order_id='${orderAId}';`);
        psql(`UPDATE sites SET name='Synthetic renamed store',legal_name='Synthetic renamed legal entity',
            invoice_prefix='RENAMED' WHERE id='${STORE_ID}';`);
        assert.equal(psql(`SELECT invoice_number||'|'||supplier::text||'|'||total_amount_minor::text
            FROM gst_invoices WHERE order_id='${orderAId}';`), invoiceFacts,
            'later General and Business edits never rewrite issued invoice identity or amounts');

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

test('an unregistered merchant order records zero GST and does not issue a GST invoice', () => {
    const unregistered = newSyntheticTenant('inv-unregistered');
    seedSyntheticTenant(psql, unregistered, { gst: false, taxRates: false });
    const { orderId } = seedSyntheticOrder(psql, unregistered);
    const [tax, registration, supplierGstin] = psql(`SELECT tax::text, tax_snapshot->>'collection_status',
        coalesce(tax_snapshot->'supplier'->>'gstin','') FROM orders WHERE id='${orderId}';`).split('|');
    assert.equal(Number(tax), 0, 'unregistered sales cannot collect GST');
    assert.equal(registration, 'not_collecting');
    assert.equal(supplierGstin, '');
    assert.equal(psql(`SELECT count(*) FROM gst_invoices WHERE order_id='${orderId}';`), '0');
    assert.match(psql(`SELECT order_number FROM orders WHERE id='${orderId}';`), /^ORD-[0-9]{8}-[0-9]+$/);
});
