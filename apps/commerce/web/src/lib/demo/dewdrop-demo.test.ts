import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { BeautyFactsSchema } from '@letbuyy/commerce-core';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '@letbuyy/theme-engine';
import { DEWDROP_DEMO_COLLECTIONS, DEWDROP_DEMO_PRODUCTS, withDewdropDemoContent } from './dewdrop-demo';
test('synthetic catalog validates public facts and ties named shades to actual distinct variants', () => {
    assert.equal(DEWDROP_DEMO_PRODUCTS.length, 4);
    const tint = DEWDROP_DEMO_PRODUCTS[2];
    const facts = BeautyFactsSchema.parse(tint.beauty);
    assert.equal(facts.shades[0].color, facts.shades[1].color);
    assert.notEqual(tint.variants![0].id, tint.variants![1].id);
    assert.deepEqual(facts.shades.map(shade => shade.value), tint.variantOptions![0].values);
    assert.deepEqual(tint.variants!.map(v => v.options.Shade), facts.shades.map(shade => shade.value));
    assert.equal(tint.variants![2].stock, 0);
    for (const item of DEWDROP_DEMO_PRODUCTS) {
        assert.match(item.id, /^[0-9a-f-]{36}$/);
        assert.match(item.description, /Fictional demonstration product; not for sale/);
        BeautyFactsSchema.parse(item.beauty);
    }
    assert.equal(DEWDROP_DEMO_PRODUCTS[3].beauty!.ingredients, null);
    assert.deepEqual(DEWDROP_DEMO_PRODUCTS[3].images, []);
});
test('approved optimized sample media exists and product references never use an external placeholder', () => {
    const webRoot = path.resolve(__dirname, '../../../public');
    for (const item of DEWDROP_DEMO_PRODUCTS)
        for (const image of item.images) {
            assert.match(image, /^\/theme-assets\/dewdrop\/v2\/.+\.webp$/);
            assert.ok(fs.existsSync(path.join(webRoot, image)));
        }
    assert.deepEqual(DEWDROP_DEMO_COLLECTIONS.map(c => c.product_count), [2, 1, 1]);
});
test('sample settings clone the package and bind explicit independent product and collection resources', () => {
    const input = { liquidBundle: createLetbuyyCoreLiquidThemeBundleFixture(), sample: true };
    const before = structuredClone(input);
    const output = withDewdropDemoContent(input);
    assert.deepEqual(input, before);
    const b = output.liquidBundle as typeof input.liquidBundle;
    assert.equal(Object.values(b.templates.index.sections).find(s => s.type === 'hero-banner')!.settings.image, '/theme-assets/dewdrop/v2/care-still-life.webp');
    assert.equal(Object.values(b.templates.index.sections).find(s => s.type === 'category-grid')!.settings.collection2, DEWDROP_DEMO_COLLECTIONS[1].id);
    assert.equal(Object.values(b.templates.product.sections).find(s => s.type === 'featured-products')!.settings.product1, DEWDROP_DEMO_PRODUCTS[0].id);
    assert.equal(Object.values(b.templates.product.sections).find(s => s.type === 'featured-products')!.settings.product2, DEWDROP_DEMO_PRODUCTS[1].id);
    assert.equal(output.sample, true);
});
