import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storefrontPath = join(testDir, '../../services/api-gateway/src/routes/storefront.ts');
const publicRoutesPath = join(testDir, '../../services/api-gateway/src/routes/storefront/public-routes.ts');
const extractedPath = join(testDir, '../../services/api-gateway/src/routes/storefront/customer-engagement-routes.ts');
// ROUTE-1 (2026-09-05): the address book moved to its own module because
// customer-engagement-routes.ts hit exactly 1500 lines against a `<= 1500` validator. This test
// caught that move, which is the guard working — the band is defined across two files now, so the
// band source is their concatenation IN REGISTRATION ORDER. That order is not assumed: a test below
// asserts the address module is registered after the last inline route, which is what makes
// concatenating engagement-then-address a faithful model of what Hono actually sees.
const addressRoutesPath = join(testDir, '../../services/api-gateway/src/routes/storefront/customer-address-routes.ts');

const storefrontSource = readFileSync(storefrontPath, 'utf8');
const publicRoutesSource = existsSync(publicRoutesPath) ? readFileSync(publicRoutesPath, 'utf8') : '';
const extractedSource = existsSync(extractedPath) ? readFileSync(extractedPath, 'utf8') : '';
const addressRoutesSource = existsSync(addressRoutesPath) ? readFileSync(addressRoutesPath, 'utf8') : '';
const routeBandSource = (extractedSource || storefrontSource) + addressRoutesSource;
const registrationHostSource = publicRoutesSource || storefrontSource;

const expectedRoutes = [
    { method: 'post', path: '/customer/from-order' },
    { method: 'post', path: '/customer/password' },
    { method: 'post', path: '/customer/password/request-reset' },
    { method: 'post', path: '/customer/password/confirm-reset' },
    { method: 'get', path: '/customer/by-email' },
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
    const beforeIndex = registrationHostSource.indexOf(beforeMarker);

    // ROUTE-2: the blog band moved to storefront-blog-routes.ts in ROUTE-1, so the inline
    // `router.get('/:subdomain/blog'` marker no longer exists in the host file and this assertion
    // failed. Resolve the band to wherever it now lives — its registration call when extracted,
    // the inline route when not — which is the same extracted-or-inline fallback this test already
    // applies to the engagement band a few lines below, rather than a new convention.
    const blogRegistrationIndex = registrationHostSource.indexOf('registerStorefrontBlogRoutes(router');
    const inlineBlogIndex = registrationHostSource.indexOf("router.get('/:subdomain/blog'");
    const afterIndex = blogRegistrationIndex === -1 ? inlineBlogIndex : blogRegistrationIndex;
    const extractedCallIndex = registrationHostSource.indexOf('registerStorefrontCustomerEngagementRoutes(router');
    const inlineFirstRouteIndex = registrationHostSource.indexOf("router.post('/customer/from-order'");

    assert.notEqual(beforeIndex, -1, 'page route marker should exist');
    assert.notEqual(afterIndex, -1, 'the blog band should exist, inline or registered');

    const bandIndex = extractedCallIndex === -1 ? inlineFirstRouteIndex : extractedCallIndex;
    assert.notEqual(bandIndex, -1, 'customer engagement band should be inline or registered');
    assert.ok(beforeIndex < bandIndex, 'customer engagement band should stay after page routes');
    assert.ok(bandIndex < afterIndex, 'customer engagement band should stay before blog routes');
});

// ROUTE-1: an extracted module is only real if something registers it. Routes can sit in a file that
// no one calls — they would still satisfy every "route exists" assertion above while being
// unreachable at runtime, which is the specific way an extraction goes wrong.
test('the extracted address module is registered, and registered last', () => {
    assert.ok(
        existsSync(addressRoutesPath),
        'customer-address-routes.ts should exist once the address band is extracted',
    );

    const callIndex = extractedSource.indexOf('registerCustomerAddressRoutes(router');
    assert.notEqual(callIndex, -1, 'customer-engagement-routes.ts must call registerCustomerAddressRoutes');

    assert.ok(
        extractedSource.includes("from './customer-address-routes'"),
        'the module must be imported, not merely named',
    );

    // Registration order is what makes concatenating the two sources a faithful band. Every inline
    // router.* call in the engagement file must come before the address module's registration.
    const lastInlineRoute = extractedSource.lastIndexOf('router.');
    assert.ok(
        callIndex >= lastInlineRoute - 'registerCustomerAddressRoutes('.length,
        'registerCustomerAddressRoutes must be the final registration in the band',
    );
});

// ROUTE-1: the extraction injects normalizeEmail and getVerifiedStoreCustomer rather than copying
// them. getVerifiedStoreCustomer is the check binding a session to THIS store and THIS customer; a
// second copy of a tenant-isolation check is a second one to get wrong, and the two would drift in
// silence because nothing compares them.
test('the address module injects its shared helpers instead of re-declaring them', () => {
    if (!existsSync(addressRoutesPath)) return;

    for (const helper of ['normalizeEmail', 'getVerifiedStoreCustomer']) {
        assert.ok(
            addressRoutesSource.includes(helper),
            `${helper} should be used by the address routes`,
        );
        // A local definition — `function x(`, `const x =`, `async function x(` — is the failure.
        // Destructuring it out of deps (`const { x } = deps`) is the intended shape and is not a
        // definition, so the patterns below are anchored to declaration syntax only.
        const declares = new RegExp(
            `(?:async\\s+)?function\\s+${helper}\\s*\\(|const\\s+${helper}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?\\(`,
        );
        assert.ok(
            !declares.test(addressRoutesSource),
            `${helper} must be injected, never re-declared in customer-address-routes.ts`,
        );
    }
});
