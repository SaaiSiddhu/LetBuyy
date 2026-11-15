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
    status: 'active',
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
    const names = ['window', 'document', 'navigator', 'self', 'fetch']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 4)) Object.defineProperty(globalThis, name, { configurable: true, writable: true,
        value: name === 'window' || name === 'self' ? dom.window : dom.window[name] })
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('marketplace-listings')
        ? Promise.resolve(json(null)) : transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../security/MerchantSecurityContext')
    const { default: ProductsPage } = await import('../../app/[store]/products/page')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let editorKey = 0
    const router = { bfcacheId: 'synthetic-router', back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', productId = id, actor = actorId) => { await act(async () => {
        root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store, productId }}>
            <ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId: actor, store }}><ProductsPage key={editorKey} /></MerchantSecurityContext.Provider></ToastProvider>
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
    const openFilters = async () => { await act(async () => {
        const search = container.querySelector('input[type="search"]') as HTMLInputElement | null
        assert.ok(search, 'Products search opens the filter controls')
        search.focus()
    }) }
    const change = async (name: string, status: string) => { await act(async () => {
        const element = container.querySelector(`select[aria-label="Change status for ${name}"]`) as HTMLSelectElement
        assert.ok(element, 'real row status selector'); assert.equal(element.disabled, false)
        element.value = status; element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    }) }
    const selectRows = async (names: string[]) => { await act(async () => {
        for (const name of names) {
            const row = [...container.querySelectorAll('table tbody tr')].find(item => item.textContent?.includes(name))
            assert.ok(row, `Missing real table row ${name}`)
            const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement
            assert.ok(checkbox); checkbox.click()
        }
    }) }
    const text = () => container.textContent || ''
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    return { container, render, remount, button, click, openFilters, change, selectRows, text, storage: dom.window.sessionStorage, close }
}

test('single row commands use opaque loaded/returned revisions, canonical pairs and captured context', async () => {
    let current = row(73); const calls: {body: any; headers: Headers}[] = []
    const h = await mount(async (_url, init) => {
        if (init?.method !== 'PATCH') return json([current])
        const body=JSON.parse(String(init.body)); calls.push({body,headers:new Headers(init.headers)})
        current={...current,...body,version:current.version+18}; return json(current)
    })
    try {
        await h.change(current.name,'draft'); await h.change(current.name,'active'); await h.change(current.name,'archived')
        assert.deepEqual(calls.map(c=>c.body.version),[73,91,109]);assert.equal(new Set(calls.map(c=>c.body.idempotency_key)).size,3)
        for(const c of calls){assert.equal(c.body.is_active,c.body.status==='active');assert.equal(c.headers.get('X-Idempotency-Key'),c.body.idempotency_key);assert.equal(c.headers.get('X-LetBuyy-Merchant-Context'),actorId)}
        assert.match(h.text(),/1 confirmed/);assert.equal(h.storage.length,0)
    } finally { await h.close() }
})

test('lost status acknowledgement survives remount and retries the exact body/key even after the status changed',async()=>{
    let current=row(73);const receipts=new Map<string,any>(),calls:any[]=[]
    const h=await mount(async(_url,init)=>{
        if(init?.method!=='PATCH')return json([current])
        const body=JSON.parse(String(init.body));calls.push(body)
        if(receipts.has(body.idempotency_key))return json(receipts.get(body.idempotency_key))
        current={...current,...body,version:91};receipts.set(body.idempotency_key,current);return json({code:'REPLY_LOST'},503)
    })
    try{
        await h.change(current.name,'draft');assert.match(h.text(),/1 uncertain/);assert.equal(h.storage.length,1)
        await h.remount();assert.match(h.text(),/1 uncertain/);await h.click('Retry uncertain changes')
        assert.deepEqual(calls[1],calls[0]);assert.equal(receipts.size,1);assert.match(h.text(),/1 confirmed/);assert.equal(h.storage.length,0)
    }finally{await h.close()}
})

test('mixed bulk keeps confirmed, uncertain and conflicted outcomes through reload and retries only uncertain',async()=>{
    let rows=[row(7,'A'),row(13,'B',variantId),row(19,'C','55555555-5555-4555-8555-555555555555')]
    const calls:{id:string;body:any}[]=[],receipts=new Map<string,any>()
    const h=await mount(async(url,init)=>{
        if(init?.method!=='PATCH')return url.includes('?')?json(rows):json({...rows[2],version:97,status:'archived',is_active:false})
        const productId=url.split('/').at(-1)!,body=JSON.parse(String(init.body));calls.push({id:productId,body})
        if(receipts.has(body.idempotency_key))return json(receipts.get(body.idempotency_key))
        if(productId===rows[2].id&&body.version===19)return json({code:'PRODUCT_VERSION_CONFLICT'},409)
        const current={...rows.find(r=>r.id===productId),...body,version:body.version+11};receipts.set(body.idempotency_key,current)
        rows=rows.map(r=>r.id===productId?current:r)
        return productId===variantId&&calls.filter(c=>c.id===variantId).length===1?json({code:'REPLY_LOST'},503):json(current)
    })
    try{
        await h.selectRows(['A','B','C']);await h.click('Set as draft')
        for(const text of ['1 confirmed','1 uncertain','1 needs review'])assert.ok(h.text().includes(text),h.text())
        await h.remount();await h.click('Retry uncertain changes');assert.equal(calls.length,4);assert.deepEqual(calls[3],calls[1]);assert.match(h.text(),/2 confirmed/)
        await h.click('Review latest for C');assert.equal(calls.length,4);await h.click('Apply requested status for C')
        assert.equal(calls[4].body.version,97);assert.notEqual(calls[4].body.idempotency_key,calls[2].body.idempotency_key);assert.match(h.text(),/3 confirmed/)
    }finally{await h.close()}
})

test('missing revision sends no command and refresh can load a real revision',async()=>{
    let loaded:any={...row(),version:undefined},writes=0
    const h=await mount(async(_url,init)=>{if(init?.method==='PATCH'){writes++;const body=JSON.parse(String(init.body));return json({...row(113),...body,version:127})}return json([loaded])})
    try{await h.change(loaded.name,'draft');assert.equal(writes,0);assert.match(h.text(),/load its current version/)
        loaded=row(113);await h.openFilters();await h.click('Refresh products');await h.change(loaded.name,'draft');assert.equal(writes,1);assert.match(h.text(),/1 confirmed/)
    }finally{await h.close()}
})

test('mid bulk account refusal stops unsent items and never repeats known success',async()=>{
    const rows=[row(7,'A'),row(13,'B',variantId),row(19,'C','55555555-5555-4555-8555-555555555555')],calls:any[]=[]
    const h=await mount(async(_url,init)=>{
        if(init?.method!=='PATCH')return json(rows)
        const body=JSON.parse(String(init.body));calls.push(body)
        return calls.length===1?json({...rows[0],...body,version:23}):json({code:'SESSION_CONTEXT_CHANGED'},409)
    })
    try{await h.selectRows(['A','B','C']);await h.click('Set as draft');assert.equal(calls.length,2)
        for(const text of ['Account or store access changed','1 confirmed','1 not sent'])assert.ok(h.text().includes(text),h.text())
        await h.remount();assert.match(h.text(),/1 not sent/);assert.equal(calls.length,2)
        await h.click('Discard changes not sent');assert.match(h.text(),/0 not sent/);assert.match(h.text(),/1 confirmed/);assert.equal(calls.length,2);assert.equal(h.storage.length,0)
    }finally{await h.close()}
})

test('corrupt saved command blocks fresh status changes rather than minting a replacement key',async()=>{
    let writes=0
    const h=await mount(async(_url,init)=>{if(init?.method==='PATCH')writes++;return json([row()])})
    try{h.storage.setItem(`letbuyy.product-status.v1:${actorId}:alpha`,'{unreadable');await h.remount()
        assert.match(h.text(),/Saved status changes need recovery/)
        const select=h.container.querySelector('select[aria-label="Change status for Original product"]')as HTMLSelectElement;assert.ok(select);assert.equal(select.disabled,true);assert.equal(writes,0)
        assert.equal(h.storage.getItem(`letbuyy.product-status.v1:${actorId}:alpha`),'{unreadable')
    }finally{await h.close()}
})

test('late collection reads and late status replies cannot replace another store or actor scope',async()=>{
    const delayed=deferred<Response>();let writes=0
    const h=await mount(async(url,init)=>{
        if(init?.method==='PATCH'){writes++;return delayed.promise}
        return json([row(url.includes('/beta/')?103:7,url.includes('/beta/')?'Beta product':'Alpha product')])
    })
    try{
        const pending=h.change('Alpha product','draft');await new Promise(resolve=>setTimeout(resolve,0));await h.render('beta',id,'66666666-6666-4666-8666-666666666666')
        await act(async()=>delayed.resolve(json({...row(29,'Alpha product'),status:'draft',is_active:false})));await pending
        assert.match(h.text(),/Beta product/);assert.doesNotMatch(h.text(),/Alpha product/);assert.equal(writes,1)
        assert.equal(h.storage.getItem('letbuyy.product-status.v1:66666666-6666-4666-8666-666666666666:beta'),null)
        const saved=JSON.parse(h.storage.getItem(`letbuyy.product-status.v1:${actorId}:alpha`)!);assert.equal(saved.items[0].outcome,'uncertain')
    }finally{await h.close()}
})


test('an outstanding collection response cannot hydrate a newly selected store',async()=>{
    const late=deferred<Response>();let reads=0
    const h=await mount(async(url)=>{
        reads++
        if(url.includes('/beta/'))return json([row(103,'Beta only')])
        if(reads===1)return json([row(7,'Alpha initial')])
        return late.promise
    })
    try{
        await h.openFilters();const refresh=h.click('Refresh products');await new Promise(resolve=>setTimeout(resolve,0));await h.render('beta')
        await act(async()=>late.resolve(json([row(29,'Alpha late')])));await refresh
        assert.match(h.text(),/Beta only/);assert.doesNotMatch(h.text(),/Alpha late/)
    }finally{await h.close()}
})
