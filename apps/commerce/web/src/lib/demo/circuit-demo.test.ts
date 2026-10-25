import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ElectronicsFactsSchema } from '@letbuyy/commerce-core';
import { createFirstPartyCatalogBundle, LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import { CIRCUIT_DEMO_COLLECTIONS, CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS, CIRCUIT_DEMO_PRODUCTS, circuitDemoNavigation, withCircuitDemoContent } from './circuit-demo';

test('preview models keep durable variants, independent stock and physically different facts', () => {
  const ids = new Set<string>();
  for (const product of CIRCUIT_DEMO_PRODUCTS) {
    assert.equal(ids.has(product.id), false);ids.add(product.id);
    assert.equal(ElectronicsFactsSchema.safeParse(product.electronics).success, true);
    assert.equal(product.currency, 'INR');assert.equal(product.stock, product.variants!.reduce((total, item) => total + (item.stock ?? NaN), 0));
    for (const variant of product.variants!) {
      assert.match(variant.id, /^[0-9a-f-]{36}$/);assert.equal(ids.has(variant.id), false);ids.add(variant.id);
    }
    assert.deepEqual(product.electronics!.compatible_devices, []);
  }
  const [cg7, cg5, charger, cable] = CIRCUIT_DEMO_PRODUCTS;
  assert.notEqual(cg7.id, cg5.id);assert.equal(cg7.electronics!.data_rate_mbps, 5000);assert.equal(cg5.electronics!.data_rate_mbps, 480);
  assert.equal(cg5.electronics!.power_input_w, 65);assert.equal(cg5.electronics!.pass_through_output_w, undefined);
  assert.equal(charger.electronics!.power_output_w, 65);assert.equal(cable.electronics!.power_output_w, undefined);
  assert.equal(cable.electronics!.power_capacity_w, 100);assert.equal(cable.electronics!.length_mm, 1000);
  assert.equal(cg7.variants![1].stock, 0);
  assert.equal(cg7.price + cable.price, 4180);
  assert.equal(CIRCUIT_DEMO_COLLECTIONS.filter(row => row.product_count === 0).length, 2);
});

test('demo bindings apply only to the explicit v2 preview and leave input and legacy documents untouched', () => {
  const old = { liquidBundle: createFirstPartyCatalogBundle('letbuyy-forge') };
  assert.equal(withCircuitDemoContent(old), old);assert.equal(withCircuitDemoContent({}).liquidBundle, undefined);
  const bundle = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
  const original = structuredClone(bundle), result = withCircuitDemoContent({ liquidBundle: bundle, previewMarker: 'owned' });
  const modified = LiquidThemePackageBundleSchema.parse(result.liquidBundle);
  assert.deepEqual(bundle, original);assert.equal(result.previewMarker, 'owned');
  const hero = Object.values(modified.templates.index.sections).find(row => row.type === 'hero-banner')!;
  assert.equal(hero.settings.product1, CIRCUIT_DEMO_PRODUCTS[0].id);assert.equal(hero.settings.image, CIRCUIT_DEMO_PRODUCTS[0].images![0]);
  assert.deepEqual(result.templates, modified.templates);
  const navigation = circuitDemoNavigation('/store/circuit-owned');
  assert.ok(navigation.main && navigation.footer);
  for (const link of [...navigation.main, ...navigation.footer]) assert.match(link.href, /^\/store\/circuit-owned\//);
});

test('all fixture media is a local optimized asset with recorded generation provenance and matching digest', () => {
  const assetRoot = new URL('../../../public/theme-assets/circuit/v2/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', assetRoot), 'utf8'));
  const serialized = JSON.stringify(provenance);
  assert.match(serialized, /imagegen|image_gen/i);
  for (const product of CIRCUIT_DEMO_PRODUCTS) {
    const filename = product.images![0].split('/').at(-1)!;
    const bytes = readFileSync(new URL(filename, assetRoot));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 100000);assert.match(serialized, new RegExp(createHash('sha256').update(bytes).digest('hex')));
  }
});
test('named collection IDs/handles have exact synthetic membership, including intentional empty and unknown collections', () => {
  const catalog = new Set(CIRCUIT_DEMO_PRODUCTS.map(item => item.id));
  assert.equal(new Set(CIRCUIT_DEMO_COLLECTIONS.map(row => row.handle)).size, CIRCUIT_DEMO_COLLECTIONS.length);
  for (const collection of CIRCUIT_DEMO_COLLECTIONS) {
    const members = CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
    assert.ok(Array.isArray(members));assert.equal(members.length,collection.product_count);
    assert.ok(members.every(id => catalog.has(id)));assert.equal(new Set(members).size,members.length);
  }
  assert.deepEqual(CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS[CIRCUIT_DEMO_COLLECTIONS.find(row => row.handle === 'connect')!.id], CIRCUIT_DEMO_PRODUCTS.slice(0,2).map(row=>row.id));
  assert.deepEqual(CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS[CIRCUIT_DEMO_COLLECTIONS.find(row => row.handle === 'listen')!.id], []);
  assert.deepEqual(CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS[CIRCUIT_DEMO_COLLECTIONS.find(row => row.handle === 'work')!.id], []);
  for (const unknown of ['foreign-collection', '', '11111111-1111-4111-8111-111111111111']) assert.equal(Object.hasOwn(CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS,unknown),false);
});
