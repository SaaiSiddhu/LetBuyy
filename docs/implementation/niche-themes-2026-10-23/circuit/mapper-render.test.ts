/** Owned integration harness: app mapper → public catalog → canonical Liquid renderer. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import type { ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { CIRCUIT_DEMO_PRODUCTS, withCircuitDemoContent } from '../../../../apps/commerce/web/src/lib/demo/circuit-demo';

const basePath = '/store/circuit-mapper';
async function render(key: 'index' | 'collection' | 'product', models = CIRCUIT_DEMO_PRODUCTS) {
  const configured = withCircuitDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' }) });
  const products = models.map(item => productToLiquidDrop(item, basePath)!);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-mapper', path: `${basePath}/products`, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: configured.liquidBundle as ReturnType<typeof createFirstPartyCatalogBundle>, liquidTemplateKey: key,
    liquidContext: { product: products[0], collection: { products, total: products.length }, section_products: { 'forge-model-index': products.slice(0, 1), 'forge-products-index': products, 'forge-related-product': products.slice(1) } },
  });
  assert.equal(result.status, 'rendered');assert.deepEqual(result.warnings, []);
  return result;
}

test('actual mapper preserves exact video and independent W/Mb/s facts in Circuit collection and home cards', async () => {
  for (const key of ['collection', 'index'] as const) {
    const result = await render(key), dom = new JSDOM(result.liquid!.contentForLayout);
    const cards = Array.from(dom.window.document.querySelectorAll('.ct-card'));
    assert.equal(cards.length, 4);
    assert.match(cards[0].textContent!, /CG-7/);assert.match(cards[0].textContent!, /3840 × 2160 \/ 30 Hz/);assert.match(cards[0].textContent!, /5000 Mb\/s/);
    assert.match(cards[1].textContent!, /CG-5/);assert.match(cards[1].textContent!, /480 Mb\/s/);assert.doesNotMatch(cards[1].textContent!, /5000 Mb\/s/);
    assert.match(cards[2].textContent!, /Output maximum65 W/);assert.match(cards[2].textContent!, /Power outputs2 × USB-C/);
    assert.match(cards[3].textContent!, /Cable power capacity100 W/);assert.doesNotMatch(cards[3].textContent!, /Output maximum|Laptop pass-through/);
    assert.ok(cards.every(card => card.querySelector('a')!.getAttribute('href')!.startsWith(`${basePath}/product/`)));
    dom.window.close();
  }
});

test('actual PDP mapper preserves canonical variant identities, nested specs and explicit compatibility uncertainty', async () => {
  const result = await render('product'), dom = new JSDOM(result.liquid!.contentForLayout), doc = dom.window.document;
  const specs = doc.querySelector('#circuit-specifications')!.textContent!;
  assert.match(specs, /Power input maximum100 W/);assert.match(specs, /Laptop pass-through maximum85 W/);
  assert.match(specs, /Video output maximum3840 × 2160 at 30 Hz/);assert.match(specs, /115 × 43 × 15 mm/);
  assert.match(doc.querySelector('.ct-compatibility')!.textContent!, /Unconfirmed/);
  const picker = doc.querySelector('lb-variant-picker')!;
  const variants = JSON.parse(picker.getAttribute('data-variants')!);
  assert.deepEqual(variants.map((row: { id: string; stock: number }) => [row.id, row.stock]), CIRCUIT_DEMO_PRODUCTS[0].variants!.map(row => [row.id, row.stock]));
  assert.equal(doc.querySelector('lb-add-to-cart')!.getAttribute('data-product-id'), CIRCUIT_DEMO_PRODUCTS[0].id);
  assert.equal(doc.querySelector('[data-lb-buy-now]'), null);assert.equal(doc.querySelector('script,[onerror],[onload]'), null);
  dom.window.close();
});

test('invalid historical facts and forged derived summaries never leak through actual mapper or Circuit render', async () => {
  const invalid = { ...CIRCUIT_DEMO_PRODUCTS[0], electronics: { model: 'Invalid', power_input_w: 65, pass_through_output_w: 85, api_key: 'private-sentinel' }, electronics_video_summary: 'forged-video', supplier_private: 'private-sentinel' } as unknown as ProductModel;
  const drop = productToLiquidDrop(invalid, basePath)!;
  assert.equal(drop.electronics, undefined);assert.equal(drop.electronics_video_summary, undefined);assert.doesNotMatch(JSON.stringify(drop), /private-sentinel|forged-video/);
  const collection = await render('collection', [invalid]);assert.match(collection.liquid!.contentForLayout, /Technical facts not supplied/);
  const pdp = await render('product', [invalid]);assert.match(pdp.liquid!.contentForLayout, /Technical facts have not been supplied/);assert.match(pdp.liquid!.contentForLayout, /Unconfirmed/);
});
