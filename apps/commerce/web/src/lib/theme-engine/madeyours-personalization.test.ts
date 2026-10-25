import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindMadeYoursPersonalization } from './madeyours-personalization';
import { MADEYOURS_DEMO_BLOCK_FACTS } from '../demo/madeyours-demo';
import { MADEYOURS_DEMO_PRODUCTS, withMadeYoursDemoContent } from '../demo/madeyours-demo';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer, LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import { productToLiquidDrop } from './product-liquid-drop';

function fixture(facts: unknown = MADEYOURS_DEMO_BLOCK_FACTS) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>') as unknown as { window: Window & typeof globalThis };
  const document = dom.window.document;
  const element = document.createElement('lb-add-to-cart');
  element.dataset.lbPersonalizationRequired = 'true'; element.dataset.lbPersonalizationFacts = JSON.stringify(facts);
  element.innerHTML = `<div data-lb-personalization><ol><li data-lb-personalization-stage="specify" aria-current="step">Specify</li><li data-lb-personalization-stage="review">Review</li></ol><fieldset data-lb-personalization-fields><select data-lb-personalization-method><option value="engraving">Front engraving</option><option value="cover-print">Cover print</option></select><input data-lb-personalization-text><select data-lb-personalization-style></select><select data-lb-personalization-placement></select><p data-lb-personalization-help></p><p data-lb-personalization-error hidden></p></fieldset><div data-lb-personalization-preview hidden><output data-lb-personalization-preview-text></output><p data-lb-personalization-preview-note></p></div><p data-lb-personalization-unavailable>Unavailable</p><button type="button" data-lb-personalization-review disabled>Review</button><section data-lb-personalization-summary hidden><span data-lb-personalization-summary-text></span><span data-lb-personalization-summary-method></span><span data-lb-personalization-summary-style></span><span data-lb-personalization-summary-placement></span><button type="button" data-lb-personalization-edit>Edit</button></section></div><button data-lb-add-to-cart disabled>Add</button>`;
  document.body.append(element);
  const q = <T extends Element = HTMLElement>(selector: string) => element.querySelector<T>(`[data-lb-personalization-${selector}]`)!;
  const input = (value: string) => { q<HTMLInputElement>('text').value = value; q('text').dispatchEvent(new dom.window.Event('input')); };
  const controller = bindMadeYoursPersonalization(element);
  return { dom, element, q, input, controller, purchase: element.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')! };
}

test('requires explicit review and canonical base eligibility before exposing a cart draft', () => {
  const f = fixture(); assert.ok(f.controller);
  f.input('Asha');
  assert.equal(f.controller.readReviewedDraft(), null); assert.equal(f.purchase.disabled, true);
  f.q<HTMLButtonElement>('review').click();
  assert.equal(f.controller.readReviewedDraft(), null); // canonical inventory/variant eligibility has not been supplied.
  f.controller.setBasePurchasable(true);
  assert.equal(f.purchase.disabled, false);
  assert.deepEqual(f.controller.readReviewedDraft(), { method_id: 'engraving', style_id: 'sans', placement_id: 'front-center', text: 'Asha' });
  assert.equal(f.q('summary-text').textContent, 'Asha');
  assert.equal(f.q('summary-method').textContent, 'Front engraving');
  assert.equal(f.q('summary-style').textContent, 'Sans');
  assert.equal(f.q('summary-placement').textContent, 'Centered on the front');
  assert.equal(f.dom.window.document.activeElement, f.q('summary'));
  f.controller.setBasePurchasable(false); assert.equal(f.purchase.disabled, true); assert.equal(f.controller.readReviewedDraft(), null);
  f.controller.destroy(); f.dom.window.close();
});
test('invalid edits retain exact draft and last valid preview without allowing stale review', () => {
  const f = fixture(); assert.ok(f.controller); f.controller.setBasePurchasable(true);
  f.input('Asha'); f.q<HTMLButtonElement>('review').click();
  f.q<HTMLButtonElement>('edit').click(); f.input('Asha ✦');
  assert.equal(f.q<HTMLInputElement>('text').value, 'Asha ✦');
  assert.equal(f.q('preview-text').textContent, 'Asha');
  assert.match(f.q('preview-note').textContent || '', /last valid text/);
  assert.match(f.q('error').textContent || '', /Use A–Z/);
  assert.equal(f.q('summary').hidden, true);
  assert.equal(f.purchase.disabled, true); assert.equal(f.controller.readReviewedDraft(), null);
  f.input('Kabir'); f.q<HTMLButtonElement>('review').click();
  assert.equal(f.q('summary-text').textContent, 'Kabir');
  assert.equal(f.controller.readReviewedDraft()?.text, 'Kabir');
  // A script changing the DOM without dispatching an input event still cannot reuse a prior review.
  f.q<HTMLInputElement>('text').value = 'Not reviewed';
  assert.equal(f.controller.readReviewedDraft(), null);
  f.controller.destroy(); f.dom.window.close();
});
test('selection eligibility loss and explicit stale-context invalidation each require a new review', () => {
  const f = fixture(); assert.ok(f.controller); f.controller.setBasePurchasable(true);
  f.input('Asha'); f.q<HTMLButtonElement>('review').click();
  assert.equal(f.purchase.disabled, false);
  f.controller.setBasePurchasable(false); f.controller.setBasePurchasable(true);
  assert.equal(f.controller.readReviewedDraft(), null); assert.equal(f.purchase.disabled, true);
  assert.equal(f.q('summary').hidden, true); assert.equal(f.q<HTMLInputElement>('text').value, 'Asha');
  f.q<HTMLButtonElement>('review').click(); assert.equal(f.controller.readReviewedDraft()?.text, 'Asha');
  f.controller.invalidateReview('Choices changed. Review again.');
  assert.equal(f.controller.readReviewedDraft(), null); assert.equal(f.purchase.disabled, true);
  assert.equal(f.q('error').textContent, 'Choices changed. Review again.');
  f.q<HTMLButtonElement>('review').click(); assert.equal(f.controller.readReviewedDraft()?.text, 'Asha');
  f.controller.destroy(); f.controller.invalidateReview('late update');
  assert.equal(f.controller.readReviewedDraft(), null); assert.equal(f.purchase.disabled, true);
  f.dom.window.close();
});
test('normalization requires a separate affirmative action and another review', () => {
  const facts = { ...MADEYOURS_DEMO_BLOCK_FACTS, methods: [{ ...MADEYOURS_DEMO_BLOCK_FACTS.methods[0], character_set: 'unicode-letters' }] };
  const f = fixture(facts); assert.ok(f.controller); f.controller.setBasePurchasable(true);
  f.input('Jose\u0301'); f.q<HTMLButtonElement>('review').click();
  assert.equal(f.q<HTMLInputElement>('text').value, 'Jose\u0301');
  assert.equal(f.controller.readReviewedDraft(), null);
  const normalize = f.q<HTMLButtonElement>('normalize');
  assert.equal(normalize.hidden, false); normalize.click();
  assert.equal(f.q<HTMLInputElement>('text').value, 'José');
  assert.equal(f.controller.readReviewedDraft(), null);
  f.q<HTMLButtonElement>('review').click();
  assert.equal(f.controller.readReviewedDraft()?.text, 'José');
  f.controller.destroy(); f.dom.window.close();
});
test('method changes use only product-defined choices and invalidate a previous review', () => {
  const method = MADEYOURS_DEMO_BLOCK_FACTS.methods[0];
  const f = fixture({ ...MADEYOURS_DEMO_BLOCK_FACTS, methods: [method, { ...method, id: 'cover-print', label: 'Cover print', max_graphemes: 3, styles: [{ id: 'cover', label: 'Cover sans' }], placements: [{ id: 'cover-center', label: 'Cover center' }] }] });
  assert.ok(f.controller); f.controller.setBasePurchasable(true); f.input('Asha'); f.q<HTMLButtonElement>('review').click();
  f.q<HTMLButtonElement>('edit').click();
  f.q<HTMLSelectElement>('method').value = 'cover-print'; f.q('method').dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(f.q<HTMLSelectElement>('style').value, 'cover'); assert.equal(f.q<HTMLSelectElement>('placement').value, 'cover-center');
  assert.match(f.q('help').textContent || '', /1–3/);
  assert.equal(f.controller.readReviewedDraft(), null); assert.equal(f.purchase.disabled, true);
  assert.match(f.q('error').textContent || '', /entered 4/);
  f.controller.destroy(); f.dom.window.close();
});
test('style changes affect the illustrative preview and exact reviewed summary', () => {
  const f = fixture(); assert.ok(f.controller); f.controller.setBasePurchasable(true); f.input('Asha');
  f.q<HTMLSelectElement>('style').value = 'serif'; f.q('style').dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(f.q('preview-text').style.fontFamily, 'Georgia, serif');
  assert.match(f.q('preview-note').textContent || '', /Serif · Centered on the front/);
  f.q<HTMLButtonElement>('review').click();
  assert.equal(f.q('summary-style').textContent, 'Serif'); assert.equal(f.controller.readReviewedDraft()?.style_id, 'serif');
  f.controller.destroy(); f.dom.window.close();
});
test('malformed or unavailable facts fail closed; nonpersonalized canonical products are untouched', () => {
  for (const facts of [null, {}, { ...MADEYOURS_DEMO_BLOCK_FACTS, methods: [] }, { ...MADEYOURS_DEMO_BLOCK_FACTS, provider_secret: 'never' }]) {
    const f = fixture(facts); assert.equal(f.controller, null); assert.equal(f.purchase.disabled, true); assert.equal(f.q('unavailable').hidden, false); f.dom.window.close();
  }
  const f = fixture(); f.controller?.destroy(); delete f.element.dataset.lbPersonalizationRequired; f.purchase.disabled = false;
  assert.equal(bindMadeYoursPersonalization(f.element), null); assert.equal(f.purchase.disabled, false); f.dom.window.close();
});
test('merchant labels are text, never HTML, and teardown removes behavior and blocks purchase', () => {
  const facts = { ...MADEYOURS_DEMO_BLOCK_FACTS, methods: [{ ...MADEYOURS_DEMO_BLOCK_FACTS.methods[0], styles: [{ id: 'sans', label: '<img src=x onerror=alert(1)>' }] }] };
  const f = fixture(facts); assert.ok(f.controller); f.controller.setBasePurchasable(true); f.input(' Asha '); f.q<HTMLButtonElement>('review').click();
  assert.equal(f.q('summary-text').textContent, ' Asha '); assert.equal(f.q('summary-style').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(f.element.querySelector('img'), null);
  f.controller.destroy(); assert.equal(f.purchase.disabled, true); assert.equal(f.controller.readReviewedDraft(), null);
  assert.equal(f.q<HTMLButtonElement>('review').disabled, true);
  f.input('Kabir'); assert.equal(f.q('summary-text').textContent, ' Asha ');
  f.dom.window.close();
});
test('actual catalog factory → public product mapper → sanitized Liquid PDP → existing-element binding preserves full facts', async () => {
  const savedV1 = createFirstPartyCatalogBundle('letbuyy-nova');
  const source = createFirstPartyCatalogBundle('letbuyy-nova', { designVersion: '2.0.0' });
  assert.equal(savedV1.package.name, 'Nova'); assert.equal(savedV1.package.version, '1.0.0');
  assert.equal(source.package.name, 'MadeYours'); assert.equal(source.package.version, '2.0.0');
  const content = withMadeYoursDemoContent({ liquidBundle: source });
  const bundle = LiquidThemePackageBundleSchema.parse(content.liquidBundle);
  const product = productToLiquidDrop(MADEYOURS_DEMO_PRODUCTS[0], '/store/madeyours-demo');
  assert.ok(product);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'madeyours-demo', path: '/product/' + product.id, previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-nova', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'product',
    liquidContext: { shop: { name: 'Synthetic MadeYours' }, product },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  const dom = new JSDOM(result.liquid!.contentForLayout) as unknown as { window: Window & typeof globalThis };
  const element = dom.window.document.querySelector<HTMLElement>('lb-add-to-cart')!;
  assert.deepEqual(JSON.parse(element.dataset.lbPersonalizationFacts!), MADEYOURS_DEMO_BLOCK_FACTS);
  const binding = bindMadeYoursPersonalization(element); assert.ok(binding);
  binding.setBasePurchasable(true);
  assert.equal(binding.readReviewedDraft(), null);
  const input = element.querySelector<HTMLInputElement>('[data-lb-personalization-text]')!;
  input.value = 'Asha'; input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(binding.readReviewedDraft(), null);
  const style = element.querySelector<HTMLSelectElement>('[data-lb-personalization-style]')!;
  assert.deepEqual(Array.from(style.options, option => option.textContent), ['Sans', 'Serif']);
  element.querySelector<HTMLButtonElement>('[data-lb-personalization-review]')!.click();
  assert.equal(binding.readReviewedDraft()?.text, 'Asha');
  assert.equal(element.querySelector('[data-lb-personalization-summary-placement]')?.textContent, 'Centered on the front');
  input.value = 'Kabir'; input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(binding.readReviewedDraft(), null);
  binding.destroy(); dom.window.close();
});
