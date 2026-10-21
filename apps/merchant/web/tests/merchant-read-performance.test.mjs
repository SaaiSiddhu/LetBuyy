import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { NextRequest } from 'next/server.js';

// Execute the real server components/helpers with controlled dependency delays.
// These prove request work and failure behavior, not production database latency.
function load(relative, modules, globals = {}) {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    const exports = {};
    new Function('require', 'exports', ...Object.keys(globals), js)((name) => {
        assert.ok(name in modules, `Unexpected dependency ${name}`);
        return modules[name];
    }, exports, ...Object.values(globals));
    return exports;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
class ApiError extends Error {
    constructor(status, code = 'UNAVAILABLE') { super(code); this.status = status; this.code = code; }
}
class MerchantError extends Error {}
const store = { id: 'store-a', name: 'Store A', subdomain: 'alpha', site_type: 'store', theme_id: 'modern' };

test('shell starts independent store and switcher reads together after session validation', async () => {
    const current = deferred(), switcher = deferred(), calls = [];
    const { default: layout } = load('../src/app/[store]/layout.tsx', {
        'react/jsx-runtime': jsx,
        'next/navigation': { notFound() { throw new Error('not-found'); }, redirect() { throw new Error('redirect'); } },
        '@/lib/auth/session': {
            getSessionUser: async () => ({ id: 'actor-a' }),
            getStoreForUser: () => { calls.push('store'); return current.promise; },
            getUserStores: () => { calls.push('switcher'); return switcher.promise; },
            isQueryCostRateLimited: () => false,
        },
        '@/components/AdminShell': { default: () => null },
        '@/lib/public-urls': { getAccountsUrl: () => '/login' },
    });
    const result = layout({ children: null, params: Promise.resolve({ store: 'alpha' }) });
    await tick();
    const started = [...calls];
    current.resolve(store); switcher.resolve([store]);
    const rendered = await result;
    assert.deepEqual(started.sort(), ['store', 'switcher'], 'the switcher must not add another network waterfall');
    assert.equal(rendered.props.storeData.id, store.id);
});

test('dashboard launches setup and metrics together and shares its recent product read', async () => {
    const gate = deferred(), calls = [];
    const delayed = name => () => { calls.push(name); return gate.promise; };
    const api = {
        products: { list: delayed('products'), listSummary: delayed('products') }, shipping: { zones: { list: delayed('shipping') } },
        stores: { paymentConfig: { get: delayed('payment') } },
        analytics: { dashboard: delayed('dashboard'), orders: delayed('order-summary') },
        orders: { list: delayed('orders') },
    };
    const { default: page } = load('../src/app/[store]/dashboard/page.tsx', {
        'react/jsx-runtime': jsx, 'next/navigation': { notFound() { throw new Error('not-found'); } },
        '@/lib/auth/session': { getSessionUser: async () => ({ id: 'actor-a' }), getStoreForUser: async () => store },
        '@/lib/api/client': { createMerchantApiClient: () => api },
        '@letbuyy/ui/formatting': { formatInrCurrency: () => 'INR' },
        './DashboardClient': { default: () => null },
        './dashboard-setup-status': {
            resolveDashboardDomain: () => ({ configured: true }),
            buildStoreSetupStatus: input => input, buildPageSetupStatus: input => input,
        },
    });
    const result = page({ params: Promise.resolve({ store: 'alpha' }) });
    await tick();
    const started = [...calls];
    gate.resolve({ data: [{ id: 'product-a', name: 'Notebook', status: 'draft' }], total: 3, summary: { products: 3 }, breakdown: {} });
    const rendered = await result;
    assert.ok(started.includes('dashboard') && started.includes('orders'), 'metrics must start while setup reads are pending');
    assert.equal(calls.filter(name => name === 'products').length, 1, 'the same all-status catalogue population serves setup and recent activity');
    assert.equal(rendered.props.homeData.totalProducts, 3);
    assert.equal(rendered.props.homeData.analyticsAvailable, true);
    assert.ok(rendered.props.homeData.recentActivity.some(item => item.title === 'Notebook'));
});

function sessionWith(operation) {
    const delays = [];
    const session = load('../src/lib/auth/session.ts', {
        react: { cache: fn => fn },
        '@letbuyy/api-client': { LetbuyyApiError: ApiError },
        '@/lib/api/client': { MerchantApiRequestError: MerchantError, createMerchantApiClient: () => ({ auth: { session: operation } }) },
    }, { setTimeout: (done, ms) => { delays.push(ms); queueMicrotask(done); } });
    return { ...session, delays };
}
test('query-cost throttling does not create eight foreground attempts', async () => {
    let attempts = 0;
    const expected = new ApiError(429, 'QUERY_COST_RATE_LIMITED');
    const session = sessionWith(async () => { attempts++; throw expected; });
    await assert.rejects(session.getSessionUser(), error => error === expected);
    assert.equal(attempts, 1, 'an overloaded backend must not be hammered by a foreground retry loop');
    assert.deepEqual(session.delays, []);
});
test('an unexpected programming error is not retried as a network failure', async () => {
    let attempts = 0;
    const expected = new Error('unexpected decoder failure');
    const session = sessionWith(async () => { attempts++; throw expected; });
    await assert.rejects(session.getSessionUser(), error => error === expected);
    assert.equal(attempts, 1);
});
test('a transient gateway failure gets only one quick retry and can recover', async () => {
    let attempts = 0;
    const session = sessionWith(async () => {
        if (++attempts === 1) throw new ApiError(503);
        return { authenticated: true, user: { id: 'actor-a', email: 'synthetic@example.invalid' } };
    });
    assert.equal((await session.getSessionUser()).id, 'actor-a');
    assert.equal(attempts, 2);
    assert.deepEqual(session.delays, [200]);
});
test('auth refusal remains signed-out and is never retried', async () => {
    let attempts = 0;
    const session = sessionWith(async () => { attempts++; throw new ApiError(401); });
    assert.equal(await session.getSessionUser(), null);
    assert.equal(attempts, 1);
});

test('read transport adds a finite deadline, composes caller cancellation, and leaves commands unreplayed', async () => {
    const calls = [], deadlines = [];
    const client = load('../src/lib/api/client.ts', {
        'next/headers': { cookies: async () => ({ get: () => undefined }) },
        'next/server': { NextResponse: { json: Response.json } },
        '@letbuyy/api-client': { resolveLetbuyyApiBaseUrl: () => 'http://gateway.invalid/v1' },
        '@letbuyy/auth-core': { LETBUYY_MERCHANT_SESSION_COOKIE: 'lb_session' },
    }, {
        fetch: async (url, init) => { calls.push({ url, init }); return Response.json({}); },
        AbortSignal: { timeout: ms => { deadlines.push(ms); return AbortSignal.timeout(ms); }, any: signals => AbortSignal.any(signals) },
    });
    const caller = new AbortController();
    await client.merchantApiFetch('/products', { signal: caller.signal });
    caller.abort();
    assert.equal(calls[0].init.signal.aborted, true);
    assert.deepEqual(deadlines, [10_000]);
    await client.merchantApiFetch('/products', { method: 'POST', body: '{}' });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].init.signal, undefined);
    assert.deepEqual(deadlines, [10_000]);
});

test('store resolution preserves backend availability errors and only hides denied/missing stores', async () => {
    for (const status of [401, 403, 404, 429, 500, 503]) {
        const { resolveOwnedStoreId } = load('../src/lib/stores/resolve-owned-store.ts', {
            'next/server': { NextResponse: { json: Response.json } },
            '@letbuyy/api-client': { LetbuyyApiError: ApiError },
            '@/lib/api/client': {
                createMerchantApiClient: () => ({ stores: { getByHandle: async () => { throw new ApiError(status); } } }),
                merchantApiErrorResponse: error => Response.json({ error: 'Unavailable' }, { status: error.status }),
            },
        });
        const result = await resolveOwnedStoreId('alpha');
        assert.equal(result.error.status, status === 403 ? 404 : status);
    }
});

for (const siteType of ['store', 'portfolio', 'resume', 'blog', 'landing']) {
    test(`setup snapshot only requests useful ${siteType} resources and retains unavailable checks`, async () => {
        const calls = []
        const read = name => async () => { calls.push(name); if (name === 'products') throw new Error('Unavailable'); return { total: 2 } }
        const api = { products: { listSummary: read('products') }, pages: { list: read('pages') }, shipping: { zones: { list: async () => { calls.push('shipping'); return [] } } }, stores: { paymentConfig: { get: async () => { calls.push('payment'); return {} } } } }
        const { GET } = load('../src/app/api/stores/[store]/dashboard/setup/route.ts', {
            'next/server': { NextResponse: { json: Response.json } },
            '@/lib/api/client': { createMerchantApiClient: () => api, merchantApiErrorResponse: () => Response.json({}, {status:500}) },
            '@/lib/stores/resolve-owned-store': { resolveOwnedStore: async () => ({storeId:'site-a',store:{...store,site_type:siteType}}) },
            '@/app/[store]/dashboard/dashboard-setup-status': { isPaymentConfigured: () => false, resolveDashboardDomain: () => ({configured:true}) },
        })
        const response = await GET(null,{params:Promise.resolve({store:'alpha'})})
        assert.equal(response.status,200)
        const data = (await response.json()).data
        assert.deepEqual(calls.sort(),siteType==='store' ? ['payment','products','shipping'] : ['pages'])
        assert.equal(data.productsCount,null)
        assert.equal(data.pagesCount,siteType==='store' ? null : 2)
        assert.equal(data.paymentConfigured,siteType==='store' ? false : null)
    })
}

test('theme translations reuse owned layout reads and private localization transport', async () => {
    const calls = [];
    const localization = { default_locale: 'en-IN', locales: [], translations: [] };
    const { default: page } = load('../src/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx', {
        'react/jsx-runtime': jsx,
        'next/headers': { cookies: async () => ({ toString: () => '' }), headers: async () => new Headers() },
        '@/lib/auth/session': { getSessionUser: async () => ({ id: 'actor-a' }), getStoreForUser: async (handle, actor) => { calls.push([handle,actor]); return store; } },
        '@/lib/api/client': { createMerchantApiClient: () => ({ stores: { localization: { get: async id => { calls.push(id); return localization; } } } }) },
        './TranslationEditorClient': { default: () => null },
    }, { fetch: async () => { throw new Error('unexpected self HTTP request'); } });
    const rendered = await page({ params: Promise.resolve({ store: 'alpha', themeId: 'synthetic-theme' }) });
    assert.deepEqual(calls, [['alpha','actor-a'],'store-a']);
    assert.equal(rendered.props.localization,localization);
    assert.equal(rendered.props.fetchError,null);
});

test('theme update wrapper resolves the store without downloading the complete theme catalog', async () => {
    const { default: page } = load('../src/app/[store]/online-store/themes/update/page.tsx', {
        'react/jsx-runtime': jsx,
        'next/headers': { cookies: async () => ({ getAll: () => [] }) },
        '@/lib/auth/session': { getSessionUser: async () => ({ id: 'actor-a' }), getStoreForUser: async () => store },
        './UpdatePageClient': { default: () => null },
    }, { fetch: async () => { throw new Error('unexpected catalog HTTP request'); } });
    const rendered = await page({ params: Promise.resolve({ store: 'alpha' }), searchParams: Promise.resolve({ themeSlug: 'synthetic-theme' }) });
    assert.equal(rendered.props.storeId,'store-a');
    assert.equal(rendered.props.fetchError,null);
});

function readBudget(deadlines) {
    return load('../src/lib/api/client.ts', {
        'next/headers': {}, 'next/server': { NextResponse: { json: Response.json } },
        '@letbuyy/api-client': {}, '@letbuyy/auth-core': {},
    }, { AbortSignal: { timeout: ms => { deadlines.push(ms); return AbortSignal.timeout(ms); }, any: signals => AbortSignal.any(signals) } }).merchantApiReadSignal;
}

const previewRoutes = [
    ['segment', '../src/app/api/stores/[store]/customers/segments/preview/route.ts', { rules: { tags_any: [] } }],
    ['audience', '../src/app/api/stores/[store]/marketing/campaigns/audience-preview/route.ts', { audience: { type: 'all_marketing', recipients: [] } }],
    ['coupon', '../src/app/api/subscribe/coupon/route.ts', { coupon_code: 'SYNTHETIC' }],
    ['invitation', '../src/app/api/employees/accept-invite/route.ts', { token: 'synthetic-preview', action: 'preview' }],
];
for (const [name, file, body] of previewRoutes) {
    test(`${name} read-only POST delegates once with a deadline and caller cancellation`, async () => {
        const calls = [], deadlines = [], caller = new AbortController();
        const read = async (...args) => { calls.push(args); return {}; };
        const { POST } = load(file, {
            'next/server': { NextResponse: { json: Response.json } },
            '@/lib/api/client': {
                merchantApiReadSignal: readBudget(deadlines),
                merchantApiErrorResponse: error => { throw error; },
                createMerchantApiClient: () => ({
                    customers: { segments: { preview: read } }, marketing: { emailCampaigns: { previewAudience: read } },
                    payments: { subscription: { coupon: read } }, employees: { previewInvite: read },
                }),
            },
            '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async () => ({ storeId: 'owned-store' }) },
            '@/lib/staff/request-origin': { validateStaffMutationRequest: () => null },
        });
        const response = await POST({ signal: caller.signal, json: async () => body }, { params: Promise.resolve({ store: 'alpha' }) });
        assert.equal(response.status, 200);
        assert.equal(calls.length, 1);
        const signal = calls[0][1]?.signal;
        assert.ok(signal instanceof AbortSignal, 'the actual delegate needs a bounded signal');
        assert.deepEqual(deadlines, [10_000]);
        assert.equal(signal.aborted, false);
        caller.abort();
        assert.equal(signal.aborted, true);
    });
}

test('invitation acceptance retains its command key and has no implicit read deadline', async () => {
    const deadlines = [], calls = [];
    const { POST } = load('../src/app/api/employees/accept-invite/route.ts', {
        'next/server': { NextResponse: { json: Response.json } },
        '@/lib/api/client': {
            merchantApiReadSignal: readBudget(deadlines), merchantApiErrorResponse: error => { throw error; },
            createMerchantApiClient: () => ({ employees: { acceptInvite: async (...args) => { calls.push(args); return {}; } } }),
        },
        '@/lib/staff/request-origin': { validateStaffMutationRequest: () => null },
    });
    await POST({ signal: new AbortController().signal, json: async () => ({ action: 'accept', token: 'synthetic-preview' }), headers: new Headers({ 'X-Idempotency-Key': 'retained-command-key' }) });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], { idempotencyKey: 'retained-command-key' });
    assert.deepEqual(deadlines, []);
});

test('best-effort logout bounds a stalled identity request and still clears only the local session cookie', async () => {
    const deadlines = [], cleared = [], calls = [];
    const { POST } = load('../src/app/api/auth/logout/route.ts', {
        'next/server': { NextResponse: { json: Response.json } },
        'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-session' }), set: (...args) => cleared.push(args) }) },
        '@letbuyy/auth-core': { LETBUYY_MERCHANT_SESSION_COOKIE: 'lb_session' },
        '@/lib/public-urls': { getAccountsUrl: (path = '') => 'https://identity.example.invalid' + path, getAdminUrl: () => 'https://merchant.example.invalid' },
    }, {
        process: { env: { NODE_ENV: 'development' } },
        AbortSignal: { timeout: ms => {
            deadlines.push(ms);
            const controller = new AbortController();
            setTimeout(() => controller.abort(new DOMException('Identity timed out', 'TimeoutError')), 5);
            return controller.signal;
        } },
        fetch: async (url, init) => {
            calls.push({ url, init });
            if (!init.signal) throw new Error('Missing logout deadline');
            return new Promise((_resolve, reject) => {
                if (init.signal.aborted) reject(init.signal.reason);
                else init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
            });
        },
    });
    const response = await POST();
    assert.deepEqual(deadlines, [5_000]);
    assert.equal(calls.length, 1, 'no retry of the remote operation');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(cleared.map(call => call[0]), ['lb_session'], 'account-picker history is retained');
    assert.equal(cleared[0][1], '');
    assert.equal(cleared[0][2].maxAge, 0);
    assert.equal(cleared[0][2].httpOnly, true);
    assert.equal((await response.json()).redirectTo, 'https://identity.example.invalid/lookup');
});

function exportRoute(file, exports, fetch = () => { throw new Error('unexpected file fetch'); }, resolve = async () => ({ storeId: 'owned-a' }), originGuard = () => null) {
    return load(file, {
        'next/server': { NextResponse: { json: Response.json } },
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: resolve },
        '@/lib/api/request-origin': { validateMerchantMutationRequest: originGuard },
        '@/lib/api/client': { createMerchantApiClient: () => ({ exports }), merchantApiFetch: fetch,
            merchantApiReadSignal: signal => signal, merchantApiErrorResponse: error => { throw error; } },
    });
}
const exportParams = { params: Promise.resolve({ store: 'alpha', jobId: 'job-a' }) };
for (const type of ['products', 'orders', 'customers']) {
    test(`export BFF starts one canonical ${type} job for the resolved store`, async () => {
        const calls = [], signal = new AbortController().signal;
        const { POST } = exportRoute('../src/app/api/stores/[store]/exports/route.ts', {
            [type]: async (...args) => { calls.push(args); return { job: { id: 'job-a' } }; },
        });
        const result = await POST({ signal, json: async () => ({ type, store_id: 'foreign', status: type === 'orders' ? 'shipped' : undefined }) }, exportParams);
        assert.equal(result.status, 202);
        assert.deepEqual(calls, [[{ store_id: 'owned-a', ...(type === 'orders' ? { status: 'shipped' } : {}) }, { signal }]]);
        assert.match(result.headers.get('Cache-Control'), /no-store/);
    });
}

test('export polling retains job/store scope and denied ownership cannot delegate', async () => {
    const calls = [], signal = new AbortController().signal;
    const file = '../src/app/api/stores/[store]/exports/[jobId]/route.ts';
    const { GET } = exportRoute(file, { job: async (...args) => { calls.push(args); return { job: { id: 'job-a' } }; } });
    assert.equal((await GET({ signal }, exportParams)).status, 200);
    assert.deepEqual(calls, [['job-a', { query: { store_id: 'owned-a' }, signal }]]);
    const denied = exportRoute(file, {}, undefined, async () => ({ error: Response.json({}, { status: 403 }) }));
    assert.equal((await denied.GET({ signal }, exportParams)).status, 403);
});

test('export download streams only the known gateway path and protects private response bytes', async () => {
    const calls = [], signal = new AbortController().signal;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('name\n東京\n')); controller.close(); } });
    const { GET } = exportRoute('../src/app/api/stores/[store]/exports/[jobId]/download/route.ts', {
        job: async () => ({ job: { id: 'job-a', type: 'products', status: 'completed', download_url: 'https://untrusted.example.invalid/leak?token=synthetic-signature' } }),
    }, async (...args) => { calls.push(args); return new Response(stream); });
    const result = await GET({ signal }, exportParams);
    assert.deepEqual(calls, [['/export/jobs/job-a/download?store_id=owned-a&token=synthetic-signature', { requireSession: true, signal, readTimeoutMs: 60_000, redirect: 'error' }]]);
    assert.equal(result.body, stream, 'do not buffer the stored file');
    assert.equal(await result.text(), 'name\n東京\n');
    assert.match(result.headers.get('Cache-Control'), /no-store/);
    assert.match(result.headers.get('Content-Disposition'), /attachment/);
});

test('export download refuses pending/import results and cancels an unsuccessful upstream body', async () => {
    const file = '../src/app/api/stores/[store]/exports/[jobId]/download/route.ts';
    for (const job of [{ id: 'job-a', type: 'products', status: 'running' }, { id: 'job-a', type: 'product_import', status: 'completed' }]) {
        const { GET } = exportRoute(file, { job: async () => ({ job }) });
        assert.equal((await GET({ signal: new AbortController().signal }, exportParams)).status, 409);
    }
    let cancelled = false;
    const upstream = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 403 });
    const { GET } = exportRoute(file, { job: async () => ({ job: { id: 'job-a', type: 'products', status: 'completed', download_url: 'https://gateway.test/?token=synthetic' } }) }, async () => upstream);
    assert.equal((await GET({ signal: new AbortController().signal }, exportParams)).status, 403);
    assert.ok(cancelled);
});


test('export creation refuses a missing or foreign Origin before resolving data or creating a job', async () => {
    const { validateMerchantMutationRequest } = load('../src/lib/api/request-origin.ts', { 'next/server': { NextResponse: { json: Response.json } } });
    const { POST } = exportRoute('../src/app/api/stores/[store]/exports/route.ts', {}, undefined,
        async () => { throw new Error('Origin refusal must precede ownership reads'); }, validateMerchantMutationRequest);
    for (const origin of [null, 'https://foreign.example.invalid']) {
        const response = await POST({ headers: new Headers(origin ? { origin } : {}), nextUrl: new URL('https://merchant.example.invalid/api/stores/alpha/exports') }, exportParams);
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error.code, 'FORBIDDEN_ORIGIN');
    }
});


test('literal loopback origins survive actual NextURL normalization while aliases, ports and forwarded spoofing are refused', () => {
    const { validateMerchantMutationRequest } = load('../src/lib/api/request-origin.ts', { 'next/server': { NextResponse: { json: Response.json } } });
    for (const address of ['127.0.0.1', '[::1]']) {
        const request = new NextRequest(`http://${address}:9141/api/export`, { headers: { host: `${address}:9141`, origin: `http://${address}:9141` } });
        assert.equal(request.nextUrl.hostname, 'localhost', 'exercise installed NextURL normalization');
        assert.equal(validateMerchantMutationRequest(request, { requireKey: false }), null);
        const alias = new NextRequest(`http://${address}:9141/api/export`, { headers: { host: `${address}:9141`, origin: 'http://localhost:9141' } });
        assert.equal(validateMerchantMutationRequest(alias, { requireKey: false }).status, 403);
    }
    for (const headers of [
        { host: 'localhost:9141', origin: 'http://127.0.0.1:9141', 'x-forwarded-host': '127.0.0.1:9141' },
        { host: '127.0.0.1:9142', origin: 'http://127.0.0.1:9142' },
        { host: '127.0.0.1:9141', origin: 'http://127.0.0.1:9142' },
    ]) {
        const request = new NextRequest('http://localhost:9141/api/export', { headers });
        assert.equal(validateMerchantMutationRequest(request, { requireKey: false }).status, 403);
    }
    const publicRequest = new NextRequest('https://merchant.example.invalid/api/export', { headers: { host: 'merchant.example.invalid', origin: 'https://merchant.example.invalid', 'X-Idempotency-Key': 'stable-synthetic-key' } });
    assert.equal(validateMerchantMutationRequest(publicRequest), null);
});

test('sign-in return uses the configured app origin and preserves the merchant path/query', () => {
    const { proxy } = load('../src/proxy.ts', {
        'next/server': { NextResponse: { redirect: value => Response.redirect(value, 307), next: () => new Response() } },
        '@letbuyy/auth-core': { LETBUYY_MERCHANT_SESSION_COOKIE: 'lb_session', verifyLetbuyySessionCookieValue: () => ({ accepted: false }) },
        '@/lib/public-urls': { getAccountsUrl: path => 'http://127.0.0.1:9162' + path, getAdminUrl: () => 'http://127.0.0.1:9141' },
    });
    const request = new NextRequest('http://127.0.0.1:9141/snazz/products?status=draft', { headers: { host: 'untrusted.example.invalid', 'x-forwarded-host': 'untrusted.example.invalid' } });
    const location = new URL(proxy(request).headers.get('Location'));
    assert.equal(location.origin, 'http://127.0.0.1:9162');
    assert.equal(location.searchParams.get('return_to'), 'http://127.0.0.1:9141/snazz/products?status=draft');
});
