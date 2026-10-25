import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindLiquidPreviewInspector } from './liquid-preview-inspector';
import { EDITOR_SECTION_SELECT_MESSAGE, EDITOR_SELECTION_MESSAGE, EDITOR_INSPECTOR_MODE_MESSAGE, createEditorPreviewIdentityIndex } from '@letbuyy/theme-engine/editor-bridge-protocol';

const context = { sessionId: '33333333-3333-4333-8333-333333333333', revision: 4, templateKey: 'page.faq' };

function fixture(editor = true) {
    const dom = new JSDOM(`<div data-theme-renderer="liquid" data-editor-mode="${editor}"><section data-section-id="hero"><h1>Merchant heading</h1><a href="/products">Shop</a><div data-block-id="first">Same label</div><div data-block-id="parent"><button data-block-id="second">Same label</button></div><div data-block-id="unknown-block">Unknown</div></section><section data-section-id="unknown">Unlisted section</section></div>`);
    const win = dom.window as unknown as Window & typeof globalThis;
    const sent: Array<{ data: { type: string; sectionId: string }; origin: string }> = [];
    Object.defineProperty(win, 'postMessage', { value: (data: { type: string; sectionId: string }, origin: string) => { sent.push({ data, origin }); } });
    const cleanup = bindLiquidPreviewInspector(dom.window.document, 'https://admin.example.test', createEditorPreviewIdentityIndex([{ id: 'hero', type: 'Hero banner', blocks: [{ id: 'first' }, { id: 'parent', children: [{ id: 'second' }] }] }]), context);
    return { dom, win, sent, cleanup, section: dom.window.document.querySelector('section')! };
}
test('Liquid preview pointer and keyboard selection use the existing bounded-origin protocol', () => {
    const f = fixture();
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.querySelector('a')!.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true, 'inspecting does not navigate away');
    assert.equal(f.section.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(f.sent[0], { data: { type: EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero', blockPath: [], sectionType: 'Hero banner', context }, origin: 'https://admin.example.test' });
    f.section.dispatchEvent(new f.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(f.sent.length, 2);
    f.cleanup(); f.win.close();
});
test('Liquid selection rejects foreign messages and restores DOM/listeners on disposal', () => {
    const f = fixture();
    const send = (origin: string) => f.win.dispatchEvent(new f.win.MessageEvent('message', { origin, source: f.dom.window as unknown as Window, data: { type: EDITOR_SELECTION_MESSAGE, sectionId: 'hero', context } }));
    send('https://foreign.example.test'); assert.equal(f.section.getAttribute('aria-pressed'), 'false');
    send('https://admin.example.test'); assert.equal(f.section.getAttribute('aria-pressed'), 'true');
    assert.equal(f.sent.length, 0, 'external selection never echoes into a message loop');
    f.cleanup();
    assert.equal(f.section.getAttribute('role'), null);
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.dispatchEvent(click); assert.equal(click.defaultPrevented, false);
    f.win.close();
});
test('exact nested block selection uses document ancestry, and tree selection never echoes', () => {
    const f = fixture();
    const second = f.win.document.querySelector('[data-block-id="second"]')!;
    second.dispatchEvent(new f.win.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.deepEqual(f.sent[0].data, { type: EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero', blockId: 'second', blockPath: ['parent', 'second'], sectionType: 'Hero banner', context });
    assert.equal(second.getAttribute('aria-pressed'), 'true');
    assert.equal(f.section.getAttribute('aria-pressed'), 'false', 'the outline belongs to the exact block');
    const data = { type: EDITOR_SELECTION_MESSAGE, sectionId: 'hero', blockId: 'first', blockPath: ['first'], context };
    f.win.dispatchEvent(new f.win.MessageEvent('message', { origin: 'https://admin.example.test', source: f.dom.window as unknown as Window, data }));
    assert.equal(f.win.document.querySelector('[data-block-id="first"]')!.getAttribute('aria-pressed'), 'true');
    assert.equal(second.getAttribute('aria-pressed'), 'false');
    assert.equal(f.sent.length, 1, 'tree messages cannot create a selection/scroll echo');
    f.cleanup(); f.win.close();
});
test('same-origin wrong windows, stale revisions/templates/sessions and forged block ancestry are ignored', () => {
    const f = fixture();
    const base = { type: EDITOR_SELECTION_MESSAGE, sectionId: 'hero', blockId: 'second', blockPath: ['parent', 'second'], context };
    const invalid = [
        { ...base, context: undefined }, { ...base, context: { ...context, revision: 3 } },
        { ...base, context: { ...context, templateKey: 'index' } },
        { ...base, context: { ...context, sessionId: '44444444-4444-4444-8444-444444444444' } },
        { ...base, blockPath: ['second'] }, { ...base, blockId: 'unknown-block' }, { ...base, sectionId: 'unknown' },
    ];
    for (const data of invalid) f.win.dispatchEvent(new f.win.MessageEvent('message', { origin: 'https://admin.example.test', source: f.dom.window as unknown as Window, data }));
    f.win.dispatchEvent(new f.win.MessageEvent('message', { origin: 'https://admin.example.test', source: {} as Window, data: base }));
    assert.equal(f.win.document.querySelector('[data-block-id="second"]')!.getAttribute('aria-pressed'), 'false');
    f.win.document.querySelector('[data-block-id="unknown-block"]')!.dispatchEvent(new f.win.MouseEvent('click', { bubbles: true }));
    assert.equal(f.sent.length, 0);
    f.cleanup(); f.win.close();
});
test('inspector mode toggles interception and restores buyer semantics without changing document identity', () => {
    const f = fixture();
    const mode = (enabled: boolean) => f.win.dispatchEvent(new f.win.MessageEvent('message', { origin: 'https://admin.example.test', source: f.dom.window as unknown as Window, data: { type: EDITOR_INSPECTOR_MODE_MESSAGE, enabled, context } }));
    mode(false);
    assert.equal(f.section.getAttribute('role'), null);
    const click = new f.win.MouseEvent('click', { bubbles: true, cancelable: true });
    f.section.querySelector('a')!.dispatchEvent(click);
    assert.equal(click.defaultPrevented, false); assert.equal(f.sent.length, 0);
    mode(true);
    f.win.document.querySelector('[data-block-id="second"]')!.dispatchEvent(new f.win.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(f.sent.length, 1); assert.equal(f.win.document.querySelector('[data-block-id="second"]')!.getAttribute('aria-pressed'), 'true');
    f.cleanup(); f.win.close();
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
