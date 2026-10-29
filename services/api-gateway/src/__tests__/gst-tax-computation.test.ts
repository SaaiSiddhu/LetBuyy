import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T13 (CAP-C45): zero of 26 orders carried tax or a place_of_supply_state before this phase.
// This file is the part of that suite that needs no database: four source-level checks that the migration and the
// checkout route are wired the way the arithmetic needs (place of supply threaded atomically, the supplier's GST state
// read from `sites`, HSN precedence, fail-open logging). Source patterns are deliberately not sufficient on their own:
// CGST/SGST vs IGST splitting, post-discount taxable value and HSN-specific rate precedence can only be proven by
// creating orders and reading orders.tax / order_tax_lines back, and that real-database proof lives in
// owned-db/gst-tax-computation.test.ts. It runs only in the owned database lane
// (`pnpm --filter @letbuyy/api-gateway run test:db`), against a database the runner created for it.

const repoRoot = process.cwd();
const migration213Source = readFileSync(
    join(repoRoot, 'database/supabase/migrations/213_checkout_order_gst_place_of_supply_and_tax_lines.sql'),
    'utf8',
);
const checkoutRouteSource = readFileSync(
    join(repoRoot, 'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts'),
    'utf8',
);

test('migration 213 threads place_of_supply_state and order_tax_lines through create_checkout_order atomically', () => {
    assert.match(migration213Source, /p_place_of_supply_state text DEFAULT NULL::text/);
    assert.match(migration213Source, /p_tax_lines jsonb DEFAULT NULL::jsonb/);
    assert.match(migration213Source, /place_of_supply_state = COALESCE\(p_place_of_supply_state, place_of_supply_state\)/);
    assert.match(migration213Source, /INSERT INTO order_tax_lines/);
});

const authoritativeMigration = readFileSync(join(repoRoot, 'database/supabase/migrations/411_authoritative_checkout_gst.sql'), 'utf8');

test('both checkout review and order use the canonical SQL GST authority; the old route calculator is removed', () => {
    assert.match(checkoutRouteSource, /quoteCheckoutTotals/);
    assert.doesNotMatch(checkoutRouteSource, /computedTaxAmount|rateByHsn|gst_computation_failed/);
    assert.match(authoritativeMigration, /public.resolve_checkout_gst_v1/);
    assert.match(authoritativeMigration, /v_authoritative_quote := public.quote_storefront_checkout_totals/);
});

test('GST configuration failures refuse payment instead of silently becoming zero tax', () => {
    const helper = readFileSync(join(repoRoot, 'services/api-gateway/src/lib/checkout-tax-quote.ts'), 'utf8');
    assert.match(helper, /CHECKOUT_TAX_SETUP_REQUIRED/);
    assert.match(authoritativeMigration, /GST_RATE_REQUIRED/);
    assert.match(authoritativeMigration, /GST_REGISTRATION_REQUIRED/);
});
