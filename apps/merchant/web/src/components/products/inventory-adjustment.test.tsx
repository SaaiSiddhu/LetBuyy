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
const locationId='77777777-7777-4777-8777-777777777777'
const levelId='88888888-8888-4888-8888-888888888888'
const row=(available=10)=>({id:levelId,product_id:id,variant_id:variantId,location_id:locationId,product_name:'Synthetic stock',variant_title:'M',location_name:'Synthetic warehouse',sku:'SYN-STOCK',images:[],available,reserved:0,incoming:0,on_hand:available,sellable:available,track_inventory:true,updated_at:'2026-10-18T00:00:00Z'})
const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { data } : { error: data }), {
    status, headers: { 'content-type': 'application/json' },
})
type Transport = (url: string, init?: RequestInit) => Promise<Response>
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

async function mount(transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/' + id })
    const names = ['window', 'document', 'navigator', 'self', 'Element', 'fetch']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 5)) Object.defineProperty(globalThis, name, { configurable: true, writable: true,
        value: name === 'window' || name === 'self' ? dom.window : dom.window[name] })
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('marketplace-listings')
        ? Promise.resolve(json(null)) : transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../security/MerchantSecurityContext')
    const { default: InventoryPage } = await import('../../app/[store]/products/inventory/page')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let editorKey = 0
    const router = { bfcacheId: 'synthetic-router-cache',  back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', productId = id, actor = actorId) => { await act(async () => {
        root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store, productId }}>
            <ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId: actor, store }}><InventoryPage key={editorKey} /></MerchantSecurityContext.Provider></ToastProvider>
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
    const quantity = async (value:string) => {await act(async()=>{
        const input=container.querySelector('table input[aria-label="Available quantity"]')as HTMLInputElement
        assert.ok(input);assert.equal(input.disabled,false)
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value)
        input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))
    })}
    const text = () => container.textContent || ''
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    return { container, render, remount, button, click, quantity, text, storage: dom.window.sessionStorage, close }
}

test('a real stock row captures its actor, target bindings, signed delta and a new logical key per confirmed command',async()=>{
 let current=row(); const calls:{body:any;headers:Headers}[]=[]
 const h=await mount(async(_url,init)=>{if(init?.method!=='POST')return json([current]);const body=JSON.parse(String(init.body));calls.push({body,headers:new Headers(init.headers)});current={...current,available:current.available+body.adjustment};return json(current)})
 try{await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(calls[0].body.adjustment,2);assert.equal(calls[0].body.product_id,id);assert.equal(calls[0].body.variant_id,variantId);assert.equal(calls[0].body.location_id,locationId);assert.equal(calls[0].headers.get('X-LetBuyy-Merchant-Context'),actorId);assert.equal(h.storage.length,0)
  await h.click('Adjust');await h.quantity('13');await h.click('Save');assert.equal(calls[1].body.adjustment,1);assert.notEqual(calls[1].headers.get('X-Idempotency-Key'),calls[0].headers.get('X-Idempotency-Key'));assert.match(h.text(),/Adjustment confirmed/)
 }finally{await h.close()}
})

test('committed HTTP errors and network reply loss survive remount with the same body/key and preserve independent stock changes',async()=>{
 for(const fault of ['http','network']){
  let current=row(); const calls:{body:string;key:string|null}[]=[];const receipts=new Map<string,any>()
  const h=await mount(async(_url,init)=>{
   if(init?.method!=='POST')return json([current]);const key=new Headers(init.headers).get('X-Idempotency-Key')!,body=JSON.parse(String(init.body));calls.push({body:String(init.body),key})
   if(receipts.has(key))return json(receipts.get(key))
   const ack={...current,available:current.available+body.adjustment};receipts.set(key,ack);current={...ack,available:ack.available-3}
   if(fault==='network')throw new TypeError('Synthetic committed reply loss');return json({code:'SYNTHETIC_REPLY_LOST',message:'Synthetic reply lost'},503)
  })
  try{
   await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(receipts.size,1);assert.equal(h.storage.length,1)
   const input=h.container.querySelector('table input[aria-label="Available quantity"]')as HTMLInputElement;assert.equal(input.disabled,true)
   await h.click('Refresh');await h.remount();await h.click('Retry pending adjustment');assert.deepEqual(calls[1],calls[0]);assert.equal(receipts.size,1);assert.equal(current.available,9);assert.equal(h.storage.length,0);assert.match(h.text(),/stock change \+2 confirmed/)
  }finally{await h.close()}
 }
})

test('a definite rejected adjustment can only be discarded explicitly and does not rekey an uncertain request',async()=>{
 let writes=0;const calls:string[]=[]
 const h=await mount(async(_url,init)=>{if(init?.method!=='POST')return json([row()]);writes++;calls.push(new Headers(init.headers).get('X-Idempotency-Key')!);return writes===1?json({code:'INVENTORY_ADJUSTMENT_FAILED',message:'Inventory adjustment failed'},400):json(row(12))})
 try{await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.match(h.text(),/Inventory adjustment failed/);assert.equal(h.storage.length,1);assert.equal(h.button('Save').disabled,true)
  await h.click('Discard refused adjustment');assert.equal(writes,1);assert.equal(h.storage.length,0);await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(writes,2);assert.notEqual(calls[1],calls[0])
 }finally{await h.close()}
})

test('account refusals retain the captured command and prevent another adjustment until the account is reviewed',async()=>{
 let writes=0
 const h=await mount(async(_url,init)=>{if(init?.method!=='POST')return json([row()]);writes++;return json({code:'SESSION_CONTEXT_CHANGED',message:'The signed-in account changed.'},409)})
 try{await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.match(h.text(),/Account or store access changed/);assert.equal(h.storage.length,1);assert.equal(h.button('Retry pending adjustment').disabled,true);assert.equal(writes,1)}finally{await h.close()}
})

test('a late stock reply cannot change a newly selected store or its pending command namespace',async()=>{
 const reply=deferred<Response>();let writes=0
 const h=await mount(async(url,init)=>{if(init?.method==='POST'){writes++;return reply.promise}return json([{...row(),product_name:url.includes('/beta/')?'Beta stock':'Alpha stock'}])})
 try{
  await h.click('Adjust');await h.quantity('12');const saving=h.click('Save');await new Promise(resolve=>setTimeout(resolve,0));await h.render('beta',id,'66666666-6666-4666-8666-666666666666')
  await act(async()=>reply.resolve(json(row(12))));await saving;assert.match(h.text(),/Beta stock/);assert.doesNotMatch(h.text(),/Alpha stock/);assert.equal(writes,1)
  assert.equal(h.storage.getItem('letbuyy.inventory-adjustment.v1:66666666-6666-4666-8666-666666666666:beta'),null);assert.equal(JSON.parse(h.storage.getItem(`letbuyy.inventory-adjustment.v1:${actorId}:alpha`)!).phase,'uncertain')
 }finally{await h.close()}
})

test('missing real level/location bindings cannot become a fabricated writable stock target',async()=>{
 let valid=false,writes=0
 const h=await mount(async(_url,init)=>{if(init?.method==='POST'){writes++;return json(row(12))}return json([{...row(),...(valid?{}:{id:'product:'+id,location_id:null})}])})
 try{await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(writes,0);assert.match(h.text(),/verified stock level and location/)
  valid=true;await h.click('Refresh');await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(writes,1)
 }finally{await h.close()}
})

test('an unreadable saved adjustment blocks fresh stock commands without overwriting its key',async()=>{
 let writes=0
 const h=await mount(async(_url,init)=>{if(init?.method==='POST')writes++;return json([row()])})
 try{h.storage.setItem(`letbuyy.inventory-adjustment.v1:${actorId}:alpha`,'{corrupt');await h.remount();assert.match(h.text(),/Saved adjustment needs recovery/);assert.equal(h.button('Adjust').disabled,true);assert.equal(writes,0);assert.equal(h.storage.getItem(`letbuyy.inventory-adjustment.v1:${actorId}:alpha`),'{corrupt')}finally{await h.close()}
})


test('an unrecognized HTTP400 after a committed adjustment remains uncertain and cannot be discarded as a refusal',async()=>{
 let current=row(),first=true;const receipts=new Map<string,any>(),calls:{key:string;body:string}[]=[]
 const h=await mount(async(_url,init)=>{
  if(init?.method!=='POST')return json([current]);const key=new Headers(init.headers).get('X-Idempotency-Key')!,body=String(init.body);calls.push({key,body})
  if(receipts.has(key))return json(receipts.get(key));current={...current,available:current.available+JSON.parse(body).adjustment};receipts.set(key,current)
  if(first){first=false;return new Response('Synthetic malformed upstream reply',{status:400})}return json(current)
 })
 try{await h.click('Adjust');await h.quantity('12');await h.click('Save');assert.equal(h.storage.length,1);assert.equal([...h.container.querySelectorAll('button')].some(button=>button.textContent?.trim()==='Discard refused adjustment'),false)
  await h.click('Retry pending adjustment');assert.deepEqual(calls[1],calls[0]);assert.equal(receipts.size,1);assert.equal(current.available,12);assert.equal(h.storage.length,0)
 }finally{await h.close()}
})
