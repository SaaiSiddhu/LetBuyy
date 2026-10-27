import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const browser = dom.window as unknown as {
    document: Document;
    HTMLElement: typeof HTMLElement;
    Element: typeof Element;
    CustomEvent: typeof CustomEvent;
    FormData: typeof FormData;
};
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, CustomEvent: browser.CustomEvent });

test('Liquid native login carries only a current solved challenge and removes it on expiry or failure', async () => {
    const previousKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-fixture-site-key';
    let callbacks: Record<string, unknown> = {};
    let removed = 0;
    Object.assign(browser, { turnstile: {
        render(container: HTMLElement, options: Record<string, unknown>) {
            // Provider-shaped fixture: reject the invalid size seen in production, and require a
            // visible container so a managed challenge can actually be completed by the buyer.
            assert.ok(['normal', 'compact', 'flexible'].includes(String(options.size)));
            assert.equal(container.hidden, false);
            assert.equal(container.closest('[hidden]'), null);
            callbacks = options;
            container.append(document.createElement('iframe'));
            return 'challenge-fixture';
        },
        remove(id: string) { assert.equal(id, 'challenge-fixture'); removed += 1; },
    } });
    const { registerLiquidHydrationIslands } = await import('./liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const form = document.createElement('form');
    form.innerHTML = '<input name="turnstileToken" type="hidden"><lb-turnstile data-lb-island="turnstile"></lb-turnstile>';
    document.body.append(form);
    const input = form.querySelector<HTMLInputElement>('input')!;
    try {
        assert.equal(input.value, '');
        assert.ok(form.querySelector('iframe'));
        (callbacks.callback as (token: string) => void)('solved-challenge-fixture');
        assert.equal(new browser.FormData(form).get('turnstileToken'), 'solved-challenge-fixture');
        (callbacks['expired-callback'] as () => void)();
        assert.equal(new browser.FormData(form).get('turnstileToken'), '');
        (callbacks.callback as (token: string) => void)('fresh-challenge-fixture');
        (callbacks['error-callback'] as () => void)();
        assert.equal(input.value, '');
        form.remove();
        assert.equal(removed, 1);
    } finally {
        form.remove();
        if (previousKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previousKey;
    }
});
