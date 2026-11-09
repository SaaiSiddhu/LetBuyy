import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync}from 'node:fs'
import {createRequire}from 'node:module'
import ts from 'typescript'
import React,{act}from 'react'
import {createRoot}from 'react-dom/client'
import * as shared from '@letbuyy/shared-types'
import * as journal from '../src/lib/products/category-command-journal'
import * as ui from '@letbuyy/ui'
const requireUI=createRequire(new URL('../../../../packages/typescript/ui/package.json',import.meta.url)),{JSDOM}=requireUI('jsdom')
const fixture=JSON.parse(readFileSync(new URL('../../../../tests/fixtures/product-category-contracts.json',import.meta.url),'utf8'))
const a=fixture.row.created_by,site=fixture.row.store_id,b='00000000-0000-4000-8000-000000000009'
function evaluate(deps:Record<string,unknown>){
 const source=readFileSync(new URL('../src/app/[store]/categories/page.tsx',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText
 const exports:Record<string,unknown>={};new Function('require','exports','React',js)((name:string)=>{assert.ok(deps[name],name);return deps[name]},exports,React)
 return exports.default as React.ComponentType
}
async function setup(){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://merchant.synthetic.invalid'}),originals=new Map<string,PropertyDescriptor|undefined>()
 const set=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value,writable:true})}
 set('window',dom.window);set('document',dom.window.document);set('navigator',dom.window.navigator);set('IS_REACT_ACT_ENVIRONMENT',true);set('React',React)
 const tails=new Map<string,Promise<unknown>>(),locks={request<T>(key:string,work:()=>Promise<T>|T){const task=(tails.get(key)??Promise.resolve()).then(work);tails.set(key,task.catch(()=>undefined));return task}}
 Object.defineProperty(dom.window.navigator,'locks',{value:locks})
 const intent:shared.ProductCategoryCommandIntent={operation:'update',category_id:fixture.row.id,command:{store_id:site,idempotency_key:fixture.receipt.idempotency_key,version:3,description:'Synthetic original category edit'}}
 await journal.retainCategoryCommand({actorId:a,siteId:site},intent,dom.window.localStorage,locks,()=>{})
 let actor=a,readsA=0;const writes:Array<{key:string|null;body:string}>=[]
 let reply:(body:Record<string,unknown>)=>Promise<Response>=async()=>Response.json({data:{...fixture.receipt,version:4,description:'Synthetic original category edit'}})
 set('fetch',async(input:string,init?:RequestInit)=>{
  const headers=new Headers(init?.headers),method=init?.method??'GET'
  if(method!=='GET'){writes.push({key:headers.get('X-Idempotency-Key'),body:init!.body as string});return reply(JSON.parse(init!.body as string))}
  if(headers.get('X-LetBuyy-Merchant-Context')===a)readsA++
  return Response.json(fixture.page)
 })
 const Page=evaluate({'react':React,'next/navigation':{useParams:()=>({store:'synthetic'})},'@letbuyy/ui':ui,'@letbuyy/shared-types':shared,
  '@/components/security/MerchantSecurityContext':{useMerchantSecurityContext:()=>({actorId:actor,store:'synthetic',siteId:site})},'@/lib/products/category-command-journal':journal})
 const root=createRoot(dom.window.document.getElementById('root')!)
 const settle=async()=>{await act(async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0))})}
 const render=async()=>{await act(async()=>root.render(<React.StrictMode><Page/></React.StrictMode>));await settle()}
 const retry=async()=>{const button=[...dom.window.document.querySelectorAll('button')].find(e=>e.textContent==='Retry original category request')!;assert(button);assert(!button.disabled);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await settle()}
 return {dom,writes,locks,intent,render,retry,settle,setActor:(id:string)=>{actor=id},readCount:()=>readsA,setReply:(fn:typeof reply)=>{reply=fn},close:async()=>{await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}}}
}
test('real web category workspace retains a mismatched acknowledgement and retries only its original body',async()=>{
 const h=await setup();try{
  h.setReply(async()=>Response.json({data:{...fixture.receipt,version:4,description:'Synthetic wrong acknowledged fields'}}));await h.render();await h.retry()
  assert.match(h.dom.window.document.body.textContent??'',/acknowledgement differs/)
  assert(await journal.readCategoryCommand({actorId:a,siteId:site},h.dom.window.localStorage,h.locks,()=>{}))
  h.setReply(async()=>Response.json({data:{...fixture.receipt,version:4,description:'Synthetic original category edit'}}));await h.retry()
  assert.deepEqual(h.writes[0],h.writes[1]);assert.equal(h.writes[0].key,h.intent.command.idempotency_key)
  assert.equal(await journal.readCategoryCommand({actorId:a,siteId:site},h.dom.window.localStorage,h.locks,()=>{}),null)
 }finally{await h.close()}
})
test('real web category workspace retires late success after an account change and preserves original recovery',async()=>{
 const h=await setup();let release!:(value:Response)=>void;try{
  h.setReply(()=>new Promise(resolve=>release=resolve));await h.render();await h.retry();const before=h.readCount()
  h.setActor(b);await h.render();release(Response.json({data:{...fixture.receipt,version:4,description:'Synthetic original category edit'}}));await h.settle()
  assert.equal(h.readCount(),before,'A retired success cannot trigger more old-account reads.')
  assert(await journal.readCategoryCommand({actorId:a,siteId:site},h.dom.window.localStorage,h.locks,()=>{}))
  assert.equal(await journal.readCategoryCommand({actorId:b,siteId:site},h.dom.window.localStorage,h.locks,()=>{}),null)
  assert.doesNotMatch(h.dom.window.document.body.textContent??'',/assigned products updated|Saved category request needs recovery/)
 }finally{await h.close()}
})
