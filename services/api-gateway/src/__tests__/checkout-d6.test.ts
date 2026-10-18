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
const dnsSource = readFileSync(new URL('../../../../infrastructure/dns/dns.tf', import.meta.url), 'utf8');
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
    const marketplaceLine = {
        product_id: 'product-a',
        marketplace_listing_id: 'listing-a',
        variant_id: null,
        quantity: 1,
        unit_price: 10,
        line_total: 10,
    };
    const marketplaceBinding = canonicalCheckoutCartBinding({
        ...base,
        salesOrigin: 'marketplace',
        lines: [marketplaceLine],
    });
    assert.match(marketplaceBinding, /"sales_origin":"marketplace"/);
    assert.match(marketplaceBinding, /"marketplace_listing_id":"listing-a"/);
    assert.notEqual(marketplaceBinding, canonicalCheckoutCartBinding({ ...base, lines: [marketplaceLine] }));
    const duplicateProductListings = [
        { ...marketplaceLine, marketplace_listing_id: 'listing-b' },
        { ...marketplaceLine, marketplace_listing_id: 'listing-a' },
    ];
    assert.equal(
        canonicalCheckoutCartBinding({ ...base, salesOrigin: 'marketplace', lines: duplicateProductListings }),
        canonicalCheckoutCartBinding({ ...base, salesOrigin: 'marketplace', lines: [...duplicateProductListings].reverse() }),
    );
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

test('marketplace cart admission and checkout preserve listing identity through dedicated order transaction', () => {
    assert.match(cartRouteSource, /router\.post\('\/:subdomain\/marketplace-cart'/);
    assert.match(cartRouteSource, /marketplace_listing_detail/);
    assert.match(cartRouteSource, /String\(listing\.product_id\) !== line\.product_id/);
    assert.match(cartRouteSource, /String\(listing\.site_id\) !== store\.id/);
    assert.match(cartRouteSource, /SALES_ORIGIN_IMMUTABLE/);
    assert.match(cartRouteSource, /salesOrigin: cart\.sales_origin/);
    assert.match(checkoutRouteSource, /MARKETPLACE_LISTING_REQUIRED/);
    assert.match(checkoutRouteSource, /marketplace_listing_id: stringValue\(line\.marketplace_listing_id\)/);
    assert.match(checkoutRouteSource, /salesOrigin: cartRow\.sales_origin/);
    const orderAdapterSource = readFileSync(new URL('../execution/order-execution.adapter.ts', import.meta.url), 'utf8');
    const orderMigrationSource = readFileSync(new URL('../../../../database/supabase/migrations/278_marketplace_order_listing_binding.sql', import.meta.url), 'utf8');
    assert.match(orderAdapterSource, /create_marketplace_checkout_order/);
    assert.match(orderMigrationSource, /marketplace_listing_review_fingerprint/);
    assert.match(orderMigrationSource, /purchases SET channel = 'marketplace'/);
    assert.match(orderMigrationSource, /trg_order_items_marketplace_listing_guard/);
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
    assert.match(dnsSource, /resource\s+"cloudflare_record"\s+"checkout"/);
    assert.match(dnsSource, /name\s+=\s+"checkout"/);
    assert.match(dnsSource, /checkout\.letbuyy\.com \(hosted checkout origin\)/);
    assert.match(apiWranglerSource, /CHECKOUT_ORIGIN = "https:\/\/checkout\.letbuyy\.com"/);
    assert.match(productionEnvSource, /CHECKOUT_ORIGIN=https:\/\/checkout\.letbuyy\.com/);
    assert.match(productionEnvSource, /CHECKOUT_SIGNING_SECRET=SKIP_NEEDS_HUMAN_PRODUCTION_CHECKOUT_SIGNING_SECRET/);
});
