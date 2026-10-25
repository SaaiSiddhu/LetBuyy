// Mount the real shared editor, Next contexts and UI. Synthetic HTTP responses
// prove client recovery; the separate owned Gateway suite proves durable effects.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { ApparelFactsSchema, GiftFactsSchema, ProductEditVariantSchema } from '@letbuyy/commerce-core'
import type { ProductFormSnapshot } from '../../lib/product-form-state'

const requireUI = createRequire(new URL('../../../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom')
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
const id = '11111111-1111-4111-8111-111111111111'
const variantId = '22222222-2222-4222-8222-222222222222'
const actorId = '44444444-4444-4444-8444-444444444444'
const row = (version = 7, name = 'Original product', productId = id) => ({
    id: productId, store_id: '33333333-3333-4333-8333-333333333333', version, name,
    description: 'Synthetic product', price: 100, stock: 5, images: [], is_active: true,
    product_options: [{ name: 'Size', position: 0, values: ['M'] }],
    variants: [{ id: variantId, title: 'M', option1: 'M', price: 100, inventory_qty: 5, sku: 'OLD-SKU' }],
})
const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { data } : { error: data }), {
    status, headers: { 'content-type': 'application/json' },
})
type Transport = (url: string, init?: RequestInit) => Promise<Response>
async function editFact(container: HTMLElement, label: string, value: string) {
    const scope = container.querySelector('[aria-label="Product-specific facts"]')!
    const fieldLabel = [...scope.querySelectorAll('label')].find(item => item.textContent?.trim() === label)
    assert.ok(fieldLabel, `Missing fact control: ${label}`)
    const element = document.getElementById(fieldLabel.htmlFor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    assert.ok(element)
    await act(async () => {
        const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
        element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
}
async function clickMedia(container: HTMLElement, label: string) {
    const element = [...container.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label)
    assert.ok(element, `Missing media action ${label}`); assert.equal(element.disabled, false)
    await act(async () => element.click())
}
async function uploadSyntheticMedia(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    assert.ok(input)
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['synthetic only'], 'fixture.webp', { type: 'image/webp' })] })
    await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })))
}
const openGiftImage = 'https://cdn.example.test/open.webp', closedGiftImage = 'https://cdn.example.test/closed.webp'
const giftProduct = () => ({ ...row(), images: [openGiftImage, closedGiftImage], metadata: {
    privateSupplier: { reference: 'KEEP_PRIVATE' }, books: { kind: 'book', language: 'Hindi' },
    gifts: { schemaVersion: 1, suitabilityNote: 'Original gift note.', contents: [{ label: 'Mug', quantity: 1 }], mediaRoles: { openBox: 0, closedBox: 1 } },
} })
const giftFacts = (body: Record<string, unknown>) => GiftFactsSchema.parse((body.metadata as Record<string, unknown>).gifts)
const mediaSources = (container: HTMLElement) => [...container.querySelectorAll('img[alt^="Product media "]')].map(image => image.getAttribute('src'))
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

async function mount(transport: Transport, initialProductId = id) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/' + id })
    const names = ['window', 'document', 'navigator', 'fetch', 'HTMLElement', 'Element', 'MutationObserver']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 3)) Object.defineProperty(globalThis, name, { configurable: true, writable: true,
        value: name === 'window' ? dom.window : dom.window[name] })
    for (const name of names.slice(4)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('marketplace-listings')
        ? Promise.resolve(json(null)) : transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../security/MerchantSecurityContext')
    const { MerchantNavigationProvider } = await import('../MerchantNavigationProvider')
    const { default: ProductEditor } = await (async () => {
        const previousCssLoader = requireUI.extensions['.css']
        requireUI.extensions['.css'] = module => { module.exports = {} }
        try { return await import('../../app/[store]/products/new/page') }
        finally {
            if (previousCssLoader) requireUI.extensions['.css'] = previousCssLoader
            else delete requireUI.extensions['.css']
        }
    })()
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let editorKey = 0
    const departures: string[] = []
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push(href: string) { departures.push(href) }, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', productId = id) => { await act(async () => {
        root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store, productId }}>
            <MerchantNavigationProvider><ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId, store }}>
                <a href={`/${store}/products`}>Leave editor</a><ProductEditor key={editorKey} />
            </MerchantSecurityContext.Provider></ToastProvider></MerchantNavigationProvider>
        </PathParamsContext.Provider></AppRouterContext.Provider>)
    }) }
    await render('alpha', initialProductId)
    const remount = async () => { editorKey += 1; await render() }
    const button = (label: string) => {
        const element = [...dom.window.document.querySelectorAll('button')].find((item: any) => item.textContent.trim() === label) as HTMLButtonElement | undefined
        assert.ok(element, `Missing button ${label}: ${container.textContent}`)
        return element
    }
    const click = async (label: string) => { await act(async () => { button(label).click() }) }
    const title = () => {
        const label = [...container.querySelectorAll('label')].find((item: any) => item.textContent.trim() === 'Title') as HTMLLabelElement | undefined
        assert.ok(label, 'real editor title label')
        const element = container.ownerDocument.getElementById(label.htmlFor) as HTMLInputElement
        assert.ok(element)
        return element
    }
    const setInput = async (element: HTMLInputElement, value: string) => { await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(element, value)
        element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    }) }
    const setTitle = (value: string) => setInput(title(), value)
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    const leave = async () => { await act(async () => { (container.querySelector('a') as HTMLAnchorElement).click() }) }
    return { container, render, remount, button, click, title, setTitle, setInput, close, leave, departures }
}

test('dirty departure keeps actual product input on Stay and clears only the explicit discarded draft', async () => {
    const h = await mount(async () => json(row()))
    try {
        await h.setTitle('Protected edit'); await h.leave()
        assert.deepEqual(h.departures, [])
        await h.click('Stay'); assert.equal(h.title().value, 'Protected edit')
        await h.leave(); await h.click('Discard and leave')
        assert.deepEqual(h.departures, ['/alpha/products'])
        assert.equal(h.title().value, 'Original product')
        assert.equal(window.sessionStorage.getItem(`letbuyy.product-edit.v1:${actorId}:alpha:${id}:unsaved`), null)
    } finally { await h.close() }
})

test('Save and leave waits for the actual acknowledged version and preserves failed validation', async () => {
    const reply = deferred<Response>()
    const h = await mount(async (_url, init) => init?.method === 'PATCH' ? reply.promise : json(row()))
    try {
        await h.setTitle(''); await h.leave(); await h.click('Save and leave')
        assert.deepEqual(h.departures, [])
        assert.equal(h.title().value, '')
        await h.click('Stay'); await h.setTitle('Acknowledged edit'); await h.leave()
        await h.click('Save and leave')
        assert.deepEqual(h.departures, [])
        assert.equal(h.button('Discard and leave').disabled, true)
        await act(async () => { reply.resolve(json(row(11, 'Acknowledged edit'))) })
        assert.deepEqual(h.departures, ['/alpha/products'])
    } finally { reply.resolve(json(row())); await h.close() }
})

test('departure requested during a running save waits for acknowledgement and then continues', async () => {
    const reply = deferred<Response>()
    const h = await mount(async (_url, init) => init?.method === 'PATCH' ? reply.promise : json(row()))
    try {
        await h.setTitle('Already saving'); await h.click('Save product'); await h.leave()
        assert.deepEqual(h.departures, [])
        assert.equal(h.button('Discard and leave').disabled, true)
        await act(async () => { reply.resolve(json(row(11, 'Already saving'))) })
        assert.deepEqual(h.departures, ['/alpha/products'])
        assert.equal(document.querySelector('[role="dialog"]'), null)
    } finally { reply.resolve(json(row())); await h.close() }
})

test('uncertain product save cannot discard or leave; its original command is recovered', async () => {
    const bodies: string[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(row())
        bodies.push(String(init.body))
        return bodies.length === 1 ? json({ code: 'UNAVAILABLE', message: 'Unknown outcome' }, 503) : json(row(12, 'Captured edit'))
    })
    try {
        await h.setTitle('Captured edit'); await h.click('Save product'); await h.leave()
        assert.equal(h.button('Discard and leave').disabled, true)
        assert.deepEqual(h.departures, [])
        await h.click('Save and leave')
        assert.equal(bodies.length, 2); assert.equal(bodies[1], bodies[0])
        assert.deepEqual(h.departures, ['/alpha/products'])
    } finally { await h.close() }
})

test('an ordinary unsaved edit survives remount as a reviewable draft without auto-overwriting the record', async () => {
    const h = await mount(async () => json(row()))
    try {
        await h.setTitle('Recovered unsaved edit'); await h.remount()
        assert.equal(h.title().value, 'Original product')
        await h.click('Restore draft')
        assert.equal(h.title().value, 'Recovered unsaved edit')
        await h.render('beta')
        assert.equal(h.title().value, 'Original product')
        assert.doesNotMatch(h.container.textContent!, /Unsaved product draft found/)
    } finally { await h.close() }
})

test('actual editor preserves a conflicted draft until explicit latest reload, then sends its exact version', async () => {
    let current = row(), first = true
    const calls: Record<string, any>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body)
        if (first) { first = false; current = row(23, 'Server winner'); return json({ code: 'PRODUCT_VERSION_CONFLICT', message: 'Product changed. Your draft is kept.' }, 409) }
        current = { ...current, ...body, version: 29 }; return json(current)
    })
    try {
        await h.setTitle('My unsaved draft'); await h.click('Save product')
        assert.equal(h.title().value, 'My unsaved draft'); assert.match(h.container.textContent!, /Server winner/)
        assert.equal(h.button('Save product').disabled, true); assert.equal(calls[0].version, 7)
        await h.click('Reload latest and discard my edits'); assert.equal(h.title().value, 'Server winner')
        await h.setTitle('Reviewed draft'); await h.click('Save product')
        assert.equal(calls[1].version, 23); assert.notEqual(calls[1].idempotency_key, calls[0].idempotency_key)
        assert.equal(calls[1].variants[0].id, variantId)
    } finally { await h.close() }
})

test('lost response retries the captured body/key and preserves a newer draft after exact recovery', async () => {
    let current = row()
    const receipts = new Map<string, typeof current>(), calls: Record<string, any>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body)
        if (receipts.has(body.idempotency_key)) return json(receipts.get(body.idempotency_key))
        current = { ...current, ...body, version: current.version + 6 }; receipts.set(body.idempotency_key, current)
        if (calls.length === 1) throw new TypeError('Synthetic response lost after commit')
        return json(current)
    })
    try {
        await h.setTitle('First save'); await h.click('Save product'); await h.setTitle('Newer unsaved draft')
        await h.click('Retry pending save'); assert.deepEqual(calls[1], calls[0])
        assert.equal(h.title().value, 'Newer unsaved draft'); assert.match(h.container.textContent!, /Your newer draft is kept/)
        await h.click('Save product'); assert.equal(calls[2].version, 13)
        assert.notEqual(calls[2].idempotency_key, calls[0].idempotency_key)
        assert.equal(calls[2].name, 'Newer unsaved draft')
    } finally { await h.close() }
})

test('missing server revision cannot become a fabricated editable version', async () => {
    let writes = 0
    const h = await mount(async (_url, init) => {
        if (init?.method === 'PATCH') writes++
        const { version: _version, ...missing } = row()
        return json(missing)
    })
    try { assert.equal(h.button('Save product').disabled, true); assert.match(h.container.textContent!, /current product version could not be loaded/); assert.equal(writes, 0) }
    finally { await h.close() }
})

test('new variant server IDs are adopted after recovering a pending save without discarding a newer scalar draft', async()=>{
    let current: Record<string, any> = row()
    const calls: Record<string, any>[] = [], receipts = new Map<string, Record<string, any>>()
    const addedId='55555555-5555-4555-8555-555555555555'
    const h=await mount(async(_url,init)=>{
        if(init?.method!=='PATCH')return json(current)
        const body=JSON.parse(String(init.body));calls.push(body)
        if(receipts.has(body.idempotency_key))return json(receipts.get(body.idempotency_key))
        current={...current,...body,version:current.version+6,variants:body.variants.map((item:Record<string,any>)=>({
            ...item,id:item.id??addedId,option1:item.options.Size,inventory_qty:item.stock,
        }))};receipts.set(body.idempotency_key,current)
        if(calls.length===1)throw new TypeError('Synthetic new-variant response lost')
        return json(current)
    })
    try {
        await h.click('Add values')
        const input=h.container.querySelector('input[placeholder="Add value"]') as HTMLInputElement
        assert.ok(input);await h.setInput(input,'L');await h.click('Add value')
        await h.setTitle('First variant save');await h.click('Save product')
        assert.equal(calls[0].variants.length,2);assert.equal(calls[0].variants[1].id,undefined)
        await h.setTitle('Newer scalar draft');await h.click('Retry pending save')
        assert.deepEqual(calls[1],calls[0]);assert.equal(h.title().value,'Newer scalar draft')
        await h.click('Save product')
        assert.equal(calls[2].version,13);assert.equal(calls[2].variants[0].id,variantId);assert.equal(calls[2].variants[1].id,addedId)
    } finally {await h.close()}
})

test('a late save from another product/store cannot replace the current editor or version', async () => {
    const pending = deferred<Response>(), entered = deferred<void>()
    const second = '44444444-4444-4444-8444-444444444444'
    const calls: Record<string, any>[] = []
    const h = await mount(async (url, init) => {
        if (init?.method !== 'PATCH') return json(url.includes(second) ? row(31, 'Second product', second) : row())
        const body = JSON.parse(String(init.body)); calls.push(body)
        if (calls.length === 1) { entered.resolve(); return pending.promise }
        return json({ ...row(37, body.name, second), ...body, version: 37 })
    })
    try {
        await h.setTitle('Old scope draft'); await h.click('Save product'); await entered.promise
        await h.render('beta', second); assert.equal(h.title().value, 'Second product')
        await act(async () => { pending.resolve(json(row(13, 'Old scope completion'))) })
        assert.equal(h.title().value, 'Second product')
        await h.setTitle('Current scope draft'); await h.click('Save product'); assert.equal(calls[1].version, 31)
    } finally { pending.resolve(json(row())); await h.close() }
})

test('pending command survives editor remount with exact key/body and retains the newer draft', async () => {
    let current = row(), lost = true
    const calls: { body: string; key: string }[] = []
    const h = await mount(async (_url, init) => {
        const headers = new Headers(init?.headers)
        assert.equal(headers.get('X-LetBuyy-Merchant-Context'), actorId)
        if (init?.method !== 'PATCH') return json(current)
        calls.push({ body: String(init.body), key: headers.get('X-Idempotency-Key')! })
        const body = JSON.parse(String(init.body))
        if (lost) { lost = false; current = row(19, body.name); return json({ code: 'LOST_COMMITTED_REPLY', message: 'Outcome unknown' }, 503) }
        if (calls.length === 2) return json(current)
        current = row(29, body.name); return json(current)
    })
    try {
        await h.setTitle('Captured pending edit'); await h.click('Save product')
        await h.setTitle('Newer unsaved draft'); await h.remount()
        assert.equal(h.title().value, 'Newer unsaved draft')
        await h.click('Retry pending save')
        assert.deepEqual(calls[1], calls[0]); assert.ok(calls[0].key)
        assert.equal(h.title().value, 'Newer unsaved draft')
        assert.equal(window.sessionStorage.getItem(`letbuyy.product-edit.v1:${actorId}:alpha:${id}`), null, 'the acknowledged command is cleared')
        const draft = JSON.parse(window.sessionStorage.getItem(`letbuyy.product-edit.v1:${actorId}:alpha:${id}:unsaved`)!)
        assert.equal(draft.snapshot.title, 'Newer unsaved draft', 'the independent unsaved edit remains recoverable')
        assert.equal(draft.version, 19, 'recovery remains bound to the acknowledged version')
        await h.click('Save product')
        assert.notEqual(calls[2].key, calls[0].key)
        assert.equal(JSON.parse(calls[2].body).version, 19)
        assert.equal(JSON.parse(calls[2].body).name, 'Newer unsaved draft')
    } finally { await h.close() }
})

test('an unreadable pending command blocks a fresh save until explicit latest review and discard', async () => {
    let writes = 0
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(row())
        writes += 1; return json(row(19, JSON.parse(String(init.body)).name))
    })
    try {
        window.sessionStorage.setItem(`letbuyy.product-edit.v1:${actorId}:alpha:${id}`, '{unreadable')
        await h.remount(); assert.equal(h.button('Save product').disabled, true)
        await h.click('Save product'); assert.equal(writes, 0)
        await h.click('Check latest product'); await h.click('Reload latest and discard my edits')
        assert.equal(window.sessionStorage.length, 0); assert.equal(h.button('Save product').disabled, true) // clean form has no new command
        await h.setTitle('Reviewed fresh edit'); assert.equal(h.button('Save product').disabled, false); await h.click('Save product'); assert.equal(writes, 1)
    } finally { await h.close() }
})


test('archived edit hydration and detail save preserve the explicit canonical status', async () => {
    const calls: Record<string, any>[] = []
    let current = { ...row(), status: 'archived', is_active: false }
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body)
        current = { ...current, ...body, version: 19 }; return json(current)
    })
    try {
        const select = [...h.container.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'active'))!
        assert.ok(select); assert.equal(select.value, 'archived'); assert.match(h.container.textContent!, /Archived product/)
        await h.setTitle('Archived details reviewed'); await h.click('Save product')
        assert.equal(calls.length, 1); assert.equal(calls[0].status, 'archived'); assert.equal(calls[0].is_active, false)
        assert.equal(calls[0].version, 7); assert.equal(current.status, 'archived')
    } finally { await h.close() }
})


test('an unmounted editor late reply cannot erase a newer instance recovery intent',async()=>{
    let current=row(),ackA=row(),ackB=row();const oldReply=deferred<Response>(),newReply=deferred<Response>();
    const calls:{body:string;key:string}[]=[];
    const h=await mount(async(_url,init)=>{
        if(init?.method!=='PATCH')return json(current);
        const body=String(init.body),parsed=JSON.parse(body),key=new Headers(init.headers).get('X-Idempotency-Key')!;
        calls.push({body,key});
        if(calls.length===1){current=ackA=row(19,parsed.name);return oldReply.promise;}
        if(calls.length===2)return json(ackA);
        if(calls.length===3){current=ackB=row(29,parsed.name);return newReply.promise;}
        throw new Error('Unexpected synthetic PATCH');
    });
    const name=`letbuyy.product-edit.v1:${actorId}:alpha:${id}`;
    try{
        await h.setTitle('Earlier command A');await h.click('Save product');assert.equal(calls.length,1);
        await h.remount();await h.click('Retry pending save');assert.equal(calls.length,2);assert.deepEqual(calls[1],calls[0]);
        await h.setTitle('New command B');await h.click('Save product');assert.equal(calls.length,3);assert.notEqual(calls[2].key,calls[0].key);
        const retained=window.sessionStorage.getItem(name);assert.ok(retained);assert.equal(JSON.parse(retained).key,calls[2].key);
        await act(async()=>oldReply.resolve(json(ackA)));
        const after=window.sessionStorage.getItem(name);
        console.info('PRODUCT_EDITOR_UNMOUNTED_REPLY_WITNESS '+JSON.stringify({scope:'real maintained editor with synthetic HTTP only',patches:calls.length,oldKey:calls[0].key,newKey:calls[2].key,newRecoveryPresentBefore:true,newRecoveryPresentAfter:after!==null,originalCommandReplayedExactly:JSON.stringify(calls[0])===JSON.stringify(calls[1]),actualBackendCalls:0,databaseLossProven:false}));
        assert.equal(after,retained,'A late reply from the unmounted instance must not erase the newer instance pending command');
    }finally{await act(async()=>{oldReply.resolve(json(ackA));newReply.resolve(json(ackB));});await h.close();}
});


test('invalid product save associates the title error and focuses its correction without dispatch', async () => {
    let writes = 0
    const h = await mount(async (_url, init) => { if (init?.method === 'PATCH') writes += 1; return json(row()) })
    try {
        await h.setTitle(''); await h.click('Save product')
        assert.equal(writes, 0)
        assert.equal(h.title().getAttribute('aria-invalid'), 'true')
        assert.equal(document.activeElement, h.title())
        const errorId = h.title().getAttribute('aria-describedby')!
        assert.match(document.getElementById(errorId)!.textContent!, /Add a product title/)
        assert.deepEqual(h.departures, [])
    } finally { await h.close() }
})

test('real shared editor saves and clears food facts without losing another namespace or private metadata', async () => {
    let current: Record<string, unknown> = { ...row(), metadata: { privateSupplier: 'KEEP', food: { ingredients: 'Original lentils' }, books: { kind: 'book', language: 'Hindi' } } }
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }
        return json(current)
    })
    try {
        await editFact(h.container, 'Ingredients (optional)', 'Edited lentils')
        await h.click('Save product')
        const saved = calls[0].metadata as Record<string, unknown>
        assert.equal((saved.food as Record<string, unknown>).ingredients, 'Edited lentils')
        assert.equal((saved.books as Record<string, unknown>).language, 'Hindi')
        assert.equal(saved.privateSupplier, 'KEEP'); assert.equal(calls[0].version, 7)
        await h.click('Clear all food facts'); await h.click('Save product')
        const cleared = calls[1].metadata as Record<string, unknown>
        assert.equal(cleared.food, undefined); assert.equal(cleared.privateSupplier, 'KEEP')
        assert.equal((cleared.books as Record<string, unknown>).language, 'Hindi')
        assert.equal(calls[1].version, 8)
    } finally { await h.close() }
})

test('unfinished niche draft survives remount and cannot dispatch a fresh product save', async () => {
    let patches = 0
    const h = await mount(async (_url, init) => { if (init?.method === 'PATCH') patches++; return json(row()) })
    try {
        await editFact(h.container, 'Product facts category', 'personalization')
        await h.click('Add personalization facts'); await h.click('Save product')
        assert.equal(patches, 0); assert.match(h.container.textContent!, /Check product facts/)
        await h.remount(); await h.click('Restore draft')
        await editFact(h.container, 'Product facts category', 'personalization')
        assert.match(h.container.textContent!, /Complete or correct the personalization facts/)
        await h.click('Save product'); assert.equal(patches, 0)
        assert.equal(h.title().value, 'Original product')
    } finally { await h.close() }
})

test('new invalid facts cannot block recovery of an earlier immutable save command', async () => {
    let current: Record<string, unknown> = { ...row(), metadata: { food: { ingredients: 'Original lentils' } } }
    const calls: string[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push(String(init.body))
        if (calls.length === 1) {
            current = { ...current, ...JSON.parse(calls[0]), version: 13 }
            return json({ code: 'UNAVAILABLE', message: 'Unknown save result' }, 503)
        }
        return json(current)
    })
    try {
        await editFact(h.container, 'Ingredients (optional)', 'Earlier accepted lentils')
        await h.click('Save product')
        await editFact(h.container, 'Product facts category', 'personalization')
        await h.click('Add personalization facts')
        await h.click('Retry pending save')
        assert.equal(calls.length, 2); assert.equal(calls[1], calls[0])
        assert.match(h.container.textContent!, /newer draft is kept/)
        assert.match(h.container.textContent!, /Complete or correct the personalization facts/)
        await h.click('Save product'); assert.equal(calls.length, 2)
    } finally { await h.close() }
})

test('actual image reorder rebases gift views and a later explicit selection uses the current image order', async () => {
    const alternate = 'https://cdn.example.test/alternate-open.webp'
    let current: Record<string, unknown> = { ...giftProduct(), images: [openGiftImage, closedGiftImage, alternate] }
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }; return json(current)
    })
    try {
        assert.deepEqual(mediaSources(h.container), [openGiftImage, closedGiftImage, alternate])
        await clickMedia(h.container, 'Move product media 3 earlier')
        await clickMedia(h.container, 'Move product media 1 later')
        assert.deepEqual(mediaSources(h.container), [alternate, openGiftImage, closedGiftImage])
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { openBox: 1, closedBox: 2 })
        assert.deepEqual(calls[0].images, [alternate, openGiftImage, closedGiftImage])
        assert.deepEqual((calls[0].metadata as Record<string, unknown>).privateSupplier, { reference: 'KEEP_PRIVATE' })
        await editFact(h.container, 'Open-box product image', '0')
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[1]).mediaRoles, { closedBox: 2, openBox: 0 })
        assert.equal(calls[1].version, 8)
    } finally { await h.close() }
})

test('actual removal clears a gift view and re-uploading its URL does not resurrect the old role', async () => {
    let current: Record<string, unknown> = giftProduct()
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (url, init) => {
        if (url.endsWith('/upload')) return json({ url: openGiftImage })
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }; return json(current)
    })
    try {
        await clickMedia(h.container, 'Remove product media 1')
        assert.deepEqual(mediaSources(h.container), [closedGiftImage])
        await uploadSyntheticMedia(h.container)
        assert.deepEqual(mediaSources(h.container), [closedGiftImage, openGiftImage])
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { closedBox: 0 })
        assert.deepEqual(giftFacts(calls[0]).contents, [{ label: 'Mug', quantity: 1 }])
        await editFact(h.container, 'Open-box product image', '1')
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[1]).mediaRoles, { closedBox: 0, openBox: 1 })
    } finally { await h.close() }
})

test('duplicate uploaded image URLs clear ambiguous roles and removing a duplicate does not guess one back', async () => {
    let current: Record<string, unknown> = giftProduct()
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (url, init) => {
        if (url.endsWith('/upload')) return json({ url: openGiftImage })
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }; return json(current)
    })
    try {
        await uploadSyntheticMedia(h.container)
        assert.deepEqual(mediaSources(h.container), [openGiftImage, closedGiftImage, openGiftImage])
        await clickMedia(h.container, 'Remove product media 3')
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { closedBox: 1 })
        assert.deepEqual(calls[0].images, [openGiftImage, closedGiftImage])
    } finally { await h.close() }
})

test('malformed gift contents remain editable across image changes and cannot silently disappear from a save', async () => {
    const source = giftProduct()
    let current: Record<string, unknown> = { ...source, metadata: { ...source.metadata, gifts: { ...source.metadata.gifts, contents: [{ label: 'Mug', quantity: '' }] } } }
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }; return json(current)
    })
    try {
        await clickMedia(h.container, 'Move product media 2 earlier')
        await h.click('Save product')
        assert.equal(calls.length, 0); assert.match(h.container.textContent!, /Check product facts/)
        await editFact(h.container, 'Item 1 quantity', '2')
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[0]).contents, [{ label: 'Mug', quantity: 2 }])
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { openBox: 1, closedBox: 0 })
        assert.deepEqual((calls[0].metadata as Record<string, unknown>).privateSupplier, { reference: 'KEEP_PRIVATE' })
    } finally { await h.close() }
})

test('gift image associations survive remount and lost reply while the older immutable command replays exactly', async () => {
    let current: Record<string, unknown> = giftProduct()
    const calls: Array<{ body: string; key: string }> = []
    let receipt: Record<string, unknown> | undefined
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push({ body: String(init.body), key: new Headers(init.headers).get('X-Idempotency-Key')! })
        if (calls.length === 2) return json(receipt)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        current = { ...current, ...body, version: calls.length === 1 ? 13 : 19 }
        if (calls.length === 1) { receipt = current; return json({ code: 'LOST_REPLY', message: 'Unknown outcome' }, 503) }
        return json(current)
    })
    try {
        await editFact(h.container, 'Suitability note (optional)', 'Captured earlier gift note.')
        await h.click('Save product')
        const key = `letbuyy.product-edit.v1:${actorId}:alpha:${id}`
        const original = JSON.parse(window.sessionStorage.getItem(key)!) as Record<string, unknown>
        await clickMedia(h.container, 'Move product media 2 earlier')
        await editFact(h.container, 'Suitability note (optional)', 'Newer reordered gift note.')
        const newer = JSON.parse(window.sessionStorage.getItem(key)!) as Record<string, unknown>
        for (const field of ['payload', 'key', 'signature', 'version']) assert.equal(newer[field], original[field])
        await h.remount()
        assert.deepEqual(mediaSources(h.container), [closedGiftImage, openGiftImage])
        await h.click('Retry pending save')
        assert.deepEqual(calls[1], calls[0])
        assert.match(h.container.textContent!, /newer draft is kept/)
        assert.deepEqual(mediaSources(h.container), [closedGiftImage, openGiftImage])
        await h.click('Save product')
        const saved = JSON.parse(calls[2].body) as Record<string, unknown>
        assert.deepEqual(giftFacts(saved).mediaRoles, { openBox: 1, closedBox: 0 })
        assert.equal(giftFacts(saved).suitabilityNote, 'Newer reordered gift note.')
        assert.equal(saved.version, 13); assert.notEqual(calls[2].key, calls[0].key)
    } finally { await h.close() }
})

test('legacy retained image roles require deliberate current-image review and preserve raw facts', async () => {
    let current: Record<string, unknown> = giftProduct(), writes = 0
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        writes++; current = { ...current, ...JSON.parse(String(init.body)), version: 13 }; return json(current)
    })
    try {
        await editFact(h.container, 'Suitability note (optional)', 'Older retained gift draft.')
        const key = `letbuyy.product-edit.v1:${actorId}:alpha:${id}:unsaved`
        const retained = JSON.parse(window.sessionStorage.getItem(key)!) as { snapshot: Partial<ProductFormSnapshot> }
        delete retained.snapshot.giftMediaImageOrder
        retained.snapshot.images = [closedGiftImage, openGiftImage]
        window.sessionStorage.setItem(key, JSON.stringify(retained))
        await h.remount(); await h.click('Restore draft')
        await editFact(h.container, 'Suitability note (optional)', 'Legacy choices reviewed deliberately.')
        await h.click('Save product'); assert.equal(writes, 0)
        assert.match(h.container.textContent!, /Review the gift image views/)
        await h.click('Use the displayed gift image choices')
        await h.click('Save product'); assert.equal(writes, 1)
        assert.deepEqual(giftFacts(current).mediaRoles, { openBox: 0, closedBox: 1 })
    } finally { await h.close() }
})

test('retained media drops bearer URLs with correct safe-image role identity before restore', async () => {
    const bearer = 'https://cdn.example.test/private.webp?token=NEVER_RETAIN'
    let current: Record<string, unknown> = { ...giftProduct(), images: [bearer, closedGiftImage] }
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: 13 }; return json(current)
    })
    try {
        await editFact(h.container, 'Suitability note (optional)', 'Retain safe product details.')
        const key = `letbuyy.product-edit.v1:${actorId}:alpha:${id}:unsaved`
        const raw = window.sessionStorage.getItem(key)!
        assert.doesNotMatch(raw, /NEVER_RETAIN|private\.webp/)
        assert.deepEqual(JSON.parse(raw).snapshot.images, [closedGiftImage])
        assert.deepEqual(JSON.parse(JSON.parse(raw).snapshot.nicheFacts).gifts.mediaRoles, { closedBox: 0 })
        await h.click('Save product'); assert.equal(calls.length, 0)
        await h.remount(); await h.click('Restore draft')
        await h.click('Save product')
        assert.deepEqual(calls[0].images, [closedGiftImage])
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { closedBox: 0 })
    } finally { await h.close() }
})

test('gift image association stays in its actor/store/product draft scope', async () => {
    const betaOpen = 'https://cdn.example.test/beta-open.webp', betaClosed = 'https://cdn.example.test/beta-closed.webp'
    const alpha = giftProduct(), beta = { ...giftProduct(), version: 31, images: [betaOpen, betaClosed] }
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const h = await mount(async (url, init) => {
        const source = url.includes('/beta/') ? beta : alpha
        if (init?.method !== 'PATCH') return json(source)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push({ url, body }); return json({ ...source, ...body, version: 37 })
    })
    try {
        await clickMedia(h.container, 'Move product media 2 earlier')
        await h.render('beta')
        assert.deepEqual(mediaSources(h.container), [betaOpen, betaClosed])
        await editFact(h.container, 'Suitability note (optional)', 'Beta scope gift edit.')
        await h.click('Save product')
        assert.match(calls[0].url, /\/beta\//)
        assert.deepEqual(calls[0].body.images, [betaOpen, betaClosed])
        assert.deepEqual(giftFacts(calls[0].body).mediaRoles, { openBox: 0, closedBox: 1 })
        assert.equal(calls[0].body.version, 31)
    } finally { await h.close() }
})

test('actual replacement photograph remains unassigned until the merchant chooses its current role', async () => {
    const replacement = 'https://cdn.example.test/new-closed-view.webp'
    let current: Record<string, unknown> = giftProduct()
    const calls: Array<Record<string, unknown>> = []
    const h = await mount(async (url, init) => {
        if (url.endsWith('/upload')) return json({ url: replacement })
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = { ...current, ...body, version: Number(current.version) + 1 }; return json(current)
    })
    try {
        await clickMedia(h.container, 'Remove product media 2')
        await uploadSyntheticMedia(h.container)
        assert.deepEqual(mediaSources(h.container), [openGiftImage, replacement])
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[0]).mediaRoles, { openBox: 0 })
        await editFact(h.container, 'Closed-box product image', '1')
        await h.click('Save product')
        assert.deepEqual(giftFacts(calls[1]).mediaRoles, { openBox: 0, closedBox: 1 })
    } finally { await h.close() }
})

test('a newer bearer-image draft cannot leak into retained recovery or alter the earlier pending command', async () => {
    const bearer = 'https://cdn.example.test/private-new.webp?token=NEVER_RETAIN'
    let current: Record<string, unknown> = giftProduct(), receipt: Record<string, unknown> | undefined
    const calls: string[] = []
    const h = await mount(async (url, init) => {
        if (url.endsWith('/upload')) return json({ url: bearer })
        if (init?.method !== 'PATCH') return json(current)
        calls.push(String(init.body))
        if (calls.length === 2) return json(receipt)
        current = { ...current, ...JSON.parse(String(init.body)), version: calls.length === 1 ? 13 : 19 }
        if (calls.length === 1) { receipt = current; return json({ code: 'LOST_REPLY', message: 'Unknown outcome' }, 503) }
        return json(current)
    })
    try {
        await editFact(h.container, 'Suitability note (optional)', 'Earlier public image command.')
        await h.click('Save product')
        await uploadSyntheticMedia(h.container)
        await editFact(h.container, 'Open-box product image', '2')
        const key = `letbuyy.product-edit.v1:${actorId}:alpha:${id}`
        const raw = window.sessionStorage.getItem(key)!
        assert.doesNotMatch(raw, /NEVER_RETAIN|private-new\.webp/)
        assert.equal((JSON.parse(raw) as Record<string, unknown>).payload, calls[0])
        await h.remount()
        assert.deepEqual(mediaSources(h.container), [openGiftImage, closedGiftImage])
        await h.click('Retry pending save')
        assert.equal(calls[1], calls[0])
        assert.match(h.container.textContent!, /newer draft is kept/)
        await h.click('Save product')
        const saved = JSON.parse(calls[2]) as Record<string, unknown>
        assert.deepEqual(giftFacts(saved).mediaRoles, { closedBox: 1 })
        assert.deepEqual(saved.images, [openGiftImage, closedGiftImage])
        assert.equal(saved.version, 13)
    } finally { await h.close() }
})

// Real enclosing variant controls. Metadata belongs to this row's durable ID;
// repeated titles/SKUs deliberately cannot act as identity in these fixtures.
const secondVariantId = '66666666-6666-4666-8666-666666666666'
function variantProduct(metadata: unknown = { toys: { finish: 'Original red' } }): Record<string, unknown> {
    return { ...row(), metadata: { toys: { materials: 'Common wood' } }, variants: [{ ...row().variants[0], metadata }] }
}
function variantRows(product: Record<string, unknown>) { return product.variants as Record<string, unknown>[] }
function acceptVariantWrite(current: Record<string, unknown>, body: Record<string, unknown>, version = 13): Record<string, unknown> {
    return { ...current, ...body, version, variants: variantRows(body).map((item, index) => {
        const saved = item.id ? variantRows(current).find(candidate => candidate.id === item.id) : undefined
        return { ...saved, ...item, id: item.id ?? (index === 0 ? variantId : secondVariantId), option1: (item.options as Record<string, unknown>).Size, inventory_qty: item.stock }
    }) }
}
function variantScope(container: HTMLElement, identity = variantId) {
    const scope = [...container.querySelectorAll<HTMLElement>('[data-variant-facts]')].find(element => element.dataset.variantFacts === identity)
    assert.ok(scope, `Missing variant fact row ${identity}`)
    return scope
}
function variantControl(container: HTMLElement, label: string, identity = variantId) {
    const fieldLabel = [...variantScope(container, identity).querySelectorAll('label')].find(item => item.textContent?.trim() === label)
    assert.ok(fieldLabel, `Missing variant control ${label}`)
    const control = document.getElementById(fieldLabel.htmlFor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    assert.ok(control); return control
}
async function editVariantFact(container: HTMLElement, label: string, value: string, identity = variantId) {
    const control = variantControl(container, label, identity)
    assert.equal(control.disabled, false)
    await act(async () => {
        const prototype = control.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : control.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value)
        control.dispatchEvent(new window.Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
}
async function clickVariantFact(container: HTMLElement, label: string, identity = variantId) {
    const button = [...variantScope(container, identity).querySelectorAll('button')].find(item => item.textContent?.trim() === label)
    assert.ok(button, `Missing variant action ${label}`); assert.equal(button.disabled, false)
    await act(async () => button.click())
}

test('real variant edits keep sibling namespaces and repeated title/SKU rows bound to their own UUID', async () => {
    const sibling = { ...row().variants[0], id: secondVariantId, metadata: { toys: { finish: 'Sibling green' } } }
    let current = { ...variantProduct({ toys: { finish: 'Original red' }, food: { netQuantity: { value: 250, unit: 'g' } } }), variants: [...variantRows(variantProduct({ toys: { finish: 'Original red' }, food: { netQuantity: { value: 250, unit: 'g' } } })), sibling] }
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body); current = acceptVariantWrite(current, body) as typeof current; return json(current)
    })
    try {
        assert.match(variantScope(h.container).textContent!, /Common wood/)
        await editVariantFact(h.container, 'Edition finish', 'Edition blue')
        await h.click('Save product')
        const [changed, untouched] = variantRows(calls[0])
        assert.equal(changed.id, variantId); assert.equal(untouched.id, secondVariantId)
        assert.deepEqual(changed.metadata, { toys: { finish: 'Edition blue' }, food: { netQuantity: { value: 250, unit: 'g' } } })
        assert.equal(Object.hasOwn(untouched, 'metadata'), false)
        assert.equal(variantControl(h.container, 'Edition finish', secondVariantId).value, 'Sibling green')
        assert.equal(variantControl(h.container, 'Edition finish').value, 'Edition blue')
    } finally { await h.close() }
})

test('commercial-only variant edits and reverted facts omit metadata; the final explicit clear sends an empty object', async () => {
    let current = variantProduct()
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body); current = acceptVariantWrite(current, body, 7 + calls.length); return json(current)
    })
    try {
        await editVariantFact(h.container, 'Edition finish', 'Temporary')
        await editVariantFact(h.container, 'Edition finish', 'Original red')
        await h.setInput(h.container.querySelector('[aria-label="SKU for M"]') as HTMLInputElement, 'NEW-SKU')
        await h.click('Save product')
        assert.equal(Object.hasOwn(variantRows(calls[0])[0], 'metadata'), false)
        await clickVariantFact(h.container, 'Clear selected variant facts')
        await h.click('Save product')
        assert.deepEqual(variantRows(calls[1])[0].metadata, {})
        await h.setTitle('After clear'); await h.click('Save product')
        assert.equal(Object.hasOwn(variantRows(calls[2])[0], 'metadata'), false)
    } finally { await h.close() }
})

test('clearing a single variant namespace preserves its sibling and explicit nested clear markers', async () => {
    let current = variantProduct({ toys: { finish: 'Red' }, food: { netQuantity: { value: 250, unit: 'g' } } })
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body); current = acceptVariantWrite(current, body, 7 + calls.length); return json(current)
    })
    try {
        await clickVariantFact(h.container, 'Clear edition contents')
        await clickVariantFact(h.container, 'Clear edition primary dimensions')
        await editVariantFact(h.container, 'Edition finish', '')
        await h.click('Save product')
        assert.deepEqual(variantRows(calls[0])[0].metadata, { food: { netQuantity: { value: 250, unit: 'g' } }, toys: { finish: '', contents: [], contentsComplete: false, dimensions: null } })
        await clickVariantFact(h.container, 'Clear selected variant facts')
        await h.click('Save product')
        assert.deepEqual(variantRows(calls[1])[0].metadata, { food: { netQuantity: { value: 250, unit: 'g' } } })
    } finally { await h.close() }
})

test('invalid raw variant facts survive remount and block a new command until corrected', async () => {
    const calls: string[] = []
    const h = await mount(async (_url, init) => { if (init?.method === 'PATCH') calls.push(String(init.body)); return json(variantProduct()) })
    try {
        await clickVariantFact(h.container, 'Add edition warning')
        await editVariantFact(h.container, 'Edition warning text', 'Raw unfinished source')
        await h.click('Save product'); assert.equal(calls.length, 0)
        assert.match(h.container.textContent!, /Check variant facts/)
        await h.remount(); await h.click('Restore draft')
        assert.equal(variantControl(h.container, 'Edition warning text').value, 'Raw unfinished source')
        await h.click('Save product'); assert.equal(calls.length, 0)
        await editVariantFact(h.container, 'Edition warning source', 'Printed edition label')
        await h.click('Save product'); assert.equal(calls.length, 1)
        assert.deepEqual((variantRows(JSON.parse(calls[0]))[0].metadata as Record<string, unknown>).toys, { finish: 'Original red', warnings: [{ text: 'Raw unfinished source', sourceLabel: 'Printed edition label' }] })
    } finally { await h.close() }
})

test('legacy retained existing rows require explicit latest review for facts and never invent a known-empty baseline', async () => {
    let current = variantProduct()
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body); current = acceptVariantWrite(current, body); return json(current)
    })
    try {
        await h.setTitle('Retained legacy scalar')
        const key = `letbuyy.product-edit.v1:${actorId}:alpha:${id}:unsaved`
        const retained = JSON.parse(window.sessionStorage.getItem(key)!) as { snapshot: ProductFormSnapshot }
        for (const item of retained.snapshot.variantMatrix) { delete item.factsMetadataBaseline; delete item.factsMetadataDraft; delete item.factsMetadataEdited }
        window.sessionStorage.setItem(key, JSON.stringify(retained))
        await h.remount(); await h.click('Restore draft')
        assert.equal(variantControl(h.container, 'Variant facts category').disabled, true)
        assert.match(h.container.textContent!, /no verified facts baseline/)
        await h.click('Review latest variant facts'); assert.equal(h.title().value, 'Retained legacy scalar')
        await h.click('Reload latest and discard my edits')
        assert.equal(variantControl(h.container, 'Edition finish').value, 'Original red')
        await h.setTitle('Reviewed scalar'); await h.click('Save product')
        assert.equal(Object.hasOwn(variantRows(calls[0])[0], 'metadata'), false)
        await editVariantFact(h.container, 'Edition finish', 'Reviewed blue'); await h.click('Save product')
        assert.deepEqual(variantRows(calls[1])[0].metadata, { toys: { finish: 'Reviewed blue' } })
    } finally { await h.close() }
})

test('variant conflict retains the raw draft until explicit reload and then uses the authoritative baseline/version', async () => {
    let current = variantProduct(), first = true
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)); calls.push(body)
        if (first) { first = false; current = { ...variantProduct({ toys: { finish: 'Server blue' } }), version: 23 }; return json({ code: 'PRODUCT_VERSION_CONFLICT', message: 'Changed elsewhere' }, 409) }
        current = acceptVariantWrite(current, body, 24); return json(current)
    })
    try {
        await editVariantFact(h.container, 'Edition finish', 'My raw green'); await h.click('Save product')
        assert.equal(variantControl(h.container, 'Edition finish').value, 'My raw green')
        assert.equal(h.button('Save product').disabled, true)
        await h.click('Reload latest and discard my edits')
        assert.equal(variantControl(h.container, 'Edition finish').value, 'Server blue')
        await editVariantFact(h.container, 'Edition finish', 'Reviewed green'); await h.click('Save product')
        assert.equal(calls[1].version, 23); assert.notEqual(calls[1].idempotency_key, calls[0].idempotency_key)
        assert.equal(variantRows(calls[1])[0].id, variantId)
    } finally { await h.close() }
})

test('lost variant reply replays the immutable command despite newer invalid facts and rebases the accepted UUID baseline', async () => {
    let current = variantProduct()
    const calls: { body: string; key: string }[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push({ body: String(init.body), key: new Headers(init.headers).get('X-Idempotency-Key')! })
        if (calls.length === 1) { current = acceptVariantWrite(current, JSON.parse(calls[0].body), 13); return json({ code: 'UNAVAILABLE', message: 'Lost committed reply' }, 503) }
        if (calls.length > 2) current = acceptVariantWrite(current, JSON.parse(String(init.body)), 14)
        return json(current)
    })
    try {
        await editVariantFact(h.container, 'Edition finish', 'Earlier accepted'); await h.click('Save product')
        const storageKey = `letbuyy.product-edit.v1:${actorId}:alpha:${id}`
        const bound = JSON.parse(window.sessionStorage.getItem(storageKey)!) as Record<string, unknown>
        await clickVariantFact(h.container, 'Add edition warning')
        await editVariantFact(h.container, 'Edition warning text', 'Newer invalid warning')
        await h.remount()
        const restored = JSON.parse(window.sessionStorage.getItem(storageKey)!) as Record<string, unknown>
        for (const key of ['payload', 'key', 'signature', 'variantSignature']) assert.equal(restored[key], bound[key])
        await h.click('Retry pending save'); assert.deepEqual(calls[1], calls[0])
        assert.equal(variantControl(h.container, 'Edition warning text').value, 'Newer invalid warning')
        await h.click('Save product'); assert.equal(calls.length, 2)
        await clickVariantFact(h.container, 'Clear all variant fact overrides')
        await editVariantFact(h.container, 'Variant facts category', 'toys')
        await editVariantFact(h.container, 'Edition finish', 'Original red')
        await h.click('Save product'); assert.equal(calls.length, 3)
        const final = JSON.parse(calls[2].body)
        assert.equal(final.version, 13); assert.notEqual(calls[2].key, calls[0].key)
        assert.deepEqual(variantRows(final)[0].metadata, { toys: { finish: 'Original red' } }, 'reverting to pre-command facts still writes against the newly accepted baseline')
    } finally { await h.close() }
})

test('unproven option deletion preserves both the original options and bound facts until explicit row removal', async () => {
    const h = await mount(async () => json(variantProduct()))
    try {
        await editVariantFact(h.container, 'Edition finish', 'Kept green')
        await h.click('Delete')
        assert.match(h.container.textContent!, /Variant combinations are kept/)
        assert.equal(variantControl(h.container, 'Edition finish').value, 'Kept green')
        assert.ok(h.container.querySelector('[aria-label="SKU for M"]'))
        await clickMedia(h.container, 'Remove variant M')
        await h.click('Delete')
        assert.equal(h.container.querySelector('[data-variant-facts]'), null)
        await h.click('Add option')
        await h.setInput(h.container.querySelector('input[placeholder="Option name (Size, Color, Material)"]') as HTMLInputElement, 'Size')
        await h.click('Done')
        await h.setInput(h.container.querySelector('input[placeholder="Add value"]') as HTMLInputElement, 'L')
        await h.click('Add value')
        assert.ok(variantScope(h.container, 'new-0'))
        assert.equal(variantControl(h.container, 'Variant facts category', 'new-0').value, '')
        assert.doesNotMatch(variantScope(h.container, 'new-0').textContent!, /Kept green/)
    } finally { await h.close() }
})

test('actual new-product rows send only supplied partial variant metadata in the single creation request', async () => {
    const posts: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method === 'POST') { posts.push(JSON.parse(String(init.body))); return json({ ...row(), id }) }
        return json(variantProduct())
    }, 'new')
    try {
        await h.setTitle('New toy')
        await h.click('Add option')
        await h.setInput(h.container.querySelector('input[placeholder="Option name (Size, Color, Material)"]') as HTMLInputElement, 'Size')
        await h.click('Done')
        await h.setInput(h.container.querySelector('input[placeholder="Add value"]') as HTMLInputElement, 'S')
        await h.click('Add value')
        await editVariantFact(h.container, 'Variant facts category', 'toys', 'new-0')
        await editVariantFact(h.container, 'Edition finish', 'Supplied blue', 'new-0')
        await h.click('Create product')
        assert.equal(posts.length, 1)
        const created = variantRows(posts[0])[0]
        assert.equal(Object.hasOwn(created, 'id'), false)
        assert.deepEqual(created.metadata, { toys: { finish: 'Supplied blue' } })
        assert.equal(created.title, 'S')
    } finally { await h.close() }
})

test('new-row facts changed after a lost reply keep their draft and require review before adopting returned UUIDs', async () => {
    let current = variantProduct()
    const calls: string[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push(String(init.body))
        if (calls.length === 1) { current = acceptVariantWrite(current, JSON.parse(calls[0]), 13); return json({ code: 'UNAVAILABLE', message: 'Lost committed response' }, 503) }
        return json(current)
    })
    try {
        await h.click('Add values')
        await h.setInput(h.container.querySelector('input[placeholder="Add value"]') as HTMLInputElement, 'L'); await h.click('Add value')
        await editVariantFact(h.container, 'Variant facts category', 'toys', 'new-1')
        await editVariantFact(h.container, 'Edition finish', 'Earlier new blue', 'new-1')
        await h.click('Save product')
        await editVariantFact(h.container, 'Edition finish', 'Newer raw green', 'new-1')
        await h.click('Retry pending save')
        assert.equal(calls[1], calls[0])
        assert.equal(variantControl(h.container, 'Edition finish', 'new-1').value, 'Newer raw green')
        assert.equal(h.container.querySelector(`[data-variant-facts="${secondVariantId}"]`), null, 'no UUID guessed from response order, SKU or option label')
        assert.equal(h.button('Save product').disabled, true)
        await h.click('Reload latest and discard my edits')
        assert.equal(variantControl(h.container, 'Edition finish', secondVariantId).value, 'Earlier new blue')
        assert.equal(h.container.querySelector('[data-variant-facts="new-1"]'), null)
    } finally { await h.close() }
})

test('option rename opens an explicit keyboard dialog before changing the retained variant', async () => {
    const h = await mount(async () => json(row()))
    try {
        await clickMedia(h.container, 'Rename Size value M')
        const dialog = document.querySelector('[role="dialog"]')
        assert.ok(dialog, 'Rename must be an explicit, accessible action')
        assert.match(dialog.textContent!, /Rename option value/)
        const input = dialog.querySelector('input') as HTMLInputElement
        assert.equal(input.value, 'M')
        await h.setInput(input, 'L')
        await h.click('Cancel')
        assert.equal(document.querySelector('[role="dialog"]'), null)
        assert.ok(h.container.querySelector('[aria-label="Stock for M"]'))
    } finally { await h.close() }
})

async function renameThroughDialog(h: Awaited<ReturnType<typeof mount>>, axis: string, from: string, to: string) {
    await clickMedia(h.container, `Rename ${axis} value ${from}`)
    const input = document.querySelector('[role="dialog"] input') as HTMLInputElement
    assert.ok(input)
    await h.setInput(input, to)
    await h.click('Save value')
}

test('option rename sends the same book UUIDs with edited facts, sibling metadata and post-order stock intact', async () => {
    const food = { netQuantity: { value: 250, unit: 'g' } }
    let current: Record<string, unknown> = { ...row(), stock: 7, images: ['https://cdn.example.test/book.webp'], metadata: { privateSupplier: 'KEEP', books: { kind: 'book', subjects: ['Essays'] } },
        product_options: [{ name: 'Edition', position: 0, values: ['English hardback', 'Hindi paperback'] }],
        variants: [
            { id: variantId, title: 'English hardback', option1: 'English hardback', price: 590, compare_price: 700, inventory_qty: 3, sku: 'SAME-SKU', metadata: { books: { kind: 'book', authors: ['Mira Sen'], language: 'English', format: 'hardback', pages: 192, dimensions_mm: { width: 156, height: 234 } }, food } },
            { id: secondVariantId, title: 'Hindi paperback', option1: 'Hindi paperback', price: 420, inventory_qty: 4, sku: 'SAME-SKU', metadata: { books: { kind: 'book', language: 'Hindi', format: 'paperback' } } },
        ] }
    const calls: { body: Record<string, unknown>; headers: Headers }[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        calls.push({ body, headers: new Headers(init.headers) })
        current = { ...current, ...body, version: 13, variants: variantRows(body).map(item => ({ ...variantRows(current).find(previous => previous.id === item.id), ...item, option1: (item.options as Record<string, string>).Edition, inventory_qty: item.stock })) }
        return json(current)
    })
    try {
        await editVariantFact(h.container, 'Variant facts category', 'books')
        await editVariantFact(h.container, 'Variant language (required)', 'Marathi')
        await editVariantFact(h.container, 'Variant print format (required)', 'spiral-bound')
        await editVariantFact(h.container, 'Author 1', 'Revised catalogue author')
        await editVariantFact(h.container, 'Printed pages (optional)', '224')
        await renameThroughDialog(h, 'Edition', 'English hardback', 'Marathi spiral edition')
        assert.equal(calls.length, 0, 'Save value only commits the local form draft')
        assert.ok(h.container.querySelector(`[data-variant-facts="${variantId}"]`))
        await h.setInput(h.container.querySelector('[aria-label="Price for Marathi spiral edition"]') as HTMLInputElement, '690')
        await h.click('Save product')
        assert.equal(calls.length, 1)
        const { body, headers } = calls[0], [changed, untouched] = variantRows(body)
        assert.deepEqual(variantRows(body).map(item => item.id), [variantId, secondVariantId])
        for (const variant of variantRows(body)) assert.equal(ProductEditVariantSchema.safeParse(variant).success, true)
        assert.deepEqual(body.product_options, [{ name: 'Edition', position: 0, values: ['Marathi spiral edition', 'Hindi paperback'] }])
        assert.equal(changed.title, 'Marathi spiral edition'); assert.deepEqual(changed.options, { Edition: 'Marathi spiral edition' })
        assert.equal(changed.stock, 3); assert.equal(untouched.stock, 4); assert.equal(body.stock, 7)
        assert.equal(changed.price, 690); assert.equal(changed.compare_price, 700); assert.equal(changed.sku, 'SAME-SKU')
        assert.deepEqual(changed.metadata, { books: { kind: 'book', authors: ['Revised catalogue author'], language: 'Marathi', format: 'spiral-bound', pages: 224, dimensions_mm: { width: 156, height: 234 } }, food })
        assert.equal(Object.hasOwn(untouched, 'metadata'), false)
        assert.deepEqual(body.images, ['https://cdn.example.test/book.webp'])
        assert.equal((body.metadata as Record<string, unknown>).privateSupplier, 'KEEP')
        assert.equal(body.version, 7); assert.equal(headers.get('X-Idempotency-Key'), body.idempotency_key)
        assert.equal(headers.get('X-LetBuyy-Merchant-Context'), actorId)
        await h.remount()
        assert.equal((h.container.querySelector('[aria-label="Stock for Marathi spiral edition"]') as HTMLInputElement).value, '3')
        await editVariantFact(h.container, 'Variant facts category', 'books')
        assert.equal(variantControl(h.container, 'Variant language (required)').value, 'Marathi')
        assert.equal(variantControl(h.container, 'Variant print format (required)').value, 'spiral-bound')
    } finally { await h.close() }
})

test('option rename validation, keyboard Save, Escape and Cancel preserve the original draft until committed', async () => {
    const source = { ...row(), product_options: [{ name: 'Size', position: 0, values: ['M', 'L'] }], variants: [...row().variants, { ...row().variants[0], id: secondVariantId, title: 'L', option1: 'L' }] }
    let writes = 0
    const h = await mount(async (_url, init) => { if (init?.method === 'PATCH') writes += 1; return json(source) })
    try {
        const trigger = h.container.querySelector('[aria-label="Rename Size value M"]') as HTMLButtonElement
        trigger.focus(); await clickMedia(h.container, 'Rename Size value M')
        const input = document.querySelector('[role="dialog"] input') as HTMLInputElement
        await h.setInput(input, '   '); await h.click('Save value')
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.match(document.querySelector('[role="dialog"]')!.textContent!, /between 1 and 100/)
        await h.setInput(input, ' L '); await h.click('Save value')
        assert.match(document.querySelector('[role="dialog"]')!.textContent!, /distinct value/)
        assert.ok(h.container.querySelector('[aria-label="Stock for M"]'))
        await h.click('Cancel'); assert.equal(document.activeElement, trigger)
        assert.equal(h.button('Save product').disabled, true)
        await clickMedia(h.container, 'Rename Size value M')
        await h.setInput(document.querySelector('[role="dialog"] input') as HTMLInputElement, 'Cancelled')
        await act(async () => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
        assert.equal(document.querySelector('[role="dialog"]'), null)
        assert.ok(h.container.querySelector('[aria-label="Stock for M"]'))
        await clickMedia(h.container, 'Rename Size value M')
        const committed = document.querySelector('[role="dialog"] input') as HTMLInputElement
        await h.setInput(committed, 'मराठी  edition')
        await act(async () => { committed.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })) })
        assert.ok(document.querySelector('[role="dialog"]'), 'IME confirmation does not commit the rename')
        await act(async () => { committed.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
        assert.equal(document.querySelector('[role="dialog"]'), null)
        assert.ok(h.container.querySelector('[aria-label="Stock for मराठी  edition"]'))
        assert.equal(document.activeElement, trigger)
        assert.equal(h.button('Save product').disabled, false)
        assert.equal(writes, 0)
    } finally { await h.close() }
})

test('option rename survives draft recovery and preserves immutable retry bytes while a newer rename stays bound to its UUID', async () => {
    let current = variantProduct()
    const calls: { body: string; key: string }[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push({ body: String(init.body), key: new Headers(init.headers).get('X-Idempotency-Key')! })
        if (calls.length === 1) { current = acceptVariantWrite(current, JSON.parse(calls[0].body), 13); return json({ code: 'UNAVAILABLE', message: 'Lost committed response' }, 503) }
        if (calls.length > 2) current = acceptVariantWrite(current, JSON.parse(String(init.body)), 14)
        return json(current)
    })
    try {
        await renameThroughDialog(h, 'Size', 'M', 'L')
        await editVariantFact(h.container, 'Edition finish', 'Earlier blue')
        await h.remount(); await h.click('Restore draft')
        assert.ok(h.container.querySelector('[aria-label="Stock for L"]'))
        await h.click('Save product')
        await renameThroughDialog(h, 'Size', 'L', 'XL')
        await editVariantFact(h.container, 'Edition finish', 'Newer green')
        await h.remount()
        assert.ok(h.container.querySelector('[aria-label="Stock for XL"]'))
        await h.click('Retry pending save')
        assert.deepEqual(calls[1], calls[0])
        assert.ok(h.container.querySelector('[aria-label="Stock for XL"]'))
        assert.equal(variantControl(h.container, 'Edition finish').value, 'Newer green')
        await h.click('Save product')
        assert.equal(calls.length, 3)
        const body = JSON.parse(calls[2].body), variant = variantRows(body)[0]
        assert.equal(body.version, 13); assert.notEqual(calls[2].key, calls[0].key)
        assert.equal(variant.id, variantId); assert.equal(variant.title, 'XL'); assert.deepEqual(variant.options, { Size: 'XL' })
        assert.equal(variant.stock, 5); assert.equal(variant.price, 100); assert.equal(variant.sku, 'OLD-SKU')
        assert.deepEqual(variant.metadata, { toys: { finish: 'Newer green' } })
    } finally { await h.close() }
})

test('absent apparel stays absent in actual beauty save, recovered draft and immutable retry', async () => {
    const metadata = { privateSupplier: { reference: 'KEEP' }, beauty: { schemaVersion: 1, routineStage: 'cleanse', ingredients: 'Aqua', directions: 'Supplied directions', netQuantity: { unit: 'ml', value: 150 }, shades: [], shadeOptionName: 'Shade' } }
    let current: Record<string, unknown> = { ...row(), price: 640, stock: 12, product_options: [], variants: [], metadata }
    const calls: { body: string; key: string }[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        calls.push({ body: String(init.body), key: new Headers(init.headers).get('X-Idempotency-Key')! })
        if (calls.length === 1) { current = { ...current, ...JSON.parse(calls[0].body), version: 13 }; return json({ code: 'UNAVAILABLE', message: 'Lost committed response' }, 503) }
        if (calls.length > 2) current = { ...current, ...JSON.parse(String(init.body)), version: 14 }
        return json(current)
    })
    try {
        await h.setTitle('First scalar edit'); await h.click('Save product')
        const first = JSON.parse(calls[0].body) as Record<string, unknown>
        assert.equal(Object.hasOwn(first.metadata as object, 'apparel'), false)
        assert.deepEqual(first.metadata, metadata); assert.equal(first.stock, 12); assert.equal(first.version, 7)
        await h.setTitle('Newer retained edit'); await h.remount()
        await h.click('Retry pending save'); assert.deepEqual(calls[1], calls[0])
        assert.equal(h.title().value, 'Newer retained edit')
        await h.click('Save product')
        const next = JSON.parse(calls[2].body) as Record<string, unknown>
        assert.deepEqual(next.metadata, metadata); assert.equal(Object.hasOwn(next.metadata as object, 'apparel'), false)
        assert.equal(next.version, 13); assert.notEqual(calls[2].key, calls[0].key)
        assert.equal(next.stock, 12); assert.equal(next.price, 640)
        await h.remount(); assert.equal(h.title().value, 'Newer retained edit')
    } finally { await h.close() }
})

test('existing garment authoring and explicit clear retain niche/private siblings in the real form', async () => {
    const apparel = ApparelFactsSchema.parse({ fit: 'Roomy', fabric: 'Cotton', care: 'Wash gently', measurements: [{ size: 'M', chest: 98 }] })
    const metadata = { apparel, privateSupplier: { reference: 'KEEP' }, books: { kind: 'book', subjects: ['Essays'] } }
    let current: Record<string, unknown> = { ...row(), metadata }
    const calls: Record<string, unknown>[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json(current)
        const body = JSON.parse(String(init.body)) as Record<string, unknown>; calls.push(body)
        current = acceptVariantWrite(current, body, 7 + calls.length); return json(current)
    })
    const editGarment = async (label: string, value: string) => {
        const fieldLabel = [...h.container.querySelectorAll('label')].find(item => item.textContent?.trim() === label)
        assert.ok(fieldLabel, `Missing garment field ${label}`)
        const control = document.getElementById(fieldLabel.htmlFor) as HTMLTextAreaElement
        assert.equal(control.tagName, 'TEXTAREA')
        await act(async () => {
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(control, value)
            control.dispatchEvent(new window.Event('input', { bubbles: true }))
        })
    }
    try {
        await h.setTitle('Scalar-only garment edit'); await h.click('Save product')
        assert.deepEqual(calls[0].metadata, metadata)
        await editGarment('Fit description', 'Tailored'); await h.click('Save product')
        assert.deepEqual(calls[1].metadata, { ...metadata, apparel: { ...apparel, fit: 'Tailored' } })
        await editGarment('Fit description', ''); await editGarment('Fabric composition', ''); await editGarment('Care instructions', '')
        await h.click('Remove size M'); await h.click('Save product')
        assert.deepEqual(calls[2].metadata, { ...metadata, apparel: ApparelFactsSchema.parse({}) })
        assert.equal(variantRows(calls[2])[0].id, variantId); assert.equal(variantRows(calls[2])[0].stock, 5)
        await h.remount()
        const fieldLabel = [...h.container.querySelectorAll('label')].find(item => item.textContent?.trim() === 'Fit description')!
        assert.equal((document.getElementById(fieldLabel.htmlFor) as HTMLTextAreaElement).value, '')
    } finally { await h.close() }
})
