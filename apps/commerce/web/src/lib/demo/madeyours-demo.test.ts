import assert from 'node:assert/strict';
import test from 'node:test';
import { readPersonalizationFacts } from '@letbuyy/commerce-core';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '@letbuyy/theme-engine';
import { MADEYOURS_DEMO_PRODUCTS, MADEYOURS_DEMO_COLLECTIONS, MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS, MADEYOURS_DEMO_BLOCK_FACTS, MADEYOURS_DEMO_NOTEBOOK_FACTS, withMadeYoursDemoContent } from './madeyours-demo';
import { resolveCatalogDemoContent, resolveCatalogDemoCollection } from './catalog-demo-dispatch';
import { createFirstPartyCatalogBundle } from '@letbuyy/theme-engine';

test('synthetic catalog keeps the approved independent products, availability and bounded facts', () => {
  assert.deepEqual(MADEYOURS_DEMO_PRODUCTS.map(p => p.price), [1290, 790]);
  assert.deepEqual(MADEYOURS_DEMO_PRODUCTS.map(p => p.personalization), [MADEYOURS_DEMO_BLOCK_FACTS, MADEYOURS_DEMO_NOTEBOOK_FACTS]);
  for (const p of MADEYOURS_DEMO_PRODUCTS) {
    assert.match(p.description, /Demonstration product/); assert.equal(p.rating, undefined); assert.equal(p.reviewCount, undefined);
    assert.deepEqual(readPersonalizationFacts({ personalization: p.personalization }), p.personalization);
    assert.ok(p.images.every(image => image.startsWith('/theme-assets/madeyours/v2/')));
  }
  assert.equal(MADEYOURS_DEMO_PRODUCTS[0].variants?.find(v => v.options.Wood === 'Oak')?.stock, 0);
  assert.equal(MADEYOURS_DEMO_PRODUCTS[0].personalization.methods[0].max_graphemes, 18);
  assert.equal(MADEYOURS_DEMO_PRODUCTS[1].personalization.methods[0].max_graphemes, 12);
});
test('preview content mutates only a clone of the supplied package, never its source or catalog data', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = JSON.stringify(base);
  const result = withMadeYoursDemoContent({ liquidBundle: base, sentinel: 'preserved' });
  assert.equal(JSON.stringify(base), before); assert.equal(result.sentinel, 'preserved');
  assert.equal((result.liquidBundle as typeof base).templates.index.sections['hero-default'].settings.image, '/theme-assets/madeyours/v2/hero.webp');
  assert.equal(result.templates, (result.liquidBundle as typeof base).templates);
});
test('explicit collection membership matches durable sample IDs, named/id lookups and supplied counts', () => {
  const original = resolveCatalogDemoContent('letbuyy-nova', '2.0.0', { liquidBundle: createFirstPartyCatalogBundle('letbuyy-nova', { designVersion: '2.0.0' }) });
  assert.ok(original);
  const content = { ...original, collectionProductIds: MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS };
  for (const collection of MADEYOURS_DEMO_COLLECTIONS) {
    const ids = MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
    assert.equal(ids.length, collection.product_count);
    assert.ok(ids.every(id => MADEYOURS_DEMO_PRODUCTS.some(product => product.id === id)));
    assert.deepEqual(resolveCatalogDemoCollection(content, collection.id)?.map(p => p.id), ids);
    assert.deepEqual(resolveCatalogDemoCollection(content, collection.handle)?.map(p => p.id), ids);
  }
  const id = MADEYOURS_DEMO_COLLECTIONS[0].id;
  assert.deepEqual(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [id]: [] } }, id), []);
  assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: { [id]: ['foreign-product'] } }, id), null);
  assert.equal(resolveCatalogDemoCollection({ ...content, collectionProductIds: {} }, id), null);
  assert.equal(resolveCatalogDemoCollection(content, 'unknown-collection'), null);
  assert.equal(Object.hasOwn(MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS, 'unknown-collection'), false);
});
