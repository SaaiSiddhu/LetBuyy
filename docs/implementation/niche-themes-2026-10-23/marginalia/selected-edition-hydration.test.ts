/** Actual app registration and picker. This is DOM/behavior evidence, not pixel layout QA. */
import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import type { ProductModel } from '@letbuyy/commerce-core';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { MARGINALIA_DEMO_PRODUCTS } from '../../../../apps/commerce/web/src/lib/demo/marginalia-demo';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';

const evidence = path.resolve('docs/implementation/niche-themes-2026-10-23/marginalia');
const outputs = path.join(evidence, 'selected-edition-dom');
const sourceFiles = ['packages/theme-engine/src/marginalia-theme.ts', 'packages/theme-engine/src/marginalia-styles.ts', 'packages/theme-engine/src/marginalia-discovery.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/theme-engine/src/theme-renderer.ts', 'apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts', 'apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts', 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'];
const readSourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sourceHashesAtStart = readSourceHashes();
const errors: string[] = [];
const console = new VirtualConsole();
console.on('jsdomError', (error: Error) => errors.push(error.message));
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://marginalia.example.invalid/product/synthetic', virtualConsole: console });
const globals = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'CSS'];
const previous = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => { fetchCalls++; throw new Error('Selected-edition evidence must not call a live API.'); }) as typeof fetch;
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('../../../../apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
const report: Array<Record<string, unknown>> = [];

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  assert.deepEqual(errors.splice(0), [], 'The real custom elements must not throw.');
  assert.equal(fetchCalls, 0);
});
after(() => {
  dom.window.close();
  globalThis.fetch = originalFetch;
  for (const name of globals) {
    const descriptor = previous.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function render(model: ProductModel, sectionId = 'product-detail-default') {
  const bundle = createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' });
  const original = bundle.templates.product;
  const detailId = original.order.find(id => original.sections[id].type === 'product-detail');
  assert.ok(detailId);
  bundle.templates.product = { ...original, sections: { [sectionId]: original.sections[detailId] }, order: [sectionId] };
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'marginalia-edition-evidence', path: `/product/${model.id}`, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-dawn', config: bundle.config, themeSettings: { ...DEFAULT_THEME_SETTINGS, ...bundle.config.settings_data.current, fontFamily: bundle.config.settings_data.current.bodyFontFamily }, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: 'product',
    liquidContext: { shop: { name: 'Marginalia', policies: [] }, product: productToLiquidDrop(model) },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  const assembled = assembleLiquidPageFromRenderResult(result.liquid);
  return assembled.html;
}
function section(id = 'product-detail-default') {
  const root = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`); assert.ok(root); return root;
}
function current(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-lb-selected-variant-facts]'); assert.ok(panel); return panel;
}
function fields(root: HTMLElement) {
  return Object.fromEntries([...current(root).querySelectorAll('dl > div')].map(row => [row.querySelector('dt')!.textContent!, row.querySelector('dd')!.textContent!]));
}
function choose(root: HTMLElement, value: string, name = 'Edition') {
  const button = [...root.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(element => element.dataset.variantName === name && element.dataset.variantValue === value);
  assert.ok(button, `${name}: ${value}`); button.click();
}
function disabled(root: HTMLElement, expected: boolean) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-lb-add-to-cart],[data-lb-buy-now]')];
  assert.ok(buttons.length >= 2); assert.ok(buttons.every(button => button.disabled === expected));
}
function save(name: string, root: HTMLElement) {
  fs.mkdirSync(outputs, { recursive: true });
  fs.writeFileSync(path.join(outputs, name + '.html'), root.outerHTML);
}

test('actual registered Marginalia picker shows the exact selected UUID, book measurements, price and unavailable edition', async () => {
  await ready();
  document.body.innerHTML = await render(structuredClone(MARGINALIA_DEMO_PRODUCTS[0]));
  const root = section();
  assert.equal(root.querySelector('lb-variant-picker')!.constructor, window.customElements.get('lb-variant-picker'));
  assert.equal(current(root).dataset.selectionState, 'incomplete');
  assert.match(current(root).textContent!, /Choose all options/); assert.deepEqual(fields(root), {}); disabled(root, true);
  const expected = [
    { label: 'English paperback', language: 'English', format: 'paperback', edition: 'First edition', dimensions: '140 × 216 mm', price: 480, unavailable: false },
    { label: 'English illustrated hardback', language: 'English', format: 'hardback', edition: 'Illustrated edition', dimensions: '156 × 234 mm', price: 780, unavailable: false },
    { label: 'Hindi paperback', language: 'Hindi', format: 'paperback', edition: 'Hindi edition', dimensions: '140 × 216 mm', price: 460, unavailable: true },
  ];
  for (const [index, row] of expected.entries()) {
    choose(root, row.label);
    const id = MARGINALIA_DEMO_PRODUCTS[0].variants![index].id;
    assert.equal(current(root).dataset.variantId, id);
    assert.equal(current(root).dataset.selectionState, row.unavailable ? 'unavailable' : 'selected');
    assert.deepEqual(fields(root), { Authors: 'Mira Sen', Language: row.language, Format: row.format, Edition: row.edition, Dimensions: row.dimensions });
    assert.equal(root.querySelector('.lb-product-detail__price-current')!.textContent, `₹${row.price}`);
    disabled(root, row.unavailable);
    const status = current(root).querySelector('[role="status"]')!;
    assert.equal(status.getAttribute('aria-live'), 'polite'); assert.equal(status.getAttribute('aria-atomic'), 'true');
    assert.ok(status.textContent!.includes(row.label));
    if (row.unavailable) assert.match(status.textContent!, /unavailable/);
    report.push({ case: 'actual edition', id, ...row, displayedFacts: fields(root), purchaseDisabled: row.unavailable });
    save(`edition-${index + 1}`, root);
  }
  assert.equal(root.querySelectorAll('.mg-edition').length, 3, 'No-JS comparison remains present.');
});

test('partial and nonexistent combinations clear prior selected measurements through the real change/click path', async () => {
  await ready();
  const model = structuredClone(MARGINALIA_DEMO_PRODUCTS[0]);
  model.variantOptions = [{ name: 'भाषा / Language', values: ['English', 'Hindi'] }, { name: 'Binding format', values: ['paperback', 'hardback'] }];
  for (const [index, variant] of model.variants!.entries()) variant.options = { 'भाषा / Language': index === 2 ? 'Hindi' : 'English', 'Binding format': index === 1 ? 'hardback' : 'paperback' };
  document.body.innerHTML = await render(model); const root = section();
  choose(root, 'English', 'भाषा / Language');
  assert.equal(current(root).dataset.selectionState, 'incomplete'); assert.deepEqual(fields(root), {}); disabled(root, true);
  choose(root, 'hardback', 'Binding format'); assert.equal(fields(root).Dimensions, '156 × 234 mm');
  choose(root, 'Hindi', 'भाषा / Language');
  assert.equal(current(root).dataset.selectionState, 'unknown'); assert.equal(current(root).dataset.variantId, '');
  assert.match(current(root).textContent!, /No variant matches/); assert.deepEqual(fields(root), {}); disabled(root, true); save('unknown-combination', root);
  choose(root, 'paperback', 'Binding format');
  assert.equal(current(root).dataset.selectionState, 'unavailable'); assert.equal(fields(root).Language, 'Hindi'); assert.equal(fields(root).Dimensions, '140 × 216 mm'); disabled(root, true);
  const picker = root.querySelector('lb-variant-picker')!;
  picker.querySelectorAll('[aria-pressed]').forEach(element => element.setAttribute('aria-pressed', 'false'));
  picker.querySelectorAll('input[type="hidden"]').forEach(element => element.remove());
  picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(current(root).dataset.selectionState, 'incomplete'); assert.deepEqual(fields(root), {}); disabled(root, true);
  report.push({ case: 'partial/unknown/reset', exactPickerEvents: true, staleMeasurementsAbsent: true, hindiAndSpacedOptionNames: true });
});

test('missing optional dimensions do not reuse the last edition and hostile bibliography remains inert', async () => {
  await ready();
  const model = structuredClone(MARGINALIA_DEMO_PRODUCTS[0]);
  const hostile = '<img src=x onerror="attack()">';
  Object.assign(model.variants![1], { metadata: { books: { kind: 'book', authors: [hostile], language: 'English', format: 'hardback', edition: 'No dimensions supplied' }, private_cost: 'NEVER_PUBLIC' } });
  document.body.innerHTML = await render(model); const root = section();
  choose(root, 'English paperback'); assert.equal(fields(root).Dimensions, '140 × 216 mm');
  choose(root, 'English illustrated hardback');
  assert.equal(current(root).dataset.variantId, model.variants![1].id);
  assert.equal(fields(root).Dimensions, undefined); assert.equal(fields(root).Authors, hostile);
  assert.doesNotMatch(current(root).textContent!, /140 × 216|156 × 234|NEVER_PUBLIC/);
  assert.equal(current(root).querySelector('img,script,[onerror]'), null);
  disabled(root, false); save('missing-dimensions-hostile-text', root);
  report.push({ case: 'missing dimensions and inert text', staleMeasurementsAbsent: true, privateMetadataAbsent: true });
});

test('two same-label product sections stay UUID-scoped and disconnect/reconnect restores the no-JS fallback', async () => {
  await ready();
  const other = structuredClone(MARGINALIA_DEMO_PRODUCTS[0]); other.id = '7b669c70-7100-4000-8000-000000000011';
  for (const [index, variant] of other.variants!.entries()) {
    variant.id = `7b669c70-7200-4000-8000-00000000001${index + 1}`;
    Object.assign(variant, { metadata: { books: { kind: 'book', language: index === 2 ? 'Hindi' : 'English', format: index === 1 ? 'hardback' : 'paperback', dimensions_mm: { width: 172, height: 250 } } } });
  }
  document.body.innerHTML = await render(structuredClone(MARGINALIA_DEMO_PRODUCTS[0]), 'first-book') + await render(other, 'second-book');
  const first = section('first-book'), second = section('second-book');
  choose(first, 'English illustrated hardback'); assert.equal(fields(first).Dimensions, '156 × 234 mm');
  assert.equal(current(second).dataset.selectionState, 'incomplete'); assert.deepEqual(fields(second), {});
  choose(second, 'English illustrated hardback'); assert.equal(fields(second).Dimensions, '172 × 250 mm'); assert.equal(current(second).dataset.variantId, other.variants![1].id);
  for (let cycle = 0; cycle < 2; cycle++) {
    first.remove(); assert.equal(first.querySelector('[data-lb-selected-variant-facts]'), null);
    assert.equal(first.querySelectorAll('.mg-edition').length, 3);
    document.body.append(first);
    assert.equal(first.querySelectorAll('[data-lb-selected-variant-facts]').length, 1);
    assert.equal(current(first).dataset.variantId, MARGINALIA_DEMO_PRODUCTS[0].variants![1].id); assert.equal(fields(first).Dimensions, '156 × 234 mm');
    assert.equal(fields(second).Dimensions, '172 × 250 mm');
  }
  report.push({ case: 'scoping and reconnect', cycles: 2, sameLabelsDifferentUuidMeasurements: true, comparisonFallbackRestored: true });
});

test('current SSR retains captured bibliography, edition comparison, options and excerpt semantics; pin new integration hashes separately', async () => {
  const html = await render(structuredClone(MARGINALIA_DEMO_PRODUCTS[0]));
  const captured = new JSDOM(fs.readFileSync(path.join(evidence, 'browser-rendered/book.html'), 'utf8'));
  const fresh = new JSDOM(html);
  try {
    const before = captured.window.document.querySelector('[data-section-id="product-detail-default"]')!;
    const after = fresh.window.document.querySelector('[data-section-id="product-detail-default"]')!;
    assert.ok(before); assert.ok(after);
    for (const selector of ['.mg-facts', '.mg-reading', '.lb-product-detail__variant-values', '.lb-product-detail__price-current']) {
      assert.deepEqual([...after.querySelectorAll(selector)].map(element => element.outerHTML), [...before.querySelectorAll(selector)].map(element => element.outerHTML), selector);
    }
    const oldVariants = JSON.parse(before.querySelector('lb-variant-picker')!.getAttribute('data-variants')!) as Array<Record<string, unknown>>;
    const newVariants = JSON.parse(after.querySelector('lb-variant-picker')!.getAttribute('data-variants')!) as Array<Record<string, unknown>>;
    for (const row of newVariants) { assert.equal(typeof row.facts_json, 'string'); delete row.facts_json; }
    for (const row of oldVariants) delete row.facts_json;
    assert.deepEqual(newVariants, oldVariants, 'Only the bounded display-only carrier changes in these edition rows.');
    assert.deepEqual(readSourceHashes(), sourceHashesAtStart, 'Shared integration sources must remain stable throughout the five-case run.');
    fs.writeFileSync(path.join(evidence, 'selected-edition-validation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entry: 'actual registerLiquidHydrationIslands', method: 'Actual app mapper → explicit v2 LiquidRenderer → canonical assembly → real registered picker/controller in JSDOM; no extracted class or substitute controller.', tests: 5, sourceHashes: sourceHashesAtStart, sourcesStableThroughoutRun: true, results: report, targetedCapturedSsrSemanticsPreserved: true, liveFetchCalls: fetchCalls, browserLaunched: false, pixelMeasurementsPassed: false, browserAcceptance: 'Prepared behavior/measurement cases; real browser focus/layout/glyph acceptance for the new shared hook awaits coordinator resource allocation.', historicalCapturedHashesModified: false }, null, 2) + '\n');
  } finally { captured.window.close(); fresh.window.close(); }
});
