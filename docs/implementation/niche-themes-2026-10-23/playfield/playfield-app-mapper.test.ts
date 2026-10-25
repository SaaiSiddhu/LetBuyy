/** Actual app mapper → shipped Playfield package → real Liquid. No browser/DB fixture. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { ToyFactsSchema, buildVariantFactPresentation, type ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { PLAYFIELD_DEMO_PRODUCTS, withPlayfieldDemoContent } from '../../../../apps/commerce/web/src/lib/demo/playfield-demo';

// Resolve the app's declared public package exports, without a new engine dependency.
const appRequire = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url));
const { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer, LiquidThemePackageBundleSchema } = appRequire('@letbuyy/theme-engine') as typeof import('../../../../packages/theme-engine/src/index');
const { loadThemeServerDom } = appRequire('@letbuyy/theme-engine/server-dom') as typeof import('../../../../packages/theme-engine/src/server-dom-runtime');

const first = () => structuredClone(PLAYFIELD_DEMO_PRODUCTS[0]);
async function render(key: 'index' | 'collection' | 'product', products: ProductModel[]) {
  const bundle = LiquidThemePackageBundleSchema.parse(withPlayfieldDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' }) }).liquidBundle);
  const drops = products.map(product => productToLiquidDrop(product, '/store/playfield-contract')!);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-contract', path: key === 'collection' ? '/store/playfield-contract/products' : '/', previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Fictional Playfield' }, product: drops[0], collection: { products: drops, total: drops.length }, section_products: { 'playfield-product-grid': drops, 'product-related': drops } },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
  assert.deepEqual(result.warnings, []);
  const { JSDOM } = await loadThemeServerDom();
  return new JSDOM(result.liquid!.contentForLayout);
}
function closeDom(dom: Awaited<ReturnType<typeof render>>): void {
  const window = dom.window;
  if (!('close' in window) || typeof window.close !== 'function') throw new Error('Expected the Node DOM cleanup API.');
  window.close();
}

test('public catalog opts into Playfield v2 while the default Bloom package stays v1', () => {
  const old = createFirstPartyCatalogBundle('letbuyy-bloom');
  const baseline = structuredClone(old);
  const current = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' });
  assert.equal(current.package.name, 'Playfield');
  assert.equal(current.package.version, '2.0.0');
  assert.equal(old.package.version, '1.0.0');
  assert.deepEqual(createFirstPartyCatalogBundle('letbuyy-bloom'), baseline);
});

test('real app collection mapper preserves age, contents and edition choice through the generic depth4 cap', async () => {
  const dom = await render('collection', PLAYFIELD_DEMO_PRODUCTS);
  try {
    const cards = dom.window.document.querySelectorAll('.pf-card');
    assert.equal(cards.length, 4);
    assert.match(cards[0].textContent!, /6–8 years/);
    assert.match(cards[0].textContent!, /12 × wooden mosaic tiles · 2 × idea cards · 1 × tray/);
    assert.match(cards[0].textContent!, /Choose an edition/);
    assert.doesNotMatch(cards[0].textContent!, /Age information not supplied|Contents not supplied|Partial contents list/);
    assert.match(cards[1].textContent!, /36 × A5 paper sheets/);
    assert.match(cards[2].textContent!, /3–5 years/);
    assert.match(cards[3].textContent!, /Product image not supplied/);
    assert.match(cards[3].textContent!, /Age information not supplied/);
    assert.match(cards[3].textContent!, /Contents not supplied/);
    assert.doesNotMatch(cards[3].textContent!, /Choose an edition/);
    assert.equal(cards[0].querySelector('a')!.getAttribute('href'), `/store/playfield-contract/product/${PLAYFIELD_DEMO_PRODUCTS[0].id}`);
    assert.equal(dom.window.document.querySelector('lb-add-to-cart'), null);
  } finally { closeDom(dom); }
});

test('partial merchant contents are labelled partial on both actual home and collection cards', async () => {
  const partial = first();
  partial.toys = ToyFactsSchema.parse({ ...partial.toys, contents: [{ quantity: 12, label: 'tiles with more contents not yet listed' }], contentsComplete: false });
  for (const key of ['index', 'collection'] as const) {
    const dom = await render(key, [partial]);
    try {
      const card = dom.window.document.querySelector('.pf-card')!;
      assert.match(card.textContent!, /12 × tiles with more contents not yet listed/);
      assert.match(card.textContent!, /Partial contents list/);
      assert.doesNotMatch(card.textContent!, /in total|complete contents/i);
    } finally { closeDom(dom); }
  }
});

test('actual app PDP keeps labelled tray/tile dimensions and full merchant-supplied facts', async () => {
  const dom = await render('product', [first()]);
  try {
    const body = dom.window.document.querySelector('#playfield-product-facts')!;
    assert.match(body.textContent!, /15 items in total/);
    assert.match(body.textContent!, /Tray.*Length 24 cm · Width 19 cm · Height 1.5 cm/);
    assert.match(body.textContent!, /Each tile.*Length 5 cm · Width 5 cm · Height 0.6 cm/);
    assert.ok(dom.window.document.querySelector('lb-variant-picker'));
    assert.ok(dom.window.document.querySelector('lb-add-to-cart'));
    const variants = JSON.parse(dom.window.document.querySelector('lb-variant-picker')!.getAttribute('data-variants')!);
    assert.equal(variants.length, 3);
    assert.equal(variants[2].stock, 0);
    assert.equal(variants[0].id, first().variants![0].id);
    assert.match(variants[0].toys_card.contentsLabel, /12 × wooden mosaic tiles/);
  } finally { closeDom(dom); }
});

test('shared variant projection preserves strict partial input and derives inherited or explicitly cleared card facts', () => {
  const common = first();
  const inherited = buildVariantFactPresentation({ toys: { finish: 'A sample blue finish' } }, common);
  assert.deepEqual(inherited.toys, { finish: 'A sample blue finish' });
  assert.deepEqual(inherited.toys_card, { ageLabel: '6–8 years', contentsLabel: '12 × wooden mosaic tiles · 2 × idea cards · 1 × tray', contentsComplete: true, hasOptions: false });
  const cleared = buildVariantFactPresentation({ toys: { ageBands: [], contents: [], dimensions: null, additionalDimensions: [], warnings: [] } }, common);
  assert.deepEqual(cleared.toys_card, { contentsComplete: false, hasOptions: false });
});

test('invalid or missing public toy facts stay unknown in the real app mapper and collection render', async () => {
  const invalid = { ...first(), variants: [], variantOptions: [], toys: { ...first().toys!, platformCertified: true } };
  const drop = productToLiquidDrop(invalid)!;
  assert.equal(drop.toys, undefined);
  assert.equal(drop.toys_card, undefined);
  const dom = await render('collection', [invalid]);
  try {
    const card = dom.window.document.querySelector('.pf-card')!;
    assert.match(card.textContent!, /Age information not supplied/);
    assert.match(card.textContent!, /Contents not supplied/);
    assert.doesNotMatch(card.textContent!, /platformCertified|certified|12 × wooden/);
  } finally { closeDom(dom); }
});
