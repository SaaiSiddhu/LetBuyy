import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { FurnitureFactsSchema } from '@letbuyy/commerce-core';

const requireUI = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url));
type TestWindow = Window & typeof globalThis & { close(): void };
const JSDOM = requireUI('jsdom').JSDOM as new (html: string, options: { url: string }) => { window: TestWindow };

async function mount(initial: unknown = null) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/owned/products/test' });
    const names = ['window', 'document', 'navigator', 'self', 'React', 'IS_REACT_ACT_ENVIRONMENT'];
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    for (const name of ['window', 'document', 'navigator', 'self']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' || name === 'self' ? dom.window : dom.window[name as 'document' | 'navigator'] });
    Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import('react-dom/client');
    const { HabitatFactsEditor } = await import('./habitat-facts-editor');
    const container = dom.window.document.getElementById('root')!;
    const root = createRoot(container);
    const writes: unknown[] = [];
    let current: unknown = initial;
    let setExternal!: (next: unknown) => void;
    let isDisabled = false;
    function Harness({ disabled }: { disabled: boolean }) {
        const [value, setValue] = React.useState<unknown>(initial);
        React.useLayoutEffect(() => { setExternal = next => { current = next; setValue(next); }; }, []);
        return <HabitatFactsEditor value={value} disabled={disabled} resources={{ images: ['/unrelated-photo.jpg'], variantOptions: [] }} onChange={next => { writes.push(next); current = next; setValue(next); }} />;
    }
    const render = async () => { await act(async () => { root.render(<Harness disabled={isDisabled} />); }); };
    await render();
    const control = (label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
        const caption = [...container.querySelectorAll('label')].find(element => element.textContent === label);
        assert.ok(caption, `Missing label ${label}`);
        const element = dom.window.document.getElementById(caption.htmlFor);
        assert.ok(element, `Missing labelled control ${label}`);
        return element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    };
    const edit = async (label: string, value: string) => { await act(async () => {
        const element = control(label);
        const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }); };
    const button = (label: string) => {
        const element = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label);
        assert.ok(element, `Missing button ${label}`); return element;
    };
    const click = async (label: string) => { await act(async () => { button(label).click(); }); };
    return { container, writes, control, button, edit, click, value: () => current,
        replace: async (next: unknown) => { await act(async () => setExternal(next)); },
        disable: async (next: boolean) => { isDisabled = next; await render(); },
        close: async () => { await act(async () => root.unmount()); dom.window.close(); for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name); } },
    };
}

test('editing actual furniture controls emits distinct units and complete canonical supplied facts', async () => {
    const h = await mount();
    try {
        assert.equal(h.writes.length, 0);
        for (const element of h.container.querySelectorAll('input,select,textarea')) assert.equal((element as HTMLInputElement).value, '', 'No inferred photograph dimensions or factual defaults');
        await h.edit('Assembled dimensions unit', 'cm');
        assert.equal(FurnitureFactsSchema.safeParse(h.value()).success, false, 'Incomplete group remains editable');
        assert.match(h.container.textContent!, /Supply at least one measured dimension/);
        await h.edit('Assembled dimensions width', '68'); await h.edit('Assembled dimensions depth', '78'); await h.edit('Assembled dimensions height', '74');
        await h.edit('Package dimensions unit', 'in'); await h.edit('Package dimensions width', '30');
        await h.edit('Seat height value', '38'); await h.edit('Seat height unit', 'cm');
        await h.edit('Product weight value', '13.8'); await h.edit('Product weight unit', 'kg');
        await h.click('Add material'); await h.edit('Material 1', 'Solid teak');
        await h.edit('Finish (optional)', 'Natural teak'); await h.edit('Assembly status', 'required');
        await h.edit('Assembly instructions (optional)', 'Attach the supplied legs.'); await h.edit('Assembly tools (optional)', 'Hex key');
        await h.edit('Care instructions (optional)', 'Dust with a soft cloth.');
        assert.deepEqual(FurnitureFactsSchema.parse(h.value()), {
            assembled: { unit: 'cm', width: 68, depth: 78, height: 74 }, package: { unit: 'in', width: 30 },
            seat_height: { value: 38, unit: 'cm' }, weight: { value: 13.8, unit: 'kg' }, materials: ['Solid teak'], finish: 'Natural teak',
            assembly: { status: 'required', instructions: 'Attach the supplied legs.', tools: 'Hex key' }, care: 'Dust with a soft cloth.',
        });
    } finally { await h.close(); }
});

test('canonical errors stay attached to invalid fields and correction preserves the rest of the draft', async () => {
    const h = await mount({ assembled: { unit: 'cm', width: 68 }, care: 'Keep dry.' });
    try {
        await h.edit('Assembled dimensions width', '-2');
        assert.equal(FurnitureFactsSchema.safeParse(h.value()).success, false);
        const input = h.control('Assembled dimensions width'); assert.equal(input.getAttribute('aria-invalid'), 'true');
        assert.ok(h.container.querySelector(`[id="${input.getAttribute('aria-describedby')}"]`)?.textContent);
        assert.equal(h.control('Care instructions (optional)').value, 'Keep dry.');
        await h.edit('Assembled dimensions width', '70');
        assert.equal(FurnitureFactsSchema.safeParse(h.value()).success, true);
        await h.edit('Assembled dimensions unit', '');
        assert.equal(h.control('Assembled dimensions unit').getAttribute('aria-invalid'), 'true');
        assert.equal(h.control('Assembled dimensions width').value, '70');
        await h.edit('Assembled dimensions unit', 'mm');
        assert.deepEqual(FurnitureFactsSchema.parse(h.value()).assembled, { width: 70, unit: 'mm' });
    } finally { await h.close(); }
});

test('deliberate clears omit optional groups and the last material; clearing the namespace emits null', async () => {
    const h = await mount({ assembled: { unit: 'cm', diameter: 50 }, materials: ['Teak'], assembly: { status: 'assembled', tools: 'None' }, finish: 'Natural' });
    try {
        await h.click('Clear assembled dimensions'); await h.click('Remove material 1'); await h.click('Clear assembly facts');
        assert.deepEqual(h.value(), { finish: 'Natural' });
        await h.edit('Finish (optional)', ''); assert.equal(h.value(), null);
        await h.edit('Care instructions (optional)', 'Merchant care text'); await h.click('Clear all furniture facts');
        assert.equal(h.value(), null);
    } finally { await h.close(); }
});

test('disabled controls cannot emit edits and external parent values replace old drafts', async () => {
    const h = await mount({ finish: 'Natural' });
    try {
        await h.disable(true);
        for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal((element as HTMLInputElement).disabled, true);
        await h.click('Clear all furniture facts'); await h.edit('Finish (optional)', 'Unaccepted edit'); assert.equal(h.writes.length, 0);
        await h.replace({ care: 'Fresh server value' }); await h.disable(false);
        assert.equal(h.control('Finish (optional)').value, ''); assert.equal(h.control('Care instructions (optional)').value, 'Fresh server value');
        await h.edit('Care instructions (optional)', 'Changed fresh value'); assert.deepEqual(h.value(), { care: 'Changed fresh value' });
    } finally { await h.close(); }
});

test('labels and button semantics remain accessible and hostile supplied text stays inert', async () => {
    const h = await mount();
    try {
        const hostile = '<img src=x onerror="alert(1)"><script>bad()</script>';
        await h.click('Add material'); await h.edit('Material 1', hostile); await h.edit('Care instructions (optional)', hostile);
        assert.equal(FurnitureFactsSchema.safeParse(h.value()).success, true);
        assert.equal(h.control('Material 1').value, hostile); assert.equal(h.container.querySelector('img,script'), null);
        const ids = [...h.container.querySelectorAll('[id]')].map(element => element.id); assert.equal(new Set(ids).size, ids.length);
        for (const element of h.container.querySelectorAll('input,select,textarea')) assert.ok([...h.container.querySelectorAll('label')].some(label => label.htmlFor === element.id));
        assert.equal(h.container.querySelector('form'), null);
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button');
    } finally { await h.close(); }
});

test('malformed historical optional groups expose canonical errors and can be cleared without losing care', async () => {
    const h = await mount({ seat_height: 'legacy size', weight: { value: 0, unit: 'kg' }, assembly: 'legacy assembly', care: 'Keep dry.' });
    try {
        assert.equal(FurnitureFactsSchema.safeParse(h.value()).success, false);
        const groups = [...h.container.querySelectorAll('fieldset')];
        for (const caption of ['Seat height', 'Assembly']) {
            const group = groups.find(fieldset => fieldset.querySelector('legend')?.textContent === caption)!;
            const message = h.container.querySelector(`[id="${group.getAttribute('aria-describedby')}"]`);
            assert.match(message?.textContent ?? '', /expected object/i);
        }
        await h.click('Clear seat height'); await h.click('Clear assembly facts');
        await h.edit('Product weight value', '14.2');
        assert.deepEqual(FurnitureFactsSchema.parse(h.value()), { weight: { value: 14.2, unit: 'kg' }, care: 'Keep dry.' });
    } finally { await h.close(); }
});
