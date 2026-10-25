import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import React, { act } from 'react';
import { BeautyFactsSchema } from '@letbuyy/commerce-core';
import type { NicheFactsEditorProps } from '../niche-facts-editor-types';

const requireUI = createRequire(path.resolve(__dirname, '../../../../../../../packages/typescript/ui/package.json'));
const { JSDOM } = requireUI('jsdom') as { JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close(): void } } };
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
// eslint-disable-next-line @letbuyy/ui/no-hardcoded-hex -- Synthetic merchant product data for same-RGB identity coverage; not a UI style.
const SHADE_RGB = '#a36a65';
const resources = { images: [], variantOptions: [{ name: 'Shade', values: ['Rosewater', 'Pink Clay', 'Terracotta'] }, { name: 'Size', values: ['Small', 'Large'] }] };
const supplied = { routineStage: 'colour', format: 'Lip tint', ingredients: 'Aqua', shadeOptionName: 'Shade', shades: [{ value: 'Rosewater', code: 'RW01', color: SHADE_RGB }, { value: 'Pink Clay', code: 'PC02', color: SHADE_RGB }] };

async function mount(initial: unknown = null, initialProps: Partial<Pick<NicheFactsEditorProps, 'disabled' | 'resources'>> = {}, two = false) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/product-editor' });
    const names = ['window', 'document', 'navigator', 'self'];
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' || name === 'self' ? dom.window : Reflect.get(dom.window, name) });
    const { createRoot } = await import('react-dom/client');
    const { DewdropFactsEditor } = await import('./dewdrop-facts-editor');
    const container = dom.window.document.getElementById('root')!;
    const root = createRoot(container);
    let current = initial;
    let props = { resources, ...initialProps };
    let setDraft!: React.Dispatch<React.SetStateAction<unknown>>;
    let submissions = 0;
    const changes: unknown[] = [];
    function Host() {
        const [draft, setter] = React.useState(initial);
        setDraft = setter; current = draft;
        return <form onSubmit={event => { event.preventDefault(); submissions++; }}>
            <DewdropFactsEditor value={draft} onChange={next => { changes.push(next); setter(next); }} {...props} />
            {two && <DewdropFactsEditor value={null} onChange={() => {}} resources={resources} />}
        </form>;
    }
    const render = async (next: Partial<Pick<NicheFactsEditorProps, 'disabled' | 'resources'>> = {}) => { props = { ...props, ...next }; await act(async () => root.render(<Host />)); };
    await render();
    for (const details of container.querySelectorAll('details')) details.open = true;
    const field = (label: string) => {
        const node = [...container.querySelectorAll('label')].find(node => node.textContent?.trim() === label);
        assert.ok(node, `Missing label ${label}`);
        const element = dom.window.document.getElementById(node.htmlFor);
        assert.ok(element instanceof dom.window.HTMLInputElement || element instanceof dom.window.HTMLTextAreaElement || element instanceof dom.window.HTMLSelectElement, `Missing native control for ${label}`);
        return element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    };
    const change = async (label: string, value: string, bypassDisabled = false) => {
        const element = field(label);
        if (!bypassDisabled) assert.equal(element.matches(':disabled'), false, label);
        await act(async () => {
            const prototype = element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
            element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
        });
    };
    const button = (label: string) => { const b = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label); assert.ok(b, `Missing button ${label}`); return b; };
    const click = async (label: string) => { await act(async () => button(label).click()); };
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close();
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name); }
    };
    return { container, field, change, button, click, render, changes, get value() { return current; }, get submissions() { return submissions; }, replace: async (next: unknown) => { await act(async () => setDraft(next)); }, close };
}

test('absent facts stay absent with empty labelled fields and no fabricated defaults', async () => {
    const h = await mount();
    try {
        assert.equal(h.value, null); assert.equal(h.changes.length, 0);
        for (const label of ['Routine stage', 'Product format', 'Net quantity amount', 'Net quantity unit', 'Ingredients', 'Directions', 'Warnings', 'Shade product option']) assert.equal(h.field(label).value, '');
        assert.equal(h.button('Add named shade').disabled, true); assert.equal(h.button('Clear all care facts').disabled, true);
        assert.doesNotMatch(h.container.textContent!, /Clinically proven|Certified|Hypoallergenic/);
    } finally { await h.close(); }
});
test('actual edits emit canonical care facts and keep same-RGB named shades as separate option entries', async () => {
    const h = await mount();
    try {
        await h.change('Routine stage', 'colour'); await h.change('Product format', 'Lip tint');
        await h.change('Net quantity amount', '6');
        assert.equal(BeautyFactsSchema.safeParse(h.value).success, false); assert.equal(h.field('Net quantity unit').getAttribute('aria-invalid'), 'true');
        await h.change('Net quantity unit', 'ml'); await h.change('Ingredients', 'Merchant ingredients'); await h.change('Directions', 'Merchant directions'); await h.change('Warnings', 'Merchant warnings');
        await h.change('Shade product option', 'Shade'); await h.click('Add named shade');
        assert.equal(BeautyFactsSchema.safeParse(h.value).success, false); assert.equal(h.field('Shade 1 name').getAttribute('aria-invalid'), 'true');
        await h.change('Shade 1 name', 'Rosewater'); await h.change('Shade 1 code', 'RW01'); await h.change('Shade 1 RGB reference', SHADE_RGB);
        await h.click('Add named shade'); await h.change('Shade 2 name', 'Pink Clay'); await h.change('Shade 2 code', 'PC02'); await h.change('Shade 2 RGB reference', SHADE_RGB);
        const facts = BeautyFactsSchema.parse(h.value);
        assert.deepEqual(facts.netQuantity, { value: 6, unit: 'ml' }); assert.equal(facts.ingredients, 'Merchant ingredients');
        assert.deepEqual(facts.shades, [{ value: 'Rosewater', code: 'RW01', color: SHADE_RGB }, { value: 'Pink Clay', code: 'PC02', color: SHADE_RGB }]);
        assert.equal(h.submissions, 0); assert.equal(h.container.querySelectorAll('form').length, 1);
        assert.ok([...h.container.querySelectorAll('button')].every(button => button.type === 'button'));
    } finally { await h.close(); }
});
test('invalid canonical quantity, RGB and duplicate shade drafts are kept and errors clear after correction', async () => {
    const h = await mount(supplied);
    try {
        await h.change('Net quantity amount', '0'); await h.change('Net quantity unit', 'g'); await h.change('Shade 2 name', 'Rosewater'); await h.change('Shade 1 RGB reference', '#red');
        assert.equal(h.field('Net quantity amount').value, '0'); assert.equal(h.field('Shade 1 RGB reference').value, '#red');
        assert.equal(BeautyFactsSchema.safeParse(h.value).success, false);
        for (const label of ['Net quantity amount', 'Shade 1 RGB reference', 'Shade 2 name']) {
            const field = h.field(label); assert.equal(field.getAttribute('aria-invalid'), 'true');
            const errorId = field.getAttribute('aria-describedby')!.split(' ').find(id => id.endsWith('-error')); assert.ok(errorId); assert.ok(h.container.querySelector(`[id="${errorId}"]`)?.textContent);
        }
        assert.match(h.container.textContent!, /Each shade option value must appear once/);
        await h.change('Net quantity amount', '50'); await h.change('Shade 1 RGB reference', SHADE_RGB); await h.change('Shade 2 name', 'Pink Clay');
        assert.equal(BeautyFactsSchema.safeParse(h.value).success, true); assert.equal(h.container.querySelector('[role="status"]'), null);
    } finally { await h.close(); }
});
test('optional facts and rows clear deliberately and null removes the namespace', async () => {
    const h = await mount({ ...supplied, netQuantity: { value: 6, unit: 'ml' }, directions: 'Directions', warnings: 'Warnings' });
    try {
        await h.change('Ingredients', ''); await h.change('Directions', ''); await h.change('Warnings', ''); await h.change('Shade 1 RGB reference', ''); await h.click('Clear net quantity'); await h.click('Remove shade 2');
        const draft = h.value as Record<string, unknown>;
        for (const key of ['ingredients', 'directions', 'warnings', 'netQuantity']) assert.equal(Object.hasOwn(draft, key), false);
        assert.equal(Object.hasOwn((draft.shades as Record<string, unknown>[])[0], 'color'), false); assert.equal((draft.shades as unknown[]).length, 1);
        await h.click('Clear all care facts'); assert.equal(h.value, null); assert.equal(h.changes.at(-1), null); assert.equal(h.field('Ingredients').value, '');
        assert.equal(h.submissions, 0);
    } finally { await h.close(); }
});
test('option renames expose stale associations without rewriting or merging supplied shade facts', async () => {
    const h = await mount(supplied);
    try {
        const before = structuredClone(h.value);
        await h.render({ resources: { images: [], variantOptions: [{ name: 'Finish', values: ['Matte', 'Satin'] }] } });
        assert.deepEqual(h.value, before); assert.equal(h.changes.length, 0); assert.equal(h.field('Shade product option').getAttribute('aria-invalid'), 'true');
        assert.equal(h.field('Shade 1 name').matches(':disabled'), true); assert.match(h.container.textContent!, /not in current product options/);
        await h.change('Shade product option', 'Finish'); assert.equal(h.field('Shade 1 name').getAttribute('aria-invalid'), 'true');
        assert.equal(h.field('Shade 1 code').value, 'RW01'); await h.change('Shade 1 name', 'Matte'); await h.change('Shade 2 name', 'Satin');
        assert.equal(h.container.querySelector('[role="status"]'), null); assert.equal(BeautyFactsSchema.safeParse(h.value).success, true);
    } finally { await h.close(); }
});
test('disabled editors reject user and programmatic changes without emitting a new draft', async () => {
    const h = await mount(supplied, { disabled: true });
    try {
        assert.ok([...h.container.querySelectorAll('input,textarea,select,button')].every(field => field.matches(':disabled')));
        await h.click('Remove shade 1'); await h.click('Clear all care facts'); await h.change('Ingredients', 'Changed', true);
        assert.deepEqual(h.value, supplied); assert.equal(h.changes.length, 0); assert.equal(h.submissions, 0);
    } finally { await h.close(); }
});
test('multiple editors have unique associated labels and preserve hostile text as inert values', async () => {
    const attack = '<script>attack()</script>';
    const h = await mount({ ...supplied, ingredients: attack, shades: [{ value: 'Rosewater', code: attack, ingredients: attack }] }, {}, true);
    try {
        const labels = [...h.container.querySelectorAll('label')]; const ids = labels.map(label => label.htmlFor);
        assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => h.container.querySelector(`[id="${id}"]`)));
        assert.equal(h.field('Ingredients').value, attack); assert.equal(h.field('Shade 1 code').value, attack);
        assert.equal(h.container.querySelector('script,[onerror]'), null);
        await h.change('Directions', attack); assert.equal((h.value as Record<string, unknown>).directions, attack); assert.equal(BeautyFactsSchema.safeParse(h.value).success, true);
        await h.replace({ format: 'x'.repeat(81), unknownClaim: 'Invented' });
        assert.equal(h.field('Product format').value.length, 81); assert.equal(h.field('Product format').getAttribute('aria-invalid'), 'true');
        assert.match(h.container.textContent!, /unknownClaim/); assert.equal(h.container.querySelector('script,[onerror]'), null);
    } finally { await h.close(); }
});


test('removing a shade keeps focus in the remaining named choices or their add action', async () => {
    const h = await mount(supplied);
    try {
        h.field('Shade 2 name').focus();
        await h.click('Remove shade 2');
        assert.equal(h.container.ownerDocument.activeElement, h.field('Shade 1 name'));
        await h.click('Remove shade 1');
        assert.equal(h.container.ownerDocument.activeElement, h.button('Add named shade'));
        assert.equal(h.submissions, 0);
    } finally { await h.close(); }
});
