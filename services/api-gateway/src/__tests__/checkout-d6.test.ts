import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    canonicalCheckoutCartBinding,
    canonicalCheckoutHandoffPayload,
} from '../../../../packages/checkout-core/src/index.ts';

const cartRouteSource = readFileSync(new URL('../routes/storefront/cart-routes.ts', import.meta.url), 'utf8');
const checkoutRouteSource = readFileSync(new URL('../routes/checkout.ts', import.meta.url), 'utf8');
const paymentAdapterSource = readFileSync(new URL('../execution/payment-execution.adapter.ts', import.meta.url), 'utf8');
const queueWorkerSource = readFileSync(new URL('../../../../services/queue-workers/src/index.ts', import.meta.url), 'utf8');
const inventorySweeperSource = readFileSync(new URL('../../../../services/queue-workers/src/inventory-reservations.ts', import.meta.url), 'utf8');
const queueWranglerSource = readFileSync(new URL('../../../../services/queue-workers/wrangler.toml', import.meta.url), 'utf8');
const apiWranglerSource = readFileSync(new URL('../../../../services/api-gateway/wrangler.toml', import.meta.url), 'utf8');
const d6MigrationSource = readFileSync(new URL('../../../../database/supabase/migrations/166_d6_checkout_handoff_inventory.sql', import.meta.url), 'utf8');
const d6RollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/166_d6_checkout_handoff_inventory.rollback.sql', import.meta.url), 'utf8');
const dnsSource = readFileSync(new URL('../../../../infrastructure/dns/letbuyy_com.tf', import.meta.url), 'utf8');
const productionEnvSource = readFileSync(new URL('../../../../config/env/production.env.example', import.meta.url), 'utf8');

test('D6 checkout handoff canonical binding is content stable and order independent', () => {
    const base = {
        siteId: 'site-1',
        cartId: 'cart-1',
        cartToken: 'ct_1',
        channel: 'web',
        expiresAt: '2026-06-10T00:00:00.000Z',
        couponCodes: ['shipfree', 'ORDER10'],
    };
    const left = canonicalCheckoutCartBinding({
        ...base,
        lines: [
            { product_id: 'product-b', variant_id: null, quantity: 1, unit_price: 20, line_total: 20 },
            { product_id: 'product-a', variant_id: 'variant-a', quantity: 2, unit_price: 10, line_total: 20 },
        ],
    });
    const right = canonicalCheckoutCartBinding({
        ...base,
        couponCodes: ['ORDER10', 'shipfree'],
        lines: [
            { product_id: 'product-a', variant_id: 'variant-a', quantity: 2, unit_price: 10, line_total: 20 },
            { product_id: 'product-b', variant_id: null, quantity: 1, unit_price: 20, line_total: 20 },
        ],
    });

    assert.equal(left, right);
    assert.notEqual(left, canonicalCheckoutCartBinding({
        ...base,
        lines: [{ product_id: 'product-a', variant_id: 'variant-a', quantity: 3, unit_price: 10, line_total: 30 }],
    }));
    assert.match(canonicalCheckoutHandoffPayload({ ...base, lines: [], cartContentDigest: 'abc123' }), /cart_content_digest/);
});

test('D6 cart checkout URL signs the cart content digest, not just cart identity', () => {
    assert.match(cartRouteSource, /canonicalCheckoutCartBinding/);
    assert.match(cartRouteSource, /sha256Hex\(canonicalCheckoutCartBinding/);
    assert.match(cartRouteSource, /canonicalCheckoutHandoffPayload\(\{/);
    assert.match(cartRouteSource, /checkoutUrl\.searchParams\.set\('cart_digest', cartContentDigest\)/);
    assert.match(cartRouteSource, /cart_content_digest: cartContentDigest/);
    assert.doesNotMatch(cartRouteSource, /\$\{store\.id\}:\$\{cart\.id\}:\$\{cart\.cart_token\}:\$\{cart\.channel\}:\$\{expiresAt\}/);
});

test('D6 hosted checkout rejects mutated cart handoffs by recomputing digest from server cart', () => {
    assert.match(checkoutRouteSource, /const cartDigest = c\.req\.query\('cart_digest'\)/);
    assert.match(checkoutRouteSource, /sha256Hex\(canonicalCheckoutCartBinding\(\{/);
    assert.match(checkoutRouteSource, /timingSafeEqualHex\(expectedCartDigest, cartDigest\)/);
    assert.match(checkoutRouteSource, /canonicalCheckoutHandoffPayload\(\{/);
    assert.match(checkoutRouteSource, /cartContentDigest: expectedCartDigest/);
    assert.doesNotMatch(checkoutRouteSource, /hmacSha256Hex\(secret,\s*`\$\{siteId\}:\$\{cartId\}:\$\{cartToken\}:\$\{channel\}:\$\{expiresAt\}`/);
});

test('D6 order inventory path uses reserve then commit lifecycle and rollback restores direct decrement', () => {
    assert.match(d6MigrationSource, /CREATE OR REPLACE FUNCTION public\.create_order_with_inventory_reservations/);
    assert.match(d6MigrationSource, /public\.reserve_inventory\(/);
    assert.match(d6MigrationSource, /public\.commit_inventory_reservation\(/);
    assert.match(d6MigrationSource, /order_id = v_order_id/);
    assert.match(d6MigrationSource, /require_inventory_site_guc\(p_store_id\)/);
    assert.doesNotMatch(d6MigrationSource, /SET available = available - v_quantity/);
    assert.match(d6RollbackSource, /SET available = available - v_quantity/);
});

test('D6 payment capture no longer directly adjusts product stock from legacy JSON orders', () => {
    assert.doesNotMatch(paymentAdapterSource, /adjustLegacyProductStock/);
    assert.doesNotMatch(paymentAdapterSource, /\.from\('products'\)[\s\S]*\.update\(\{\s*stock:/);
    assert.doesNotMatch(paymentAdapterSource, /reserveLegacyProductStockIfNeeded/);
    assert.match(paymentAdapterSource, /confirm_order_payment_with_ledger/);
});

test('D6 stale reservation sweeper is scheduled in queue-workers', () => {
    assert.match(inventorySweeperSource, /expire_inventory_reservations/);
    assert.match(inventorySweeperSource, /INVENTORY_RESERVATION_SWEEPER_LIMIT/);
    assert.match(queueWorkerSource, /runInventoryReservationSweeper/);
    assert.match(queueWorkerSource, /scheduled\.inventory_reservation_sweeper/);
    assert.match(queueWranglerSource, /INVENTORY_RESERVATION_SWEEPER_LIMIT = "250"/);
});

test('D6 hosted checkout origin is provisioned as config and human-applied DNS', () => {
    assert.match(dnsSource, /checkout\s+= "storefront-runtime hosted checkout origin"/);
    assert.match(apiWranglerSource, /CHECKOUT_ORIGIN = "https:\/\/checkout\.letbuyy\.com"/);
    assert.match(productionEnvSource, /CHECKOUT_ORIGIN=https:\/\/checkout\.letbuyy\.com/);
    assert.match(productionEnvSource, /CHECKOUT_SIGNING_SECRET=SKIP_NEEDS_HUMAN_PRODUCTION_CHECKOUT_SIGNING_SECRET/);
});
