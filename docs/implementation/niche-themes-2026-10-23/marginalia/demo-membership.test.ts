import assert from 'node:assert/strict';
import test from 'node:test';
import { MARGINALIA_DEMO_PRODUCTS as products, MARGINALIA_DEMO_COLLECTIONS as collections, MARGINALIA_DEMO_COLLECTION_PRODUCT_IDS as members } from '../../../../apps/commerce/web/src/lib/demo/marginalia-demo';
import { resolveCatalogDemoContent, resolveCatalogDemoCollection } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { resolveCatalogDemoRoute } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-route';

test('named and ID-addressed demo shelves have exact catalog members, counts and order', () => {
  assert.deepEqual(Object.keys(members).sort(), collections.map(collection => collection.id).sort());
  assert.equal(new Set(collections.map(collection => collection.handle)).size, collections.length);
  for (const collection of collections) {
    assert.ok(collection.handle && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection.handle));
    const byHandle = collections.find(item => item.handle === collection.handle)!;
    const byId = collections.find(item => item.id === collection.id)!;
    assert.equal(byHandle.id, byId.id);
    assert.equal(members[collection.id].length, collection.product_count);
    assert.equal(new Set(members[collection.id]).size, members[collection.id].length);
    for (const id of members[collection.id]) assert.ok(products.some(product => product.id === id), id);
  }
  assert.deepEqual(members[collections[0].id], [products[0].id, products[1].id]);
  assert.deepEqual(members[collections[1].id], [products[2].id]);
});
test('intentionally empty shelf has an explicit empty array, with no all-products fallback', () => {
  const empty = collections.find(collection => collection.handle === 'reading-soon')!;
  assert.ok(empty); assert.equal(empty.product_count, 0);
  assert.equal(Object.hasOwn(members, empty.id), true); assert.deepEqual(members[empty.id], []);
});
test('foreign theme, missing and product IDs are not collection membership entries', () => {
  for (const id of ['7b669c70-3000-4000-8000-000000000001', 'missing-collection', products[0].id]) {
    assert.equal(Object.hasOwn(members, id), false); assert.equal(members[id], undefined);
  }
  assert.equal(collections.find(collection => collection.handle === 'missing-collection'), undefined);
  assert.equal(Object.hasOwn(members, '__proto__'), false);
});
test('actual collection resolver honors handle/id, explicit empty, foreign member and missing membership', () => {
  const base = resolveCatalogDemoContent('letbuyy-dawn', '2.0.0', { liquidBundle: createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' }) });
  assert.ok(base);
  assert.deepEqual(base.collectionProductIds, members);
  const content = base;
  for (const collection of collections) for (const identity of [collection.id, collection.handle]) {
    const route = resolveCatalogDemoRoute(`/collections/${identity}`);
    assert.equal(route.type, 'collection'); assert.equal(route.resourceSlug, identity);
    assert.deepEqual(resolveCatalogDemoCollection(content, route.resourceSlug!)?.map(product => product.id), members[collection.id]);
  }
  const id = collections[0].id;
  assert.deepEqual(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [id]: [] } }, id), []);
  assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [id]: ['foreign-product'] } }, id), null);
  assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: {} }, id), null);
  assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: undefined }, id), null);
  assert.equal(resolveCatalogDemoCollection(content, 'unknown-collection'), null);
});
