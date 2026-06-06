import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/public-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const routeBandSource = extractedSource || storefrontSource;

const expectedRoutes = [
    { method: 'get', path: '/lookup' },
    { method: 'get', path: '/directory' },
    { method: 'get', path: '/store/:storeId' },
    { method: 'get', path: '/store/:storeId/products' },
    { method: 'get', path: '/store/:storeId/coupons/validate' },
    { method: 'get', path: '/reviews' },
    { method: 'get', path: '/:subdomain/checkout/extensions' },
    { method: 'get', path: '/:subdomain/theme-preview' },
    { method: 'get', path: '/:subdomain' },
    { method: 'get', path: '/:subdomain/status' },
    { method: 'get', path: '/:subdomain/products' },
    { method: 'get', path: '/:subdomain/products/by-ids' },
    { method: 'get', path: '/:subdomain/products/:slug' },
    { method: 'get', path: '/:subdomain/coupons/validate' },
    { method: 'get', path: '/:subdomain/categories' },
    { method: 'get', path: '/:subdomain/navigation' },
    { method: 'get', path: '/:subdomain/pages' },
    { method: 'get', path: '/:subdomain/policies' },
    { method: 'get', path: '/:subdomain/policies/:policyType' },
    { method: 'get', path: '/:subdomain/pages/:slug' },
    { method: 'get', path: '/:subdomain/blog' },
    { method: 'get', path: '/:subdomain/blog/:slug' },
    { method: 'post', path: '/:subdomain/contact' },
] as const;

function routePattern(route: typeof expectedRoutes[number]): RegExp {
    const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`router\\.${route.method}\\(\\s*'${escapedPath}'`);
}

function indexOfRoute(route: typeof expectedRoutes[number]): number {
    const match = routeBandSource.match(routePattern(route));
    return match?.index ?? -1;
}

test('storefront public routes are registered exactly once', () => {
    for (const route of expectedRoutes) {
        const matches = routeBandSource.match(new RegExp(routePattern(route).source, 'g')) || [];
        assert.equal(matches.length, 1, `${route.method.toUpperCase()} ${route.path}`);
    }
});

test('storefront public route order is preserved', () => {
    let previousIndex = -1;
    for (const route of expectedRoutes) {
        const currentIndex = indexOfRoute(route);
        assert.notEqual(currentIndex, -1, `${route.method.toUpperCase()} ${route.path}`);
        assert.ok(
            currentIndex > previousIndex,
            `${route.method.toUpperCase()} ${route.path} should remain after the previous public route`,
        );
        previousIndex = currentIndex;
    }
});

test('storefront public route band stays after internal routes and before router export', () => {
    const beforeMarker = 'registerStorefrontInternalPaymentRoutes(router';
    const afterMarker = 'export default router;';
    const beforeIndex = storefrontSource.indexOf(beforeMarker);
    const afterIndex = storefrontSource.indexOf(afterMarker);
    const extractedCallIndex = storefrontSource.indexOf('registerStorefrontPublicRoutes(router');
    const inlineFirstRouteIndex = storefrontSource.indexOf("router.get('/lookup'");

    assert.notEqual(beforeIndex, -1, 'internal payment route registration should exist');
    assert.notEqual(afterIndex, -1, 'router export marker should exist');

    const bandIndex = extractedCallIndex === -1 ? inlineFirstRouteIndex : extractedCallIndex;
    assert.notEqual(bandIndex, -1, 'public route band should be inline or registered');
    assert.ok(beforeIndex < bandIndex, 'public route band should stay after internal routes');
    assert.ok(bandIndex < afterIndex, 'public route band should stay before router export');
});
