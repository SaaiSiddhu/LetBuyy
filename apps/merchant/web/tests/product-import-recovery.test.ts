import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server'
import { createLetbuyyApiClient, LetbuyyApiError } from '@letbuyy/api-client'
import * as shared from '@letbuyy/shared-types'
import { validateMerchantMutationRequest } from '../src/lib/api/request-origin'
import { readProductImport, retainProductImport, clearProductImport } from '../src/lib/products/product-import-journal'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const site=id(1),actor=id(2),key=id(3),jobId=id(4),csv='name,price\nSynthetic shirt,10.50',origin='https://admin.synthetic.invalid'
async function sourceHash(){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(csv)))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function evaluate<T>(path:string,deps:Record<string,unknown>):T {
 const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 const exports={};new Function('require','exports',js)((name:string)=>{assert.ok(deps[name],name);return deps[name]},exports);return exports as T
}
function record(hash:string){return {id:jobId,type:'product_import',contract_version:2,store_id:site,actor_id:actor,idempotency_key:key,
 source_sha256:hash,status:'queued',total_rows:1,row_count:0,failed_rows:0,pending_rows:1,stopped_rows:0,resumable:true,error_code:null,
 created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',started_at:null,completed_at:null,download_url:null}}
for(const fault of ['none','origin','actor','key','store','ack-actor','ack-source','old-protocol','backend-denied'])test('actual Next/SDK import command boundary: '+fault,async()=>{
 const calls:Request[]=[],hash=await sourceHash()
 const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',fetch:async(input,init)=>{
  const request=new Request(input,init);calls.push(request)
  if(new URL(request.url).pathname.endsWith('/auth/custom/session'))return Response.json({authenticated:true,user:{id:actor}})
  assert.equal(request.method,'POST');assert.equal(new URL(request.url).pathname,'/v1/export/imports/register');assert.equal(request.headers.get('X-Store-ID'),site);assert.equal(request.headers.get('X-Idempotency-Key'),key)
  assert.deepEqual(await request.json(),{store_id:site,idempotency_key:key,contract_version:2,csv})
  if(fault==='backend-denied')return Response.json({error:{code:'FORBIDDEN',message:'Synthetic denial'}},{status:403})
  return Response.json({data:{job:{...record(fault==='ack-source'?'a'.repeat(64):hash),...(fault==='ack-actor'?{actor_id:id(99)}:{}),...(fault==='old-protocol'?{contract_version:1}:{})}}},{status:202})
 }})
 const client={createMerchantApiClient:()=>api,merchantApiErrorResponse:(error:unknown)=>NextResponse.json({error:{code:error instanceof LetbuyyApiError?error.code:'UNCONFIRMED'}},{status:error instanceof LetbuyyApiError?error.status:503})}
 const security=evaluate<Record<string,unknown>>('../src/lib/api/merchant-security-scope.ts',{'next/server':{NextRequest,NextResponse},'./client':client,'./request-origin':{validateMerchantMutationRequest},'@/lib/stores/resolve-owned-store':{resolveOwnedStoreId:async()=>({storeId:site})}})
 const route=evaluate<{POST:(r:NextRequest,c:{params:Promise<{store:string}>})=>Promise<Response>}>('../src/app/api/stores/[store]/products/import/route.ts',{
  'next/server':{NextRequest,NextResponse},'@/lib/api/client':client,'@/lib/api/merchant-security-scope':security,'@letbuyy/shared-types':shared,
 })
 const previous=process.env.NEXT_PUBLIC_ADMIN_URL;process.env.NEXT_PUBLIC_ADMIN_URL=origin
 try {
  const result=await route.POST(new NextRequest(origin+'/api/stores/synthetic/products/import',{method:'POST',headers:{host:new URL(origin).host,
   origin:fault==='origin'?'https://foreign.synthetic.invalid':origin,'Content-Type':'application/json','X-Idempotency-Key':key,
   'X-LetBuyy-Merchant-Context':fault==='actor'?id(99):actor},body:JSON.stringify({store_id:fault==='store'?id(99):site,idempotency_key:fault==='key'?id(98):key,contract_version:2,csv})}),{params:Promise.resolve({store:'synthetic'})})
  const expected:Record<string,number>={none:202,origin:403,actor:409,key:400,store:400,'ack-actor':503,'ack-source':503,'old-protocol':503,'backend-denied':403}
  assert.equal(result.status,expected[fault],await result.text());assert.match(result.headers.get('Cache-Control')??'',/private.*no-store/)
  if(['origin','actor','key','store'].includes(fault))assert.equal(calls.filter(r=>r.method==='POST').length,0)
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ADMIN_URL;else process.env.NEXT_PUBLIC_ADMIN_URL=previous}
})
class Storage {
 data=new Map<string,string>();fail=false
 getItem(key:string){return this.data.get(key)??null}
 setItem(key:string,value:string){if(this.fail)throw new Error('Synthetic persistence failure');this.data.set(key,value)}
 removeItem(key:string){this.data.delete(key)}
}
function locks(){let tail:Promise<unknown>=Promise.resolve();return {request<T>(_name:string,fn:()=>Promise<T>|T):Promise<T>{const result=tail.then(fn);tail=result.catch(()=>undefined);return result}}}
test('concurrent browser submissions retain one original key, hash only, and refuse changed source',async()=>{
 const storage=new Storage(),lock=locks(),scope={actorId:actor,siteId:site},check=()=>{},hash=await sourceHash()
 const [a,b]=await Promise.all([retainProductImport(scope,hash,storage,lock,check),retainProductImport(scope,hash,storage,lock,check)])
 assert.equal(a.key,b.key);assert.equal(storage.data.size,1);assert.ok(![...storage.data.values()][0].includes(csv))
 await assert.rejects(()=>retainProductImport(scope,'b'.repeat(64),storage,lock,check),/original import/)
 assert.equal((await readProductImport(scope,storage,lock,check))?.key,a.key)
 await clearProductImport(a,storage,lock,check);assert.equal(storage.data.size,0)
})
test('browser storage refusal and context retirement cannot return a new sendable identity',async()=>{
 const storage=new Storage(),lock=locks(),scope={actorId:actor,siteId:site},hash=await sourceHash();storage.fail=true
 await assert.rejects(()=>retainProductImport(scope,hash,storage,lock,()=>{}),/persistence failure/)
 storage.fail=false;await assert.rejects(()=>retainProductImport(scope,hash,storage,lock,()=>{throw new Error('Retired context')}),/Retired context/)
 assert.equal(storage.data.size,0)
})
test('retained browser identity is isolated from another actor and checked before deletion',async()=>{
 const storage=new Storage(),lock=locks(),scope={actorId:actor,siteId:site},hash=await sourceHash(),a=await retainProductImport(scope,hash,storage,lock,()=>{})
 assert.equal(await readProductImport({...scope,actorId:id(9)},storage,lock,()=>{}),null)
 await assert.rejects(()=>clearProductImport({...a,key:id(10)},storage,lock,()=>{}),/storage changed/)
 assert.equal(storage.data.size,1)
})

test('the SDK refuses an older backend at the distinct v2 path without entering its legacy importer',async()=>{
 const calls:string[]=[];const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',fetch:async(input,init)=>{
  const r=new Request(input,init);calls.push(new URL(r.url).pathname);return Response.json({error:{code:'NOT_FOUND',message:'Older backend'}},{status:404});
 }});
 await assert.rejects(()=>api.productImports.register({store_id:site,idempotency_key:key,contract_version:2,csv}),error=>error instanceof LetbuyyApiError&&error.status===404);
 assert.deepEqual(calls,['/v1/export/imports/register']);
});

for(const fault of ['none','key','actor','nonterminal','backend-refusal'])test('actual Next/SDK registration-stop boundary: '+fault,async()=>{
 const hash=await sourceHash(),writes:Request[]=[],stopped={...record(hash),status:'stopped',total_rows:0,pending_rows:0,resumable:false,error_code:'PRODUCT_IMPORT_STOPPED',completed_at:'2026-11-01T00:00:01Z'};
 const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',fetch:async(input,init)=>{
  const r=new Request(input,init);if(new URL(r.url).pathname.endsWith('/auth/custom/session'))return Response.json({authenticated:true,user:{id:actor}});
  writes.push(r);assert.equal(new URL(r.url).pathname,'/v1/export/imports/stop-registration');assert.equal(r.headers.get('X-Idempotency-Key'),key);
  assert.deepEqual(await r.json(),{store_id:site,idempotency_key:key,source_sha256:hash,contract_version:2});
  if(fault==='backend-refusal')return Response.json({error:{code:'UNAVAILABLE'}},{status:503});
  return Response.json({data:{job:fault==='nonterminal'?record(hash):{...stopped,...(fault==='actor'?{actor_id:id(99)}:{})}}});
 }});
 const client={createMerchantApiClient:()=>api,merchantApiErrorResponse:(error:unknown)=>NextResponse.json({error:{code:error instanceof LetbuyyApiError?error.code:'UNCONFIRMED'}},{status:error instanceof LetbuyyApiError?error.status:503})};
 const security=evaluate<Record<string,unknown>>('../src/lib/api/merchant-security-scope.ts',{'next/server':{NextRequest,NextResponse},'./client':client,'./request-origin':{validateMerchantMutationRequest},'@/lib/stores/resolve-owned-store':{resolveOwnedStoreId:async()=>({storeId:site})}});
 const route=evaluate<{PUT:(r:NextRequest,c:{params:Promise<{store:string}>})=>Promise<Response>}>('../src/app/api/stores/[store]/products/import/route.ts',{
  'next/server':{NextRequest,NextResponse},'@/lib/api/client':client,'@/lib/api/merchant-security-scope':security,'@letbuyy/shared-types':shared,
 });
 const previous=process.env.NEXT_PUBLIC_ADMIN_URL;process.env.NEXT_PUBLIC_ADMIN_URL=origin;
 try{
  const result=await route.PUT(new NextRequest(origin+'/api/stores/synthetic/products/import',{method:'PUT',headers:{host:new URL(origin).host,origin,
   'Content-Type':'application/json','X-Idempotency-Key':key,'X-LetBuyy-Merchant-Context':actor},
   body:JSON.stringify({store_id:site,idempotency_key:fault==='key'?id(99):key,source_sha256:hash,contract_version:2})}),{params:Promise.resolve({store:'synthetic'})});
  const expected=fault==='none'?200:fault==='key'?400:503;assert.equal(result.status,expected,await result.text());assert.match(result.headers.get('Cache-Control')??'',/private.*no-store/);
  if(fault==='key')assert.equal(writes.length,0);
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ADMIN_URL;else process.env.NEXT_PUBLIC_ADMIN_URL=previous}
});
