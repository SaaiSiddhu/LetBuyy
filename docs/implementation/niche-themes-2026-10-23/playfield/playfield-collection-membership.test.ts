/** Shared pure lookup exercised with the owned membership fixture; no API or seed. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS, PLAYFIELD_DEMO_COLLECTIONS, PLAYFIELD_DEMO_PRODUCTS, PLAYFIELD_DEMO_NAVIGATION } from '../../../../apps/commerce/web/src/lib/demo/playfield-demo';
import { resolveCatalogDemoCollection, resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { catalogDemoNavigationTarget, resolveCatalogDemoRoute } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-route';
const appRequire = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url));
const { createFirstPartyCatalogBundle } = appRequire('@letbuyy/theme-engine') as typeof import('../../../../packages/theme-engine/src/index');
function content() {
  const bundle = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' });
  const trusted = resolveCatalogDemoContent('letbuyy-bloom', '2.0.0', { liquidBundle: bundle });
  assert.ok(trusted);
  // The common dispatcher owner wires the export separately. This is a pure lookup fixture.
  return { ...trusted, collectionProductIds: structuredClone(PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS) };
}

test('owned collection counts, shelf order and handle/id navigation match existing catalog members', () => {
  const source = content();
  const known = new Set(PLAYFIELD_DEMO_PRODUCTS.map(product => product.id));
  assert.deepEqual(Object.keys(PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS).sort(), PLAYFIELD_DEMO_COLLECTIONS.map(collection => collection.id).sort());
  for (const collection of PLAYFIELD_DEMO_COLLECTIONS) {
    const ids = PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
    assert.equal(collection.product_count, ids.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => known.has(id)));
    for (const identity of [collection.id, collection.handle]) {
      const route = resolveCatalogDemoRoute(`/collections/${identity}`);
      assert.equal(route.type, 'collection');
      assert.deepEqual(resolveCatalogDemoCollection(source, route.resourceSlug!)!.map(product => product.id), ids);
    }
  }
  assert.deepEqual(resolveCatalogDemoCollection(source, 'art-making')!.map(product => product.name), ['Pattern Studio', 'Paper Play', 'Make a Story']);
  assert.deepEqual(resolveCatalogDemoCollection(source, 'building')!.map(product => product.name), ['Arch Paths']);
  for (const link of PLAYFIELD_DEMO_NAVIGATION.main!.filter(link => ['Art & making', 'Building'].includes(link.label))) {
    const target = catalogDemoNavigationTarget(link.href, 'https://sample.example.test', 'letbuyy-bloom', '2.0.0');
    assert.ok(target);
    const route = resolveCatalogDemoRoute(new URL(target, 'https://sample.example.test').searchParams.get('demo_path')!);
    assert.ok(resolveCatalogDemoCollection(source, route.resourceSlug!));
  }
});

test('an intentionally empty membership resolves empty rather than every product', () => {
  const source = content(), id = PLAYFIELD_DEMO_COLLECTIONS[0].id;
  source.collectionProductIds[id] = [];
  source.collections = source.collections.map(collection => collection.id === id ? { ...collection, product_count: 0 } : collection);
  assert.deepEqual(resolveCatalogDemoCollection(source, id), []);
  const empty = source.collections.find(collection => collection.id === id);
  assert.ok(empty && 'product_count' in empty);
  assert.equal(empty.product_count, 0);
});

test('a foreign product membership is unavailable and never substitutes the entire catalog', () => {
  const source = content(), id = PLAYFIELD_DEMO_COLLECTIONS[0].id;
  source.collectionProductIds[id] = ['foreign-product-not-in-playfield'];
  assert.equal(resolveCatalogDemoCollection(source, id), null);
  assert.equal(resolveCatalogDemoCollection(source, 'not-a-playfield-collection'), null);
});

test('missing membership remains unavailable for an otherwise valid named collection', () => {
  const source = content(), id = PLAYFIELD_DEMO_COLLECTIONS[1].id;
  delete source.collectionProductIds[id];
  assert.equal(resolveCatalogDemoCollection(source, id), null);
  assert.equal(resolveCatalogDemoCollection(source, 'building'), null);
});
