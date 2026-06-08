import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/tax.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/144_executable_tax_gst_invoices.sql', import.meta.url), 'utf8');
const rollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/144_executable_tax_gst_invoices.rollback.sql', import.meta.url), 'utf8');
const humanRequiredSource = readFileSync(new URL('../../../../tests/executable/human-required-live-paths.test.mjs', import.meta.url), 'utf8');

test('Task 008 tax route is mounted as the V1 /tax surface without replacing shipping-tax parity routes', () => {
    assert.match(indexSource, /import taxRouter from '\.\/routes\/tax'/);
    assert.match(indexSource, /api\.route\('\/shipping-tax', shippingTaxRouter\)/);
    assert.match(indexSource, /api\.route\('\/tax', taxRouter\)/);
    assert.match(routeSource, /router\.post\('\/calculate', validate\('json', CalculateTaxSchema\)/);
    assert.match(routeSource, /router\.get\('\/invoice\/:orderId'/);
});

test('Task 008 tax route uses checkout-core GST calculation and guards live IRP as human-required', () => {
    assert.match(routeSource, /generateGstInvoice\(body\)/);
    assert.match(routeSource, /LETBUYY_GST_IRP_MODE/);
    assert.match(routeSource, /HR-GST-IRP-LIVE/);
    assert.match(routeSource, /TAX_IRP_SETUP_REQUIRED/);
    assert.match(humanRequiredSource, /HR-GST-IRP-LIVE/);
    assert.doesNotMatch(routeSource, /S-0[0-9]{2}|SKIP-NEEDS-BACKEND|backend contract/i);
});

test('Task 008 checkout-core exposes TCS and mock IRP metadata on the tax calculation contract', () => {
    assert.match(checkoutCoreSource, /export const CalculateTaxSchema = GenerateGstInvoiceSchema\.extend/);
    assert.match(checkoutCoreSource, /marketplace_tcs_bps/);
    assert.match(checkoutCoreSource, /tcs_amount_minor/);
    assert.match(checkoutCoreSource, /MOCK-IRN-/);
    assert.match(checkoutCoreSource, /letbuyy:\/\/gst-invoice/);
});

test('Task 008 tax migration creates immutable tenant-scoped GST invoice tables with rollback', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.tax_registrations/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.tax_overrides/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.hsn_rates/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.gst_invoices/);
    assert.match(migrationSource, /ALTER TABLE public\.gst_invoices FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /reject_gst_invoice_mutation/);
    assert.match(migrationSource, /gst_invoices_tax_split_check/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.gst_invoices/);
    assert.match(rollbackSource, /DROP FUNCTION IF EXISTS public\.reject_gst_invoice_mutation/);
});
