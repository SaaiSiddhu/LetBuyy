/** Real app binding plan with an explicitly supplied, bounded private-preview catalog. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, fromThemeDocumentV2, LiquidRenderer, toThemeDocumentV2, type LiquidThemePackageBundle, type SectionModel } from '@letbuyy/theme-engine';
import { buildSectionDataPlan } from '../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { getUrbanKicksDemoStore } from '../../../../apps/commerce/web/src/lib/demo/urban-kicks-demo';
import { CIRCUIT_DEMO_PRODUCTS, withCircuitDemoContent } from '../../../../apps/commerce/web/src/lib/demo/circuit-demo';

const basePath = '/store/circuit-binding';
async function boundRender(bundle: LiquidThemePackageBundle, key: 'index' | 'product') {
  const store = { ...getUrbanKicksDemoStore(), subdomain: 'circuit-binding', selectedProductIds: [] };
  const template = bundle.templates[key];
  const sections: SectionModel[] = template.order.map((id, order) => ({ id, type: template.sections[id].type, rendererKey: `liquid.section.${template.sections[id].type}`, settings: template.sections[id].settings, order, isVisible: true }));
  const route = { type: key, path: `${basePath}/`, subdomain: 'circuit-binding' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('This bounded private-preview fixture must not fetch a network catalog.'); };
  try {
    const plan = await buildSectionDataPlan({ store, sections, route, preloadedProducts: CIRCUIT_DEMO_PRODUCTS });
    const products = CIRCUIT_DEMO_PRODUCTS.map(item => productToLiquidDrop(item, basePath)!);
    const result = await new LiquidRenderer().render({
      context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-binding', path: route.path, previewMode: true, locale: 'en-IN' },
      storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
      routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
      liquidBundle: bundle, liquidTemplateKey: key,
      liquidContext: { product: products[0], collection: { products }, section_products: Object.fromEntries(Array.from(plan.entries()).map(([id, data]) => [id, (data.products ?? []).map(item => productToLiquidDrop(item, basePath))])) },
    });
    assert.equal(result.status, 'rendered');assert.deepEqual(result.warnings, []);
    return { plan, dom: new JSDOM(result.liquid!.contentForLayout) };
  } finally { globalThis.fetch = originalFetch; }
}

function bundle() {
  return withCircuitDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' }) }).liquidBundle as LiquidThemePackageBundle;
}

test('saved featured product selection resolves through the real app plan and changes actual model, URL and price', async () => {
  const original = bundle(), document = toThemeDocumentV2(original);
  const hero = document.templates.find(row => row.key === 'index')!.sections.find(row => row.type === 'hero-banner')!;
  hero.settings.product1 = CIRCUIT_DEMO_PRODUCTS[1].id;
  const saved = fromThemeDocumentV2(document), rendered = await boundRender(saved, 'index');
  assert.equal(rendered.plan.get(hero.id)!.products![0].id, CIRCUIT_DEMO_PRODUCTS[1].id);
  const feature = rendered.dom.window.document.querySelector('.ct-feature')!;
  assert.match(feature.textContent!, /Nodeworks CG-5/);assert.match(feature.textContent!, /2,490/);
  assert.equal(feature.querySelector('a')!.getAttribute('href'), `${basePath}/product/${CIRCUIT_DEMO_PRODUCTS[1].id}`);
  assert.equal(original.templates.index.sections[hero.id].settings.product1, CIRCUIT_DEMO_PRODUCTS[0].id);
  rendered.dom.window.close();
});

test('clearing optional related resources resolves to no products and hides that purchase section', async () => {
  const original = bundle(), document = toThemeDocumentV2(original);
  const related = document.templates.find(row => row.key === 'product')!.sections.find(row => row.type === 'featured-products')!;
  const before = await boundRender(original, 'product');
  assert.deepEqual(before.plan.get(related.id)!.products!.map(item => item.id), CIRCUIT_DEMO_PRODUCTS.slice(1).map(item => item.id));
  assert.equal(before.dom.window.document.querySelectorAll('.ct-card').length, 3);before.dom.window.close();
  related.settings.product1 = '';related.settings.product2 = '';related.settings.product3 = '';
  const cleared = await boundRender(fromThemeDocumentV2(document), 'product');
  assert.deepEqual(cleared.plan.get(related.id)!.products, []);
  assert.equal(cleared.dom.window.document.querySelectorAll('.ct-card').length, 0);
  assert.doesNotMatch(cleared.dom.window.document.body.textContent!, /Useful additions\. Separate purchases\./);
  cleared.dom.window.close();
});
