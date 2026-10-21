import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/shipping-tax.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const apiClientSource = readFileSync(new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url), 'utf8');
const dartApiClientSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/123_mobile_tax_rate_parity.sql', import.meta.url), 'utf8');

test('shipping-tax route is mounted, BFF allowlisted, and exposed by both clients', () => {
    assert.match(indexSource, /import shippingTaxRouter from '\.\/routes\/shipping-tax'/);
    assert.match(indexSource, /api\.route\('\/shipping-tax', shippingTaxRouter\)/);
    assert.match(bffSource, /'\/v1\/shipping-tax'/);
    assert.match(apiClientSource, /readonly taxes = \{/);
    assert.match(apiClientSource, /\/shipping-tax\/taxes/);
    assert.match(dartApiClientSource, /class TaxesApi/);
    assert.match(dartApiClientSource, /\/shipping-tax\/taxes/);
});

test('tax rate routes verify store ownership before every mutation', () => {
    assert.match(routeSource, /router\.get\('\/taxes'/);
    assert.match(routeSource, /router\.post\('\/taxes', validate\('json', CreateTaxRateSchema\)/);
    assert.match(routeSource, /router\.patch\('\/taxes\/:id'/);
    assert.match(routeSource, /router\.delete\('\/taxes\/:id'/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /resolveShippingTaxResourceScope\(c, 'tax_rates', id\)/);
    assert.match(routeSource, /\.eq\('id', id\)\.eq\(scopeColumn, storeId\)/);
    assert.match(routeSource, /\.from\('tax_rates'\)[\s\S]*\.insert\(plan\.taxRateInsert\)/);
    assert.match(routeSource, /\.from\('tax_rates'\)[\s\S]*\.update\(plan\.updates\)/);
    assert.match(routeSource, /\.from\('tax_rates'\)\.delete\(\)\.eq\('id', id\)/);
});

test('tax rate planner and migration preserve GST metadata used by mobile', () => {
    assert.match(checkoutCoreSource, /CreateTaxRateSchema[\s\S]*hsn_code:\s*z\.string\(\)\.max\(20\)\.optional\(\)/);
    assert.match(checkoutCoreSource, /CreateTaxRateSchema[\s\S]*applies_to:\s*z\.enum\(\['all', 'shipping', 'products'\]\)/);
    assert.match(checkoutCoreSource, /const TAX_RATE_UPDATE_FIELDS = \[[^\]]*'hsn_code'[^\]]*'applies_to'[^\]]*\]/);
    assert.match(checkoutCoreSource, /hsn_code:\s*input\.hsn_code \|\| null/);
    assert.match(checkoutCoreSource, /applies_to:\s*input\.applies_to \|\| 'all'/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS hsn_code text/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all' NOT NULL/);
    assert.match(migrationSource, /tax_rates_applies_to_check/);
    assert.match(migrationSource, /tax_rates_hsn_code_check/);
    assert.match(migrationSource, /update_tax_rates_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(routeSource, /S-025|SKIP-NEEDS-BACKEND|backend contract/i);
});
