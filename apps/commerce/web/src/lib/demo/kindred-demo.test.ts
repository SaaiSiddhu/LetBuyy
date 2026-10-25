import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GiftFactsSchema, readGiftFacts } from '@letbuyy/commerce-core';
import { createLetbuyyCoreLiquidThemeBundleFixture, createKindredTheme } from '@letbuyy/theme-engine';
import { KINDRED_DEMO_PRODUCTS, KINDRED_DEMO_COLLECTIONS, KINDRED_DEMO_COLLECTION_PRODUCT_IDS, KINDRED_DEMO_DISCOVERY, withKindredDemoContent } from './kindred-demo';
import { resolveCatalogDemoContent, resolveCatalogDemoCollection } from './catalog-demo-dispatch';
import { resolveCatalogDemoRoute } from './catalog-demo-route';

test('synthetic fixed sets keep approved contents, real packaging variants and unavailable selection', () => {
  assert.deepEqual(KINDRED_DEMO_PRODUCTS.map(item => item.price), [1790, 1290]);
  assert.deepEqual(KINDRED_DEMO_PRODUCTS[0].variants.map(item => [item.name, item.price, item.stock]), [
    ['Blush gift box', 1790, 5], ['Kraft gift box', 1590, 4], ['Moss gift box', 1790, 0],
  ]);
  const ids = KINDRED_DEMO_PRODUCTS.flatMap(item => [item.id, ...item.variants.map(variant => variant.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of KINDRED_DEMO_PRODUCTS) {
    assert.match(item.description, /Synthetic demonstration product; not for sale/);
    const facts = GiftFactsSchema.parse(item.gifts);
    assert.equal(facts.contents!.reduce((sum, row) => sum + row.quantity, 0), 3);
    assert.deepEqual(readGiftFacts({ gifts: item.gifts, supplier: 'private' }), facts);
    for (const index of Object.values(facts.mediaRoles!)) assert.ok(item.images[index]);
    assert.equal(item.stock, item.variants.reduce((sum, variant) => sum + variant.stock, 0));
  }
  assert.equal(KINDRED_DEMO_PRODUCTS[1].images.length, 1);
  assert.equal(GiftFactsSchema.parse(KINDRED_DEMO_PRODUCTS[1].gifts).mediaRoles!.closedBox, undefined);
  assert.deepEqual(KINDRED_DEMO_COLLECTIONS.map(item => item.product_count), [2, 2, 1, 1]);
  assert.deepEqual(KINDRED_DEMO_DISCOVERY.gift_occasions.map(item => item.value), ['birthday', 'thank-you', 'housewarming', 'just-because']);
});

test('optimized preview photography matches the frozen approved provenance', () => {
  const directory = new URL('../../../public/theme-assets/kindred/v2/', import.meta.url);
  const provenance: { assets: Array<{ file: string; bytes: number; sha256: string; width: number; height: number }> } = JSON.parse(readFileSync(new URL('provenance.json', directory), 'utf8'));
  for (const asset of provenance.assets) {
    const content = readFileSync(new URL(asset.file, directory));
    assert.equal(content.byteLength, asset.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256);
    assert.ok(asset.bytes < 110000);
    assert.equal(asset.width / asset.height, 4 / 3);
  }
  for (const item of KINDRED_DEMO_PRODUCTS) for (const image of item.images) {
    assert.match(image, /^\/theme-assets\/kindred\/v2\/.+\.webp$/);
    assert.ok(readFileSync(fileURLToPath(new URL(`../../../public${image}`, import.meta.url))).byteLength > 0);
  }
});

test('preview adapter requires explicit v2 identity and clones its resource bindings', () => {
  const core = createLetbuyyCoreLiquidThemeBundleFixture();
  assert.throws(() => withKindredDemoContent({ liquidBundle: core }), /exact v2 package/);
  const base = createKindredTheme(core);
  const before = structuredClone(base);
  const output = withKindredDemoContent({ liquidBundle: base, sentinel: 'retained' });
  const configured = output.liquidBundle as typeof base;
  assert.deepEqual(base, before);
  assert.equal(output.sentinel, 'retained');
  assert.equal(output.templates, configured.templates);
  assert.equal(Object.values(configured.templates.index.sections).find(section => section.type === 'hero-banner')!.settings.image, '/theme-assets/kindred/v2/little-pause-open.webp');
  assert.equal(Object.values(configured.templates.index.sections).find(section => section.type === 'category-grid')!.settings.collection4, KINDRED_DEMO_COLLECTIONS[3].id);
  assert.equal(Object.values(configured.templates.product.sections).find(section => section.type === 'featured-products')!.settings.product1, KINDRED_DEMO_PRODUCTS[1].id);
});

test('explicit gift shelves resolve named handle/id membership and keep empty, foreign and missing states distinct', () => {
  const context = resolveCatalogDemoContent('letbuyy-summit', '2.0.0', { liquidBundle: createKindredTheme(createLetbuyyCoreLiquidThemeBundleFixture()) })!;
  assert.ok(context);
  // Pure resolver contract with this owner-supplied map; shared dispatcher cloning is separately integrated.
  const supplied = { ...context, collectionProductIds: structuredClone(KINDRED_DEMO_COLLECTION_PRODUCT_IDS) };
  const catalogIds = new Set(KINDRED_DEMO_PRODUCTS.map(item => item.id));
  for (const collection of KINDRED_DEMO_COLLECTIONS) {
    const ids = KINDRED_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
    assert.equal(ids.length, collection.product_count);
    assert.ok(ids.every(id => catalogIds.has(id)));
    for (const identity of [collection.id, collection.handle]) {
      const route = resolveCatalogDemoRoute(`/collections/${identity}`);
      assert.equal(route.type, 'collection');
      assert.deepEqual(resolveCatalogDemoCollection(supplied, route.resourceSlug!)!.map(item => item.id), ids);
    }
  }
  const first = KINDRED_DEMO_COLLECTIONS[0].id;
  assert.deepEqual(resolveCatalogDemoCollection({ ...supplied, collectionProductIds: { [first]: [] } }, first), []);
  assert.equal(resolveCatalogDemoCollection({ ...supplied, collectionProductIds: { [first]: ['7b669c70-4199-4000-8000-000000000999'] } }, first), null);
  assert.equal(resolveCatalogDemoCollection({ ...supplied, collectionProductIds: {} }, first), null);
  assert.equal(resolveCatalogDemoCollection(supplied, 'unknown-collection'), null);
});
