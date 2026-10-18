import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ProductOriginDisclosure } from './product-origin-disclosure';

test('public origin and importer details are labeled as seller-provided and unverified', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator };
    const prior = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        actEnvironment: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: browserWindow.document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserWindow.navigator });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(browserWindow.document.getElementById('root')!);

    try {
        await act(async () => root.render(
            <ProductOriginDisclosure countryOfOrigin=" Japan " importerDetails=" Example Imports, Mumbai " />,
        ));
        const html = browserWindow.document.getElementById('root')!.innerHTML;
        assert.match(html, /Country of origin/);
        assert.match(html, /Japan/);
        assert.match(html, /Importer details/);
        assert.match(html, /Example Imports, Mumbai/);
        assert.match(html, /Provided by the seller; not independently verified by LetBuyy\./);

        await act(async () => root.render(<ProductOriginDisclosure importerDetails={'\n  '} />));
        assert.equal(browserWindow.document.getElementById('root')!.textContent, '');
    } finally {
        await act(async () => root.unmount());
        browserWindow.close();
        Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        Object.defineProperty(globalThis, 'document', { configurable: true, value: prior.document });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prior.navigator });
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
    }
});
