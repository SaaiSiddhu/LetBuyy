// T4 W4 (CAP-C24) — isStorefrontInternalOnlyPath is an exact-string allowlist deciding which
// gateway calls get the internal-app HMAC signature attached. It used to compare against the
// FULL request path including any query string, so any call carrying query params — most of
// them, since these are almost all GET reads — silently never matched, never got signed, and
// the gateway correctly rejected the (never-signed) request. Fixed to match on the pathname
// alone. This test proves the fix without widening the matched set: a query string or trailing
// slash must not change the verdict, and a similarly-named-but-different path must still miss.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isStorefrontInternalOnlyPath } from './internal-only-paths';

test('T4 W4: a literal internal-only path with a query string now matches', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/order-stats?limit=10'), true);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/addresses?store_id=abc'), true);
});

test('T4 W4: a similarly-named but distinct path does NOT match, query string or not', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/order-stats-public'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/order-stats-public?limit=10'), false);
});

test('only a UUID address mutation route inherits the exact address endpoint signing rule', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/addresses/6d604f48-9954-4a47-91a2-a06c834785ad'), true);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/addresses/not-a-uuid'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/addresses/6d604f48-9954-4a47-91a2-a06c834785ad/nested'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/addresses-extra/6d604f48-9954-4a47-91a2-a06c834785ad'), false);
});

test('every explicitly listed internal storefront path matches bare, with a query string, and with a trailing slash', () => {
    const literalPaths = [
        '/storefront/customer/from-order',
        '/storefront/customer/by-email',
        '/storefront/customer/password',
        '/storefront/customer/login-success',
        '/storefront/customer/order-credential',
        '/storefront/customer/order-credential/login',
        '/storefront/customer/order-credential/login-success',
        '/storefront/customer/order-stats',
        '/storefront/customer/addresses',
    ];
    for (const path of literalPaths) {
        assert.equal(isStorefrontInternalOnlyPath(path), true, `${path} (bare) must match`);
        assert.equal(isStorefrontInternalOnlyPath(`${path}?store_id=abc&email=x%40y.com`), true, `${path} (with query) must match`);
        assert.equal(isStorefrontInternalOnlyPath(`${path}/`), true, `${path}/ (trailing slash) must match`);
    }
});

test('T4 W4: the orders/contact pattern still matches with a query string', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/snaz/orders/contact'), true);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/snaz/orders/contact?ref=footer'), true);
    // the [^/]+ segment must still not cross a slash
    assert.equal(isStorefrontInternalOnlyPath('/storefront/snaz/nested/orders/contact'), false);
});

test('T4 W4: an unrelated storefront path never matches, with or without a query string', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/orders'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/orders?store_id=abc&email=x%40y.com'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/wishlist'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/snaz/products'), false);
});

test('T4 W4: the matched set is not widened — a prefix of a real path is not itself a match', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/customer/by-email-extra'), false);
});
