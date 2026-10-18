import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T14 (CAP-C48/CAP-C49): no gst_invoices row existed for any order, ever. W0 found the real
// cause live (placed an order, read the gateway's log): generateAndPersistGstInvoice's own
// order_items query had no tenant predicate and was rejected by the app-layer tenant guard on
// every single call. Fixing the predicate alone would have unblocked a computation that still
// disagreed with T13's authoritative orders.tax (no discount apportionment, no HSN precedence)
// -- an invoice that disagrees with the order it documents is worse than none. Replaced with
// issue_gst_invoice (migration 214), a SECURITY DEFINER RPC that reads T13's stored figures
// directly and allocates a per-site sequential invoice number under a row lock.
//
// This file is the part of that suite that needs no database: two source-level checks. The real-database proof (an
// invoice that matches its order to the paisa, numbering unique under genuine concurrency, immutability refused for
// real) lives in owned-db/gst-invoice-issuance.test.ts and runs only in the owned database lane
// (`pnpm --filter @letbuyy/api-gateway run test:db`), against a database the runner created for it.

const repoRoot = process.cwd();
const migration214Source = readFileSync(
    join(repoRoot, 'database/supabase/migrations/214_issue_gst_invoice.sql'),
    'utf8',
);
const adapterSource = readFileSync(
    join(repoRoot, 'services/api-gateway/src/execution/order-execution.adapter.ts'),
    'utf8',
);

test('migration 214 reads T13 stored figures, never recomputes GST, and locks the site row for numbering', () => {
    assert.match(migration214Source, /CREATE OR REPLACE FUNCTION public\.issue_gst_invoice/);
    assert.match(migration214Source, /FROM order_tax_lines otl/);
    assert.doesNotMatch(migration214Source, /calculateGstLine|generateGstInvoice/);
    assert.match(migration214Source, /SELECT \* INTO v_site FROM sites WHERE id = v_order\.store_id FOR UPDATE/);
    assert.match(migration214Source, /UPDATE sites SET invoice_number_next = invoice_number_next \+ 1/);
});

test('the old, never-successfully-run generateAndPersistGstInvoice is fully retired, not merely deprecated', () => {
    // The name may still appear inside an explanatory comment documenting what replaced it --
    // that is expected. What must be gone is the function DEFINITION and any CALL to it.
    assert.doesNotMatch(adapterSource, /async generateAndPersistGstInvoice\s*\(/);
    assert.doesNotMatch(adapterSource, /this\.generateAndPersistGstInvoice\s*\(/);
    assert.match(adapterSource, /rpc\('issue_gst_invoice'/);
});
