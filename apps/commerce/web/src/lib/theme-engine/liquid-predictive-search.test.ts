import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>') as unknown as { window: Window & typeof globalThis; reconfigure(options: { url: string }): void };
dom.reconfigure({ url: 'http://synthetic-threadline.localhost/' });
const win = dom.window as unknown as Window & typeof globalThis;
Object.assign(globalThis, { window: win, document: win.document, HTMLElement: win.HTMLElement, Element: win.Element, CustomEvent: win.CustomEvent, DOMException: win.DOMException });
Object.defineProperty(win.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
const tick = () => new Promise(done => setTimeout(done, 0));

async function fixture(response: () => Response) {
    const { registerLiquidHydrationIslands } = await import('./liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const original = globalThis.fetch;
    const calls: string[] = [];
    let received!: () => void;
    const requested = new Promise<void>(resolve => { received = resolve; });
    globalThis.fetch = (async input => { calls.push(String(input)); received(); return response(); }) as typeof fetch;
    const search = document.createElement('lb-predictive-search');
    search.dataset.basePath = '/store/synthetic-threadline';
    search.innerHTML = '<form data-lb-search-form action="/store/synthetic-threadline/search"><input role="combobox" aria-controls="qa-results" data-lb-search-input><div id="qa-results" role="listbox" data-lb-search-results></div></form>';
    document.body.append(search);
    return { search, calls, requested, input: search.querySelector<HTMLInputElement>('input')!, cleanup() { search.remove(); globalThis.fetch = original; } };
}

test('canonical-host search uses the server-bound store path when the public pathname is root', async () => {
    const f = await fixture(() => Response.json({ results: [{ id: 'shirt', title: 'Linen shirt', price: 2490, currency: 'INR', image: null, url: '/store/synthetic-threadline/product/shirt' }] }));
    try {
        f.input.value = 'linen'; f.input.dispatchEvent(new win.Event('input', { bubbles: true }));
        await f.requested; await tick();
        assert.deepEqual(f.calls, ['/api/store/synthetic-threadline/search-suggest?q=linen']);
        assert.match(f.search.textContent || '', /Linen shirt/);
        assert.equal(f.search.querySelector('[role="option"]')?.getAttribute('href'), '/store/synthetic-threadline/product/shirt');
        assert.equal(f.search.querySelector('.lb-predictive-search__view-all')?.getAttribute('href'), '/store/synthetic-threadline/search?search=linen');
        f.input.focus();
        f.input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        const activeId = f.input.getAttribute('aria-activedescendant');
        assert.ok(activeId);
        assert.equal(document.getElementById(activeId)?.getAttribute('aria-selected'), 'true');
        assert.equal(document.activeElement, f.input, 'combobox navigation retains input focus');
    } finally { f.cleanup(); }
});

test('unavailable suggestions remain distinct from a successful empty search', async () => {
    for (const [response, expected, excluded] of [
        [() => Response.json({ error: 'synthetic unavailable' }, { status: 503 }), /suggestions are unavailable/, /No results/],
        [() => { throw new TypeError('synthetic transport failure'); }, /suggestions are unavailable/, /No results/],
        [() => Response.json({ results: [] }), /No results for "linen"/, /suggestions are unavailable/],
    ] as const) {
        const f = await fixture(response);
        try {
            f.input.setAttribute('aria-activedescendant', 'stale-result');
            f.input.value = 'linen'; f.input.dispatchEvent(new win.Event('input', { bubbles: true }));
            await f.requested; await tick();
            assert.match(f.search.textContent || '', expected);
            assert.doesNotMatch(f.search.textContent || '', excluded);
            assert.equal(f.input.getAttribute('aria-activedescendant'), null);
            assert.equal(f.search.querySelector('[role="option"]'), null);
        } finally { f.cleanup(); }
    }
});
