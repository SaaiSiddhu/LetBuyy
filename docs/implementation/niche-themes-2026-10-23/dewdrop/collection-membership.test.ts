/** Synthetic fixture contract exercised through the marketplace-owned shared resolver, without modifying its dispatcher. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCatalogDemoCollection, type CatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { resolveCatalogDemoRoute } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-route';
import { DEWDROP_DEMO_PRODUCTS, DEWDROP_DEMO_COLLECTIONS, DEWDROP_DEMO_COLLECTION_PRODUCT_IDS, DEWDROP_DEMO_NAVIGATION } from '../../../../apps/commerce/web/src/lib/demo/dewdrop-demo';

function fixture(): CatalogDemoContent {
    return {
        slug: 'letbuyy-aura', name: 'Dewdrop', route: resolveCatalogDemoRoute('/'), version: '2.0.0', template: {},
        products: structuredClone(DEWDROP_DEMO_PRODUCTS), collections: structuredClone(DEWDROP_DEMO_COLLECTIONS),
        collectionProductIds: structuredClone(DEWDROP_DEMO_COLLECTION_PRODUCT_IDS), navigation: structuredClone(DEWDROP_DEMO_NAVIGATION),
    };
}
test('each actual collection has exact durable product membership, shelf order and matching declared count', () => {
    const expected = [['Cloud Rinse', 'Palm Wash'], ['Daily Veil'], ['Soft Colour']];
    const content = fixture();
    assert.deepEqual(Object.keys(DEWDROP_DEMO_COLLECTION_PRODUCT_IDS).sort(), DEWDROP_DEMO_COLLECTIONS.map(c => c.id).sort());
    assert.equal(new Set(DEWDROP_DEMO_COLLECTIONS.map(c => c.handle)).size, DEWDROP_DEMO_COLLECTIONS.length);
    for (const [index, collection] of DEWDROP_DEMO_COLLECTIONS.entries()) {
        const ids = DEWDROP_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
        assert.equal(ids.length, collection.product_count); assert.equal(new Set(ids).size, ids.length);
        assert.ok(ids.every(id => DEWDROP_DEMO_PRODUCTS.some(product => product.id === id)));
        const products = resolveCatalogDemoCollection(content, collection.id)!;
        assert.deepEqual(products.map(p => p.name), expected[index]);
        assert.ok(products.every(product => product.beauty?.routineStage === collection.handle));
    }
});
test('named handle and durable ID collection routes resolve the identical ordered shelf', () => {
    const content = fixture();
    for (const collection of DEWDROP_DEMO_COLLECTIONS) {
        const byId = resolveCatalogDemoRoute(`/collections/${collection.id}`);
        const byHandle = resolveCatalogDemoRoute(`/collections/${collection.handle}`);
        assert.equal(byId.type, 'collection'); assert.equal(byHandle.type, 'collection');
        const idProducts = resolveCatalogDemoCollection(content, byId.resourceSlug!)!;
        const handleProducts = resolveCatalogDemoCollection(content, byHandle.resourceSlug!)!;
        assert.deepEqual(idProducts.map(p => p.id), DEWDROP_DEMO_COLLECTION_PRODUCT_IDS[collection.id]);
        assert.deepEqual(handleProducts.map(p => p.id), idProducts.map(p => p.id));
    }
});
test('an intentionally empty cloned collection stays empty by ID and handle without becoming all products', () => {
    const content = fixture(); const collection = { ...DEWDROP_DEMO_COLLECTIONS[0], product_count: 0 };
    content.collections[0] = collection;
    content.collectionProductIds![collection.id] = [];
    assert.deepEqual(resolveCatalogDemoCollection(content, collection.id), []);
    assert.deepEqual(resolveCatalogDemoCollection(content, DEWDROP_DEMO_COLLECTIONS[0].handle), []);
    assert.equal(DEWDROP_DEMO_COLLECTIONS[0].product_count, 2);
    assert.equal(DEWDROP_DEMO_COLLECTION_PRODUCT_IDS[collection.id].length, 2);
});
test('foreign members and unknown collection identities fail closed without partial or full-catalog fallback', () => {
    const content = fixture(); const collection = content.collections[0];
    content.collectionProductIds![collection.id] = [content.products[0].id, '7b669c70-1005-4000-8000-000000000001'];
    assert.equal(resolveCatalogDemoCollection(content, collection.id), null);
    for (const unknown of ['foreign-collection', '7b669c70-8300-4000-8000-000000000099', '__proto__', '']) {
        assert.equal(resolveCatalogDemoCollection(content, unknown), null);
        assert.equal(Object.hasOwn(DEWDROP_DEMO_COLLECTION_PRODUCT_IDS, unknown), false);
    }
});
test('missing collection membership and an omitted map remain unavailable, preserving other known shelves', () => {
    const content = fixture(); const collection = content.collections[0];
    delete content.collectionProductIds![collection.id];
    assert.equal(resolveCatalogDemoCollection(content, collection.id), null);
    assert.equal(resolveCatalogDemoCollection(content, DEWDROP_DEMO_COLLECTIONS[0].handle), null);
    assert.deepEqual(resolveCatalogDemoCollection(content, DEWDROP_DEMO_COLLECTIONS[1].handle)?.map(p => p.name), ['Daily Veil']);
    content.collectionProductIds = undefined;
    assert.equal(resolveCatalogDemoCollection(content, DEWDROP_DEMO_COLLECTIONS[1].id), null);
    assert.equal(DEWDROP_DEMO_COLLECTION_PRODUCT_IDS[collection.id].length, 2);
});
