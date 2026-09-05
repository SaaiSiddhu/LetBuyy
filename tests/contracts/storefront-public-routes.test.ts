import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/public-routes.ts');

// ROUTE-1 (2026-09-05): the blog band moved to its own module because public-routes.ts sat at 1496
// lines against a `<= 1500` validator — four lines from being unable to accept any new public route.
// This test caught the move, which is the guard working. The band is now two files, and the band
// source is their concatenation IN REGISTRATION ORDER; the test below asserts that order rather than
// assuming it, since a concatenation that does not match what Hono sees would silently pass.
const blogRoutesPath = join(testDir, '../../services/api-gateway/src/routes/storefront/storefront-blog-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const blogRoutesSource = existsSync(blogRoutesPath) ? readFileSync(blogRoutesPath, 'utf8') : '';
const publicRoutesOwnSource = extractedSource || storefrontSource;

// The blog band registers in the MIDDLE of public-routes.ts, not at the end, so appending the module
// would model an order Hono never sees — and "route order is preserved" would fail for a reason that
// is an artifact of the test rather than a real regression. Splice the module's body in at its
// registration call instead: that IS the order routes are added in.
const blogCallPattern = /^.*registerStorefrontBlogRoutes\(router.*$/m;
const routeBandSource = blogRoutesSource
    ? publicRoutesOwnSource.replace(blogCallPattern, blogRoutesSource)
    : publicRoutesOwnSource;

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
    { method: 'post', path: '/:subdomain/analytics/beacon' },
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

// ROUTE-1: routes sitting in a module nobody registers satisfy every "route exists" assertion above
// while being unreachable at runtime. That is the specific way an extraction goes wrong, so it is
// asserted directly rather than inferred.
test('the extracted blog module is registered by public-routes', () => {
    if (!existsSync(blogRoutesPath)) return;

    assert.ok(
        publicRoutesOwnSource.includes("from './storefront-blog-routes'"),
        'public-routes.ts must import the blog module',
    );
    const callIndex = publicRoutesOwnSource.indexOf('registerStorefrontBlogRoutes(router');
    assert.notEqual(callIndex, -1, 'public-routes.ts must call registerStorefrontBlogRoutes');

    // The concatenation order above is only faithful if the blog module registers after the inline
    // public routes. The contact route is the one that used to follow the blog band directly.
    const contactIndex = publicRoutesOwnSource.indexOf("router.post('/:subdomain/contact'");
    assert.notEqual(contactIndex, -1, 'the contact route should still be inline');
    assert.ok(
        callIndex < contactIndex,
        'the blog band should register where it previously sat, before the contact route',
    );
});

// ROUTE-1: storefrontCacheTags is injected rather than copied. Two cache-tag rules that disagree
// produce a purge that misses, which stays invisible until someone is served stale content.
test('the blog module injects its shared helpers instead of re-declaring them', () => {
    if (!existsSync(blogRoutesPath)) return;

    for (const helper of ['storefrontCacheTags', 'loadPublishedStore', 'normalizePublicRouteToken']) {
        const declares = new RegExp(
            `(?:async\\s+)?function\\s+${helper}\\s*\\(|const\\s+${helper}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?\\(`,
        );
        assert.ok(
            !declares.test(blogRoutesSource),
            `${helper} must be injected, never re-declared in storefront-blog-routes.ts`,
        );
    }
});
