/**
 * Phase W — Dynamic Source Binding Tests
 *
 * Gate: pnpm typecheck test --filter=@letbuyy/theme-engine
 *
 * Covered:
 *  - isDynamicSourceDescriptor guard: correct discrimination for all descriptor shapes,
 *    all scalar types, array, null, undefined, plain objects without __lb_binding
 *  - resolveDynamicSourceDescriptors:
 *      plain scalar / literal values are byte-identical (backward-compat)
 *      known product id resolves to the site-scoped product drop
 *      unknown product id resolves to null (no cross-tenant leak)
 *      foreign-site id (present in test BUT absent from siteDrops) resolves to null
 *      fallback is returned when id is missing and fallback is provided
 *      collection / page / blog / menu resource types all resolve
 *      metafield descriptor → NOT-CONNECTED → returns null (or fallback)
 *      static descriptor behaves byte-identically to the wrapped literal
 *      BLOCKED_DROP_KEYS (credential-adjacent keys) stripped from resolved drop objects
 *      mixed settings map: only descriptors are resolved; scalars unchanged
 *      empty settings map returns empty map (determinism)
 *      determinism: same inputs always produce same output
 *  - Tenancy / cross-tenant binding leak
 *      an id from Site B never resolves when Site A's siteDrops are supplied
 *      productsById with id not present → null (not a crash, not a leak)
 *  - Edge cases
 *      null siteDrops value for a map → null resolution
 *      __lb_binding:true with unknown source → guard returns false (not a descriptor)
 *      nested object that is NOT a descriptor → passes through unchanged
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isDynamicSourceDescriptor,
    resolveDynamicSourceDescriptors,
    BINDING_BLOCKED_KEYS,
    BLOCKED_DROP_KEYS,
    type DynamicSourceDescriptor,
    type ResourceBinding,
    type MetafieldBinding,
    type StaticBinding,
    type SiteDrops,
} from '../src/index.ts';

// Sync guard: BINDING_BLOCKED_KEYS is a local copy of theme-renderer's BLOCKED_DROP_KEYS (kept
// local to avoid a circular import). This test fails if the renderer's credential-key blocklist
// ever gains a key the binding resolver does not also strip — preventing a silent security drift.
test('W BINDING_BLOCKED_KEYS is a superset of BLOCKED_DROP_KEYS (no credential-key drift)', () => {
    for (const key of BLOCKED_DROP_KEYS) {
        assert.ok(
            BINDING_BLOCKED_KEYS.has(key),
            `BINDING_BLOCKED_KEYS is missing "${key}" from theme-renderer's BLOCKED_DROP_KEYS — update the local copy in dynamic-source-binding.ts`,
        );
    }
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SITE_A_PRODUCT_ID = 'aaaa0000-0000-0000-0000-000000000001';
const SITE_A_PRODUCT_ID_2 = 'aaaa0000-0000-0000-0000-000000000002';
const SITE_A_COLLECTION_ID = 'bbbb0000-0000-0000-0000-000000000001';
const SITE_A_PAGE_ID = 'cccc0000-0000-0000-0000-000000000001';
const SITE_A_BLOG_ID = 'dddd0000-0000-0000-0000-000000000001';
const SITE_A_MENU_ID = 'eeee0000-0000-0000-0000-000000000001';
const SITE_B_PRODUCT_ID = 'ffff0000-0000-0000-0000-000000000099'; // belongs to a different site

const siteAProduct = { id: SITE_A_PRODUCT_ID, title: 'Drop Hoodie', handle: 'drop-hoodie', price: 299900 };
const siteAProduct2 = { id: SITE_A_PRODUCT_ID_2, title: 'Track Jacket', handle: 'track-jacket', price: 349900 };
const siteACollection = { id: SITE_A_COLLECTION_ID, title: 'New Arrivals', handle: 'new-arrivals' };
const siteAPage = { id: SITE_A_PAGE_ID, title: 'About Us', slug: 'about-us' };
const siteABlog = { id: SITE_A_BLOG_ID, title: 'Style Notes', slug: 'style-notes' };
const siteAMenu = { id: SITE_A_MENU_ID, name: 'Main Menu', handle: 'main-menu' };

/** Site A's drops — used for all positive-path tests. Site B's id is intentionally absent. */
const siteADrops: SiteDrops = {
    productsById: {
        [SITE_A_PRODUCT_ID]: siteAProduct,
        [SITE_A_PRODUCT_ID_2]: siteAProduct2,
    },
    collectionsById: { [SITE_A_COLLECTION_ID]: siteACollection },
    pagesById: { [SITE_A_PAGE_ID]: siteAPage },
    blogPostsById: { [SITE_A_BLOG_ID]: siteABlog },
    menusById: { [SITE_A_MENU_ID]: siteAMenu },
};

function makeResourceBinding(
    resourceType: ResourceBinding['resourceType'],
    id: string,
    fallback?: unknown,
): ResourceBinding {
    return fallback !== undefined
        ? { __lb_binding: true, source: 'resource', resourceType, id, fallback }
        : { __lb_binding: true, source: 'resource', resourceType, id };
}

function makeMetafieldBinding(fallback?: unknown): MetafieldBinding {
    return fallback !== undefined
        ? { __lb_binding: true, source: 'metafield', namespace: 'custom', key: 'badge', owner_type: 'product', owner_id: SITE_A_PRODUCT_ID, fallback }
        : { __lb_binding: true, source: 'metafield', namespace: 'custom', key: 'badge', owner_type: 'product', owner_id: SITE_A_PRODUCT_ID };
}

function makeStaticBinding(value: unknown): StaticBinding {
    return { __lb_binding: true, source: 'static', value };
}

// ---------------------------------------------------------------------------
// isDynamicSourceDescriptor — type guard
// ---------------------------------------------------------------------------

test('W isDynamicSourceDescriptor: resource binding returns true', () => {
    const d: DynamicSourceDescriptor = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    assert.equal(isDynamicSourceDescriptor(d), true);
});

test('W isDynamicSourceDescriptor: metafield binding returns true', () => {
    assert.equal(isDynamicSourceDescriptor(makeMetafieldBinding()), true);
});

test('W isDynamicSourceDescriptor: static binding returns true', () => {
    assert.equal(isDynamicSourceDescriptor(makeStaticBinding('hello')), true);
});

test('W isDynamicSourceDescriptor: plain string returns false', () => {
    assert.equal(isDynamicSourceDescriptor('Hello World'), false);
});

test('W isDynamicSourceDescriptor: number returns false', () => {
    assert.equal(isDynamicSourceDescriptor(42), false);
});

test('W isDynamicSourceDescriptor: boolean true returns false (not a descriptor)', () => {
    assert.equal(isDynamicSourceDescriptor(true), false);
});

test('W isDynamicSourceDescriptor: boolean false returns false', () => {
    assert.equal(isDynamicSourceDescriptor(false), false);
});

test('W isDynamicSourceDescriptor: null returns false', () => {
    assert.equal(isDynamicSourceDescriptor(null), false);
});

test('W isDynamicSourceDescriptor: undefined returns false', () => {
    assert.equal(isDynamicSourceDescriptor(undefined), false);
});

test('W isDynamicSourceDescriptor: array returns false', () => {
    assert.equal(isDynamicSourceDescriptor(['a', 'b']), false);
});

test('W isDynamicSourceDescriptor: plain object without __lb_binding returns false', () => {
    assert.equal(isDynamicSourceDescriptor({ source: 'resource', id: 'abc' }), false);
});

test('W isDynamicSourceDescriptor: object with __lb_binding:false returns false', () => {
    assert.equal(isDynamicSourceDescriptor({ __lb_binding: false, source: 'resource', id: 'x' }), false);
});

test('W isDynamicSourceDescriptor: object with __lb_binding:true but unknown source returns false', () => {
    assert.equal(isDynamicSourceDescriptor({ __lb_binding: true, source: 'unknown_future_source' }), false);
});

test('W isDynamicSourceDescriptor: object with __lb_binding:true but no source returns false', () => {
    assert.equal(isDynamicSourceDescriptor({ __lb_binding: true }), false);
});

test('W isDynamicSourceDescriptor: empty object returns false', () => {
    assert.equal(isDynamicSourceDescriptor({}), false);
});

// ---------------------------------------------------------------------------
// resolveDynamicSourceDescriptors — backward-compat (plain values unchanged)
// ---------------------------------------------------------------------------

test('W resolve: plain string value is byte-identical (backward-compat)', () => {
    const settings = { heading: 'New Season' };
    const out = resolveDynamicSourceDescriptors(settings, siteADrops);
    assert.equal(out['heading'], 'New Season');
});

test('W resolve: plain number value is byte-identical', () => {
    const out = resolveDynamicSourceDescriptors({ columns: 4 }, siteADrops);
    assert.equal(out['columns'], 4);
});

test('W resolve: plain boolean value is byte-identical', () => {
    const out = resolveDynamicSourceDescriptors({ showSearch: true }, siteADrops);
    assert.equal(out['showSearch'], true);
});

test('W resolve: null value is byte-identical', () => {
    const out = resolveDynamicSourceDescriptors({ image: null }, siteADrops);
    assert.equal(out['image'], null);
});

test('W resolve: plain object (non-descriptor) is byte-identical', () => {
    const nested = { key: 'value', nested: { x: 1 } };
    const out = resolveDynamicSourceDescriptors({ config: nested }, siteADrops);
    assert.deepEqual(out['config'], nested);
});

test('W resolve: array value is byte-identical', () => {
    const arr = ['a', 'b', 'c'];
    const out = resolveDynamicSourceDescriptors({ tags: arr }, siteADrops);
    assert.deepEqual(out['tags'], arr);
});

test('W resolve: empty settings returns empty record', () => {
    const out = resolveDynamicSourceDescriptors({}, siteADrops);
    assert.deepEqual(out, {});
});

// ---------------------------------------------------------------------------
// resolveDynamicSourceDescriptors — static binding
// ---------------------------------------------------------------------------

test('W resolve static: string value behaves byte-identically to plain literal', () => {
    const binding = makeStaticBinding('Drop Season');
    const out = resolveDynamicSourceDescriptors({ heading: binding }, siteADrops);
    assert.equal(out['heading'], 'Drop Season');
});

test('W resolve static: boolean true behaves byte-identically', () => {
    const out = resolveDynamicSourceDescriptors({ visible: makeStaticBinding(true) }, siteADrops);
    assert.equal(out['visible'], true);
});

test('W resolve static: null value behaves byte-identically', () => {
    const out = resolveDynamicSourceDescriptors({ image: makeStaticBinding(null) }, siteADrops);
    assert.equal(out['image'], null);
});

test('W resolve static: number value behaves byte-identically', () => {
    const out = resolveDynamicSourceDescriptors({ columns: makeStaticBinding(3) }, siteADrops);
    assert.equal(out['columns'], 3);
});

// ---------------------------------------------------------------------------
// resolveDynamicSourceDescriptors — resource binding (positive paths)
// ---------------------------------------------------------------------------

test('W resolve resource: product id resolves to site-scoped product drop', () => {
    const binding = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    const out = resolveDynamicSourceDescriptors({ featuredProduct: binding }, siteADrops);
    const resolved = out['featuredProduct'] as Record<string, unknown>;
    assert.ok(resolved !== null, 'expected non-null resolved product');
    assert.equal(resolved['id'], SITE_A_PRODUCT_ID);
    assert.equal(resolved['title'], 'Drop Hoodie');
    assert.equal(resolved['handle'], 'drop-hoodie');
});

test('W resolve resource: collection id resolves to site-scoped collection drop', () => {
    const binding = makeResourceBinding('collection', SITE_A_COLLECTION_ID);
    const out = resolveDynamicSourceDescriptors({ collection: binding }, siteADrops);
    const resolved = out['collection'] as Record<string, unknown>;
    assert.equal(resolved['title'], 'New Arrivals');
});

test('W resolve resource: page id resolves to site-scoped page drop', () => {
    const binding = makeResourceBinding('page', SITE_A_PAGE_ID);
    const out = resolveDynamicSourceDescriptors({ aboutPage: binding }, siteADrops);
    const resolved = out['aboutPage'] as Record<string, unknown>;
    assert.equal(resolved['title'], 'About Us');
});

test('W resolve resource: blog id resolves to site-scoped blog drop', () => {
    const binding = makeResourceBinding('blog', SITE_A_BLOG_ID);
    const out = resolveDynamicSourceDescriptors({ blog: binding }, siteADrops);
    const resolved = out['blog'] as Record<string, unknown>;
    assert.equal(resolved['title'], 'Style Notes');
});

test('W resolve resource: menu id resolves to site-scoped menu drop', () => {
    const binding = makeResourceBinding('menu', SITE_A_MENU_ID);
    const out = resolveDynamicSourceDescriptors({ menu: binding }, siteADrops);
    const resolved = out['menu'] as Record<string, unknown>;
    assert.equal(resolved['name'], 'Main Menu');
});

test('W resolve resource: multiple descriptors in same settings map all resolve independently', () => {
    const settings = {
        product1: makeResourceBinding('product', SITE_A_PRODUCT_ID),
        product2: makeResourceBinding('product', SITE_A_PRODUCT_ID_2),
        title: 'Static heading',
    };
    const out = resolveDynamicSourceDescriptors(settings, siteADrops);
    const p1 = out['product1'] as Record<string, unknown>;
    const p2 = out['product2'] as Record<string, unknown>;
    assert.equal(p1['title'], 'Drop Hoodie');
    assert.equal(p2['title'], 'Track Jacket');
    assert.equal(out['title'], 'Static heading');
});

// ---------------------------------------------------------------------------
// resolveDynamicSourceDescriptors — resource binding (miss / foreign paths)
// ---------------------------------------------------------------------------

test('W resolve resource: unknown id returns null (no cross-tenant leak)', () => {
    const binding = makeResourceBinding('product', 'not-a-known-id');
    const out = resolveDynamicSourceDescriptors({ p: binding }, siteADrops);
    assert.equal(out['p'], null);
});

test('W resolve resource: Site B id not in Site A siteDrops → null (tenancy boundary)', () => {
    // SITE_B_PRODUCT_ID is intentionally absent from siteADrops — this is the cross-tenant test.
    const binding = makeResourceBinding('product', SITE_B_PRODUCT_ID);
    const out = resolveDynamicSourceDescriptors({ p: binding }, siteADrops);
    assert.equal(out['p'], null, 'a foreign-site product id must never resolve to a drop');
});

test('W resolve resource: missing id returns fallback when provided', () => {
    const binding = makeResourceBinding('product', 'no-such-id', { title: 'Placeholder' });
    const out = resolveDynamicSourceDescriptors({ p: binding }, siteADrops);
    assert.deepEqual(out['p'], { title: 'Placeholder' });
});

test('W resolve resource: productsById map absent → null', () => {
    const drops: SiteDrops = {}; // no productsById at all
    const binding = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    assert.equal(out['p'], null);
});

test('W resolve resource: known collection id, but collectionsById absent → null', () => {
    const drops: SiteDrops = { productsById: { [SITE_A_PRODUCT_ID]: siteAProduct } }; // no collectionsById
    const binding = makeResourceBinding('collection', SITE_A_COLLECTION_ID);
    const out = resolveDynamicSourceDescriptors({ c: binding }, drops);
    assert.equal(out['c'], null);
});

test('W resolve resource: empty siteDrops → all bindings resolve to null', () => {
    const settings = {
        p: makeResourceBinding('product', SITE_A_PRODUCT_ID),
        c: makeResourceBinding('collection', SITE_A_COLLECTION_ID),
    };
    const out = resolveDynamicSourceDescriptors(settings, {});
    assert.equal(out['p'], null);
    assert.equal(out['c'], null);
});

// ---------------------------------------------------------------------------
// resolveDynamicSourceDescriptors — metafield (NOT-CONNECTED honesty)
// ---------------------------------------------------------------------------

test('W resolve metafield: returns null when no fallback (NOT-CONNECTED)', () => {
    const binding = makeMetafieldBinding();
    const out = resolveDynamicSourceDescriptors({ badge: binding }, siteADrops);
    assert.equal(out['badge'], null);
});

test('W resolve metafield: returns fallback string when provided', () => {
    const binding = makeMetafieldBinding('Sale');
    const out = resolveDynamicSourceDescriptors({ badge: binding }, siteADrops);
    assert.equal(out['badge'], 'Sale');
});

test('W resolve metafield: returns fallback object when provided', () => {
    const fallback = { text: 'New', color: '#FF0000' };
    const binding = makeMetafieldBinding(fallback);
    const out = resolveDynamicSourceDescriptors({ badge: binding }, siteADrops);
    assert.deepEqual(out['badge'], fallback);
});

test('W resolve metafield: null fallback is returned as-is', () => {
    const binding: MetafieldBinding = { __lb_binding: true, source: 'metafield', namespace: 'x', key: 'y', owner_type: 'product', owner_id: '1', fallback: null };
    const out = resolveDynamicSourceDescriptors({ v: binding }, siteADrops);
    assert.equal(out['v'], null);
});

// ---------------------------------------------------------------------------
// Sanitizer safety — BLOCKED_DROP_KEYS stripped from resolved drops
// ---------------------------------------------------------------------------

test('W sanitize: resolved product drop with api_key is stripped', () => {
    const dangerousDrop = {
        id: SITE_A_PRODUCT_ID,
        title: 'Drop Hoodie',
        api_key: 'sk_live_should_never_reach_liquid',
    };
    const drops: SiteDrops = { productsById: { [SITE_A_PRODUCT_ID]: dangerousDrop } };
    const binding = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    const resolved = out['p'] as Record<string, unknown>;
    assert.equal(resolved['title'], 'Drop Hoodie');
    assert.ok(!('api_key' in resolved), 'api_key must be stripped from resolved drop');
});

test('W sanitize: resolved drop with access_token is stripped', () => {
    const dangerousDrop = { id: 'x', title: 'Item', access_token: 'tok_1234' };
    const drops: SiteDrops = { productsById: { ['x']: dangerousDrop } };
    const binding = makeResourceBinding('product', 'x');
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    const resolved = out['p'] as Record<string, unknown>;
    assert.ok(!('access_token' in resolved), 'access_token must be stripped');
});

test('W sanitize: resolved drop with password is stripped', () => {
    const dangerousDrop = { id: 'y', title: 'Item', password: 'hunter2' };
    const drops: SiteDrops = { productsById: { ['y']: dangerousDrop } };
    const binding = makeResourceBinding('product', 'y');
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    const resolved = out['p'] as Record<string, unknown>;
    assert.ok(!('password' in resolved), 'password must be stripped');
});

test('W sanitize: resolved drop with __proto__ is stripped', () => {
    // Note: JSON-serialised objects generally cannot carry __proto__ as an own-enumerable key
    // but we still guard against it for defense-in-depth.
    const dangerousDrop: Record<string, unknown> = { id: 'z', title: 'Item' };
    // Manually set the key (not via literal — prototype-chain safety)
    Object.defineProperty(dangerousDrop, '__proto__', { value: {}, enumerable: true, configurable: true });
    const drops: SiteDrops = { productsById: { ['z']: dangerousDrop } };
    const binding = makeResourceBinding('product', 'z');
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    const resolved = out['p'] as Record<string, unknown>;
    // __proto__ must not appear as an own enumerable key on the output
    assert.ok(!Object.prototype.hasOwnProperty.call(resolved, '__proto__'), '__proto__ must be stripped');
});

test('W sanitize: safe fields on a resolved drop are preserved', () => {
    const drops: SiteDrops = { productsById: { [SITE_A_PRODUCT_ID]: siteAProduct } };
    const binding = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    const out = resolveDynamicSourceDescriptors({ p: binding }, drops);
    const resolved = out['p'] as Record<string, unknown>;
    // Safe fields survive the filter
    assert.equal(resolved['id'], SITE_A_PRODUCT_ID);
    assert.equal(resolved['title'], 'Drop Hoodie');
    assert.equal(resolved['handle'], 'drop-hoodie');
    assert.equal(resolved['price'], 299900);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('W determinism: same inputs always produce same output (run twice)', () => {
    const settings = {
        product: makeResourceBinding('product', SITE_A_PRODUCT_ID),
        heading: 'Drop Season',
        count: 4,
    };
    const out1 = resolveDynamicSourceDescriptors(settings, siteADrops);
    const out2 = resolveDynamicSourceDescriptors(settings, siteADrops);
    assert.deepEqual(out1, out2);
});

test('W determinism: calling with empty siteDrops twice is stable', () => {
    const settings = { p: makeResourceBinding('product', SITE_A_PRODUCT_ID) };
    const out1 = resolveDynamicSourceDescriptors(settings, {});
    const out2 = resolveDynamicSourceDescriptors(settings, {});
    assert.deepEqual(out1, out2);
    assert.equal(out1['p'], null);
});

test('W determinism: does not mutate the original settings object', () => {
    const original: Record<string, unknown> = {
        heading: 'Static',
        product: makeResourceBinding('product', SITE_A_PRODUCT_ID),
    };
    // Keep a snapshot of the original to compare after resolution
    const originalHeading = original['heading'];
    const originalProductDescriptor = original['product'];
    resolveDynamicSourceDescriptors(original, siteADrops);
    // Original must be unchanged
    assert.equal(original['heading'], originalHeading);
    assert.deepEqual(original['product'], originalProductDescriptor);
});

// ---------------------------------------------------------------------------
// Mixed settings map — scalars and descriptors coexist
// ---------------------------------------------------------------------------

test('W mixed: descriptor fields resolve while scalar fields pass through unchanged', () => {
    const settings = {
        title: 'Featured Collection',
        subtitle: 'Hand-picked for you',
        columns: 3,
        showBadge: false,
        collection: makeResourceBinding('collection', SITE_A_COLLECTION_ID),
    };
    const out = resolveDynamicSourceDescriptors(settings, siteADrops);

    assert.equal(out['title'], 'Featured Collection');
    assert.equal(out['subtitle'], 'Hand-picked for you');
    assert.equal(out['columns'], 3);
    assert.equal(out['showBadge'], false);

    const col = out['collection'] as Record<string, unknown>;
    assert.equal(col['title'], 'New Arrivals');
});

test('W mixed: unknown descriptor id in same map as known → only known resolves', () => {
    const settings = {
        p1: makeResourceBinding('product', SITE_A_PRODUCT_ID),
        p2: makeResourceBinding('product', 'not-in-drops-uuid'),
    };
    const out = resolveDynamicSourceDescriptors(settings, siteADrops);
    const p1 = out['p1'] as Record<string, unknown>;
    assert.equal(p1['title'], 'Drop Hoodie');
    assert.equal(out['p2'], null, 'unknown product id must resolve to null');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('W edge: binding with source=resource and unknown resourceType resolves to null', () => {
    // Simulate a future resourceType that this version does not know about
    const futureBinding = {
        __lb_binding: true as const,
        source: 'resource' as const,
        resourceType: 'blog_comment' as unknown as ResourceBinding['resourceType'],
        id: 'some-id',
    };
    const out = resolveDynamicSourceDescriptors({ x: futureBinding }, siteADrops);
    assert.equal(out['x'], null);
});

test('W edge: static binding with undefined value returns undefined', () => {
    const out = resolveDynamicSourceDescriptors({ x: makeStaticBinding(undefined) }, siteADrops);
    assert.equal(out['x'], undefined);
});

test('W edge: static binding wrapping an array returns the array', () => {
    const arr = [1, 2, 3];
    const out = resolveDynamicSourceDescriptors({ x: makeStaticBinding(arr) }, siteADrops);
    assert.deepEqual(out['x'], arr);
});

test('W edge: descriptor nested inside a non-descriptor object is NOT resolved (only top-level keys)', () => {
    // resolveDynamicSourceDescriptors only processes top-level keys.
    // A descriptor buried inside a plain object value is not a top-level descriptor —
    // it passes through as a plain nested value (the outer object has no __lb_binding).
    const nestedDescriptor = makeResourceBinding('product', SITE_A_PRODUCT_ID);
    const settings = { config: { sub: nestedDescriptor } };
    const out = resolveDynamicSourceDescriptors(settings, siteADrops);
    // The top-level 'config' is a plain object (not a descriptor) → passes through unchanged
    const config = out['config'] as Record<string, unknown>;
    assert.deepEqual(config['sub'], nestedDescriptor, 'nested descriptor inside plain object is not resolved');
});
