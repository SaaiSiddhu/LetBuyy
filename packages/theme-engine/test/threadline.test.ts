import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';

const product = { id: 'shirt', title: 'Everyday linen shirt', price: 2490, currency: 'INR', url: '/product/shirt', images: [], available: true, options: [{ name: 'Size', values: ['S', 'M'] }], variants: [], apparel: { fit: 'Relaxed fit', unit: 'cm', fabric: '<script>unsafe</script> Linen', care: 'Cold wash', measurements: [{ size: 'M', chest: 102, shoulder: 40, length: 69 }] } };
async function render(key: string, bundle = createFirstPartyCatalogBundle('letbuyy-sense'), searchParams?: Record<string, string>) {
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'threadline-test', path: '/', previewMode: true, locale: 'en-IN', searchParams },
    storeTemplate: { themeId: 'letbuyy-sense', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic Threadline' }, product, collection: { products: [product] }, section_products: { 'sense-productGrid-index': [product], 'sense-featuredProducts-index': [product] } },
  });
}

test('Threadline installs a versioned apparel composition, not a Core token overlay', () => {
  const b = createFirstPartyCatalogBundle('letbuyy-sense');
  assert.equal(b.package.version, '2.0.0');
  assert.equal(b.package.name, 'Threadline');
  assert.equal(firstPartyThemeListings().length, 10);
  assert.equal(firstPartyThemeListings().find(t => t.presetId === 'sense')?.id, '7b669c70-0000-4000-8000-000000000002');
  assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner', 'category-grid', 'product-grid', 'featured-products', 'about-section', 'trust-badges']);
  assert.notDeepEqual(b.templates.index.order, createFirstPartyCatalogBundle('letbuyy-refresh').templates.index.order);
  assert.match(b.sections['product-detail'].source, /Garment measurements/);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
});
test('collection filters preserve selected sizes and never display Liquid hash.size as an unselected size', async () => {
  for (const query of [undefined, { color: 'Oat' }, { size: 'M', color: 'Oat' }]) {
    const result = await render('collection', undefined, query);
    assert.equal(result.status, 'rendered');
    assert.match(result.liquid!.contentForLayout, new RegExp(`name="size" value="${query?.size ?? ''}"`));
  }
});
test('actual Liquid render retains layout styles, real product identity and garment facts', async () => {
  for (const key of ['index', 'collection', 'product']) {
    const result = await render(key);
    assert.equal(result.status, 'rendered');
    assert.deepEqual(result.warnings, []);
    assert.match(result.liquid!.headStyleText!, /\.tl-hero/);
    if (key === 'product') {
      assert.match(result.liquid!.contentForLayout, /102/);
      assert.match(result.liquid!.contentForLayout, /Relaxed fit/);
      assert.doesNotMatch(result.liquid!.contentForLayout, /<script/);
      assert.match(result.liquid!.contentForLayout, /lb-variant-picker/);
      assert.match(result.liquid!.contentForLayout, /lb-add-to-cart/);
    } else assert.match(result.liquid!.contentForLayout, /Everyday linen shirt/);
  }
});
test('editor document mutation survives exact roundtrip and changes actual output', async () => {
  const initial = createFirstPartyCatalogBundle('letbuyy-sense');
  const doc = toThemeDocumentV2(initial);
  doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'hero-banner')!.settings.heading = 'Merchant-owned campaign';
  const saved = fromThemeDocumentV2(doc);
  const result = await render('index', saved);
  assert.match(result.liquid!.contentForLayout, /Merchant-owned campaign/);
  assert.doesNotMatch((await render('index', initial)).liquid!.contentForLayout, /Merchant-owned campaign/);
});
