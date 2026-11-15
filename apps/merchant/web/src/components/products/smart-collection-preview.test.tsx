// Actual component lifecycle with explicit synthetic HTTP inputs. Real SQL and
// normal browser journeys remain separate evidence.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import * as shared from '@letbuyy/shared-types'
import * as journal from '@/lib/products/collection-command-journal'
import * as recovery from '@/lib/products/collection-command-recovery'
import * as ui from '@letbuyy/ui'
import * as icons from 'lucide-react'
const requireUI = createRequire(new URL('../../../../../../packages/typescript/ui/package.json', import.meta.url)), { JSDOM } = requireUI('jsdom')
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = id(1), site = id(2), collection = id(3)
const stored = { id: collection, store_id: site, name: 'Synthetic saved collection', slug: 'synthetic-saved', description: null,
    conditions: [{ field: 'title' as const, op: 'contains' as const, value: 'Synthetic' }], match_type: 'all' as const, is_active: false, version: 7, created_at: null }
const page = { success: true, data: [stored], meta: { store_id: site, page: 1, per_page: 20, total: 1, total_pages: 1, total_is_exact: true, has_next: false, has_prev: false } }
const preview = (count=1,evaluated=2,total=evaluated) => ({ store_id: site, collection_id: collection, collection_version: 7, match_type: 'all', condition_count: 1,
    count, sample_product_ids: Array.from({ length: Math.min(10,count) },(_,n)=>id(100+n)), evaluated_of: evaluated, capped_at: 500, catalog_count: total, count_is_exact: evaluated===total })
const intent: shared.CollectionMetadataCommandIntent = { operation: 'update', collection_id: collection, command: { collection_type: 'smart', store_id: site, idempotency_key: id(4), version: 7, description: 'Synthetic original draft' } }
const receipt = () => ({ id: collection, store_id: site, title: stored.name, slug: stored.slug, description: 'Synthetic original draft', image_url: null, is_active: false,
    match_type: 'all', collection_type: 'smart', conditions: stored.conditions, version: 8, membership_version: 1, created_at: null, updated_at: '2026-11-03T00:00:00Z', deleted_at: null,
    created_by: actor, updated_by: actor, actor_id: actor, operation: 'update', idempotency_key: id(4), expected_version: 7, request: { collection_type: 'smart', description: 'Synthetic original draft' } })
type Transport = (url: string, init?: RequestInit) => Promise<Response>
async function mount(transport?: Transport, retained=false, kind: 'manual' | 'smart' = 'smart') {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://merchant.synthetic.invalid', pretendToBeVisual: true }), originals = new Map<string,PropertyDescriptor|undefined>()
    const set = (k:string,v:unknown) => { originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k)); Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v}) }
    set('window',dom.window); set('document',dom.window.document); set('navigator',dom.window.navigator); set('IS_REACT_ACT_ENVIRONMENT',true);set('React',React)
    for(const name of ['HTMLElement','Element','Node','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
        const value=dom.window[name];set(name,['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(name)?value.bind(dom.window):value)
    }
    const tails = new Map<string,Promise<unknown>>(), locks={request<T>(k:string,work:()=>Promise<T>|T){const next=(tails.get(k)??Promise.resolve()).then(work);tails.set(k,next.catch(()=>undefined));return next}}
    Object.defineProperty(dom.window.navigator,'locks',{value:locks})
    if(retained)await journal.retainCollectionCommand({actorId:actor,siteId:site},shared.CollectionMetadataCommandIntentSchema.parse({...intent,command:{...intent.command,collection_type:kind}}),dom.window.localStorage,locks,()=>{})
    const calls: {url:string;method:string;body?:BodyInit|null;key:string|null}[]=[]
    const kindReceipt=()=>({...receipt(),collection_type:kind,request:{...receipt().request,collection_type:kind}})
    const manual=Object.fromEntries(Object.entries(kindReceipt()).filter(([key])=>!['actor_id','operation','idempotency_key','expected_version','request'].includes(key)))
    const defaultTransport:Transport=async(url,init)=>Response.json((init?.method??'GET')!=='GET'?{data:kindReceipt()}:url.endsWith('/preview')?{data:preview()}:url.includes('?')?page:{data:kind==='smart'?stored:manual})
    let reply=transport??defaultTransport,currentActor=actor
    set('fetch',async(input:string,init?:RequestInit)=>{calls.push({url:String(input),method:init?.method??'GET',body:init?.body,key:new Headers(init?.headers).get('X-Idempotency-Key')});return reply(String(input),init)})
    const source=readFileSync(new URL(kind==='smart'?'../../app/[store]/products/smart-collections/page.tsx':'./ManualCollectionMetadataPanel.tsx',import.meta.url),'utf8')
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText
    const exports:Record<string,unknown>={},deps:Record<string,unknown>={'react':React,'next/navigation':{useParams:()=>({store:'synthetic'})},'@letbuyy/ui':ui,'lucide-react':icons,'@letbuyy/shared-types':shared,
        '@/components/security/MerchantSecurityContext':{useMerchantSecurityContext:()=>({store:'synthetic',actorId:currentActor,siteId:site})},'@/lib/products/collection-command-journal':journal,'@/lib/products/collection-command-recovery':recovery}
    new Function('require','exports','React',js)((name:string)=>{assert(deps[name],name);return deps[name]},exports,React)
    const Page=exports.default as React.ComponentType,Panel=exports.ManualCollectionMetadataPanel as React.ComponentType<{store:string;actorId:string;siteId:string;selected:string;onClose:()=>void;onSaved:()=>void}>,root=createRoot(dom.window.document.getElementById('root')!)
    const settle=async()=>{await act(async()=>{for(let n=0;n<8;n++)await new Promise(r=>setTimeout(r,0))})}
    const render=async()=>{await act(async()=>root.render(<React.StrictMode>{kind==='smart'?<Page/>:<Panel key={currentActor} store="synthetic" actorId={currentActor} siteId={site} selected={collection} onClose={()=>{}} onSaved={()=>{}}/>}</React.StrictMode>));await settle()}
    await render()
    const text=()=>dom.window.document.body.textContent??''
    const click=async(label:string)=>{const button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===label);assert(button,'Missing '+label+': '+text());assert(!button.disabled,label+' disabled');try{await act(async()=>button.click());await settle()}catch(error){if(error instanceof AggregateError)throw new Error(error.errors.map(value=>String(value)).join('\n'),{cause:error});throw error}}
    const pending=()=>journal.readCollectionCommand({actorId:actor,siteId:site},dom.window.localStorage,locks,()=>{})
    return {dom,calls,text,click,pending,settle,render,setActor:(value:string)=>{currentActor=value},setReply:(value:Transport)=>{reply=value},defaultTransport,
        close:async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,v]of originals){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k)}}}
}
test('saved rules preview reads the current revision without writes and displays unknown creation time honestly',async()=>{
    const h=await mount();try{await h.click('Edit '+stored.name);await h.click('Preview saved rules');assert.match(h.text(),/1 matching products/);assert.match(h.text(),/Evaluated 2 of 2/);assert.match(h.text(),/Creation date unavailable/);assert.equal(h.calls.length,3);assert(h.calls.every(c=>c.method==='GET'&&c.body===undefined));}finally{await h.close()}
})
test('preview failure cannot become zero matches and an explicit retry can recover',async()=>{
    let attempts=0;const h=await mount();try{h.setReply(async(url,init)=>url.endsWith('/preview')&&++attempts===1?Response.json({error:{code:'UNAVAILABLE',message:'Synthetic preview unavailable'}},{status:503}):h.defaultTransport(url,init));await h.click('Edit '+stored.name);await h.click('Preview saved rules');assert.match(h.text(),/Synthetic preview unavailable/);assert.doesNotMatch(h.text(),/0 matching products/);await h.click('Preview saved rules');assert.equal(attempts,2);assert.match(h.text(),/1 matching products/);}finally{await h.close()}
})
test('partial rule preview describes its bounded sample and refuses a changed collection revision',async()=>{
    const h=await mount();try{h.setReply(async(url,init)=>url.endsWith('/preview')?Response.json({data:preview(500,500,1005)}):h.defaultTransport(url,init));await h.click('Edit '+stored.name);await h.click('Preview saved rules');assert.match(h.text(),/At least 500 matches/);assert.match(h.text(),/total matches are unknown/);assert.match(h.text(),/Evaluated 500 of 1005/);
      h.setReply(async(url,init)=>url.endsWith('/preview')?Response.json({data:{...preview(),collection_version:8}}):h.defaultTransport(url,init));await h.click('Preview saved rules');assert.match(h.text(),/collection changed/i);
    }finally{await h.close()}
})
test('a mismatched receipt remains pending and retry retains its exact original body/key',async()=>{
    const h=await mount(undefined,true);try{h.setReply(async(url,init)=>(init?.method??'GET')!=='GET'?Response.json({data:{...receipt(),actor_id:id(9)}}):h.defaultTransport(url,init));await h.click('Retry original collection save');assert(await h.pending());assert.match(h.text(),/acknowledgement could not be confirmed/);h.setReply(h.defaultTransport);await h.click('Retry original collection save');assert.equal(await h.pending(),null);const writes=h.calls.filter(c=>c.method==='PATCH');assert.equal(writes.length,2);assert.equal(writes[0].body,writes[1].body);assert.equal(writes[0].key,id(4));assert.equal(writes[1].key,id(4));}finally{await h.close()}
})
test('an old account late success cannot clear its original request or update a replacement view',async()=>{
    const h=await mount(undefined,true);let release!:(response:Response)=>void;try{h.setReply((url,init)=>(init?.method??'GET')!=='GET'?new Promise(r=>release=r):h.defaultTransport(url,init));await h.click('Retry original collection save');h.setActor(id(9));await h.render();release(Response.json({data:receipt()}));await h.settle();assert(await h.pending());assert.doesNotMatch(h.text(),/Collection saved\./);}finally{await h.close()}
})
test('unavailable list is distinct from an empty matching population',async()=>{
    const h=await mount(async()=>Response.json({error:{code:'UNAVAILABLE',message:'Synthetic collection list unavailable'}},{status:503}));try{assert.match(h.text(),/rows and counts are unavailable/);assert.doesNotMatch(h.text(),/No matching smart collections|0 matching collections/);}finally{await h.close()}
})
for(const kind of ['manual','smart'] as const) {
test(`${kind}: canonical deleted target is released only after explicit confirmation and exact original recheck`,async()=>{
    const h=await mount(undefined,true,kind);try{
        h.setReply(async(url,init)=>(init?.method??'GET')!=='GET'?Response.json({error:{code:'COLLECTION_NOT_FOUND',message:'The collection is no longer available.'}},{status:404}):h.defaultTransport(url,init));
        await h.click('Retry original collection save');assert(await h.pending());
        await h.click('Discard rejected collection request');
        assert(await h.pending(),'Opening the dialog never discards intent');
        await h.click('Discard request');assert.equal(await h.pending(),null);
        assert.match(h.text(),/Rejected request discarded\. The collection remains deleted\./);
        const writes=h.calls.filter(c=>c.method==='PATCH');assert.equal(writes.length,2);assert.equal(writes[0].body,writes[1].body);assert.equal(writes[0].key,writes[1].key)
    }finally{await h.close()}
})
for(const failure of [{status:404,code:'NOT_FOUND'},{status:503,code:'UNAVAILABLE'},{status:403,code:'FORBIDDEN'}])test(`${kind}: discard preserves original request after ${failure.code}`,async()=>{
    const h=await mount(undefined,true,kind);try{
        h.setReply(async(url,init)=>(init?.method??'GET')!=='GET'?Response.json({error:{code:'COLLECTION_NOT_FOUND'}},{status:404}):h.defaultTransport(url,init));await h.click('Retry original collection save');
        const original=await h.pending();await h.click('Discard rejected collection request');
        h.setReply(async(url,init)=>(init?.method??'GET')!=='GET'?Response.json({error:{code:failure.code,message:'Synthetic subsequent failure'}},{status:failure.status}):h.defaultTransport(url,init));
        await h.click('Discard request');assert.deepEqual(await h.pending(),original);assert.doesNotMatch(h.text(),/Rejected request discarded\./)
    }finally{await h.close()}
})
test(`${kind}: an original receipt wins over stale missing-target presentation`,async()=>{
    const h=await mount(undefined,true,kind);try{
        h.setReply(async(url,init)=>(init?.method??'GET')!=='GET'?Response.json({error:{code:'COLLECTION_NOT_FOUND'}},{status:404}):h.defaultTransport(url,init));await h.click('Retry original collection save');await h.click('Discard rejected collection request');h.setReply(h.defaultTransport);await h.click('Discard request');assert.equal(await h.pending(),null);assert.match(h.text(),/Collection saved\./);assert.doesNotMatch(h.text(),/Rejected request discarded\./)
    }finally{await h.close()}
})
}
