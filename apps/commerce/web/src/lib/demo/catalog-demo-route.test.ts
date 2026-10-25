import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogDemoHref, catalogDemoNavigationTarget, isCatalogDemoRouteMessage, resolveCatalogDemoRoute, CATALOG_DEMO_ROUTE_MESSAGE } from './catalog-demo-route';

test('demo routes retain distinct resources, variant/query state and content types', () => {
    assert.equal(resolveCatalogDemoRoute('/product/shirt-one?variant=size-m#fit-guide').resourceId, 'shirt-one');
    assert.equal(resolveCatalogDemoRoute('/products/trouser-two').resourceId, 'trouser-two');
    assert.equal(resolveCatalogDemoRoute('/collections/linen').resourceSlug, 'linen');
    assert.equal(resolveCatalogDemoRoute('/collections').type, 'list_collections');
    assert.equal(resolveCatalogDemoRoute('/pages/about').type, 'page');
    assert.equal(resolveCatalogDemoRoute('/blog').type, 'blog');
    assert.equal(resolveCatalogDemoRoute('/blog/linen-care').resourceSlug, 'linen-care');
    assert.equal(resolveCatalogDemoRoute('/blogs/journal/linen-care').type, 'article');
    assert.equal(resolveCatalogDemoRoute('/policies/privacy').type, 'policy');
    assert.equal(resolveCatalogDemoRoute('/search?q=linen&page=2').searchParams?.search, 'linen');
    assert.equal(resolveCatalogDemoRoute('/checkout').simulation, 'checkout');
    assert.equal(resolveCatalogDemoRoute('/account/orders').simulation, 'account');
});
test('navigation remains in the selected design with exact path instead of mapping all clicks to one product', () => {
    const target = catalogDemoNavigationTarget('/store/sample-store/product/shirt-one?variant=size-m#fit-guide', 'https://store.example', 'letbuyy-sense', '2.0.0');
    assert.ok(target);
    const query = new URL(target, 'https://store.example').searchParams;
    assert.equal(query.get('demo_path'), '/product/shirt-one?variant=size-m#fit-guide');
    assert.equal(query.get('version'), '2.0.0');
    assert.notEqual(target, catalogDemoNavigationTarget('/product/trouser-two', 'https://store.example', 'letbuyy-sense', '2.0.0'));
});
test('untrusted origins, schemes, traversal, private authority and other-theme jumps cannot escape the demo', () => {
    for (const href of ['https://evil.invalid/product/a', 'javascript:alert(1)', 'data:text/html,hello', '//evil.invalid/cart', '/theme-preview/letbuyy-forge', '/\\evil.invalid/cart']) assert.equal(catalogDemoNavigationTarget(href, 'https://store.example', 'letbuyy-sense'), null, href);
    for (const path of ['https://evil.invalid', '//evil.invalid', '/product/%2Fprivate', '/unknown/resource', '/product/%zz']) assert.equal(resolveCatalogDemoRoute(path).type, 'not_found');
    assert.deepEqual(resolveCatalogDemoRoute('/products?subdomain=real-store&theme_preview_token=secret&search=linen').searchParams, { search: 'linen' });
    assert.throws(() => catalogDemoHref('../private', '/'), /Invalid/);
});
test('route messages require selected-theme identity and canonical bounded path; source/origin are checked by caller', () => {
    const message = { type: CATALOG_DEMO_ROUTE_MESSAGE, slug: 'letbuyy-sense', path: '/product/shirt-one' };
    assert.equal(isCatalogDemoRouteMessage(message, 'letbuyy-sense'), true);
    assert.equal(isCatalogDemoRouteMessage(message, 'letbuyy-forge'), false);
    assert.equal(isCatalogDemoRouteMessage({ ...message, path: 'https://evil.invalid' }, 'letbuyy-sense'), false);
    assert.equal(isCatalogDemoRouteMessage({ ...message, path: '/products?theme_preview_token=secret' }, 'letbuyy-sense'), false);
});
test('demo queries reuse canonical discovery fields and retain repeated connector values through navigation', () => {
    const route = resolveCatalogDemoRoute('/products?connector=usb-c&connector=hdmi&electronics_kind=hub&power_output_w=65&books_ruling=lined&personalization_method=engraving');
    assert.notEqual(route.type, 'not_found');
    assert.deepEqual(route.discoveryQuery?.connector, ['usb-c', 'hdmi']);
    assert.equal(route.discoveryQuery?.power_output_w, 65);
    assert.equal(route.discoveryQuery?.books_ruling, 'lined');
    assert.equal(route.discoveryQuery?.personalization_method, 'engraving');
    assert.equal(route.searchParams?.connector, undefined, 'compatibility scalar view cannot silently lose a selected connector');
    const target = catalogDemoNavigationTarget('/store/sample' + route.path, 'https://store.example', 'letbuyy-forge', '2.0.0');
    assert.ok(target);
    const nested = new URL(new URL(target, 'https://store.example').searchParams.get('demo_path')!, 'https://store.example');
    assert.deepEqual(nested.searchParams.getAll('connector'), ['usb-c', 'hdmi']);
});
test('invalid, unknown and repeated scalar filters fail visibly; aliases normalize through canonical validation', () => {
    for (const query of ['page=1&page=2', 'connector=usb-c&connector=usb-c', 'power_output_w=-1', 'unknown_filter=yes', 'min_price=20&max_price=10', 'sort=unverified', 'variant=a&variant=b']) {
        assert.equal(resolveCatalogDemoRoute('/products?' + query).type, 'not_found', query);
    }
    const route = resolveCatalogDemoRoute('/search?q=linen&sort_by=price-ascending&price_min=10');
    assert.equal(route.discoveryQuery?.search, 'linen');
    assert.equal(route.discoveryQuery?.sort, 'price-asc');
    assert.equal(route.discoveryQuery?.min_price, 10);
});
