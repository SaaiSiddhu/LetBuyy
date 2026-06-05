import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/customer-engagement-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const routeBandSource = extractedSource || storefrontSource;

const expectedRoutes = [
    { method: 'post', path: '/customer/find-or-create' },
    { method: 'post', path: '/customer/password' },
    { method: 'post', path: '/customer/password/request-reset' },
    { method: 'post', path: '/customer/password/confirm-reset' },
    { method: 'get', path: '/customer/by-email' },
    { method: 'get', path: '/customer/status' },
    { method: 'post', path: '/customer/login' },
    { method: 'post', path: '/customer/login-success' },
    { method: 'post', path: '/customer/order-credential' },
    { method: 'post', path: '/customer/order-credential/login' },
    { method: 'post', path: '/customer/order-credential/login-success' },
    { method: 'post', path: '/customer/order-stats' },
    { method: 'get', path: '/customer/wishlist' },
    { method: 'get', path: '/customer/orders' },
    { method: 'get', path: '/:subdomain/orders/contact' },
    { method: 'post', path: '/customer/wishlist' },
    { method: 'delete', path: '/customer/wishlist' },
    { method: 'post', path: '/customer/wishlist/sync' },
    { method: 'post', path: '/customer/activity' },
    { method: 'patch', path: '/customer/profile' },
    { method: 'post', path: '/reviews' },
    { method: 'get', path: '/customer/addresses' },
    { method: 'post', path: '/customer/addresses' },
    { method: 'patch', path: '/customer/addresses/:id' },
    { method: 'delete', path: '/customer/addresses/:id' },
] as const;

function routePattern(route: typeof expectedRoutes[number]): RegExp {
    const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`router\\.${route.method}\\(\\s*'${escapedPath}'`);
}

function indexOfRoute(route: typeof expectedRoutes[number]): number {
    const match = routeBandSource.match(routePattern(route));
    return match?.index ?? -1;
}

test('storefront customer engagement routes are registered exactly once', () => {
    for (const route of expectedRoutes) {
        const matches = routeBandSource.match(new RegExp(routePattern(route).source, 'g')) || [];
        assert.equal(matches.length, 1, `${route.method.toUpperCase()} ${route.path}`);
    }
});

test('storefront customer engagement route order is preserved', () => {
    let previousIndex = -1;
    for (const route of expectedRoutes) {
        const currentIndex = indexOfRoute(route);
        assert.notEqual(currentIndex, -1, `${route.method.toUpperCase()} ${route.path}`);
        assert.ok(
            currentIndex > previousIndex,
            `${route.method.toUpperCase()} ${route.path} should remain after the previous customer engagement route`,
        );
        previousIndex = currentIndex;
    }
});

test('storefront customer engagement band stays after page routes and before blog routes', () => {
    const beforeMarker = "router.get('/:subdomain/pages/:slug'";
    const afterMarker = "router.get('/:subdomain/blog'";
    const beforeIndex = storefrontSource.indexOf(beforeMarker);
    const afterIndex = storefrontSource.indexOf(afterMarker);
    const extractedCallIndex = storefrontSource.indexOf('registerStorefrontCustomerEngagementRoutes(router');
    const inlineFirstRouteIndex = storefrontSource.indexOf("router.post('/customer/find-or-create'");

    assert.notEqual(beforeIndex, -1, 'page route marker should exist');
    assert.notEqual(afterIndex, -1, 'blog route marker should exist');

    const bandIndex = extractedCallIndex === -1 ? inlineFirstRouteIndex : extractedCallIndex;
    assert.notEqual(bandIndex, -1, 'customer engagement band should be inline or registered');
    assert.ok(beforeIndex < bandIndex, 'customer engagement band should stay after page routes');
    assert.ok(bandIndex < afterIndex, 'customer engagement band should stay before blog routes');
});
