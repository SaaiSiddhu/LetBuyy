import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindLiquidPreviewInspector } from './liquid-preview-inspector';
import { EDITOR_SECTION_SELECT_MESSAGE, EDITOR_SELECTION_MESSAGE } from '@letbuyy/theme-engine/editor-bridge-protocol';

function fixture(editor = true) {
    const dom = new JSDOM(`<div data-theme-renderer="liquid" data-editor-mode="${editor}"><section data-section-id="hero"><h1>Merchant heading</h1><a href="/products">Shop</a></section><section data-section-id="unknown">Unlisted section</section></div>`);
    const win = dom.window as unknown as Window & typeof globalThis;
    const sent: Array<{ data: { type: string; sectionId: string }; origin: string }> = [];
    Object.defineProperty(win, 'postMessage', { value: (data: { type: string; sectionId: string }, origin: string) => { sent.push({ data, origin }); } });
    const cleanup = bindLiquidPreviewInspector(dom.window.document, 'https://admin.example.test', { hero: 'Hero banner' });
    return { dom, win, sent, cleanup, section: dom.window.document.querySelector('section')! };
}
test('Liquid preview pointer and keyboard selection use the existing bounded-origin protocol', () => {
    const f = fixture();
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.querySelector('a')!.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true, 'inspecting does not navigate away');
    assert.equal(f.section.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(f.sent[0], { data: { type: EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero', sectionType: 'Hero banner' }, origin: 'https://admin.example.test' });
    f.section.dispatchEvent(new f.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(f.sent.length, 2);
    f.cleanup(); f.win.close();
});
test('Liquid selection rejects foreign messages and restores DOM/listeners on disposal', () => {
    const f = fixture();
    const send = (origin: string) => f.win.dispatchEvent(new f.win.MessageEvent('message', { origin, source: f.dom.window as unknown as Window, data: { type: EDITOR_SELECTION_MESSAGE, sectionId: 'hero' } }));
    send('https://foreign.example.test'); assert.equal(f.section.getAttribute('aria-pressed'), 'false');
    send('https://admin.example.test'); assert.equal(f.section.getAttribute('aria-pressed'), 'true');
    assert.equal(f.sent.length, 0, 'external selection never echoes into a message loop');
    f.cleanup();
    assert.equal(f.section.getAttribute('role'), null);
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.dispatchEvent(click); assert.equal(click.defaultPrevented, false);
    f.win.close();
});
test('public Liquid previews and unknown section IDs retain their storefront behavior', () => {
    const f = fixture(false);
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.querySelector('a')!.dispatchEvent(click);
    assert.equal(click.defaultPrevented, false); assert.equal(f.sent.length, 0);
    assert.equal(f.section.getAttribute('role'), null);
    f.cleanup(); f.win.close();
    const g = fixture();
    g.win.document.querySelector('[data-section-id="unknown"]')!.dispatchEvent(new g.win.MouseEvent('click', { bubbles: true }));
    assert.equal(g.sent.length, 0); g.cleanup(); g.win.close();
});
