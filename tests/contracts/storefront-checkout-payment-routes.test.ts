import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/checkout-payment-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const routeBandSource = extractedSource || storefrontSource;

const expectedRoutes = [
    { method: 'post', path: '/:subdomain/orders' },
    { method: 'post', path: '/:subdomain/payments/razorpay/order' },
    { method: 'post', path: '/:subdomain/payments/razorpay/verify' },
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

test('storefront checkout payment band stays after status and before catalog routes', () => {
    const beforeMarker = "router.get('/:subdomain/status'";
    const afterMarker = "router.get('/:subdomain/products'";
    const beforeIndex = storefrontSource.indexOf(beforeMarker);
    const afterIndex = storefrontSource.indexOf(afterMarker);
    const extractedCallIndex = storefrontSource.indexOf('registerStorefrontCheckoutPaymentRoutes(router');
    const inlineFirstRouteIndex = storefrontSource.indexOf("router.post('/:subdomain/orders'");

    assert.notEqual(beforeIndex, -1, 'status route marker should exist');
    assert.notEqual(afterIndex, -1, 'catalog route marker should exist');

    const bandIndex = extractedCallIndex === -1 ? inlineFirstRouteIndex : extractedCallIndex;
    assert.notEqual(bandIndex, -1, 'checkout payment band should be inline or registered');
    assert.ok(beforeIndex < bandIndex, 'checkout payment band should stay after status route');
    assert.ok(bandIndex < afterIndex, 'checkout payment band should stay before catalog routes');
});
