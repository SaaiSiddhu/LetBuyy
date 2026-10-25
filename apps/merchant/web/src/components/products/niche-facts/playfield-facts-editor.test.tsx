import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { ToyFactsSchema } from '@letbuyy/commerce-core';
import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';

const appRequire = createRequire(new URL('../../../../package.json', import.meta.url));
async function mount(initial: unknown = null, initiallyDisabled = false, copies = 1) {
  const { JSDOM } = await loadThemeServerDom();
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const window = dom.window as unknown as Window & typeof globalThis;
  const globals: Record<string, unknown> = { window, document: window.document, navigator: window.navigator, self: window, HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const oldCss = appRequire.extensions['.css'];
  appRequire.extensions['.css'] = module => { module.exports = {}; };
  const { PlayfieldFactsEditor } = await import('./playfield-facts-editor');
  const { createRoot } = await import('react-dom/client');
  const container = window.document.getElementById('root')!;
  const root = createRoot(container);
  let current = initial, disabled = initiallyDisabled, submits = 0;
  const changes: unknown[] = [];
  const onChange = (next: unknown | null) => { current = next; changes.push(structuredClone(next)); root.render(view()); };
  const view = () => <form onSubmit={event => { event.preventDefault(); submits += 1; }}>{Array.from({ length: copies }, (_, index) => <PlayfieldFactsEditor key={index} value={current} onChange={onChange} disabled={disabled} />)}</form>;
  await act(async () => root.render(view()));
  const control = (label: string, index = 0): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    const labels = [...container.querySelectorAll('label')].filter(item => item.textContent?.trim() === label);
    assert.ok(labels[index], `Missing label ${label}: ${container.textContent}`);
    const element = window.document.getElementById(labels[index].htmlFor);
    assert.ok(element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName), label);
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
  const click = async (label: string) => {
    const button = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label);
    assert.ok(button, `Missing button ${label}`);
    await act(async () => button.click());
  };
  const toggle = async (label: string) => { const element = control(label); assert.ok(element instanceof window.HTMLInputElement); await act(async () => element.click()); };
  return { container, document: window.document, changes, control, field, click, toggle,
    value: () => current, submits: () => submits,
    replace: async (next: unknown, nextDisabled = false) => { current = next; disabled = nextDisabled; await act(async () => root.render(view())); },
    close: async () => {
      await act(async () => root.unmount()); window.close();
      for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
      if (oldCss) appRequire.extensions['.css'] = oldCss; else delete appRequire.extensions['.css'];
    },
  };
}

test('unknown facts stay absent and editing one supplied fact emits only that draft field', async () => {
  const h = await mount();
  try {
    assert.equal(h.changes.length, 0);
    assert.equal(h.control('Materials (optional)').value, '');
    assert.equal(h.container.querySelectorAll('input:checked').length, 0);
    await h.field('Materials (optional)', 'Wood supplied by the merchant');
    assert.deepEqual(h.value(), { materials: 'Wood supplied by the merchant' });
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, true);
    assert.equal(h.submits(), 0);
    await h.field('Materials (optional)', '');
    assert.equal(h.value(), null);
  } finally { await h.close(); }
});

test('contents rows preserve incomplete drafts, expose canonical field errors and accept corrected quantities', async () => {
  const h = await mount();
  try {
    await h.click('Add contents item');
    assert.deepEqual(h.value(), { contents: [{ label: '' }] });
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    const quantity = h.control('Included quantity');
    assert.equal(quantity.getAttribute('aria-invalid'), 'true');
    assert.ok(h.document.getElementById(quantity.getAttribute('aria-describedby')!));
    await h.field('Included item', 'Wooden tiles');
    await h.field('Included quantity', '-2');
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Included quantity').value, '-2');
    await h.field('Included quantity', '12');
    await h.toggle('This is the complete contents list supplied by the merchant');
    const accepted = ToyFactsSchema.parse(h.value());
    assert.deepEqual(accepted.contents, [{ label: 'Wooden tiles', quantity: 12 }]);
    assert.equal(accepted.contentsComplete, true);
    assert.equal(h.control('Included quantity').getAttribute('aria-invalid'), null);
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});

test('supplied age, interests and product type use the canonical schema without inferred shopper facts', async () => {
  const h = await mount();
  try {
    await h.toggle('6–8 years');
    await h.field('Supplied age statement (optional)', '6–8 years, according to supplied packaging');
    await h.click('Add interest');
    await h.field('Interest 1', 'Art and Making');
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Interest 1').getAttribute('aria-invalid'), 'true');
    await h.field('Interest 1', 'art');
    await h.field('Product type code (optional)', 'mosaic-kit');
    const accepted = ToyFactsSchema.parse(h.value());
    assert.deepEqual(accepted.ageBands, ['6-8']);
    assert.deepEqual(accepted.interests, ['art']);
    assert.equal(accepted.productType, 'mosaic-kit');
    assert.equal(accepted.dimensions, undefined);
    await h.toggle('6–8 years');
    await h.click('Remove interest 1');
    assert.equal(Object.hasOwn(h.value() as Record<string, unknown>, 'ageBands'), false);
    assert.equal(Object.hasOwn(h.value() as Record<string, unknown>, 'interests'), false);
  } finally { await h.close(); }
});

test('a completeness assertion without supplied contents remains invalid and can be explicitly removed', async () => {
  const h = await mount();
  try {
    await h.toggle('This is the complete contents list supplied by the merchant');
    assert.deepEqual(h.value(), { contentsComplete: true });
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('This is the complete contents list supplied by the merchant').getAttribute('aria-invalid'), 'true');
    assert.match(h.container.textContent!, /A complete contents statement needs supplied contents/);
    await h.toggle('This is the complete contents list supplied by the merchant');
    assert.equal(h.value(), null);
    assert.doesNotMatch(h.container.textContent!, /Correct these toy facts/);
  } finally { await h.close(); }
});

test('primary and additional measured parts retain distinct labelled dimensions and clear deliberately', async () => {
  const h = await mount();
  try {
    await h.click('Add primary dimensions');
    assert.deepEqual(h.value(), { dimensions: {} });
    assert.equal(h.control('Measurement unit').value, '');
    await h.field('Measured object label (optional)', 'Tray');
    await h.field('Measurement unit', 'cm');
    await h.field('Length (optional)', '24');
    await h.field('Width (optional)', '19');
    await h.field('Height (optional)', '1.5');
    await h.click('Add measured part');
    await h.field('Measurement unit', 'cm', 1);
    await h.field('Length (optional)', '5', 1);
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false, 'an additional measured part requires its own label');
    assert.equal(h.control('Measured part label').getAttribute('aria-invalid'), 'true');
    await h.field('Measured part label', 'Each tile');
    await h.field('Width (optional)', '5', 1);
    await h.field('Height (optional)', '0.6', 1);
    const accepted = ToyFactsSchema.parse(h.value());
    assert.deepEqual(accepted.dimensions, { label: 'Tray', unit: 'cm', length: 24, width: 19, height: 1.5 });
    assert.deepEqual(accepted.additionalDimensions, [{ label: 'Each tile', unit: 'cm', length: 5, width: 5, height: 0.6 }]);
    await h.click('Remove primary dimensions');
    assert.equal(Object.hasOwn(h.value() as Record<string, unknown>, 'dimensions'), false);
    await h.click('Remove measured part 1');
    assert.equal(h.value(), null);
  } finally { await h.close(); }
});

test('warning text requires its supplied source and hostile text remains inert literal data', async () => {
  const h = await mount();
  try {
    await h.click('Add warning');
    await h.field('Warning text', '<img src=x onerror=alert(1)> Read before choosing.');
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Warning source').getAttribute('aria-invalid'), 'true');
    await h.field('Warning source', 'Merchant <script>source</script>');
    await h.field('Warning edition label (optional)', 'Garden sample');
    await h.field('Care instructions (optional)', 'Wipe dry');
    const accepted = ToyFactsSchema.parse(h.value());
    assert.equal(accepted.warnings[0].text, '<img src=x onerror=alert(1)> Read before choosing.');
    assert.equal(accepted.warnings[0].sourceLabel, 'Merchant <script>source</script>');
    assert.equal(h.container.querySelectorAll('img,script,[onerror]').length, 0);
    await h.field('Warning edition label (optional)', '');
    assert.equal(Object.hasOwn(ToyFactsSchema.parse(h.value()).warnings[0], 'editionLabel'), false);
  } finally { await h.close(); }
});

test('invalid existing facts remain editable and only an explicit namespace clear removes them', async () => {
  const initial = { schemaVersion: 2, materials: 'Keep supplied materials', platformCertified: true };
  const h = await mount(initial);
  try {
    assert.match(h.container.textContent!, /Correct these toy facts/);
    await h.field('Care instructions (optional)', 'Keep dry');
    assert.deepEqual(h.value(), { ...initial, care: 'Keep dry' });
    assert.equal(ToyFactsSchema.safeParse(h.value()).success, false);
    await h.click('Remove all toy facts');
    assert.equal(h.value(), null);
    assert.equal(h.control('Materials (optional)').value, '');
    assert.doesNotMatch(h.container.textContent!, /Correct these toy facts/);
  } finally { await h.close(); }
});

test('disabled fields and buttons emit no changes, including programmatic input events', async () => {
  const h = await mount({ materials: 'Wood' }, true);
  try {
    for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(element.matches(':disabled'), true);
    await h.click('Add contents item');
    await h.click('Remove all toy facts');
    await h.field('Materials (optional)', 'Paper');
    assert.equal(h.changes.length, 0);
    assert.deepEqual(h.value(), { materials: 'Wood' });
    assert.equal(h.submits(), 0);
    await h.replace({ materials: 'Paper' });
    await h.field('Finish (optional)', 'Supplied finish');
    assert.deepEqual(h.value(), { materials: 'Paper', finish: 'Supplied finish' });
  } finally { await h.close(); }
});

test('multiple editors have unique labelled controls and all editor actions avoid submitting the parent form', async () => {
  const h = await mount(null, false, 2);
  try {
    const ids = [...h.container.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const control of h.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')) assert.ok(control.labels && control.labels.length > 0, control.outerHTML);
    for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button');
    assert.equal(h.container.querySelectorAll('form').length, 1);
    assert.equal(h.container.querySelectorAll('textarea').length, 6, 'only materials, finish and care fields; no raw metadata editor');
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});
