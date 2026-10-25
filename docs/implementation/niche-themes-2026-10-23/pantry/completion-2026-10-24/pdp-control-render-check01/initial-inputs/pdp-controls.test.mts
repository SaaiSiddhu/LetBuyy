import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
import { buildProductFactPresentation } from '../../../../../../packages/commerce-core/src/product-fact-presentation.ts';

const root = new URL('../../../../../../', import.meta.url);
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const packagePath = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-refresh-2.0.0.json';
const packageBytes = readFileSync(new URL(packagePath, root));
assert.equal(sha(packageBytes), '39866e8607d2f0e98bd6abafd4d33141e915b44140d2e8f70c2893462dae8cf9');
const frozen = LiquidThemePackageBundleSchema.parse(JSON.parse(packageBytes.toString()).document.liquidBundle);
const pins = [packagePath, 'packages/theme-engine/src/theme-renderer.ts', 'packages/theme-engine/src/theme-bundle.ts', 'packages/theme-engine/src/theme-settings.ts', 'packages/commerce-core/src/product-fact-presentation.ts', 'packages/commerce-core/src/pantry-facts.ts'].map(path => ({ path, sha256: sha(readFileSync(new URL(path, root))) }));
assert.equal(pins[1].sha256, '794cbc6ff9ae71f995560f302e1b0d5f0d4ff4da59fa31191585851b1e822164');
const require = createRequire(new URL('packages/theme-engine/package.json', root));
const { JSDOM } = require('jsdom');
const artifacts = new URL('results/', import.meta.url);
assert.equal(existsSync(artifacts), false, 'Refuse to overwrite earlier observations'); mkdirSync(artifacts);
writeFileSync(new URL('source-pins-before.json', artifacts), JSON.stringify(pins, null, 2));
const observations: Record<string, unknown>[] = [];
const oldFetch = globalThis.fetch; let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Network is outside this pure render check.'); };
function product(nutritionText: string | null = 'Merchant-supplied label: energy 340 kcal per100g.') {
  return {
    id: '11111111-1005-4000-8000-000000000001', title: 'Synthetic source-only red lentils', price: 180, currency: 'INR',
    url: '/product/source-only-lentils', available: true, options: [], variants: [],
    images: ['/theme-assets/pantry/v2/red-lentils.webp', '/theme-assets/pantry/v2/staples-still-life.webp'],
    featured_image: '/theme-assets/pantry/v2/red-lentils.webp', description: 'Supplier-provided product description.',
    reviews: [{ author: 'Synthetic reviewer', rating: 4, is_verified: false, title: 'Supplied review', body: 'Source-only review text.', helpful_count: 0 }], review_count: 1, rating: 4,
    ...buildProductFactPresentation({ facts: { food: { ingredients: 'Split red lentils (100%).', allergens: { status: 'not_supplied' }, storage: 'Keep cool and dry.', preparation: 'Rinse before cooking.', nutritionText, netQuantity: { value: 250, unit: 'g' } } }, priceMinor: 18000, hasVariants: false }),
  };
}
async function render(settings: Record<string, boolean> = {}, item = product()) {
  const bundle: LiquidThemePackageBundle = structuredClone(frozen);
  Object.assign(bundle.templates.product.sections['pantry-selection'].settings, settings);
  const before = JSON.stringify({ bundle, item });
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'pantry-pdp-source-only', path: item.url, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: { ...DEFAULT_THEME_SETTINGS, ...bundle.config.settings_data.current }, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'product',
    liquidContext: { shop: { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic source-only Pantry' }, product: item, section_products: { 'pantry-related': [] } },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  assert.equal(JSON.stringify({ bundle, item }), before, 'Renderer must not mutate source data');
  const html = result.liquid.contentForLayout, style = result.liquid.headStyleText ?? '', outputSha256 = sha(html + '\n' + style);
  if (!existsSync(new URL(`${outputSha256}.json`, artifacts))) writeFileSync(new URL(`${outputSha256}.json`, artifacts), JSON.stringify({ html, style }, null, 2));
  observations.push({ settings, outputSha256, htmlSha256: sha(html), styleSha256: sha(style) });
  const dom = new JSDOM(html); return { html, document: dom.window.document, close: () => dom.window.close() };
}
function description(document: Document) {
  return [...document.querySelectorAll('.lb-product-detail__accordion')].find(node => node.querySelector('summary')?.textContent === 'Description');
}
function foodText(document: Document) { return document.querySelector('.pn-food-facts')?.textContent; }

test('PDPCTRL01: actual frozen200 manifest exposes all four controls with unchanged stable product section', () => {
  assert.equal(frozen.package.slug, 'letbuyy-refresh'); assert.equal(frozen.package.version, '2.0.0');
  assert.equal(frozen.templates.product.sections['pantry-selection'].type, 'product-detail');
  for (const id of ['showGallery', 'showDescription', 'showReviews', 'showNutrition']) assert.equal(frozen.sections['product-detail'].schema.settings.find(field => field.id === id)?.type, 'toggle');
});

test('PDPCTRL02: gallery true/false changes real gallery output; missing media is honest; food warnings stay visible', async () => {
  const on = await render({ showGallery: true }), off = await render({ showGallery: false });
  try {
    assert.equal(on.document.querySelectorAll('lb-product-gallery [data-lb-gallery-image]').length, 2);
    assert.equal(on.document.querySelectorAll('lb-product-gallery [data-lb-gallery-thumb]').length, 2);
    assert.equal(off.document.querySelector('lb-product-gallery'), null); assert.equal(foodText(on.document), foodText(off.document));
    const item = { ...product(), images: [], featured_image: '' }, missing = await render({ showGallery: true }, item);
    try { assert.match(missing.document.querySelector('.lb-product-detail__gallery')?.textContent ?? '', /Product image not supplied/); assert.equal(missing.document.querySelector('lb-product-gallery'), null); } finally { missing.close(); }
  } finally { on.close(); off.close(); }
});

test('PDPCTRL03: description false/true renders supplied content; clearing it does not leave an empty accordion', async () => {
  const on = await render({ showDescription: true }), off = await render({ showDescription: false });
  try {
    assert.match(description(on.document)?.textContent ?? '', /Supplier-provided product description/); assert.equal(description(off.document), undefined);
    const clear = await render({ showDescription: true }, { ...product(), description: '' });
    try { assert.equal(description(clear.document), undefined, 'A cleared description must not expose an empty disclosure'); } finally { clear.close(); }
  } finally { on.close(); off.close(); }
});

test('PDPCTRL04: nutrition true/false only toggles supplied text; absent text remains absent and safety facts survive', async () => {
  const on = await render({ showNutrition: true }), off = await render({ showNutrition: false });
  try {
    assert.match(foodText(on.document) ?? '', /Supplied nutrition information.*Merchant-supplied label/s);
    assert.doesNotMatch(foodText(off.document) ?? '', /Supplied nutrition information|340 kcal/);
    for (const output of [on, off]) assert.match(foodText(output.document) ?? '', /Split red lentils.*Unknown is not allergen-free/s);
    const missing = await render({ showNutrition: true }, product(null)); try { assert.doesNotMatch(foodText(missing.document) ?? '', /Supplied nutrition information|kcal/); } finally { missing.close(); }
  } finally { on.close(); off.close(); }
});

test('PDPCTRL05: reviews control governs supplied review list/form; review and nutrition text cannot inject active markup', async () => {
  const item = product('<img src=x onerror=attack()> ऊर्जा / உணவு'); item.reviews[0].title = '<script>reviewAttack()</script> समीक्षा';
  const on = await render({ showReviews: true, showNutrition: true }, item), off = await render({ showReviews: false }, item);
  try {
    assert.equal(on.document.querySelector('.lb-product-review__heading')?.textContent, item.reviews[0].title); assert.equal(on.document.querySelectorAll('lb-review-form').length, 1);
    assert.equal(off.document.querySelector('.lb-product-reviews'), null); assert.equal(off.document.querySelector('lb-review-form'), null);
    assert.equal(on.document.querySelector('script,[onerror],img[src="x"]'), null); assert.match(foodText(on.document) ?? '', /<img src=x onerror=attack\(\)> ऊर्जा \/ உணவு/);
    assert.equal(on.document.querySelector('.lb-product-review__verified'), null, 'Synthetic unverified source review must not become verified');
  } finally { on.close(); off.close(); }
});

test('PDPCTRL06: hiding all optional PDP regions preserves purchase identity, price, net facts and allergen warning', async () => {
  const on = await render({ showGallery: true, showDescription: true, showReviews: true, showNutrition: true });
  const off = await render({ showGallery: false, showDescription: false, showReviews: false, showNutrition: false });
  try {
    for (const selector of ['h1', '.lb-product-detail__price', '[data-lb-food-net-quantity]', '.lb-product-detail__purchase']) assert.equal(off.document.querySelector(selector)?.innerHTML, on.document.querySelector(selector)?.innerHTML, selector);
    assert.match(foodText(off.document) ?? '', /Unknown is not allergen-free/); assert.match(foodText(off.document) ?? '', /Split red lentils \(100%\)/);
    const facts = off.document.querySelector('.pn-food-facts')!, purchase = off.document.querySelector('.lb-product-detail__purchase')!; assert.ok(facts.compareDocumentPosition(purchase) & 4, 'Safety information precedes purchase in document order');
    assert.equal(networkAttempts, 0);
  } finally { on.close(); off.close(); }
});

test.after(() => {
  globalThis.fetch = oldFetch;
  const after = pins.map(pin => ({ ...pin, actual: sha(readFileSync(new URL(pin.path, root))) }));
  writeFileSync(new URL('source-pins-after.json', artifacts), JSON.stringify(after, null, 2));
  writeFileSync(new URL('renders.json', artifacts), JSON.stringify({ classification: 'FROZEN200_SOURCE_RENDER_CONTROLS_ONLY_NOT_BROWSER_RESOURCE_ORDER_OR_PAYMENT_ACCEPTANCE', inputPackage: packagePath, inputPackageSha256: sha(packageBytes), networkAttempts, observations }, null, 2));
  assert.ok(after.every(pin => pin.sha256 === pin.actual), 'Pinned renderer/package/source changed during check');
});
