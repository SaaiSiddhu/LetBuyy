import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { ElectronicsFactsSchema } from '@letbuyy/commerce-core';

const requireUI = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url));
const { JSDOM } = requireUI('jsdom') as { JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis } };
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

async function mount(initial: unknown = null, disabled = false) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/products/fixture' });
  const names = ['window', 'document', 'navigator', 'self'];
  const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' || name === 'self' ? dom.window : Reflect.get(dom.window, name) });
  const { createRoot } = await import('react-dom/client');
  const { CircuitFactsEditor } = await import('./circuit-facts-editor');
  const container = dom.window.document.getElementById('root')!, root = createRoot(container), calls: unknown[] = [];
  let current = initial, submits = 0;
  const draw = () => root.render(<form onSubmit={event => { event.preventDefault();submits++; }}><CircuitFactsEditor value={current} disabled={disabled} onChange={next => { current = next;calls.push(next);draw(); }} /></form>);
  await act(async () => draw());
  const field = (name: string) => {
    const label = Array.from(container.querySelectorAll('label')).find(item => item.textContent === name);
    assert.ok(label, `Missing label ${name}`);
    const element = dom.window.document.getElementById(label.htmlFor) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    assert.ok(element, `Missing labelled control ${name}`);return element;
  };
  const change = async (name: string, value: string) => act(async () => {
    const element = field(name), prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
  const button = (name: string) => { const element = Array.from(container.querySelectorAll('button')).find(item => item.textContent === name);assert.ok(element, `Missing button ${name}`);return element; };
  const click = async (name: string) => act(async () => button(name).click());
  const close = async () => { await act(async () => root.unmount());dom.window.close();for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!);else Reflect.deleteProperty(globalThis, name); } };
  return { container, calls, field, change, button, click, close, value: () => current, submits: () => submits };
}

test('editing actual labelled controls emits canonical independent measurements and complete referenced facts', async () => {
  const h = await mount();
  try {
    for (const [label, value] of [['Manufacturer','Nodeworks'],['Exact product model','CG-7'],['Power input maximum (W)','100'],['Laptop pass-through maximum (W)','85'],['Data transfer maximum (Mb/s)','5000'],['Cable length (mm)','100'],['Video width (px)','3840'],['Video height (px)','2160'],['Video refresh rate (Hz)','30']]) await h.change(label,value);
    await h.click('Add connector');await h.change('Connector 1 kind','usb-c');await h.change('Connector 1 role','host');await h.change('Connector 1 count','1');
    await h.click('Add host requirement');await h.change('Host requirement 1','DisplayPort Alt Mode is required for HDMI output.');
    await h.click('Add included item');await h.change('Included item 1 label','CG-7 hub');await h.change('Included item 1 quantity','1');
    await h.change('Product fact-sheet reference','NW-CG7-F1');await h.change('Product fact-sheet source date','2026-10-22');
    await h.click('Add device reference');await h.change('Device 1 manufacturer','Fictional Devices');await h.change('Device 1 model','Desk 14 A');await h.change('Device 1 reference','Merchant source A');await h.change('Device 1 source date','2026-10-22');
    const parsed = ElectronicsFactsSchema.safeParse(h.value());assert.equal(parsed.success,true, JSON.stringify(parsed.error?.issues));
    if (!parsed.success) return;
    assert.equal(parsed.data.power_input_w,100);assert.equal(parsed.data.pass_through_output_w,85);assert.equal(parsed.data.power_output_w,undefined);
    assert.equal(parsed.data.data_rate_mbps,5000);assert.equal(parsed.data.length_mm,100);assert.equal(parsed.data.video!.refresh_hz,30);
    assert.equal(parsed.data.compatible_devices[0].model,'Desk 14 A');assert.equal(parsed.data.connectors[0].count,1);
    assert.equal(h.submits(),0);assert.equal(h.container.querySelectorAll('form').length,1);
  } finally { await h.close(); }
});

test('incomplete and invalid drafts stay editable with canonical errors until corrected or cleared', async () => {
  const h = await mount();
  try {
    await h.change('Power input maximum (W)','65');await h.change('Laptop pass-through maximum (W)','85');
    assert.equal(ElectronicsFactsSchema.safeParse(h.value()).success,false);assert.match(h.container.textContent!,/Pass-through output cannot exceed/);
    assert.equal(h.field('Laptop pass-through maximum (W)').getAttribute('aria-invalid'),'true');
    await h.change('Power input maximum (W)','-');assert.equal(h.field('Power input maximum (W)').value,'-');
    assert.equal((h.value() as Record<string,unknown>).power_input_w,'-');
    await h.change('Power input maximum (W)','1.');assert.equal(h.field('Power input maximum (W)').value,'1.');
    await h.change('Power input maximum (W)','100');assert.equal(ElectronicsFactsSchema.safeParse(h.value()).success,true);
    await h.change('Video width (px)','3840');assert.equal(ElectronicsFactsSchema.safeParse(h.value()).success,false);
    assert.match(h.container.textContent!,/video.height_px/);assert.equal(h.field('Video width (px)').value,'3840');
    await h.change('Video width (px)','');assert.equal((h.value() as Record<string,unknown>).video,undefined);
    await h.change('Cable length (mm)','1.');assert.equal(h.field('Cable length (mm)').value,'1.');
    await h.change('Cable length (mm)','1.5');assert.equal((h.value() as Record<string,unknown>).length_mm,1.5);
    await h.change('Video width (px)','3840');await h.change('Video height (px)','2160');await h.change('Video refresh rate (Hz)','30');
    await h.click('Clear video specification');assert.equal((h.value() as Record<string,unknown>).video,undefined);assert.equal(h.field('Video width (px)').value,'');
    await h.click('Add device reference');await h.change('Device 1 manufacturer','Fictional');await h.change('Device 1 model','all devices');await h.change('Device 1 reference','A');await h.change('Device 1 source date','2026-10-22');
    assert.equal(ElectronicsFactsSchema.safeParse(h.value()).success,false);assert.match(h.container.textContent!,/Name a specific device model/);
    await h.click('Remove device reference 1');assert.equal(ElectronicsFactsSchema.safeParse(h.value()).success,true);
  } finally { await h.close(); }
});

test('unknown stays absent and deliberate clearing emits removal rather than fabricated values', async () => {
  const h = await mount();
  try {
    assert.equal(h.calls.length,0);assert.equal(h.value(),null);
    assert.equal(h.field('Power input maximum (W)').value,'');assert.equal(h.field('Product kind').value,'');
    await h.change('Power input maximum (W)','65');
    assert.deepEqual(h.value(),{power_input_w:65});
    await h.change('Power input maximum (W)','');assert.equal(h.value(),null);
    await h.click('Add connector');await h.click('Remove connector 1');assert.equal(h.value(),null);
    await h.change('Exact product model','CG-5');await h.click('Clear all electronics facts');assert.equal(h.value(),null);
    assert.equal(h.field('Exact product model').value,'');assert.equal(h.field('Laptop pass-through maximum (W)').value,'');
  } finally { await h.close(); }
});

test('disabled fields preserve payload and all operations stay within the parent form', async () => {
  const initial = { manufacturer:'Nodeworks',model:'CG-7' }, h = await mount(initial,true);
  try {
    for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(element.matches(':disabled'),true);
    await h.click('Add connector');await h.click('Clear all electronics facts');
    assert.equal(h.calls.length,0);assert.deepEqual(h.value(),initial);assert.equal(h.submits(),0);
    for (const button of h.container.querySelectorAll('button')) assert.equal(button.type,'button');
  } finally { await h.close(); }
});

test('hostile merchant text remains literal input and each control has a unique associated label', async () => {
  const hostile = '<img src=x onerror=alert(1)>', h = await mount({ manufacturer:hostile, notes:'<script>alert(1)</script>' });
  try {
    assert.equal(h.field('Manufacturer').value,hostile);assert.equal(h.container.querySelector('script,img,[onerror]'),null);
    await h.change('Exact product model',hostile);assert.equal((h.value() as Record<string,unknown>).model,hostile);
    await h.click('Add connector');await h.click('Add connector');
    const controls = Array.from(h.container.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea'));
    assert.equal(new Set(controls.map(item=>item.id)).size,controls.length);
    for (const control of controls) assert.ok(control.labels?.length,`Unlabelled ${control.id}`);
    assert.equal(h.container.querySelector('script,img,[onerror]'),null);
  } finally { await h.close(); }
});
