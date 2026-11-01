import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { quoteStorefrontShippingOptions, storefrontZoneCoversAddress } from '../lib/storefront-shipping';

const storefrontRoute = readFileSync(new URL('../routes/storefront/checkout-payment-routes.ts', import.meta.url), 'utf8');
const orderAdapter = readFileSync(new URL('../execution/order-execution.adapter.ts', import.meta.url), 'utf8');
const checkoutClient = readFileSync(new URL('../../../../apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx', import.meta.url), 'utf8');
const rateBindingMigration = readFileSync(new URL('../../../../database/supabase/migrations/281_storefront_checkout_shipping_rate_binding.sql', import.meta.url), 'utf8');
const rateBindingRollback = readFileSync(new URL('../../../../database/supabase/rollback/281_storefront_checkout_shipping_rate_binding.rollback.sql', import.meta.url), 'utf8');

const address = { country: 'IN', state: 'Karnataka', stateCode: '29', pincode: '560001' };

test('storefront shipping zone requires country and respects state and exact pincode coverage', () => {
    assert.equal(storefrontZoneCoversAddress({ countries: ['India'], states: ['Karnataka'], zip_codes: ['560001'] }, address), true);
    assert.equal(storefrontZoneCoversAddress({ countries: ['IN'], states: ['Tamil Nadu'], zip_codes: ['560001'] }, address), false);
    assert.equal(storefrontZoneCoversAddress({ countries: ['IN'], states: ['Karnataka'], zip_codes: ['600001'] }, address), false);
    assert.equal(storefrontZoneCoversAddress({ countries: [], states: [], zip_codes: [] }, address), false);
});

test('empty state and pincode lists allow the merchant zone wildcard only within its country', () => {
    assert.equal(storefrontZoneCoversAddress({ countries: ['IN'], states: [], zip_codes: [] }, address), true);
    assert.equal(storefrontZoneCoversAddress({ countries: ['US'], states: [], zip_codes: [] }, address), false);
});

test('storefront quotes use only matching saved rates, apply subtotal limits and retain COD eligibility', () => {
    const zones = [
        { id: 'covered', countries: ['IN'], states: ['29'], zip_codes: ['560001'], cod_enabled: true },
        { id: 'other-pin', countries: ['IN'], states: ['29'], zip_codes: ['600001'], cod_enabled: true },
    ];
    const rates = [
        { id: 'flat', zone_id: 'covered', name: 'Standard', type: 'flat', price: '25', min_order_amount: '100', max_order_amount: '500', estimated_days_min: 3, estimated_days_max: 5, cod_enabled: true },
        { id: 'out-of-range', zone_id: 'covered', name: 'Large order', type: 'flat', price: '0', min_order_amount: '500', max_order_amount: null, estimated_days_min: null, estimated_days_max: null, cod_enabled: true },
        { id: 'uncovered', zone_id: 'other-pin', name: 'Other zone', type: 'free', price: '0', min_order_amount: null, max_order_amount: null, estimated_days_min: 1, estimated_days_max: 1, cod_enabled: true },
        { id: 'weight-based', zone_id: 'covered', name: 'Weight rate', type: 'weight_based', price: '10', min_order_amount: null, max_order_amount: null, estimated_days_min: 1, estimated_days_max: 1, cod_enabled: true },
    ];
    const quotes = quoteStorefrontShippingOptions(zones, rates, address, 19900);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].id, 'flat');
    assert.equal(quotes[0].amount_minor, 2500);
    assert.equal(quotes[0].cod_available, true);
    assert.equal(quotes[0].carrier_confirmed, false);
});

test('public storefront quote and final order use the locked, reviewed seller rate', () => {
    assert.match(storefrontRoute, /router\.get\('\/:subdomain\/shipping-rates'/);
    assert.match(storefrontRoute, /listStorefrontShippingRates\(getSupabaseAdmin\(c\), store\.id/);
    assert.match(storefrontRoute, /selected\.amount_minor !== body\.shippingAmountMinor/);
    assert.match(storefrontRoute, /expected_shipping_amount: resolvedRate\.amount/);
    assert.match(orderAdapter, /create_storefront_checkout_order_with_delivery_rate/);
    assert.match(rateBindingMigration, /FOR SHARE OF sr, sz/);
    assert.match(rateBindingMigration, /p_expected_shipping_amount/);
    assert.match(rateBindingMigration, /storefront delivery rate does not cover this address/);
    assert.match(rateBindingMigration, /create_checkout_order_for_buyer/);
    assert.match(rateBindingRollback, /DROP FUNCTION IF EXISTS public\.create_storefront_checkout_order_with_delivery_rate/);
});

test('buyer checkout requires an explicit returned rate and submits its reviewed amount', () => {
    assert.match(checkoutClient, /fetch\('\/api\/shipping\/rates'/);
    assert.match(checkoutClient, /if \(!selectedRateId \|\| !selectedRate\)/);
    assert.match(checkoutClient, /shipping_quote: selectedRate\?\.id \? \{/);
    assert.match(checkoutClient, /shipping_rate_id: selectedRate\.id/);
    assert.match(checkoutClient, /expected_shipping_amount: selectedRate\.amount_minor \/ 100/);
    assert.match(checkoutClient, /selectedRate\?\.cod_available/);
    assert.doesNotMatch(checkoutClient, /amount:\s*method\s*===\s*['"]express['"]\s*\?\s*99/);
});
