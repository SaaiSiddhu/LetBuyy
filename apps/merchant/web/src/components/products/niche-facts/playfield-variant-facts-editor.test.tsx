import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { ToyFactsSchema, ToyVariantFactsSchema, resolveToyFacts } from '@letbuyy/commerce-core';
import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';

const appRequire = createRequire(new URL('../../../../package.json', import.meta.url));
const COMMON = ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: 'Common 6–8 years', interests: ['art'], productType: 'mosaic-kit', contents: [{ quantity: 12, label: 'tiles' }, { quantity: 2, label: 'cards' }, { quantity: 1, label: 'tray' }], contentsComplete: true, dimensions: { label: 'Common tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Common tile', length: 5, width: 5, height: 0.6, unit: 'cm' }], materials: 'Common wood', warnings: [{ text: 'Common supplied warning', sourceLabel: 'Common merchant' }] });

async function mount(initial: unknown = null, commonFacts: unknown = COMMON, initiallyDisabled = false, copies = 1) {
  const { JSDOM } = await loadThemeServerDom();
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const window = dom.window as unknown as Window & typeof globalThis;
  const globals: Record<string, unknown> = { window, document: window.document, navigator: window.navigator, self: window, HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const oldCss = appRequire.extensions['.css'];
  appRequire.extensions['.css'] = module => { module.exports = {}; };
  const { PlayfieldVariantFactsEditor } = await import('./playfield-variant-facts-editor');
  const { createRoot } = await import('react-dom/client');
  const container = window.document.getElementById('root')!, root = createRoot(container);
  let current = initial, common = commonFacts, disabled = initiallyDisabled, submits = 0;
  const changes: unknown[] = [];
  const onChange = (next: unknown | null) => { current = next; changes.push(structuredClone(next)); root.render(view()); };
  const view = () => <form onSubmit={event => { event.preventDefault(); submits += 1; }}>{Array.from({ length: copies }, (_, index) => <PlayfieldVariantFactsEditor key={index} value={current} commonFacts={common} onChange={onChange} disabled={disabled} />)}</form>;
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
  const click = async (label: string) => { const button = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label);assert.ok(button, `Missing button ${label}`);await act(async () => button.click()); };
  const toggle = async (label: string) => { const element = control(label);assert.ok(element instanceof window.HTMLInputElement);await act(async () => element.click()); };
  return { container, document: window.document, changes, control, field, click, toggle, value: () => current, submits: () => submits,
    replace: async (next: unknown, nextCommon: unknown = common, nextDisabled = false) => { current = next;common = nextCommon;disabled = nextDisabled;await act(async () => root.render(view())); },
    close: async () => { await act(async () => root.unmount());window.close();for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else Reflect.deleteProperty(globalThis, key); }if (oldCss) appRequire.extensions['.css'] = oldCss;else delete appRequire.extensions['.css']; },
  };
}

test('common context is read only and one edited override remains a partial variant payload without identity or defaults', async () => {
  const baseline = structuredClone(COMMON), h = await mount();
  try {
    assert.equal(h.changes.length, 0);
    assert.match(h.container.textContent!, /Common wood/);
    assert.equal(h.control('Edition materials').value, '');
    assert.equal(h.container.querySelectorAll('input:checked').length, 0);
    await h.field('Edition finish', 'Blue supplied finish');
    assert.deepEqual(h.value(), { finish: 'Blue supplied finish' });
    assert.deepEqual(ToyVariantFactsSchema.parse(h.value()), { finish: 'Blue supplied finish' });
    assert.equal(resolveToyFacts(COMMON, h.value())!.contents.reduce((sum, row) => sum + row.quantity, 0), 15);
    for (const key of ['id', 'variant_id', 'sku', 'schemaVersion', 'contents', 'ageBands']) assert.equal(Object.hasOwn(h.value() as Record<string, unknown>, key), false);
    assert.deepEqual(COMMON, baseline);
  } finally { await h.close(); }
});

test('a supported string clear is distinct from omitting the override to inherit again', async () => {
  const h = await mount();
  try {
    await h.click('Clear edition materials');
    assert.deepEqual(h.value(), { materials: '' });
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, true);
    assert.equal(resolveToyFacts(COMMON, h.value())!.materials, '');
    await h.click('Use common materials');
    assert.equal(h.value(), null);
    assert.equal(resolveToyFacts(COMMON, h.value())!.materials, 'Common wood');
    await h.field('Edition materials', 'Paper');
    await h.field('Edition materials', '');
    assert.deepEqual(h.value(), { materials: '' });
  } finally { await h.close(); }
});

test('age selection, empty age bands and inherited prose follow canonical edition resolution', async () => {
  const h = await mount();
  try {
    await h.toggle('Edition 9–12 years');
    assert.deepEqual(h.value(), { ageBands: ['9-12'] });
    assert.equal(resolveToyFacts(COMMON, h.value())!.ageStatement, undefined);
    assert.match(h.container.textContent!, /Common age prose is not inherited/);
    await h.toggle('Edition 9–12 years');
    assert.deepEqual(h.value(), { ageBands: [] });
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.ageBands, []);
    await h.click('Use common age bands');
    assert.equal(h.value(), null);
    assert.equal(resolveToyFacts(COMMON, h.value())!.ageStatement, 'Common 6–8 years');
    await h.click('Clear edition age statement');
    assert.deepEqual(h.value(), { ageStatement: '' });
  } finally { await h.close(); }
});

test('incomplete edition contents stay editable and replacing them does not inherit an old completeness assertion', async () => {
  const h = await mount();
  try {
    await h.click('Add edition contents item');
    assert.deepEqual(h.value(), { contents: [{ label: '' }] });
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    const quantity = h.control('Edition included quantity');
    assert.equal(quantity.getAttribute('aria-invalid'), 'true');
    assert.ok(h.document.getElementById(quantity.getAttribute('aria-describedby')!));
    await h.field('Edition included item', 'Paper sheets');
    await h.field('Edition included quantity', '-1');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Edition included quantity').value, '-1');
    await h.field('Edition included quantity', '36');
    assert.deepEqual(ToyVariantFactsSchema.parse(h.value()), { contents: [{ label: 'Paper sheets', quantity: 36 }] });
    assert.equal(resolveToyFacts(COMMON, h.value())!.contentsComplete, false);
    await h.toggle('Confirm the edition contents list is complete');
    assert.equal(resolveToyFacts(COMMON, h.value())!.contentsComplete, true);
    await h.click('Use default list completeness');
    assert.equal(Object.hasOwn(h.value() as Record<string, unknown>, 'contentsComplete'), false);
    assert.equal(resolveToyFacts(COMMON, h.value())!.contentsComplete, false);
    await h.click('Use common contents and completeness');
    assert.equal(h.value(), null);
    assert.equal(resolveToyFacts(COMMON, h.value())!.contentsComplete, true);
  } finally { await h.close(); }
});

test('clearing contents removes a stale completeness assertion while preserving sibling overrides', async () => {
  const h = await mount({ finish: 'Blue', contents: [{ label: 'Tiles', quantity: 12 }], contentsComplete: true });
  try {
    await h.click('Clear edition contents');
    assert.deepEqual(h.value(), { finish: 'Blue', contents: [], contentsComplete: false });
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, true);
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.contents, []);
    await h.click('Use common contents and completeness');
    assert.deepEqual(h.value(), { finish: 'Blue' });
    await h.toggle('Confirm the edition contents list is complete');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Confirm the edition contents list is complete').getAttribute('aria-invalid'), 'true');
    await h.click('Use default list completeness');
    assert.deepEqual(h.value(), { finish: 'Blue' });
  } finally { await h.close(); }
});

test('edition dimensions start unknown, replace the whole measured object and distinguish null from inheritance', async () => {
  const h = await mount();
  try {
    await h.click('Set edition primary dimensions');
    assert.deepEqual(h.value(), { dimensions: {} });
    assert.equal(h.control('Edition measurement unit').value, '');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    await h.field('Edition measured object label (optional)', 'Small tray');
    await h.field('Edition measurement unit', 'mm');
    await h.field('Edition length (optional)', '120');
    await h.field('Edition width (optional)', '90');
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.dimensions, { label: 'Small tray', unit: 'mm', length: 120, width: 90 });
    await h.click('Clear edition primary dimensions');
    assert.deepEqual(h.value(), { dimensions: null });
    assert.equal(resolveToyFacts(COMMON, h.value())!.dimensions, null);
    await h.click('Use common primary dimensions');
    assert.equal(h.value(), null);
    assert.equal(resolveToyFacts(COMMON, h.value())!.dimensions?.height, 1.5);
  } finally { await h.close(); }
});

test('additional measured parts require their own labels and removing the last part preserves an explicit empty override', async () => {
  const h = await mount();
  try {
    await h.click('Add edition measured part');
    await h.field('Edition measurement unit', 'cm');
    await h.field('Edition length (optional)', '12');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Edition measured part label').getAttribute('aria-invalid'), 'true');
    await h.field('Edition measured part label', 'Puzzle board');
    await h.field('Edition width (optional)', '10');
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.additionalDimensions, [{ label: 'Puzzle board', unit: 'cm', length: 12, width: 10 }]);
    await h.click('Remove edition measured part 1');
    assert.deepEqual(h.value(), { additionalDimensions: [] });
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.additionalDimensions, []);
    await h.click('Use common measured parts');
    assert.equal(h.value(), null);
    assert.equal(resolveToyFacts(COMMON, h.value())!.additionalDimensions[0].label, 'Common tile');
  } finally { await h.close(); }
});

test('interest lists retain explicit clears and product type offers inheritance rather than an unsupported clear', async () => {
  const h = await mount();
  try {
    await h.click('Add edition interest');
    await h.field('Edition interest 1', 'Art & making');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    await h.field('Edition interest 1', 'building');
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.interests, ['building']);
    await h.click('Remove edition interest 1');
    assert.deepEqual(h.value(), { interests: [] });
    await h.click('Use common interests');
    assert.equal(h.value(), null);
    await h.field('Edition product type', 'paper-kit');
    await h.field('Edition product type', '');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Edition product type').getAttribute('aria-invalid'), 'true');
    assert.ok(![...h.container.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Clear edition product type'));
    await h.click('Use common product type');
    assert.equal(h.value(), null);
  } finally { await h.close(); }
});

test('edition warnings need a source, replace common warnings and keep hostile text inert', async () => {
  const h = await mount(null, { ...COMMON, materials: '<img src=x onerror=alert(1)> common material' });
  try {
    await h.click('Add edition warning');
    await h.field('Edition warning text', '<script>warning</script> Read packaging');
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    assert.equal(h.control('Edition warning source').getAttribute('aria-invalid'), 'true');
    await h.field('Edition warning source', 'Merchant <svg onload=alert(1)>');
    await h.field('Edition warning label (optional)', 'Paper edition');
    const accepted = ToyVariantFactsSchema.parse(h.value());
    assert.equal(accepted.warnings![0].text, '<script>warning</script> Read packaging');
    assert.equal(resolveToyFacts(COMMON, h.value())!.warnings.length, 1);
    assert.equal(resolveToyFacts(COMMON, h.value())!.warnings[0].sourceLabel, 'Merchant <svg onload=alert(1)>');
    assert.equal(h.container.querySelectorAll('img,script,[onload],[onerror]').length, 0);
    await h.field('Edition warning label (optional)', '');
    assert.equal(Object.hasOwn(ToyVariantFactsSchema.parse(h.value()).warnings![0], 'editionLabel'), false);
    await h.click('Remove edition warning 1');
    assert.deepEqual(h.value(), { warnings: [] });
    assert.deepEqual(resolveToyFacts(COMMON, h.value())!.warnings, []);
    await h.click('Use common warnings');
    assert.equal(h.value(), null);
  } finally { await h.close(); }
});

test('an invalid external namespace remains editable but never becomes a valid identity-bearing payload', async () => {
  const initial = { variant_id: 'unexpected identity', materials: 'Keep materials' }, h = await mount(initial);
  try {
    assert.match(h.container.textContent!, /Correct these edition facts/);
    await h.field('Edition finish', 'Keep finish');
    assert.deepEqual(h.value(), { ...initial, finish: 'Keep finish' });
    assert.equal(ToyVariantFactsSchema.safeParse(h.value()).success, false);
    await h.click('Remove all edition toy overrides');
    assert.equal(h.value(), null);
    assert.doesNotMatch(h.container.textContent!, /Correct these edition facts/);
  } finally { await h.close(); }
});

test('disabled variant editors emit nothing even for programmatic events', async () => {
  const h = await mount({ finish: 'Blue' }, COMMON, true);
  try {
    for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(element.matches(':disabled'), true);
    await h.click('Clear edition materials');
    await h.click('Remove all edition toy overrides');
    await h.field('Edition materials', 'Paper');
    assert.equal(h.changes.length, 0);
    assert.deepEqual(h.value(), { finish: 'Blue' });
    await h.replace({ finish: 'Blue' });
    await h.field('Edition care', 'Wipe dry');
    assert.deepEqual(h.value(), { finish: 'Blue', care: 'Wipe dry' });
  } finally { await h.close(); }
});

test('multiple variant editors have unique associated labels and no nested form or submit actions', async () => {
  const h = await mount(null, COMMON, false, 2);
  try {
    const ids = [...h.container.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const element of h.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')) assert.ok(element.labels?.length, element.outerHTML);
    for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button');
    assert.equal(h.container.querySelectorAll('form').length, 1);
    assert.equal(h.container.querySelectorAll('textarea').length, 6, 'only materials, finish and care; no raw metadata textarea');
    assert.equal(h.submits(), 0);
  } finally { await h.close(); }
});

test('controlled common-context replacement never copies or overwrites edition overrides', async () => {
  const h = await mount({ care: 'Edition care' });
  try {
    await h.replace({ care: 'Edition care' }, { ...COMMON, materials: 'Different common paper' });
    assert.equal(h.changes.length, 0);
    assert.equal(h.control('Edition materials').value, '');
    assert.equal(h.control('Edition care').value, 'Edition care');
    assert.match(h.container.textContent!, /Different common paper/);
    await h.replace(null, { invalid_common: true });
    assert.match(h.container.textContent!, /Common toy facts are not valid/);
    assert.equal(h.changes.length, 0);
    await h.field('Edition finish', 'Supplied finish');
    assert.deepEqual(h.value(), { finish: 'Supplied finish' });
  } finally { await h.close(); }
});
