import assert from 'node:assert/strict';
import test from 'node:test';
import { HABITAT_DEMO_PRODUCTS, HABITAT_DEMO_COLLECTIONS, HABITAT_DEMO_COLLECTION_PRODUCT_IDS } from '../../../../apps/commerce/web/src/lib/demo/habitat-demo';

function assertCatalogMembership(collections: { id: string; handle: string; product_count: number }[], map: Record<string, string[]>) {
    const products = new Set(HABITAT_DEMO_PRODUCTS.map(product => product.id));
    assert.equal(new Set(collections.map(collection => collection.handle)).size, collections.length, 'Named handle routes are unique');
    assert.deepEqual(Object.keys(map).sort(), collections.map(collection => collection.id).sort(), 'Every known collection has explicit membership');
    for (const collection of collections) {
        const ids = map[collection.id];
        assert.equal(ids.length, collection.product_count, collection.handle);
        assert.equal(new Set(ids).size, ids.length, 'No duplicate catalog members');
        for (const id of ids) assert.ok(products.has(id), `Foreign demo product ${id}`);
    }
}

test('actual Habitat collection IDs, named handles, shelf order and counts match the explicit demo catalog', () => {
    assertCatalogMembership(HABITAT_DEMO_COLLECTIONS, HABITAT_DEMO_COLLECTION_PRODUCT_IDS);
    const [chair, table] = HABITAT_DEMO_PRODUCTS;
    const [living, reading] = HABITAT_DEMO_COLLECTIONS;
    assert.equal(living.handle, 'living-room'); assert.equal(reading.handle, 'reading-corner');
    assert.deepEqual(HABITAT_DEMO_COLLECTION_PRODUCT_IDS[living.id], [chair.id, table.id]);
    assert.deepEqual(HABITAT_DEMO_COLLECTION_PRODUCT_IDS[reading.id], [chair.id]);
    assert.equal(Object.hasOwn(HABITAT_DEMO_COLLECTION_PRODUCT_IDS, 'unknown-collection'), false);
});

test('an intentionally empty membership remains empty; foreign and missing membership cannot pass the fixture contract', () => {
    const emptyCollection = { id: 'owned-empty-fixture', handle: 'empty-fixture', product_count: 0 };
    const map = { ...HABITAT_DEMO_COLLECTION_PRODUCT_IDS, [emptyCollection.id]: [] };
    assertCatalogMembership([...HABITAT_DEMO_COLLECTIONS, emptyCollection], map);
    assert.deepEqual(map[emptyCollection.id], []);
    const foreign = structuredClone(HABITAT_DEMO_COLLECTION_PRODUCT_IDS);
    foreign[HABITAT_DEMO_COLLECTIONS[1].id] = ['foreign-product-id'];
    assert.throws(() => assertCatalogMembership(HABITAT_DEMO_COLLECTIONS, foreign), /Foreign demo product/);
    const missing = structuredClone(HABITAT_DEMO_COLLECTION_PRODUCT_IDS); delete missing[HABITAT_DEMO_COLLECTIONS[0].id];
    assert.throws(() => assertCatalogMembership(HABITAT_DEMO_COLLECTIONS, missing), /explicit membership/);
});
