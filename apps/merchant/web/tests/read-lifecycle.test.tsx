import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'

const requireUI = createRequire(new URL('../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom')
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
const json = (data: unknown, status = 200) => Response.json({ data }, { status })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const contentPages = {
    categories: () => import('../src/app/[store]/categories/page'),
    certifications: () => import('../src/app/[store]/certifications/page'),
    comments: () => import('../src/app/[store]/comments/page'),
    contact: () => import('../src/app/[store]/contact/page'),
    coupons: () => import('../src/app/[store]/coupons/page'),
    education: () => import('../src/app/[store]/education/page'),
    experience: () => import('../src/app/[store]/experience/page'),
    gallery: () => import('../src/app/[store]/gallery/page'),
    leads: () => import('../src/app/[store]/leads/page'),
    pages: () => import('../src/app/[store]/pages/page'),
    posts: () => import('../src/app/[store]/posts/page'),
    projects: () => import('../src/app/[store]/projects/page'),
    reviews: () => import('../src/app/[store]/reviews/page'),
    skills: () => import('../src/app/[store]/skills/page'),
    testimonials: () => import('../src/app/[store]/testimonials/page'),
}
const readPages = {
    ...contentPages,
    aiStudio: () => import('../src/app/[store]/ai/page'),
    operationsDashboard: () => import('../src/app/[store]/products/operations-dashboard/page'),
    exportPage: () => import('../src/app/[store]/export/page'),
    generalSettings: () => import('../src/app/[store]/settings/general/page'),
    checkoutSettings: () => import('../src/app/[store]/settings/checkout/page'),
    policySettings: () => import('../src/app/[store]/settings/policies/page'),
    notificationSettings: () => import('../src/app/[store]/settings/notifications/page'),
    businessSettings: () => import('../src/app/[store]/settings/business/page'),
    storefrontPages: () => import('../src/app/[store]/online-store/pages/page'),
    segments: () => import('../src/app/[store]/customers/segments/page'),
    inventory: () => import('../src/app/[store]/products/inventory/page'),
    planSettings: () => import('../src/app/[store]/settings/plan/page'),
    themeUpdate: () => import('../src/app/[store]/online-store/themes/update/UpdatePageClient'),

}

test('AI Studio renders the authoritative balance, all credit sources and canonical usage fields', async () => {
    const h=await mount('aiStudio',async()=>json({credits:{store_id:'11111111-1111-4111-8111-111111111111',
        plan_credits:3000,bonus_credits:10,total_purchased:20,total_used:2206,balance:824},
        usage:[{id:'22222222-2222-4222-8222-222222222222',feature:'custom',tokens_input:10,tokens_output:7,credits_used:2,created_at:null}]}));
    try {
        assert.match(h.text(),/Credits remaining824/);
        assert.match(h.text(),/3,030 total credits/);
        assert.match(h.text(),/Latest 20 AI usage events/);
        assert.doesNotMatch(h.text(),/NaN|Invalid Date/);
        assert.match(h.text(),/custom17/);
    } finally {await h.close()}
});

test('AI Studio treats missing credit authority as unavailable instead of a zero-credit success', async () => {
    const h=await mount('aiStudio',async()=>json({usage:[]}));
    try {assert.match(h.text(),/AI credit information is unavailable/)} finally {await h.close()}
});

test('operations panels settle independently and page only the requested identity-bound collection', async () => {
    const calls:string[]=[];
    const pendingSupplier=deferred<Response>();
    const h=await mount('operationsDashboard',async url=>{
        calls.push(url);
        if(url.includes('supplier-metrics')) return pendingSupplier.promise;
        if(url.includes('warehouse-metrics')) return json({warehouses:[{location_id:'location-a',location_name:url.includes('page=2')?'Second location':'First location',is_default:false,sku_count:1100,total_units:9900}],meta:{page:url.includes('page=2')?2:1,per_page:20,total:21,total_pages:2,has_next:!url.includes('page=2'),has_prev:url.includes('page=2')}});
        if(url.includes('transfer-metrics')) return json({by_status:{shipped:1100,received:3},in_transit_count:1100,total_count:1103});
        return json({order_count:3});
    });
    try {
        assert.match(h.text(),/1103/);
        assert.match(h.text(),/First location/);
        const before=calls.length;
        await h.click('Next locations');
        assert.equal(calls.length,before+1);
        assert.match(calls.at(-1)!,/warehouse-metrics\?page=2/);
        assert.match(h.text(),/Second location/);
        await h.render('beta');
        assert.match(calls.filter(url=>url.includes('/beta/')&&url.includes('warehouse-metrics'))[0],/page=1/);
        pendingSupplier.resolve(json({suppliers:[],meta:{page:1,per_page:20,total:0,total_pages:0,has_next:false,has_prev:false}}));
        await h.pause(0);
    } finally {await h.close()}
});
type ContentPage = keyof typeof readPages
type Transport = (url: string, init?: RequestInit) => Promise<Response>

async function mount(kind: ContentPage | 'orders' | 'customers' | 'analytics' | 'search' | 'notifications' | 'purchasing' | 'transfers' | 'assistant' | 'themeLibrary' | 'previewUpdate' | 'loyalty', transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/alpha/orders' })
    const domGlobals = ['window', 'document', 'navigator', 'self', 'localStorage', 'MutationObserver', 'HTMLElement', 'Element']
    const previous = Object.fromEntries([...domGlobals, 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of domGlobals) Object.defineProperty(globalThis, name, {
        configurable: true, writable: true, value: name === 'window' || name === 'self' ? dom.window : dom.window[name],
    })
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../src/components/security/MerchantSecurityContext')
    const Component: React.ElementType = kind === 'themeLibrary' ? (await import('../src/components/theme-library/ThemeLibraryWorkspace')).ThemeLibraryWorkspace
        : kind === 'previewUpdate' ? (await import('../src/components/theme-editor/ThemeUpdatePanel')).default
        : kind === 'loyalty' ? (await import('../src/components/settings/LoyaltySettings')).LoyaltySettings
        : kind in readPages ? (await readPages[kind as ContentPage]()).default
        : kind === 'orders' ? (await import('../src/app/[store]/orders/page')).default
        : kind === 'customers' ? (await import('../src/app/[store]/customers/page')).default
        : kind === 'analytics' ? (await import('../src/app/[store]/analytics/page')).default
        : kind === 'search' ? (await import('../src/components/CommandPalette')).default
        : kind === 'purchasing' ? (await import('../src/app/[store]/products/purchase-orders/page')).default
        : kind === 'transfers' ? (await import('../src/app/[store]/products/transfers/page')).default
        : kind === 'assistant' ? (await import('../src/components/AISidebar')).default
        : (await import('../src/components/NotificationsPanel')).default
    const root = createRoot(dom.window.document.getElementById('root')!)
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', actorId = 'actor-a') => {
        await act(async () => root.render(
            <AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store }}>
                <ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId, store }}>
                    <Component actorId={actorId} currentVersionId="current-version" availableVersionId="next-version" themeSlug="synthetic-theme" storeId={kind === 'previewUpdate' ? store : kind === 'themeLibrary' ? null : 'site-a'} store={store} storeName="Synthetic Store" siteType="store" onClose={() => {}} storeData={{ id: 'site-a', name: 'Synthetic Store', store_name: 'Synthetic Store', subdomain: store, site_type: 'store', status: 'draft', trial_ends_at: null, trial_status: null, theme_id: 'modern', theme_settings: null, custom_domain: null }} />
                </MerchantSecurityContext.Provider></ToastProvider>
            </PathParamsContext.Provider></AppRouterContext.Provider>,
        ))
    }
    await render()
    return {
        render,
        text: () => dom.window.document.body.textContent || '',
        controls: () => [...dom.window.document.querySelectorAll('input,textarea,select,[role="switch"]')].map((node: Element) => ({ value: (node as HTMLInputElement).value, checked: (node as HTMLInputElement).checked, ariaChecked: node.getAttribute('aria-checked') })),
        async type(value: string) {
            const input = dom.window.document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            assert.ok(input, 'real search input')
            await act(async () => {
                Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
                input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
            })
        },
        async pause(ms = 300) { await act(async () => { await new Promise(done => setTimeout(done, ms)) }) },
        async click(label: string) {
            const button = [...dom.window.document.querySelectorAll('button')].find(item => item.textContent?.trim() === label)
            assert.ok(button, `Missing button ${label}: ${dom.window.document.body.textContent}`)
            await act(async () => button.click())
        },
        async file(file: { name: string; size: number; text(): Promise<string> }) {
            const input = dom.window.document.querySelector('input[type="file"]') as HTMLInputElement
            assert.ok(input, 'real file input')
            Object.defineProperty(input, 'files', { configurable: true, value: [file] })
            await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
        },
        async close() {
            await act(async () => root.unmount()); dom.window.close()
            for (const [name, descriptor] of Object.entries(previous)) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor)
                else Reflect.deleteProperty(globalThis, name)
            }
        },
    }
}

for (const kind of ['orders', 'customers'] as const) {
    test(`${kind} search coalesces rapid typing into one applied query`, async () => {
        const calls: string[] = []
        const h = await mount(kind, async url => { calls.push(url); return json([]) })
        try {
            const start = calls.length
            for (const value of ['n', 'no', 'note']) { await h.type(value); await h.pause(30) }
            assert.equal(calls.length, start, 'typing must not launch a request per key')
            await h.pause()
            assert.equal(calls.length, start + 1)
            assert.match(calls.at(-1)!, /search=note/)
        } finally { await h.close() }
    })
    test(`${kind} retires late old-store data even when transport ignores abort`, async () => {
        const old = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount(kind, async (url, init) => {
            if (url.includes('shipping/zones')) return json({ provider_mode: 'mock' })
            if (init?.signal) signals.push(init.signal)
            if (url.includes('/alpha/')) return old.promise
            return json([])
        })
        try {
            await h.render('beta')
            assert.ok(signals[0]?.aborted, 'retiring the scope also cancels the supported transport')
            await act(async () => old.resolve(json([{ id: 'old-row', order_number: 'PRIVATE-OLD-ORDER', email: 'old@example.invalid', full_name: 'PRIVATE-OLD-CUSTOMER', status: 'active', created_at: '2026-10-21' }])))
            assert.doesNotMatch(h.text(), /PRIVATE-OLD-/)
        } finally { await h.close() }
    })
}

test('command search waits for typing to pause before its three bounded resource reads', async () => {
    const calls: string[] = []
    const h = await mount('search', async url => { calls.push(url); return json([]) })
    try {
        for (const value of ['no', 'not', 'note']) { await h.type(value); await h.pause(30) }
        assert.equal(calls.length, 0)
        await h.pause()
        assert.equal(calls.length, 3)
    } finally { await h.close() }
})

test('failed and partial notifications settle with retry rather than false empty success', async () => {
    for (const partial of [false, true]) {
        const h = await mount('notifications', async () => partial
            ? Response.json({ data: [], meta: { partial: true } }) : json(null, 503))
        try {
            assert.match(h.text(), /Notifications could not be fully loaded/)
            assert.match(h.text(), /Retry/)
            assert.doesNotMatch(h.text(), /All caught up/)
        } finally { await h.close() }
    }
})

test('notification results from a retired store cannot replace the current store', async () => {
    const old = deferred<Response>()
    const h = await mount('notifications', async url => url.includes('/alpha/') ? old.promise : json([]))
    try {
        await h.render('beta')
        await act(async () => old.resolve(json([{ id: 'old', icon: 'mail', title: 'PRIVATE OLD STORE', time: 'Now', unread: true }])))
        assert.doesNotMatch(h.text(), /PRIVATE OLD STORE/)
        assert.match(h.text(), /All caught up/)
    } finally { await h.close() }
})

for (const [kind, label] of [['purchasing', 'Create purchase order'], ['transfers', 'Create transfer']] as const) {
    test(`${kind} loads rich product options on demand and permits the next bounded page`, async () => {
        const calls: string[] = []
        const h = await mount(kind, async url => {
            calls.push(url)
            if (url.includes('inventory-locations')) return json([{ id: 'location-a', name: 'A' }, { id: 'location-b', name: 'B' }])
            if (url.includes('/products?')) {
                const page = new URL(url, 'http://localhost').searchParams.get('page')
                return Response.json({ data: [{ id: `product-${page}`, name: `Product ${page}`, variants: [] }], meta: { has_next: page === '1' } })
            }
            return json([])
        })
        try {
            assert.equal(calls.filter(url => url.includes('/products?')).length, 0, 'a closed form must not preload the catalogue')
            if (kind === 'purchasing') assert.equal(calls.filter(url => url.endsWith('/suppliers')).length, 0)
            await h.click(label)
            const productReads = () => calls.filter(url => url.includes('/products?'))
            assert.equal(productReads().length, 1)
            assert.match(productReads()[0], /limit=100/)
            await h.click('Load more products')
            assert.equal(productReads().length, 2)
            assert.match(productReads()[1], /page=2/)
            assert.match(h.text(), /Product 1/)
            assert.match(h.text(), /Product 2/)
        } finally { await h.close() }
    })
}

test('setup assistant uses one maintained snapshot and keeps unknown checks distinct', async () => {
    const calls: string[] = []
    const h = await mount('assistant', async url => {
        calls.push(url)
        return json({ productsCount: 3, shippingZonesCount: 1, paymentConfigured: null, themeCustomized: true, domainConfigured: true, published: true })
    })
    try {
        assert.equal(calls.length, 1)
        assert.match(calls[0], /\/alpha\/dashboard\/setup$/)
        assert.doesNotMatch(calls[0], /store-data/)
        assert.match(h.text(), /Status unavailable/)
        assert.doesNotMatch(h.text(), /All setup tasks complete/)
    } finally { await h.close() }
})

for (const kind of Object.keys(contentPages) as ContentPage[]) {
    test(`${kind} discards a slow retired read without replacing the new store's rows`, async () => {
        const old = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount(kind, async (url, init) => {
            if (url.includes('/alpha/')) { if (init?.signal) signals.push(init.signal); return old.promise }
            return json([])
        })
        try {
            await h.render('beta')
            assert.equal(signals[0]?.aborted, true)
            await act(async () => old.resolve(json([{ id: 'old', name: 'PRIVATE-OLD', title: 'PRIVATE-OLD', content: 'PRIVATE-OLD', full_name: 'PRIVATE-OLD', email: 'old@example.invalid', code: 'PRIVATE-OLD', is_visible: true, status: 'pending', proficiency: 50, created_at: '2026-10-21' }])))
            assert.doesNotMatch(h.text(), /PRIVATE-OLD/)
        } finally { await h.close() }
    })
}

for (const kind of ['purchasing', 'transfers'] as const) {
    test(`${kind} primary records settle when optional location reads stall or fail`, async () => {
        const locations = deferred<Response>()
        const h = await mount(kind, async url => url.includes('inventory-locations') ? locations.promise : json([]))
        try {
            assert.match(h.text(), kind === 'purchasing' ? /No purchase orders yet/ : /No transfers yet/)
            await act(async () => locations.resolve(json(null,503)))
            assert.match(h.text(), /Inventory locations could not be loaded/)
            assert.match(h.text(), /Retry locations/)
            assert.doesNotMatch(h.text(), /No inventory locations|Not enough inventory locations/)
        } finally { await h.close() }
    })
}

test('theme library starts alongside catalog metadata and never flashes false empty success', async () => {
    const pending = deferred<Response>(), calls: string[] = []
    const h = await mount('themeLibrary', async url => { calls.push(url); return pending.promise })
    try {
        assert.equal(calls.length,1,'the handle-scoped library must not wait for catalog UUID metadata')
        assert.doesNotMatch(h.text(), /No themes installed yet/)
        await act(async () => pending.resolve(Response.json({data:[]})))
        assert.match(h.text(), /No themes installed yet/)
    } finally { await h.close() }
})

function settingsResponse(url: string) {
    if (url.includes('/settings')) return json({ id: 'site-a', name: 'Current store', business_profile: {}, site_settings: {} })
    if (url.includes('/navigation')) return json({ items: [] })
    if (url.includes('/localization')) return json({ locales: [], default_locale: 'en', currency: 'INR', timezone: 'Asia/Kolkata' })
    if (url.endsWith('/kyc')) return json({ overall_status: 'not_started', provider_mode: 'sandbox', required_documents: [], documents: [] })
    if (url.endsWith('/commission')) return json({ currency: 'INR', schedule: { commission_bps: 0, gst_bps: 1800 }, summary: { gross_amount_minor: 0 } })
    return json([])
}

for (const kind of ['generalSettings','checkoutSettings','policySettings','notificationSettings','businessSettings','storefrontPages','segments'] as const) {
    test(`${kind} retires a previous store's response body even when transport ignores cancellation`, async () => {
        const oldBody = deferred<unknown>()
        let held = false
        let oldSignal: AbortSignal | null | undefined
        const h = await mount(kind, async (url, init) => {
            if (url.includes('/alpha/') && !held) {
                held = true; oldSignal = init?.signal
                const response = new Response('', { status: 200 })
                response.json = () => oldBody.promise
                return response
            }
            return settingsResponse(url)
        })
        try {
            await h.render('beta')
            assert.equal(oldSignal?.aborted, true, 'old scope must stop its read')
            const currentControls = h.controls()
            const lateData = kind === 'generalSettings' || kind === 'businessSettings' || kind === 'checkoutSettings'
                ? { id: 'old-site', name: 'PRIVATE-OLD', legal_name: 'PRIVATE-OLD', business_profile: {}, site_settings: { checkout: { contact_method: 'phone', order_notes: true } } }
                : kind === 'notificationSettings' ? [{ id: 'old', channel: 'email', category: 'orders', enabled: false }]
                : [{ id: 'old', title: 'PRIVATE-OLD', name: 'PRIVATE-OLD', body: 'PRIVATE-OLD', policy_type: 'privacy', rules: {}, created_at: '2026-10-21', updated_at: '2026-10-21' }]
            await act(async () => oldBody.resolve({ data: lateData }))
            assert.ok(!h.text().includes('PRIVATE-OLD'), h.text())
            assert.deepEqual(h.controls(), currentControls, 'late old-store data must not replace editable controls')
            assert.ok(!h.text().includes('could not load'), h.text())
        } finally { await h.close() }
    })
}

test('business identity becomes editable while verification and commission are stalled', async () => {
    const optional = deferred<Response>()
    const h = await mount('businessSettings', async url => url.endsWith('/kyc') || url.endsWith('/commission') ? optional.promise : settingsResponse(url))
    try {
        assert.ok(h.text().includes('Business identity'), h.text())
        assert.ok(h.text().includes('Checking verification and settlement fees'), h.text())
    } finally { await h.close(); optional.resolve(json({})) }
})

test('business identity survives unavailable optional verification with an explicit retry', async () => {
    const h = await mount('businessSettings', async url => url.endsWith('/kyc') ? new Response('', { status: 503 }) : settingsResponse(url))
    try {
        assert.ok(h.text().includes('Business identity'), h.text())
        assert.ok(h.text().includes('Verification status could not load'), h.text())
        assert.ok(h.text().includes('Retry status'), h.text())
    } finally { await h.close() }
})

test('theme releases reuse captured merchant identity without downloading editor data', async () => {
    const calls: string[] = []
    const h = await mount('themeUpdate', async url => { calls.push(url); return json([]) })
    try {
        assert.equal(calls.length, 1, JSON.stringify(calls))
        assert.ok(calls[0].includes('/releases?'), calls[0])
        assert.ok(h.text().includes('Update theme'), h.text())
    } finally { await h.close() }
})

test('read deadline settles general settings into a recoverable error', async () => {
    const originalTimeout = AbortSignal.timeout
    AbortSignal.timeout = () => originalTimeout(5)
    const h = await mount('generalSettings', async (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Read timed out', 'TimeoutError')), { once: true })
    }))
    try {
        await h.pause(30)
        assert.ok(h.text().includes('Read timed out'), h.text())
        assert.ok(h.text().includes('Retry'), h.text())
    } finally { await h.close(); AbortSignal.timeout = originalTimeout }
})

for (const kind of ['loyalty', 'previewUpdate'] as const) {
    test(`${kind} stalled reads settle into a retry after the read deadline`, async () => {
        const originalTimeout = AbortSignal.timeout
        AbortSignal.timeout = () => originalTimeout(5)
        const h = await mount(kind, async (_url, init) => new Promise((_resolve, reject) => {
            const fail = () => reject(new DOMException('Read timed out', 'TimeoutError'))
            if (init?.signal?.aborted) fail()
            else init?.signal?.addEventListener('abort', fail, { once: true })
        }))
        try {
            if (kind === 'previewUpdate') await h.click('Preview update')
            await h.pause(30)
            assert.match(h.text(), /Read timed out/)
            assert.match(h.text(), kind === 'loyalty' ? /Retry loading loyalty/ : /Preview update/)
            assert.doesNotMatch(h.text(), /Loading loyalty settings|Previewing\.\.\./)
        } finally { await h.close(); AbortSignal.timeout = originalTimeout }
    })
}

test('loyalty scope retirement cancels the old read and refuses its late snapshot', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('loyalty', async (url, init) => {
        if (url.includes('/alpha/')) { signals.push(init!.signal!); return old.promise }
        return Response.json({ success: true, data: { store_id: 'beta', enrolled: false, program: null, outstanding_points: '0', valuation_policy: 'block_decrease_while_outstanding', value_decrease_allowed: true } })
    })
    try {
        await h.render('beta')
        assert.ok(signals[0]?.aborted)
        await act(async () => old.resolve(Response.json({ success: true, data: { store_id: 'alpha', enrolled: false, program: null, outstanding_points: '777777', valuation_policy: 'block_decrease_while_outstanding', value_decrease_allowed: true } })))
        assert.match(h.text(), /Loyalty is not set up/)
        assert.doesNotMatch(h.text(), /777,777/)
    } finally { await h.close() }
})

test('theme preview retires a successful old-store body before it can supply an apply hash', async () => {
    const body = deferred<unknown>(), signals: AbortSignal[] = []
    const h = await mount('previewUpdate', async (_url, init) => {
        signals.push(init!.signal!)
        return { ok: true, json: () => body.promise } as Response
    })
    try {
        await h.click('Preview update')
        await h.render('beta')
        assert.ok(signals[0]?.aborted)
        await act(async () => body.resolve({ diff: { diffHash: 'PRIVATE-OLD-DIFF', compatible: true, requiresDuplicate: false, rows: [] } }))
        assert.match(h.text(), /Preview update/)
        assert.doesNotMatch(h.text(), /Refresh preview|PRIVATE-OLD-DIFF/)
    } finally { await h.close() }
})

test('inventory reaches later records through bounded pages instead of loading all stock levels', async () => {
    const calls: string[] = []
    const h = await mount('inventory', async url => {
        calls.push(url)
        const second = url.includes('page=2')
        return Response.json({ data: [{ id: second ? 'b' : 'a', product_id: 'p', product_name: second ? 'Later stock level' : 'First stock level', available: 5 }], meta: { total: 101, has_next: !second } })
    })
    try {
        assert.ok(h.text().includes('101 tracked'), h.text())
        await h.click('Next page')
        assert.ok(h.text().includes('Later stock level'), h.text())
        assert.ok(!h.text().includes('First stock level'), h.text())
        assert.equal(calls.length,2,JSON.stringify(calls))
        assert.ok(calls.every(url => url.includes('limit=100')),JSON.stringify(calls))
        assert.ok(calls[1].includes('page=2'),calls[1])
    } finally { await h.close() }
})

test('plan status and paid amount settle while optional catalog descriptions are stalled', async () => {
    const catalog = deferred<Response>()
    const h = await mount('planSettings', async url => url.startsWith('/api/plans?') ? catalog.promise : json({ store: { site_type: 'store' }, subscription: { id: 'sub', plan: 'growth', plan_name: 'Growth', status: 'active', billing_period: 'monthly', amount_paid: 2500 } }))
    try {
        assert.ok(h.text().includes('Growth'),h.text())
        assert.ok(h.text().includes('paid'),h.text())
    } finally { await h.close(); catalog.resolve(json([])) }
})


test('export queues the canonical job, never downloads list pages, and exposes the complete ready file', async () => {
    const calls: string[] = [], ready = deferred<Response>()
    const h = await mount('exportPage', async (url, init) => {
        calls.push(`${init?.method || 'GET'} ${url}`)
        if (init?.method === 'POST') return json({ job: { id: 'export-a', type: 'products', status: 'queued', row_count: 0 } }, 202)
        return ready.promise
    })
    try {
        await h.click('Export Products')
        assert.match(h.text(), /Preparing export/)
        assert.deepEqual(calls, ['POST /api/stores/alpha/exports', 'GET /api/stores/alpha/exports/export-a'])
        await act(async () => ready.resolve(json({ job: { id: 'export-a', type: 'products', status: 'completed', row_count: 1103 } })))
        assert.match(h.text(), /1,103 records are ready/)
        const link = document.querySelector('a[download]')
        assert.equal(link?.getAttribute('href'), '/api/stores/alpha/exports/export-a/download')
        assert.equal(link?.getAttribute('download'), 'products.csv')
    } finally { await h.close() }
})

test('export polling retry checks the same job without starting another export', async () => {
    const calls: string[] = []
    const h = await mount('exportPage', async (url, init) => {
        calls.push(`${init?.method || 'GET'} ${url}`)
        if (init?.method === 'POST') return json({ job: { id: 'export-a', type: 'products', status: 'queued', row_count: 0 } }, 202)
        return calls.length === 2 ? new Response('', { status: 503 }) : json({ job: { id: 'export-a', type: 'products', status: 'completed', row_count: 0 } })
    })
    try {
        await h.click('Export Products')
        assert.match(h.text(), /Unable to check export/)
        await h.click('Check again')
        assert.match(h.text(), /Export ready/)
        assert.equal(calls.filter(call => call.startsWith('POST')).length, 1)
        assert.equal(calls.filter(call => call.startsWith('GET')).length, 2)
    } finally { await h.close() }
})

test('export scope retirement cancels polling and refuses a late old-store ready file', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('exportPage', async (_url, init) => {
        if (init?.method === 'POST') return json({ job: { id: 'private-old', type: 'products', status: 'queued', row_count: 0 } }, 202)
        signals.push(init!.signal!); return old.promise
    })
    try {
        await h.click('Export Products')
        await h.render('beta')
        assert.ok(signals[0].aborted)
        await act(async () => old.resolve(json({ job: { id: 'private-old', type: 'products', status: 'completed', row_count: 777777 } })))
        assert.doesNotMatch(h.text(), /Export ready|777,777/)
        assert.equal(document.querySelector('a[download]'), null)
    } finally { await h.close() }
})


test('export retires a captured account even when the store URL is unchanged', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('exportPage', async (_url, init) => {
        if (init?.method === 'POST') return json({ job: { id: 'old-actor-job', type: 'products', status: 'queued', row_count: 0 } }, 202)
        signals.push(init!.signal!); return old.promise
    })
    try {
        await h.click('Export Products')
        await h.render('alpha', 'actor-b')
        assert.ok(signals[0].aborted)
        await act(async () => old.resolve(json({ job: { id: 'old-actor-job', type: 'products', status: 'completed', row_count: 777777 } })))
        assert.doesNotMatch(h.text(), /Export ready|777,777/)
        assert.equal(document.querySelector('a[download]'), null)
    } finally { await h.close() }
})

test('CSV import rejects an oversized file before reading it or sending a command', async () => {
    let reads = 0, commands = 0
    const h = await mount('exportPage', async () => { commands++; throw new Error('unexpected command') })
    try {
        await h.file({ name: 'large.csv', size: 3 * 1_048_576 + 1, text: async () => { reads++; return '' } })
        await h.click('Import CSV')
        assert.match(h.text(), /This CSV is too large/)
        assert.equal(reads, 0)
        assert.equal(commands, 0)
    } finally { await h.close() }
})

test('CSV import checks the same job after a read failure and displays the committed row count', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const h = await mount('exportPage', async (url, init) => {
        calls.push({ url, init })
        if (init?.method === 'POST') return json({ job: { id: 'import-a', type: 'product_import', status: 'queued', row_count: 0 } }, 202)
        if (calls.length === 2) return new Response('', { status: 503 })
        return json({ job: { id: 'import-a', type: 'product_import', status: 'completed', row_count: 2 } })
    })
    try {
        const csv = 'name,description\r\n"東京","  First\r\nSecond  "\r\n'
        await h.file({ name: 'quoted.csv', size: Buffer.byteLength(csv), text: async () => csv })
        await h.click('Import CSV')
        assert.match(h.text(), /Unable to check import/)
        await h.click('Check import again')
        assert.match(h.text(), /Import complete[\s\S]*2 products imported/)
        assert.equal(calls.length, 3)
        assert.deepEqual(calls.map(call => call.url), ['/api/stores/alpha/products/import', '/api/stores/alpha/exports/import-a', '/api/stores/alpha/exports/import-a'])
        assert.equal(calls[0].init?.body, JSON.stringify({ csv }))
        assert.equal(calls[0].init?.signal, undefined, 'progress read deadlines do not abort or replay the import command')
        assert.equal(document.querySelector('a[download]'), null, 'imports never expose an export download action')
    } finally { await h.close() }
})

test('CSV import retires late status and command acknowledgements when the captured account changes', async () => {
    for (const stage of ['command', 'status'] as const) {
        const late = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount('exportPage', async (_url, init) => {
            if (init?.method === 'POST') return stage === 'command' ? late.promise : json({ job: { id: 'old-import', type: 'product_import', status: 'queued', row_count: 0 } }, 202)
            signals.push(init!.signal!); return late.promise
        })
        try {
            await h.file({ name: 'old.csv', size: 11, text: async () => 'name\nItem\n' })
            await h.click('Import CSV')
            await h.render('alpha', 'actor-b')
            if (stage === 'status') assert.ok(signals[0]?.aborted)
            await act(async () => late.resolve(json({ job: { id: 'old-import', type: 'product_import', status: 'completed', row_count: 777777 } })))
            assert.doesNotMatch(h.text(), /777,777|Import complete|import-a|old-import/)
            if (stage === 'command') assert.doesNotMatch(h.text(), /Import queued/)
        } finally { await h.close() }
    }
})

test('CSV import lost acknowledgement reports uncertainty and never automatically replays the command', async () => {
    let commands = 0
    const h = await mount('exportPage', async () => { commands++; throw new TypeError('fetch failed') })
    try {
        await h.file({ name: 'import.csv', size: 10, text: async () => 'name\nItem\n' })
        await h.click('Import CSV')
        assert.match(h.text(), /could not be confirmed[\s\S]*Some products may already exist/)
        assert.equal(commands, 1)
        assert.doesNotMatch(h.text(), /Import complete|Import queued/)
    } finally { await h.close() }
})
