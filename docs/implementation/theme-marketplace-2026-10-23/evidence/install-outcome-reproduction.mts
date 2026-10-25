/** Audit reproducer, not acceptance. Exercises the actual current component with mocked transport. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const requireMerchant = createRequire(new URL('../../../../apps/merchant/web/package.json', import.meta.url));
// CSS is outside this state/transport reproduction; actual visual QA uses the browser.
const priorCss = requireMerchant.extensions['.css'];
requireMerchant.extensions['.css'] = module => { module.exports = {}; };
const { ThemeWorkspace } = requireMerchant('./src/components/theme-library/ThemeWorkspace');
const React = requireMerchant('react');
const { act } = React;
const { createRoot } = requireMerchant('react-dom/client');
const { AppRouterContext } = requireMerchant('next/dist/shared/lib/app-router-context.shared-runtime.js');
const { PathParamsContext } = requireMerchant('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
const { ToastProvider } = requireMerchant('@letbuyy/ui');
const { JSDOM } = await requireMerchant('@letbuyy/theme-engine/server-dom').loadThemeServerDom();
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/marketplace-qa/online-store/themes/marketplace' });
const globals = ['window', 'document', 'navigator', 'self', 'localStorage', 'MutationObserver', 'HTMLElement', 'Element', 'fetch', 'React', 'IS_REACT_ACT_ENVIRONMENT'];
const previous = Object.fromEntries(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
for (const name of globals.slice(0, 9)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'self' ? dom.window : dom.window[name] });
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let catalogReads = 0;
const theme = { id: '7b669c70-0000-4000-8000-000000000002', slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0', description: 'Synthetic apparel', category: 'fashion', is_active: true };
const calls: string[] = [];
globalThis.fetch = (async input => {
    const url = String(input); calls.push(url);
    if (url === '/api/themes/install') return Response.json({ success: true, theme: { slug: theme.slug, name: theme.name } });
    catalogReads++;
    return catalogReads === 1 ? Response.json({ themes: [theme], storeId: '7b669c70-9000-4000-8000-000000000001' })
        : Response.json({ error: { message: 'Injected catalog read failure after install' } }, { status: 503 });
}) as typeof fetch;
const root = createRoot(dom.window.document.getElementById('root')!);
try {
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
    await act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(PathParamsContext.Provider, { value: { store: 'marketplace-qa' } }, React.createElement(ToastProvider, { duration: 0 }, React.createElement(ThemeWorkspace, { marketplace: true }))))));
    const add = dom.window.document.querySelector('button[aria-label="Add Threadline"]') as HTMLButtonElement | null;
    assert.ok(add);
    await act(async () => add.click());
    const text = dom.window.document.body.textContent || '';
    const fixed = process.argv.includes('--expect-fixed');
    if (fixed) {
        assert.doesNotMatch(text, /Theme added to your library/);
        assert.match(text, /Add has not been confirmed|did not identify the selected theme instance/);
    } else {
        assert.match(text, /Injected catalog read failure after install/);
        assert.match(text, /Theme added to your library/);
    }
    process.stdout.write(JSON.stringify({ expectedOutcome: fixed ? 'fixed' : 'reproduced', scenario: 'Install returns only slug/name; no instance/readback can confirm Add', transport: 'mocked fetch, JSDOM; no actual mutation', calls }, null, 2) + '\n');
} finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [name, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
    if (priorCss) requireMerchant.extensions['.css'] = priorCss;
    else delete requireMerchant.extensions['.css'];
}
