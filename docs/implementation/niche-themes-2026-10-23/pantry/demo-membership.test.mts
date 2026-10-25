import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createPantryTheme } from '../../../../packages/theme-engine/src/pantry-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core.ts';
const require = createRequire(import.meta.url);
const { PANTRY_DEMO_PRODUCTS, PANTRY_DEMO_COLLECTIONS, PANTRY_DEMO_COLLECTION_PRODUCT_IDS } = require('../../../../apps/commerce/web/src/lib/demo/pantry-demo.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/pantry-demo');
const { resolveCatalogDemoContent, resolveCatalogDemoCollection } = require('../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch');
function content() {
  const result = resolveCatalogDemoContent('letbuyy-refresh', '2.0.0', { liquidBundle: createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()) });
  assert.ok(result);
  // The common dispatcher writer integrates this export separately. This probes
  // the real shared resolver against the ready mapping without editing its source.
  return { ...result, collectionProductIds: structuredClone(PANTRY_DEMO_COLLECTION_PRODUCT_IDS) };
}

test('each actual Pantry collection has exact durable catalog membership and matching count for ID and handle routes', () => {
  const source = structuredClone(PANTRY_DEMO_COLLECTION_PRODUCT_IDS);
  assert.deepEqual(Object.keys(source).sort(), PANTRY_DEMO_COLLECTIONS.map(collection => collection.id).sort());
  const demo = content();
  for (const collection of PANTRY_DEMO_COLLECTIONS) {
    const members = source[collection.id];
    assert.equal(collection.product_count, members.length);
    assert.equal(new Set(members).size, members.length);
    assert.ok(members.every(id => PANTRY_DEMO_PRODUCTS.some(product => product.id === id)));
    for (const identity of [collection.id, collection.handle]) assert.deepEqual(resolveCatalogDemoCollection(demo, identity)?.map(product => product.id), members);
  }
  assert.deepEqual(source[PANTRY_DEMO_COLLECTIONS[0].id], [PANTRY_DEMO_PRODUCTS[0].id]);
  assert.deepEqual(source[PANTRY_DEMO_COLLECTIONS[1].id], [PANTRY_DEMO_PRODUCTS[1].id]);
  assert.deepEqual(PANTRY_DEMO_COLLECTION_PRODUCT_IDS, source, 'resolver does not mutate owned fixture membership');
});

test('the actual resolver preserves an intentional empty membership rather than substituting the Pantry catalog', () => {
  const demo = content(), id = demo.collections[0].id;
  demo.collectionProductIds[id] = [];
  demo.collections = demo.collections.map(collection => collection.id === id ? { ...collection, product_count: 0 } : collection);
  assert.deepEqual(resolveCatalogDemoCollection(demo, id), []);
  assert.equal(PANTRY_DEMO_COLLECTION_PRODUCT_IDS[id].length, 1, 'empty probe never changes the two real nonempty sample shelves');
});

test('foreign or missing collection membership stays unavailable and a foreign product never falls back to all products', () => {
  const demo = content(), id = demo.collections[0].id;
  for (const foreign of ['', 'foreign-collection', '11111111-1111-4111-8111-111111111111']) assert.equal(resolveCatalogDemoCollection(demo, foreign), null);
  assert.equal(resolveCatalogDemoCollection({ ...demo, collectionProductIds: undefined }, id), null);
  assert.equal(resolveCatalogDemoCollection({ ...demo, collectionProductIds: {} }, id), null);
  assert.equal(resolveCatalogDemoCollection({ ...demo, collectionProductIds: { [id]: ['foreign-product'] } }, id), null);
});
