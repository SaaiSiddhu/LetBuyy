import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const requireApp = createRequire(new URL('../package.json', import.meta.url));
const ts = requireApp('typescript');
const jsx = requireApp('react/jsx-runtime');
const env = { NEXT_PUBLIC_ACCOUNTS_URL: 'http://accounts.fixture.localhost:31001',
    NEXT_PUBLIC_ADMIN_URL: 'http://admin.fixture.localhost:31002', NEXT_PUBLIC_STOREFRONT_URL: 'http://localhost:31003',
    NEXT_PUBLIC_THEME_MARKETPLACE_URL: 'http://localhost:9005' };
const stub = () => null;
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
function load(text, require, environment = env, window) {
    const exports = {};
    const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, require, URL, URLSearchParams, process: { env: environment }, ...(window ? { window } : {}) });
    return exports;
}
const urls = () => load(source('lib/public-urls.ts'), () => { throw new Error('Unexpected URL dependency'); });

test('edge sign-in preserves path and query on the configured marketplace when Next normalizes or receives an untrusted request origin', () => {
    const scopedEnv = { ...env, NEXT_PUBLIC_THEME_MARKETPLACE_URL: 'http://themes.fixture.localhost:9015' };
    const scopedUrls = load(source('lib/public-urls.ts'), () => { throw new Error('Unexpected URL dependency'); }, scopedEnv);
    let authenticated = false, verifications = 0;
    const loaded = load(source('proxy.ts'), id => {
        if (id === 'next/server') return { NextResponse: { next: () => ({ next: true }), redirect: url => ({ location: url.toString() }) } };
        if (id === '@/lib/public-urls') return scopedUrls;
        if (id === '@letbuyy/auth-core') return { LETBUYY_MERCHANT_SESSION_COOKIE: 'synthetic',
            verifyLetbuyySessionCookieValue: (realm, cookie) => { assert.equal(realm, 'merchant'); assert.equal(cookie, undefined); verifications++; return { accepted: authenticated }; } };
        throw new Error('Unexpected dependency: ' + id);
    }, scopedEnv);
    const query = '?theme=letbuyy-sense&version=2.0.0&return_to=https%3A%2F%2Fattacker.invalid%2F';
    const nextUrl = new URL('http://localhost:9015/install' + query);
    const request = url => ({ url, nextUrl, headers: new Headers({ host: 'themes.fixture.localhost:9015' }), cookies: { get: () => undefined } });
    for (const origin of ['http://localhost:9015', 'http://attacker.invalid', 'http://user:password@attacker.invalid']) {
        const redirect = new URL(loaded.proxy(request(origin + '/install' + query)).location);
        assert.equal(redirect.origin, scopedEnv.NEXT_PUBLIC_ACCOUNTS_URL);
        assert.equal(redirect.pathname, '/lookup');
        const returnTo = new URL(redirect.searchParams.get('return_to'));
        assert.equal(returnTo.origin, scopedEnv.NEXT_PUBLIC_THEME_MARKETPLACE_URL);
        assert.equal(returnTo.username, ''); assert.equal(returnTo.password, '');
        assert.equal(returnTo.pathname, '/install');
        assert.equal(returnTo.search, query);
    }
    authenticated = true;
    assert.equal(loaded.proxy(request('http://localhost:9015/install' + query)).next, true);
    const before = verifications;
    assert.equal(loaded.proxy({ ...request('http://attacker.invalid/themes'), nextUrl: new URL('http://localhost:9015/themes') }).next, true);
    assert.equal(verifications, before, 'public browsing still skips the merchant session guard');
});

test('configured public origins survive client static inlining and match server URLs', () => {
    const text = source('lib/public-urls.ts');
    // Model Next's documented direct NEXT_PUBLIC_* substitution; browsers have
    // no server environment object for dynamic process.env[name] lookups.
    const clientSource = text.replace(/process\.env\.(NEXT_PUBLIC_[A-Z_]+)/g, (_, name) => JSON.stringify(env[name]) ?? 'undefined');
    const server = urls(), client = load(clientSource, () => { throw new Error('Unexpected dependency'); }, {},
        { location: { hostname: 'localhost', protocol: 'http:' } });
    for (const [method, key] of [['getAccountsUrl', 'NEXT_PUBLIC_ACCOUNTS_URL'], ['getAdminUrl', 'NEXT_PUBLIC_ADMIN_URL'],
        ['getStorefrontUrl', 'NEXT_PUBLIC_STOREFRONT_URL'], ['getThemeMarketplaceUrl', 'NEXT_PUBLIC_THEME_MARKETPLACE_URL']]) {
        assert.equal(client[method]('/lookup'), env[key] + '/lookup');
        assert.equal(client[method]('/lookup'), server[method]('/lookup'));
    }
});

test('root authentication requires the canonical current user, even when an old cookie parses as accepted', async () => {
    const AuthProvider = stub;
    for (const currentUser of [null, { id: 'synthetic-user' }]) {
        const loaded = load(source('app/layout.tsx'), id => {
            if (id === 'react/jsx-runtime') return jsx;
            if (id === './globals.css') return {};
            if (id === 'next/font/local') return ({ variable }) => ({ variable });
            if (id === 'next/headers') return { cookies: async () => ({ get: () => ({ value: 'synthetic-old-cookie' }) }) };
            if (id === '@letbuyy/auth-core') return { LETBUYY_MERCHANT_SESSION_COOKIE: 'synthetic', verifyLetbuyySessionCookieValue: () => ({ accepted: true }) };
            if (id === '@/lib/theme-service') return { ThemeService: { getSessionUser: async () => currentUser } };
            if (id === '@/lib/site-url') return { getThemeMarketplaceUrl: () => env.NEXT_PUBLIC_THEME_MARKETPLACE_URL };
            if (id === '@/components/auth-provider') return AuthProvider;
            if (id.startsWith('@/components/')) return () => null;
            if (id === '@letbuyy/ui') return { LetbuyyThemeProvider: 'theme-provider', ThemeScript: 'theme-script', ToastProvider: 'toast-provider' };
            throw new Error('Unexpected dependency: ' + id);
        });
        const tree = await loaded.default({ children: null });
        function find(node) {
            if (!node || typeof node !== 'object') return null;
            if (node.type === AuthProvider) return node.props;
            const children = node.props?.children;
            for (const child of Array.isArray(children) ? children : [children]) { const match = find(child); if (match) return match; }
            return null;
        }
        const props = find(tree);
        assert.ok(props);
        assert.equal(props.initialAuthenticated, Boolean(currentUser));
        assert.equal(props.initialUser, currentUser);
    }
});

test('unconfirmed install identity returns to canonical sign-in with exact theme/version before owned-store reads', async () => {
    let storeReads = 0;
    const loaded = load(source('app/install/page.tsx'), id => {
        if (id === 'react/jsx-runtime') return jsx;
        if (id === 'next/link') return stub;
        if (id === '@/components/marketplace-task-title') return stub;
        if (id === 'next/navigation') return { redirect: url => { const error = new Error('redirect'); error.url = url; throw error; } };
        if (id === '@/lib/public-urls') return urls();
        if (id === '@/lib/theme-service') return { MarketplaceInstallUnconfirmedError: Error,
            ThemeService: { getSessionUser: async () => null, getUserStores: async () => { storeReads++; return []; } } };
        if (id === '@letbuyy/theme-engine') return requireApp(id);
        if (id === '@letbuyy/api-client') return { LetbuyyApiError: Error };
        if (id === '@letbuyy/ui') return {};
        if (id === '@/components/theme-action-feedback') return {};
        if (id === '@/lib/install-feedback') return {};
        if (id === '@/lib/install-selection') return {};
        throw new Error('Unexpected dependency: ' + id);
    });
    await assert.rejects(loaded.default({ searchParams: Promise.resolve({ theme: 'letbuyy-sense', version: '2.0.0' }) }), error => {
        const target = new URL(error.url);
        assert.equal(target.origin, env.NEXT_PUBLIC_ACCOUNTS_URL);
        assert.equal(target.pathname, '/lookup');
        assert.equal(target.searchParams.get('return_to'), env.NEXT_PUBLIC_THEME_MARKETPLACE_URL + '/install?theme=letbuyy-sense&version=2.0.0');
        return true;
    });
    assert.equal(storeReads, 0);
});
