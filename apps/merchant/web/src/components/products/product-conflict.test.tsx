// Mount the real shared editor, Next contexts and UI. Synthetic HTTP responses
// prove client recovery; the separate owned Gateway suite proves durable effects.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'

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
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

async function mount(transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/' + id })
    const names = ['window', 'document', 'navigator', 'fetch']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 3)) Object.defineProperty(globalThis, name, { configurable: true, writable: true,
        value: name === 'window' ? dom.window : dom.window[name] })
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('marketplace-listings')
        ? Promise.resolve(json(null)) : transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../security/MerchantSecurityContext')
    const { default: ProductEditor } = await import('../../app/[store]/products/new/page')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let editorKey = 0
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', productId = id) => { await act(async () => {
        root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store, productId }}>
            <ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId, store }}><ProductEditor key={editorKey} /></MerchantSecurityContext.Provider></ToastProvider>
        </PathParamsContext.Provider></AppRouterContext.Provider>)
    }) }
    await render()
    const remount = async () => { editorKey += 1; await render() }
    const button = (label: string) => {
        const element = [...container.querySelectorAll('button')].find((item: any) => item.textContent.trim() === label) as HTMLButtonElement | undefined
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
    return { container, render, remount, button, click, title, setTitle, setInput, close }
}

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
        assert.equal(window.sessionStorage.length, 0)
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
        assert.equal(window.sessionStorage.length, 0); assert.equal(h.button('Save product').disabled, false)
        await h.setTitle('Reviewed fresh edit'); await h.click('Save product'); assert.equal(writes, 1)
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
