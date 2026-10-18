import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ShippingServiceabilityQuerySchema, planShippingServiceability } from '@letbuyy/checkout-core';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/shipping.ts', import.meta.url), 'utf8');
const shippingTaxRouteSource = readFileSync(new URL('../routes/shipping-tax.ts', import.meta.url), 'utf8');
const labelsRouteSource = readFileSync(new URL('../routes/shipping-labels.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/145_executable_shipping_serviceability.sql', import.meta.url), 'utf8');
const rollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/145_executable_shipping_serviceability.rollback.sql', import.meta.url), 'utf8');
const checkoutRateBindingSource = readFileSync(new URL('../../../../database/supabase/migrations/279_marketplace_checkout_delivery_rate_binding.sql', import.meta.url), 'utf8');
const checkoutRateBindingRollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/279_marketplace_checkout_delivery_rate_binding.rollback.sql', import.meta.url), 'utf8');
const humanRequiredSource = readFileSync(new URL('../../../../tests/executable/human-required-live-paths.test.mjs', import.meta.url), 'utf8');

test('Task 009 shipping route mounts V1 rates, serviceability, and tracking without replacing labels', () => {
    assert.match(indexSource, /import shippingRouter from '\.\/routes\/shipping'/);
    assert.match(indexSource, /api\.route\('\/shipping\/labels', shippingLabelsRouter\)/);
    assert.match(indexSource, /api\.route\('\/shipping', shippingRouter\)/);
    assert.match(routeSource, /router\.get\('\/serviceability\/:pincode'/);
    assert.match(routeSource, /router\.post\('\/rates'/);
    assert.match(routeSource, /router\.get\('\/track\/:trackingNumber'/);
});

test('Task 009 shipping route is tenant checked, COD-aware, and live-carrier gated', () => {
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*authUser\.storeId\)/);
    assert.match(routeSource, /planShippingServiceability/);
    assert.match(routeSource, /cod_available/);
    assert.match(routeSource, /HR-CARRIER-LIVE/);
    assert.match(routeSource, /CARRIER_SETUP_REQUIRED/);
    assert.match(routeSource, /isLogisticsLiveProviderUnavailableError/);
    assert.match(humanRequiredSource, /HR-CARRIER-LIVE/);
    assert.match(labelsRouteSource, /createLogisticsProvider/);
    assert.match(labelsRouteSource, /liveLogisticsProviderAvailable/);
    assert.match(labelsRouteSource, /CARRIER_SETUP_REQUIRED/);
});

test('shipping estimates fail closed when coverage or merchant rates are absent or unavailable', () => {
    assert.doesNotMatch(routeSource, /function defaultRules/);
    assert.doesNotMatch(routeSource, /sandbox-standard/);
    assert.match(routeSource, /if \(!rules\) return c\.json\([\s\S]*SHIPPING_CONFIGURATION_UNAVAILABLE[\s\S]*503\)/);
    assert.match(routeSource, /if \(error\) return c\.json\([\s\S]*SHIPPING_CONFIGURATION_UNAVAILABLE[\s\S]*503\)/);
    assert.match(routeSource, /rates,\s*\}\)\);/);
});

test('an empty saved serviceability configuration produces no serviceability promise', () => {
    const query = ShippingServiceabilityQuerySchema.parse({
        store_id: '00000000-0000-4000-8000-000000000001',
        pincode: '560001',
    });
    const result = planShippingServiceability(query, []);
    assert.equal(result.serviceable, false);
    assert.equal(result.cod_available, false);
    assert.equal(result.reason, 'no_rule');
});

test('Task 009 checkout-core exposes serviceability schema and planner', () => {
    assert.match(checkoutCoreSource, /export const ShippingServiceabilityQuerySchema/);
    assert.match(checkoutCoreSource, /export function planShippingServiceability/);
    assert.match(checkoutCoreSource, /amount_out_of_range/);
    assert.match(checkoutCoreSource, /weight_out_of_range/);
});

test('checkout shipping rates are tenant-bound in the merchant write path', () => {
    assert.match(checkoutCoreSource, /zoneInsert:\s*\{\s*store_id: input\.store_id,\s*site_id: input\.store_id/);
    assert.match(shippingTaxRouteSource, /insert\(\{ \.\.\.plan\.rateInsert, site_id: ownedZone\.store_id, cod_enabled: true \}\)/);
});

test('marketplace order RPC locks and checks the reviewed seller rate atomically', () => {
    assert.match(checkoutRateBindingSource, /FOR SHARE OF sr, sz/);
    assert.match(checkoutRateBindingSource, /p_expected_shipping_amount/);
    assert.match(checkoutRateBindingSource, /marketplace delivery rate quote changed before order creation/);
    assert.match(checkoutRateBindingSource, /marketplace delivery rate does not cover this address/);
    assert.match(checkoutRateBindingRollbackSource, /DROP FUNCTION IF EXISTS public\.create_marketplace_checkout_order_with_delivery_rate/);
});

test('Task 009 shipping migration adds serviceability, profiles, shipment tracking, RLS, and rollback', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.shipping_profiles/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.shipping_serviceability_rules/);
    assert.match(migrationSource, /ALTER TABLE public\.shipments[\s\S]*ADD COLUMN IF NOT EXISTS provider text/);
    assert.match(migrationSource, /ALTER TABLE public\.shipping_rates[\s\S]*ADD COLUMN IF NOT EXISTS site_id uuid/);
    assert.match(migrationSource, /ALTER TABLE public\.shipments FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /shipping_serviceability_rules_tenant_site_guc/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.shipping_serviceability_rules/);
    assert.match(rollbackSource, /DROP COLUMN IF EXISTS site_id/);
});
