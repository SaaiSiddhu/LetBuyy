import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '@letbuyy/theme-engine';
import { catalogDemoRoute, selectCatalogDemoProducts } from '../theme-engine/catalog-demo-data';
import { catalogDemoStateNamespace, resolveCatalogDemoCollection, resolveCatalogDemoContent } from './catalog-demo-dispatch';

const listings = firstPartyThemeListings();
const v210Artifacts = new URL('../../../../../../docs/implementation/niche-theme-programme/release-v210/proposals/6e8408ba3449a0feb08d131e7d46764e64d686271f4c72998205ba17c49fbdb2/', import.meta.url);
test('catalog samples require the exact selected package slug and version', () => {
    const bundle = createFirstPartyCatalogBundle('letbuyy-sense');
    const template = { liquidBundle: bundle };
    assert.equal(resolveCatalogDemoContent('letbuyy-sense', '1.0.0', template), null);
    assert.equal(resolveCatalogDemoContent('letbuyy-aura', '2.0.0', template), null);
    assert.equal(resolveCatalogDemoContent('unknown-theme', '2.0.0', template), null);
    assert.equal(resolveCatalogDemoContent('__proto__', '2.0.0', template), null);
    assert.equal(resolveCatalogDemoContent('letbuyy-sense', '2.0.0', { liquidBundle: {} }), null);
});
test('every registered v2 leaf has isolated products, collections and presentation', () => {
    for (const listing of listings) {
        const bundle = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
        // Before coordinated catalog activation, v1 leaves must remain unavailable here.
        if (bundle.package.version !== '2.0.0') {
            assert.equal(resolveCatalogDemoContent(listing.slug, bundle.package.version, { liquidBundle: bundle }), null);
            continue;
        }
        const original = JSON.stringify(bundle);
        const content = resolveCatalogDemoContent(listing.slug, bundle.package.version, { liquidBundle: bundle });
        assert.ok(content, listing.slug);
        assert.ok(content.products.length > 1);
        assert.ok(content.collections.length > 1);
        assert.equal(JSON.stringify(bundle), original, 'never amend the installed package');
        const again = resolveCatalogDemoContent(listing.slug, bundle.package.version, { liquidBundle: bundle });
        assert.notEqual(again?.products[0], content.products[0]);
        assert.notEqual(again?.navigation.main, content.navigation.main);
        assert.ok(Object.isFrozen(content));
        assert.ok(Object.isFrozen(content.products[0]));
    }
});

test('every admitted 2.1.0 release artifact has an isolated public catalog sample', () => {
    for (const slug of ['letbuyy-aura', 'letbuyy-bloom', 'letbuyy-craft', 'letbuyy-dawn', 'letbuyy-forge', 'letbuyy-nova', 'letbuyy-refresh', 'letbuyy-ride', 'letbuyy-summit']) {
        const artifact = JSON.parse(readFileSync(new URL(`${slug}-2.1.0.json`, v210Artifacts), 'utf8')) as { document: Record<string, unknown> };
        const original = JSON.stringify(artifact.document);
        const content = resolveCatalogDemoContent(slug, '2.1.0', artifact.document);
        assert.ok(content, slug);
        assert.equal(content.version, '2.1.0');
        assert.ok(content.products.length > 1, slug);
        assert.ok(content.collections.length > 1, slug);
        assert.equal(JSON.stringify(artifact.document), original, `${slug}: release bytes must remain untouched`);
        assert.equal(resolveCatalogDemoContent(slug, '2.0.0', artifact.document), null, `${slug}: a stale URL cannot select a new package`);
        assert.ok(catalogDemoStateNamespace(slug, '2.1.0', 'visitor_1111111111111111'));
        assert.notEqual(catalogDemoStateNamespace(slug, '2.0.0', 'visitor_1111111111111111'), catalogDemoStateNamespace(slug, '2.1.0', 'visitor_1111111111111111'));
    }
});

test('collection membership is explicit and unknown collections never show the entire catalog', () => {
    const bundle = createFirstPartyCatalogBundle('letbuyy-sense');
    const content = resolveCatalogDemoContent('letbuyy-sense', '2.0.0', { liquidBundle: bundle })!;
    assert.equal(resolveCatalogDemoCollection(content, 'unknown'), null);
    assert.equal(resolveCatalogDemoCollection(content, content.collections[0].id)?.length, 1);
    assert.notEqual(resolveCatalogDemoCollection(content, content.collections[0].id)?.[0].id, resolveCatalogDemoCollection(content, content.collections[1].id)?.[0].id);
    assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: undefined }, content.collections[0].id), null);
    assert.deepEqual(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [content.collections[0].id]: [] } }, content.collections[0].id), []);
    assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [content.collections[0].id]: ['foreign-product'] } }, content.collections[0].id), null);
});
test('demo state namespace includes theme, exact version and bounded visitor identity', () => {
    const a = catalogDemoStateNamespace('letbuyy-sense', '2.0.0', 'visitor_1111111111111111');
    assert.ok(a);
    assert.notEqual(a, catalogDemoStateNamespace('letbuyy-aura', '2.0.0', 'visitor_1111111111111111'));
    assert.notEqual(a, catalogDemoStateNamespace('letbuyy-sense', '2.0.0', 'visitor_2222222222222222'));
    assert.equal(catalogDemoStateNamespace('letbuyy-sense', '1.0.0', 'visitor_1111111111111111'), null);
    assert.equal(catalogDemoStateNamespace('letbuyy-sense', '2.0.0', '../merchant'), null);
});

test('all ten actual sample contexts resolve every named shelf in order and preserve known empty shelves', () => {
    let themes = 0, shelves = 0, empty = 0;
    for (const listing of firstPartyThemeListings({ designVersion: '2.0.0' })) {
        const bundle = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
        const context = resolveCatalogDemoContent(listing.slug, '2.0.0', { liquidBundle: bundle })!;
        themes++;
        assert.ok(context.collectionProductIds, listing.slug);
        assert.ok(Object.isFrozen(context.collectionProductIds));
        for (const collection of context.collections) {
            shelves++;
            const expected: string[] | undefined = context.collectionProductIds[collection.id];
            assert.ok(expected, `${listing.slug}/${collection.title}: explicit membership required`);
            assert.equal(new Set(expected).size, expected.length, 'no duplicate shelf entries');
            assert.equal(collection.product_count, expected.length, `${listing.slug}/${collection.title}: declared count matches membership`);
            assert.deepEqual(resolveCatalogDemoCollection(context, collection.id)?.map(product => product.id), expected);
            const routeIdentity = 'handle' in collection && typeof collection.handle === 'string' ? collection.handle : collection.id;
            assert.deepEqual(resolveCatalogDemoCollection(context, routeIdentity)?.map(product => product.id), expected);
            const routed = resolveCatalogDemoContent(listing.slug, '2.0.0', { liquidBundle: bundle }, `/collections/${routeIdentity}`)!;
            const selected = selectCatalogDemoProducts(routed, catalogDemoRoute(routed));
            assert.deepEqual(selected.products.map(product => product.id), expected);
            assert.equal(selected.pagination.total, expected.length);
            if (!expected.length) { empty++; assert.deepEqual(resolveCatalogDemoCollection(context, collection.id), []); }
            assert.equal(resolveCatalogDemoCollection({ ...context, collectionProductIds: {} }, collection.id), null);
            assert.equal(resolveCatalogDemoCollection({ ...context, collectionProductIds: { [collection.id]: ['foreign-product-id'] } }, collection.id), null);
        }
        assert.equal(resolveCatalogDemoCollection(context, 'missing-shelf'), null);
        const second = resolveCatalogDemoContent(listing.slug, '2.0.0', { liquidBundle: bundle })!;
        assert.notEqual(context.collectionProductIds, second.collectionProductIds);
    }
    assert.equal(themes, 10); assert.ok(shelves > 20); assert.ok(empty >= 3, 'explicit Circuit and Marginalia empty shelves remain empty');
});
