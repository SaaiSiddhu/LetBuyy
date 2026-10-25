import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createLetbuyyCoreLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { productToLiquidDrop } from './product-liquid-drop';
import { readProductNicheFacts, type ProductModel } from '@letbuyy/commerce-core';

const facts = {
  toys: { ageBands: ['6-8'], contents: [{ label: 'Tiles', quantity: 12 }], contentsComplete: true },
  electronics: { video: { width_px: 3840, height_px: 2160, refresh_hz: 60 } },
  food: { netQuantity: { value: 999, unit: 'ml' } },
  furniture: { assembled: { width: 68, depth: 78, height: 74, unit: 'cm' } },
  gifts: { contents: [{ label: 'Notebook', quantity: 2 }, { label: 'Pen', quantity: 1 }] },
  beauty: { netQuantity: { value: 30, unit: 'ml' }, shades: [{ value: 'Rosewater' }, { value: 'Pink Clay' }] },
  sports: { activity: 'badminton', equipmentType: 'racket', length: { value: 67.5, unit: 'cm' } },
  books: { kind: 'book', authors: ['Asha Test'], language: 'English', format: 'paperback' },
  personalization: { version: 1, revision: 1, methods: [{ id: 'engrave', label: 'Engrave <review & accept>', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front', label: 'Front' }] }] },
};

function model(): ProductModel {
  return {
    id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic shared projection', description: '', price: 180,
    currency: 'INR', stock: 3, images: [], ...readProductNicheFacts(facts),
    variantOptions: [{ name: 'Pack size', values: ['250 g', '500 g'] }],
    variants: [
      { id: '22222222-2222-4222-8222-222222222222', price: 180, stock: 3, options: { 'Pack size': '250 g' }, food: { netQuantity: { value: 250, unit: 'g' } }, furniture: { package: { width: 72, depth: 82, height: 78, unit: 'cm' } }, sports: { length: { value: 68, unit: 'cm' } }, books: { kind: 'book', language: 'Hindi', format: 'hardback', dimensions_mm: { width: 156, height: 234 } } },
      { id: '33333333-3333-4333-8333-333333333333', price: 340, stock: 0, options: { 'Pack size': '500 g' } },
    ],
  };
}

const card = `<article><p class="age">{{ item.toys_card.ageLabel }}</p><p class="contents">{{ item.toys_card.contentsLabel }}</p><p class="video">{{ item.electronics_video_summary }}</p><p class="food">{{ item.food.netQuantityValue }}</p><p class="furniture">{{ item.furniture_display.assembled }}</p><p class="gifts">{{ item.gifts.itemCount }}</p><p class="beauty">{{ item.beauty.shadeCount }} / {{ item.beauty.netQuantityLabel }}</p><p class="sports">{{ item.sports_display.length }}</p><p class="books">{{ item.books_display.authors }} / {{ item.books_display.multiple_editions }}</p><p class="personalization">{{ item.personalization.methodSummary }}</p></article>`;
async function render(key: 'product' | 'collection', drop: Record<string, unknown>) {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const type = key === 'collection' ? 'collection-product-list' : 'product-detail';
  bundle.templates[key] = { sections: { probe: { type, settings: {}, blocks: {}, block_order: [], disabled: false } }, order: ['probe'] };
  bundle.sections[type].source = key === 'collection' ? `{% for item in collection.products %}${card}{% endfor %}`
    : `<lb-add-to-cart data-lb-personalization-facts="{{ product.personalization_json }}"></lb-add-to-cart>{% for variant in product.variants %}<article data-variant-id="{{ variant.id }}"><p class="pack">{{ variant.food.netQuantityValue }} {{ variant.food.netQuantityUnit }} / {{ variant.food.unitPriceMinor }}</p><p class="package">{{ variant.furniture_display.package }}</p><p class="length">{{ variant.sports_display.length }}</p><p class="edition">{{ variant.books_display.dimensions }}</p></article>{% endfor %}`;
  bundle.sections[type].source += `{% schema %}${JSON.stringify(bundle.sections[type].schema)}{% endschema %}`;
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'projection-test', path: '/', previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-core', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { product: drop, collection: { products: [drop] } },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
  assert.deepEqual(result.warnings, []);
  return new JSDOM(result.liquid!.contentForLayout).window.document;
}

test('actual application mapper preserves all nine derived namespaces through collection depth4', async () => {
  const document = await render('collection', productToLiquidDrop(model())!);
  const read = (selector: string) => document.querySelector(selector)?.textContent;
  assert.equal(read('.age'), 'Ages 6–8'); assert.equal(read('.contents'), '12 × Tiles');
  assert.equal(read('.video'), '3840 × 2160 / 60 Hz'); assert.equal(read('.food'), '');
  assert.equal(read('.furniture'), '68 W × 78 D × 74 H cm'); assert.equal(read('.gifts'), '3');
  assert.equal(read('.beauty'), '2 / 30 ml'); assert.equal(read('.sports'), '67.5 cm');
  assert.equal(read('.books'), 'Asha Test / true');
  assert.equal(read('.personalization'), 'Engrave <review & accept> · 1–18');
  assert.equal(document.querySelector('review'), null);
});

test('actual PDP keeps exact inert personalization JSON and UUID-specific variant display facts', async () => {
  const document = await render('product', productToLiquidDrop(model())!);
  const encoded = document.querySelector('lb-add-to-cart')?.getAttribute('data-lb-personalization-facts');
  assert.ok(encoded);
  assert.deepEqual(JSON.parse(encoded), facts.personalization);
  const variants = document.querySelectorAll('article[data-variant-id]');
  assert.equal(variants.length, 2);
  assert.match(variants[0].querySelector('.pack')!.textContent!, /250 g \/ 7200/);
  assert.equal(variants[0].querySelector('.package')!.textContent, '72 W × 82 D × 78 H cm');
  assert.equal(variants[0].querySelector('.length')!.textContent, '68 cm');
  assert.equal(variants[0].querySelector('.edition')!.textContent, '156 × 234 mm');
  assert.doesNotMatch(variants[1].querySelector('.pack')!.textContent!, /999|7200|ml/);
});

test('anonymous Liquid variant projection cannot copy arbitrary metadata, supplier cost or SKU', () => {
  const product = model();
  const variant = product.variants![0];
  Object.assign(variant, { sku: 'PRIVATE_SKU', private_cost: 'PRIVATE_COST', metadata: { private_cost: 'VARIANT_SECRET', food: { netQuantity: { value: 250, unit: 'g' } } } });
  const drop = productToLiquidDrop(product)!;
  const publicVariant = (drop.variants as Array<Record<string, unknown>>)[0];
  assert.equal(publicVariant.id, variant.id);
  assert.equal((publicVariant.food as Record<string, unknown>).netQuantityValue, 250);
  assert.equal(publicVariant.metadata, undefined);
  assert.doesNotMatch(JSON.stringify(drop), /PRIVATE_SKU|PRIVATE_COST|VARIANT_SECRET|private_cost/);
});
