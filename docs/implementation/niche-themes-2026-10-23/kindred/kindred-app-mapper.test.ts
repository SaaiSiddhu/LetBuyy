/** Cross-package integration harness only: no runtime import boundary is changed. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import type { ProductModel } from '../../../../packages/commerce-core/src/index';
import { GiftFactsSchema } from '../../../../packages/commerce-core/src/index';
import { DEFAULT_THEME_SETTINGS, LiquidRenderer, type LiquidThemePackageBundle } from '../../../../packages/theme-engine/src/index';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { KINDRED_DEMO_PRODUCTS, KINDRED_DEMO_COLLECTIONS, KINDRED_DEMO_DISCOVERY, withKindredDemoContent } from '../../../../apps/commerce/web/src/lib/demo/kindred-demo';

// Resolve the DOM tool from the app that declares it; no manifest/dependency mutation.
const { JSDOM } = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url))('jsdom') as {
  JSDOM: new (html: string) => { window: { document: Document } };
};
const siteId = '11111111-1111-4111-8111-111111111111';
const basePath = '/store/kindred-projection';
const bundle = () => withKindredDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' }) }).liquidBundle as LiquidThemePackageBundle;
const copy = (): ProductModel => structuredClone(KINDRED_DEMO_PRODUCTS[0]);

async function render(key: 'index' | 'collection' | 'product', models: ProductModel[] = KINDRED_DEMO_PRODUCTS) {
  const theme = bundle();
  const products = models.map(model => productToLiquidDrop(model, basePath)!);
  const related = productToLiquidDrop(KINDRED_DEMO_PRODUCTS[1], basePath)!;
  const sectionProducts = Object.fromEntries(Object.values(theme.templates).flatMap(template => Object.entries(template.sections).map(([id, section]) => [id, section.type === 'featured-products' ? [related] : products])));
  const result = await new LiquidRenderer().render({
    context: { storeId: siteId, subdomain: 'kindred-projection', path: key === 'product' ? `${basePath}/product/${models[0]?.id}` : `${basePath}/products`, previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: theme, liquidTemplateKey: key,
    liquidContext: {
      shop: { id: siteId, name: 'Synthetic Kindred', subdomain: 'kindred-projection', ...KINDRED_DEMO_DISCOVERY },
      product: products[0] ?? null,
      collection: { title: 'Birthday gifts', products, total: products.length },
      collections: KINDRED_DEMO_COLLECTIONS,
      section_products: sectionProducts,
    },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
  assert.deepEqual(result.warnings, []);
  return { document: new JSDOM(result.liquid!.contentForLayout).window.document, html: result.liquid!.contentForLayout, products };
}

test('explicit v2 dispatch reaches Kindred and leaves the default neutral Summit distribution intact', () => {
  const legacy = createFirstPartyCatalogBundle('letbuyy-summit');
  const explicit = createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' });
  assert.equal(legacy.package.version, '1.0.0');
  assert.doesNotMatch(legacy.layout.theme.source, /data-kindred/);
  assert.equal(explicit.package.version, '2.0.0');
  assert.equal(explicit.package.name, 'Kindred');
  assert.match(explicit.layout.theme.source, /data-kindred/);
  assert.equal(firstPartyThemeListings({ designVersion: '2.0.0' }).find(item => item.slug === 'letbuyy-summit')!.id, '7b669c70-0000-4000-8000-000000000010');
  assert.deepEqual(Object.keys(explicit.templates).sort(), Object.keys(legacy.templates).sort());
});

test('actual mapper derives card quantity through the unchanged depth cap for home and collection', async () => {
  for (const key of ['index', 'collection'] as const) {
    const { document, products } = await render(key);
    const cards = document.querySelectorAll('.kr-card');
    assert.equal(cards.length, 2);
    for (const card of cards) assert.match(card.querySelector('.kr-card-meta')!.textContent!, /3 included items/);
    assert.equal(cards[0].querySelector('a')!.getAttribute('href'), `${basePath}/product/${KINDRED_DEMO_PRODUCTS[0].id}`);
    assert.equal((products[0].gifts as { itemCount: number }).itemCount, 3);
  }
  const quantity = copy();
  quantity.gifts = GiftFactsSchema.parse({ contents: [{ label: 'Notebook', quantity: 2 }, { label: 'Pen', quantity: 1 }] });
  const { document } = await render('collection', [quantity]);
  assert.match(document.querySelector('.kr-card-meta')!.textContent!, /3 included items/);
});

test('actual PDP carries the correct contents, roles and canonical packaging prices and stock', async () => {
  const { document } = await render('product');
  assert.equal(document.querySelectorAll('#gift-contents li').length, 3);
  assert.match(document.querySelector('#gift-contents')!.textContent!, /300 ml/);
  assert.deepEqual([...document.querySelectorAll('.kr-media-pair figcaption')].map(item => item.textContent!.split(' · ')[0]), ['Open box', 'Closed box']);
  const views = [...document.querySelectorAll('.kr-media-pair img')].map(item => item.getAttribute('src'));
  assert.ok(views[0]!.includes('little-pause-open.webp'));
  assert.ok(views[1]!.includes('little-pause-closed.webp'));
  const variants = JSON.parse(document.querySelector('lb-variant-picker')!.getAttribute('data-variants')!) as Array<{ id: string; price: number; stock: number }>;
  assert.deepEqual(variants.map(item => [item.id, item.price, item.stock]), KINDRED_DEMO_PRODUCTS[0].variants.map(item => [item.id, item.price, item.stock]));
  assert.equal(document.querySelector('lb-add-to-cart')!.getAttribute('data-product-price'), '1790');
  assert.ok(document.querySelector('[data-lb-add-to-cart]'));
});

test('actual mapper never invents item counts or contents for missing and malformed facts', async () => {
  for (const gifts of [undefined, { suitabilityNote: 'For a quiet day.' }, { contents: [] }, { ...KINDRED_DEMO_PRODUCTS[0].gifts, itemCount: 999 }]) {
    const item = Object.assign(copy(), { gifts }) as ProductModel;
    const drop = productToLiquidDrop(item)!;
    assert.equal((drop.gifts as { itemCount?: number } | undefined)?.itemCount, undefined);
    const { document } = await render('collection', [item]);
    assert.match(document.querySelector('.kr-card-meta')!.textContent!, /Contents not supplied/);
    const pdp = await render('product', [item]);
    assert.match(pdp.document.querySelector('#gift-contents')!.textContent!, /merchant has not supplied a contents list/);
    assert.equal(pdp.document.querySelectorAll('#gift-contents li').length, 0);
  }
});

test('schema-valid but out-of-catalog media indices never produce false box images or captions', async () => {
  const invalid = copy();
  invalid.gifts = GiftFactsSchema.parse({ ...invalid.gifts, mediaRoles: { openBox: 19, closedBox: 18 } });
  assert.equal(GiftFactsSchema.safeParse(invalid.gifts).success, true);
  const rendered = await render('product', [invalid]);
  assert.equal(rendered.document.querySelectorAll('.kr-media-pair figure').length, 0);
  assert.equal(rendered.document.querySelectorAll('.kr-media-pair img').length, 0);
  assert.doesNotMatch(rendered.html, /src="undefined"|<figcaption>Open box|<figcaption>Closed box/);
  const partial = copy();
  partial.gifts = GiftFactsSchema.parse({ ...partial.gifts, mediaRoles: { openBox: 0, closedBox: 19 } });
  const oneView = await render('product', [partial]);
  assert.equal(oneView.document.querySelectorAll('.kr-media-pair figure').length, 1);
  assert.match(oneView.document.querySelector('.kr-media-pair figcaption')!.textContent!, /^Open box/);
  const noMedia = Object.assign(copy(), { images: [] });
  assert.equal((await render('product', [noMedia])).document.querySelectorAll('.kr-media-pair figure').length, 0);
});

test('actual mapper and Kindred output escape merchant markup and ignore unrelated metadata', async () => {
  const malicious = Object.assign(copy(), { name: '<script>gift()</script>', metadata: { supplier: 'NEVER_PUBLIC' } });
  malicious.gifts = GiftFactsSchema.parse({ contents: [{ label: '<img src=x onerror=gift()>', quantity: 1, detail: '<script>detail()</script>' }], suitabilityNote: '<iframe src=x></iframe>' });
  const drop = productToLiquidDrop(malicious)!;
  assert.equal('metadata' in drop, false);
  assert.doesNotMatch(JSON.stringify(drop), /NEVER_PUBLIC/);
  for (const key of ['collection', 'product'] as const) {
    const { document, html } = await render(key, [malicious]);
    assert.equal(document.querySelector('script,iframe,img[onerror]'), null);
    assert.match(html, /&lt;script&gt;/);
  }
});

test('retained Kindred inline block roots expose exact IDs only in actual editor preview', async () => {
  for (const previewMode of [true, false]) {
    const theme = bundle();
    theme.templates.index = {
      layout: 'theme', order: ['kindred-faq-probe'], sections: {
        'kindred-faq-probe': { type: 'faq-accordion', settings: { title: 'Gift questions' }, disabled: false,
          blocks: Object.fromEntries(['first-question', 'second-question'].map(id => [id, { type: 'faq-item', settings: { question: 'Same question', answer: 'Supplied contents.' }, blocks: {}, block_order: [], disabled: false }])),
          block_order: ['first-question', 'second-question'],
        },
      },
    };
    const result = await new LiquidRenderer().render({
      context: { storeId: siteId, subdomain: 'kindred-projection', path: '/', previewMode, locale: 'en-IN' },
      storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
      liquidTemplateKey: 'index', liquidBundle: theme,
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    const document = new JSDOM(result.liquid!.contentForLayout).window.document;
    const roots = [...document.querySelectorAll('details.lb-faq-accordion__item')];
    assert.equal(roots.length, 2);
    assert.deepEqual(roots.map(root => root.getAttribute('data-block-id')), previewMode ? ['first-question', 'second-question'] : [null, null]);
    assert.equal(document.querySelector('.lb-faq-accordion__items')!.children.length, 2, 'No editor wrapper changes the existing DOM structure.');
    if (!previewMode) assert.equal(document.querySelector('[data-block-id]'), null);
  }
});
