import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { ProductVariantMetadataSchema } from '@letbuyy/commerce-core';
import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';
import { validateVariantFactsDraft } from '../../lib/variant-facts-draft';

const appRequire = createRequire(new URL('../../../package.json', import.meta.url));
const commonMetadata = { toys: { materials: 'Common wood', contents: [{ quantity: 12, label: 'Tiles' }], contentsComplete: true }, food: { netQuantity: { value: 999, unit: 'ml' } }, privateSupplier: 'PRIVATE_COMMON_SENTINEL' };
async function mount(initial: unknown = undefined, initialCommon: unknown = commonMetadata, initiallyDisabled = false, copies = 1) {
  const { JSDOM } = await loadThemeServerDom();
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const window = dom.window as unknown as Window & typeof globalThis;
  const globals: Record<string, unknown> = { window, document: window.document, navigator: window.navigator, self: window, HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const oldCss = appRequire.extensions['.css'];
  appRequire.extensions['.css'] = module => { module.exports = {}; };
  const { VariantFactsEditor } = await import('./VariantFactsEditor');
  const { createRoot } = await import('react-dom/client');
  const container = window.document.getElementById('root')!, root = createRoot(container);
  let current = initial, common = initialCommon, disabled = initiallyDisabled, submits = 0;
  const changes: Record<string, unknown>[] = [];
  const onChange = (next: Record<string, unknown>) => { current = next;changes.push(structuredClone(next));root.render(view()); };
  const view = () => <form onSubmit={event => { event.preventDefault();submits += 1; }}>{Array.from({ length: copies }, (_, index) => <VariantFactsEditor key={index} value={current} commonFacts={common} disabled={disabled} onChange={onChange} resources={{ images: [], variantOptions: [] }} />)}</form>;
  await act(async () => root.render(view()));
  const control = (label: string, index = 0): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    const labels = [...container.querySelectorAll('label')].filter(item => item.textContent?.trim() === label);
    assert.ok(labels[index], `Missing ${label}: ${container.textContent}`);
    const element = window.document.getElementById(labels[index].htmlFor);
    assert.ok(element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
    return element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  };
  const field = async (label: string, value: string, index = 0) => {
    const element = control(label, index);
    await act(async () => {
      const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
      element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  };
  const click = async (label: string) => { const button = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label);assert.ok(button, `Missing ${label}`);await act(async () => button.click()); };
  return { container, document: window.document, changes, control, field, click, value: () => current, submits: () => submits,
    replace: async (next: unknown, nextCommon: unknown = common, nextDisabled = false) => { current = next;common = nextCommon;disabled = nextDisabled;await act(async () => root.render(view())); },
    close: async () => { await act(async () => root.unmount());window.close();for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else Reflect.deleteProperty(globalThis, key); }if (oldCss) appRequire.extensions['.css'] = oldCss;else delete appRequire.extensions['.css']; },
  };
}

test('all five real editors compose without creating metadata when only the view category changes', async () => {
  const baseline = structuredClone(commonMetadata), h = await mount();
  try {
    for (const [namespace, expected] of [['toys', 'Edition toy fact overrides'], ['food', 'Net contents for this variant'], ['furniture', 'Furniture facts for this variant'], ['sports', 'Variant equipment measurements'], ['books', 'Variant book and paper facts']]) {
      await h.field('Variant facts category', namespace);
      assert.ok(h.container.textContent!.includes(expected), namespace);
      assert.equal(h.changes.length, 0);
      assert.equal(h.value(), undefined);
    }
    await h.field('Variant facts category', 'food');
    assert.equal(h.control('Variant net quantity').value, '', 'food quantity does not inherit the common product quantity');
    await h.field('Variant facts category', 'toys');
    assert.match(h.container.textContent!, /Common wood/);
    assert.equal(h.control('Edition materials').value, '');
    assert.doesNotMatch(h.container.textContent!, /PRIVATE_COMMON_SENTINEL/);
    assert.deepEqual(commonMetadata, baseline);
  } finally { await h.close(); }
});

test('actual Food child edits flow into only its raw namespace and retain incomplete values until corrected', async () => {
  const h = await mount({ toys: { finish: 'Keep blue' } });
  try {
    await h.field('Variant facts category', 'food');
    await h.field('Variant net quantity', '250');
    assert.deepEqual(h.value(), { toys: { finish: 'Keep blue' }, food: { netQuantity: { value: 250 } } });
    assert.equal(validateVariantFactsDraft(h.value()).success, false);
    assert.match(h.container.textContent!, /Review variant facts before saving/);
    const unit = h.control('Variant net quantity unit');
    assert.equal(unit.getAttribute('aria-invalid'), 'true');
    assert.ok(h.document.getElementById(unit.getAttribute('aria-describedby')!));
    await h.field('Variant facts category', 'toys');
    await h.field('Edition care', 'Dry cloth');
    await h.field('Variant facts category', 'food');
    assert.equal(h.control('Variant net quantity').value, '250');
    await h.field('Variant net quantity unit', 'g');
    assert.deepEqual(ProductVariantMetadataSchema.parse(h.value()), { toys: { finish: 'Keep blue', care: 'Dry cloth' }, food: { netQuantity: { value: 250, unit: 'g' } } });
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});

test('actual Toy child edits preserve Food and exact explicit clear markers', async () => {
  const initial = { food: { netQuantity: { value: 250, unit: 'g' } } }, h = await mount(initial);
  try {
    await h.field('Variant facts category', 'toys');
    await h.field('Edition finish', 'Blue supplied finish');
    await h.click('Clear edition primary dimensions');
    await h.click('Clear edition warnings');
    await h.click('Clear edition materials');
    assert.deepEqual(h.value(), { ...initial, toys: { finish: 'Blue supplied finish', dimensions: null, warnings: [], materials: '' } });
    assert.equal(validateVariantFactsDraft(h.value()).success, true);
    await h.click('Use common primary dimensions');
    assert.deepEqual(h.value(), { ...initial, toys: { finish: 'Blue supplied finish', warnings: [], materials: '' } });
    assert.deepEqual(initial, { food: { netQuantity: { value: 250, unit: 'g' } } });
  } finally { await h.close(); }
});

test('a real child null removes one namespace and the final removal still emits explicit empty metadata', async () => {
  const h = await mount({ food: { netQuantity: { value: 250, unit: 'g' } }, toys: { finish: 'Blue' } });
  try {
    await h.field('Variant facts category', 'food');
    await h.click('Clear variant net contents');
    assert.deepEqual(h.value(), { toys: { finish: 'Blue' } });
    await h.field('Variant facts category', 'toys');
    await h.click('Remove all edition toy overrides');
    assert.deepEqual(h.value(), {});
    assert.deepEqual(h.changes.at(-1), {});
    assert.equal(JSON.stringify({ metadata: h.value() }), '{"metadata":{}}');
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});

test('wrapper selected clear preserves siblings and all-clear is an explicit independent action', async () => {
  const h = await mount({ toys: { finish: 'Blue' }, food: { netQuantity: { value: 250, unit: 'g' } } });
  try {
    await h.click('Clear selected variant facts');
    assert.deepEqual(h.value(), { food: { netQuantity: { value: 250, unit: 'g' } } });
    await h.click('Clear all variant fact overrides');
    assert.deepEqual(h.value(), {});
  } finally { await h.close(); }
});

test('unsupported draft fields remain visible validation failures while supported child edits are retained', async () => {
  const h = await mount({ toys: { variant_id: 'unsupported identity', finish: 'Keep' }, unsupported: 'Kept invalid field' });
  try {
    assert.match(h.container.textContent!, /Review variant facts before saving/);
    await h.field('Edition care', 'Dry cloth');
    assert.deepEqual(h.value(), { toys: { variant_id: 'unsupported identity', finish: 'Keep', care: 'Dry cloth' }, unsupported: 'Kept invalid field' });
    assert.equal(validateVariantFactsDraft(h.value()).success, false);
    await h.click('Clear all variant fact overrides');
    assert.deepEqual(h.value(), {});
    assert.doesNotMatch(h.container.textContent!, /Review variant facts before saving/);
  } finally { await h.close(); }
});

test('unreadable top-level metadata is kept until an explicit clear and disabled recovery emits nothing', async () => {
  const h = await mount('unreadable metadata');
  try {
    assert.match(h.container.textContent!, /Variant facts could not be read/);
    assert.equal(h.changes.length, 0);
    assert.equal(h.value(), 'unreadable metadata');
    await h.replace('unreadable metadata', commonMetadata, true);
    await h.click('Clear unreadable variant facts');
    assert.equal(h.changes.length, 0);
    await h.replace('unreadable metadata');
    await h.click('Clear unreadable variant facts');
    assert.deepEqual(h.value(), {});
    assert.ok(h.control('Variant facts category'));
  } finally { await h.close(); }
});

test('disabled composition and clear controls cannot emit metadata changes', async () => {
  const initial = { food: { netQuantity: { value: 250, unit: 'g' } } }, h = await mount(initial, commonMetadata, true);
  try {
    for (const control of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(control.matches(':disabled'), true);
    await h.field('Variant facts category', 'toys');
    await h.field('Variant net quantity', '500');
    await h.click('Clear all variant fact overrides');
    await h.click('Clear variant net contents');
    assert.equal(h.changes.length, 0);
    assert.deepEqual(h.value(), initial);
    await h.replace(initial);
    await h.field('Variant net quantity', '500');
    assert.deepEqual(h.value(), { food: { netQuantity: { value: 500, unit: 'g' } } });
  } finally { await h.close(); }
});

test('controlled row replacement and common-context changes never reintroduce a prior row draft', async () => {
  const h = await mount({ toys: { finish: 'Old row' } });
  try {
    await h.field('Variant facts category', 'toys');
    await h.replace({ food: { netQuantity: { value: 500, unit: 'g' } } }, { toys: { materials: 'New common paper' } });
    assert.equal(h.control('Edition finish').value, '');
    assert.match(h.container.textContent!, /New common paper/);
    assert.equal(h.changes.length, 0);
    await h.field('Edition finish', 'New row finish');
    assert.deepEqual(h.value(), { food: { netQuantity: { value: 500, unit: 'g' } }, toys: { finish: 'New row finish' } });
  } finally { await h.close(); }
});

test('hostile text stays inert and repeated wrappers retain unique labelled controls without nested forms', async () => {
  const h = await mount({ toys: { materials: '<script>literal</script>' } }, { toys: { materials: '<img src=x onerror=alert(1)>' } }, false, 2);
  try {
    assert.equal(h.container.querySelectorAll('img,script,[onerror]').length, 0);
    await h.field('Edition finish', '<svg onload=alert(1)> literal finish');
    assert.deepEqual((h.value() as Record<string, unknown>).toys, { materials: '<script>literal</script>', finish: '<svg onload=alert(1)> literal finish' });
    assert.equal(h.container.querySelectorAll('[onload]').length, 0);
    const ids = [...h.container.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const control of h.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')) assert.ok(control.labels?.length, control.outerHTML);
    for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button');
    assert.equal(h.container.querySelectorAll('form').length, 1);
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});
