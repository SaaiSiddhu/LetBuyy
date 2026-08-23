import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const publicRoutesPath = join(testDir, '../../services/api-gateway/src/routes/storefront/public-routes.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/checkout-payment-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const publicRoutesSource = existsSync(publicRoutesPath) ? readFileSync(publicRoutesPath, 'utf8') : '';
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const routeBandSource = extractedSource || storefrontSource;
const registrationHostSource = publicRoutesSource || storefrontSource;

// Phase M1 (LetBuyy DOC 03 row 11 "Payments": single capture adapter, MoR-on-own-Razorpay;
// LETBUYY_FOUNDATION_ROADMAP.md P5/W-03 "retire legacy app-local checkout/Stripe/PayPal
// handlers from the live path") retired the Stripe/PayPal/Cashfree capture routes.
// Razorpay + COD (order creation) are the only live storefront payment-capture routes.
const expectedRoutes = [
    { method: 'post', path: '/:subdomain/orders' },
    { method: 'post', path: '/:subdomain/payments/razorpay/order' },
    { method: 'post', path: '/:subdomain/payments/razorpay/verify' },
] as const;

const retiredRoutes = [
    { method: 'post', path: '/:subdomain/payments/cashfree/order' },
    { method: 'post', path: '/:subdomain/payments/cashfree/verify' },
    { method: 'post', path: '/:subdomain/payments/stripe/checkout' },
    { method: 'post', path: '/:subdomain/payments/paypal/order' },
    { method: 'post', path: '/:subdomain/payments/paypal/capture' },
] as const;

function routePattern(route: typeof expectedRoutes[number]): RegExp {
    const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`router\\.${route.method}\\(\\s*'${escapedPath}'`);
}

function indexOfRoute(route: typeof expectedRoutes[number]): number {
    const match = routeBandSource.match(routePattern(route));
    return match?.index ?? -1;
}

test('storefront checkout payment routes are registered exactly once', () => {
    for (const route of expectedRoutes) {
        const matches = routeBandSource.match(new RegExp(routePattern(route).source, 'g')) || [];
        assert.equal(matches.length, 1, `${route.method.toUpperCase()} ${route.path}`);
    }
});

test('storefront checkout payment route order is preserved', () => {
    let previousIndex = -1;
    for (const route of expectedRoutes) {
        const currentIndex = indexOfRoute(route);
        assert.notEqual(currentIndex, -1, `${route.method.toUpperCase()} ${route.path}`);
        assert.ok(
            currentIndex > previousIndex,
            `${route.method.toUpperCase()} ${route.path} should remain after the previous checkout payment route`,
        );
        previousIndex = currentIndex;
    }
});

test('retired Stripe/PayPal/Cashfree storefront capture routes are gone from source', () => {
    for (const route of retiredRoutes) {
        const matches = routeBandSource.match(new RegExp(routePattern(route).source, 'g')) || [];
        assert.equal(matches.length, 0, `${route.method.toUpperCase()} ${route.path} must not be registered`);
    }
});

test('checkout-payment-routes.ts does not import the retired non-canonical provider adapters', () => {
    for (const specifier of [
        '@letbuyy/infrastructure/stripe-adapter',
        '@letbuyy/infrastructure/paypal-adapter',
        '@letbuyy/infrastructure/cashfree-adapter',
    ]) {
        assert.ok(
            !routeBandSource.includes(specifier),
            `checkout-payment-routes.ts must not import ${specifier}`,
        );
    }
    assert.ok(
        routeBandSource.includes('@letbuyy/infrastructure/razorpay-adapter'),
        'checkout-payment-routes.ts must still import the canonical Razorpay adapter',
    );
});

test('storefront checkout payment band stays after status and before catalog routes', () => {
    const beforeMarker = "router.get('/:subdomain/status'";
    const afterMarker = "router.get('/:subdomain/products'";
    const beforeIndex = registrationHostSource.indexOf(beforeMarker);
    const afterIndex = registrationHostSource.indexOf(afterMarker);
    const extractedCallIndex = registrationHostSource.indexOf('registerStorefrontCheckoutPaymentRoutes(router');
    const inlineFirstRouteIndex = registrationHostSource.indexOf("router.post('/:subdomain/orders'");

    assert.notEqual(beforeIndex, -1, 'status route marker should exist');
    assert.notEqual(afterIndex, -1, 'catalog route marker should exist');

    const bandIndex = extractedCallIndex === -1 ? inlineFirstRouteIndex : extractedCallIndex;
    assert.notEqual(bandIndex, -1, 'checkout payment band should be inline or registered');
    assert.ok(beforeIndex < bandIndex, 'checkout payment band should stay after status route');
    assert.ok(bandIndex < afterIndex, 'checkout payment band should stay before catalog routes');
});
