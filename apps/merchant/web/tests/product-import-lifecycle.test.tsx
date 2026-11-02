import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React,{act} from 'react'
import * as shared from '@letbuyy/shared-types'
import * as journal from '../src/lib/products/product-import-journal'
import * as messages from '../src/lib/products/product-import-messages'
import * as ui from '@letbuyy/ui'
import { createRoot } from 'react-dom/client'
const requireUI=createRequire(new URL('../../../../packages/typescript/ui/package.json',import.meta.url)),{JSDOM}=requireUI('jsdom')
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,site=id(1),a=id(2),b=id(3),csv='name,price\nSynthetic private import,10.50'
const evaluate=(deps:Record<string,unknown>)=>{
 const source=readFileSync(new URL('../src/app/[store]/products/import/page.tsx',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText
 const exports:Record<string,unknown>={};new Function('require','exports','React',js)((name:string)=>{assert.ok(deps[name],name);return deps[name]},exports,React)
 return exports.default as React.ComponentType
}
test('the actual web workspace deduplicates StrictMode entry and retires a late registration on account change',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://merchant.synthetic.invalid'}),originals=new Map<string,PropertyDescriptor|undefined>()
 const set=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value,writable:true})}
 set('window',dom.window);set('document',dom.window.document);set('navigator',dom.window.navigator);set('IS_REACT_ACT_ENVIRONMENT',true);set('React',React)
 let tail:Promise<unknown>=Promise.resolve();Object.defineProperty(dom.window.navigator,'locks',{value:{request<T>(_name:string,fn:()=>Promise<T>|T){const next=tail.then(fn);tail=next.catch(()=>undefined);return next}}})
 let actor=a,posted:Record<string,unknown>|null=null,release!:(response:Response)=>void
 const deferred=new Promise<Response>(resolve=>release=resolve),calls:{actor:string;view:string;method:string}[]=[]
 set('fetch',async(input:string,init?:RequestInit)=>{
  const url=new URL(input,dom.window.location.origin),headers=new Headers(init?.headers),who=headers.get('X-LetBuyy-Merchant-Context')!,method=init?.method??'GET',view=url.searchParams.get('view')??'history'
  calls.push({actor:who,view,method})
  if(method==='POST'){posted=JSON.parse(init!.body as string);return deferred}
  if(view==='key')return Response.json({data:{job:null}})
  if(view==='capabilities')return Response.json({data:{store_id:site,actor_id:who,contract_version:2,max_rows:500,max_bytes:1048576,durable_registration:true,durable_rows:true,async_recovery:true}})
  if(view==='history')return Response.json({data:{data:[],meta:{store_id:site,actor_id:who,page:1,per_page:20,total:0,total_is_exact:true,has_next:false}}})
  throw new Error('Unexpected source request: '+view)
 })
 const Page=evaluate({'react':React,'next/navigation':{useParams:()=>({store:'synthetic'})},'@letbuyy/ui':ui,'@letbuyy/shared-types':shared,
  '@/components/security/MerchantSecurityContext':{useMerchantSecurityContext:()=>({actorId:actor,store:'synthetic',siteId:site})},'@/lib/products/product-import-journal':journal,'@/lib/products/product-import-messages':messages})
 const root=createRoot(dom.window.document.getElementById('root')!)
 const settle=async()=>{await act(async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0))})}
 try {
  await act(async()=>root.render(<React.StrictMode><Page/></React.StrictMode>));await settle()
  assert.equal(calls.filter(c=>c.actor===a&&c.view==='history').length,1)
  assert.equal(calls.filter(c=>c.actor===a&&c.view==='capabilities').length,1)
  const picker=dom.window.document.querySelector('input[type=file]')!
  Object.defineProperty(picker,'files',{configurable:true,value:[{name:'private.csv',size:new TextEncoder().encode(csv).length,arrayBuffer:async()=>new TextEncoder().encode(csv).buffer}]})
  await act(async()=>picker.dispatchEvent(new dom.window.Event('change',{bubbles:true})));await settle()
  const start=[...dom.window.document.querySelectorAll('button')].find(e=>e.textContent==='Start import')!
  assert.ok(!start.disabled)
  await act(async()=>start.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await settle()
  assert.ok(posted);assert.equal(calls.filter(c=>c.method==='POST').length,1)
  const original=posted as unknown as {idempotency_key:string}
  actor=b;await act(async()=>root.render(<React.StrictMode><Page/></React.StrictMode>));await settle()
  release(Response.json({data:{job:{id:id(4),type:'product_import',contract_version:2,store_id:site,actor_id:a,idempotency_key:original.idempotency_key,
   source_sha256:'a'.repeat(64),status:'queued',total_rows:1,row_count:0,failed_rows:0,pending_rows:1,stopped_rows:0,resumable:true,error_code:null,
   created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',started_at:null,completed_at:null,download_url:null}}}));await settle()
  assert.doesNotMatch(dom.window.document.body.textContent??'',/private.csv|Original import|original registration needs confirmation/i)
  assert.equal(dom.window.document.querySelector('textarea')?.value,'')
  assert.equal(calls.filter(c=>c.actor===a&&c.view==='job').length,0,'A retired registration must not trigger more private reads.')
  const stored=dom.window.localStorage.getItem(`letbuyy.product-import.v2:${a}:${site}`)
  assert.ok(stored?.includes(original.idempotency_key));assert.ok(!stored?.includes(csv))
 }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}}
})
