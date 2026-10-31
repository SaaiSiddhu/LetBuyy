import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
import * as commerce from '@letbuyy/commerce-core';
import type {WarehouseCommandOperation} from '@letbuyy/shared-types';
import {validateMerchantMutationRequest} from '../src/lib/api/request-origin';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const site=id(1),actor=id(7),key=id(2),admin='https://admin.example.invalid';
type Kind=WarehouseCommandOperation|'stop';
const kinds:Kind[]=['purchase_order.create','purchase_order.receive','transfer.create','transfer.ship','transfer.receive','stop'];
const routes:Record<Kind,string>={
 'purchase_order.create':'api/stores/[store]/purchase-orders/route.ts',
 'purchase_order.receive':'api/stores/[store]/purchase-orders/[id]/receive/route.ts',
 'transfer.create':'api/stores/[store]/transfers/route.ts',
 'transfer.ship':'api/stores/[store]/transfers/[id]/ship/route.ts',
 'transfer.receive':'api/stores/[store]/transfers/[id]/receive/route.ts',
 stop:'api/v1/stores/[store]/inventory/commands/stop/route.ts',
};
function input(kind:Kind) {
 const common={idempotency_key:key};
 if(kind==='purchase_order.create')return {...common,location_id:id(5),lines:[{product_id:id(6),quantity:4,unit_cost:12.25}]};
 if(kind==='transfer.create')return {...common,source_location_id:id(5),destination_location_id:id(8),lines:[{product_id:id(6),quantity:4}]};
 if(kind==='transfer.ship')return common;
 if(kind==='stop')return {...common,store_id:site,operation:'transfer.ship',target_id:id(3),command:{}};
 return {...common,lines:[{[kind==='purchase_order.receive'?'purchase_order_line_id':'transfer_line_id']:id(4),quantity:2}]};
}
function evaluate<T>(url:URL,dependencies:Record<string,unknown>):T {
 const js=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('require','exports',js)((name:string)=>{assert.ok(dependencies[name],name);return dependencies[name];},exports);return exports as T;
}
function load(kind:Kind,options:{unauthenticated?:boolean;foreignStore?:boolean;wrongActorReceipt?:boolean;cancelled?:boolean}={}) {
 const calls:Array<{kind:string;key?:string|null;site?:string|null;body?:unknown}>=[];
 const api=createLetbuyyApiClient({baseUrl:'https://api.synthetic.invalid/v1',storeId:id(99),fetch:async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);
  if(url.pathname==='/v1/auth/custom/session'){calls.push({kind:'session'});return Response.json({authenticated:!options.unauthenticated,user:options.unauthenticated?null:{id:actor}});}
  const body=await request.json() as Record<string,unknown>;
  calls.push({kind:'gateway',key:request.headers.get('X-Idempotency-Key'),site:request.headers.get('X-Store-ID'),body});
  const op=kind==='stop'?'transfer.ship':kind,po=op.startsWith('purchase_order.'),create=op.endsWith('.create'),receiving=op.endsWith('.receive');
  const command=kind==='stop'?body.command:commerce.prepareWarehouseCommand(op,create?null:id(3),body).command;
  const data={command_receipt:{id:id(9),key:body.idempotency_key,site_id:site,actor_id:options.wrongActorReceipt?id(99):actor,
   operation:op,target_id:id(3),command,effective_lines:receiving?(command as Record<string,unknown>).lines:null,
   outcome:options.cancelled?'cancelled':'applied'},
   ...(!options.cancelled?{[po?'purchase_order':'transfer']:{id:id(3),site_id:site,status:create?(po?'ordered':'reserved'):receiving?'partially_received':'shipped'}}:{}),
   lines:options.cancelled?[]:[{id:id(4),site_id:site,[po?'purchase_order_id':'transfer_id']:id(3),product_id:id(6),variant_id:null,
    ...(po?{quantity_ordered:4,quantity_received:receiving?2:0,unit_cost:12.25}:{quantity_requested:4,quantity_shipped:create?0:4,quantity_received:receiving?2:0})}]};
  return Response.json({data});
 }});
 const client={createMerchantApiClient:()=>api,merchantApiErrorResponse:(error:unknown)=>NextResponse.json({error:{code:error instanceof LetbuyyApiError?error.code:'UNAVAILABLE',message:'Unavailable'}},{status:error instanceof LetbuyyApiError?error.status:503})};
 const resolve={resolveOwnedStoreId:async(store:string)=>{assert.equal(store,'qa');calls.push({kind:'owner'});return options.foreignStore?
  {error:NextResponse.json({error:{code:'NOT_FOUND'}},{status:404})}:{storeId:site};}};
 const security=evaluate<Record<string,unknown>>(new URL('../src/lib/api/merchant-security-scope.ts',import.meta.url),{
  'next/server':{NextRequest,NextResponse},'./client':client,'./request-origin':{validateMerchantMutationRequest},'@/lib/stores/resolve-owned-store':resolve});
 const warehouse=evaluate<Record<string,unknown>>(new URL('../src/lib/api/merchant-warehouse-scope.ts',import.meta.url),{
  'next/server':{NextRequest,NextResponse},'./merchant-security-scope':security});
 type Handler={POST:(request:NextRequest,context:{params:Promise<{store:string;id:string}>})=>Promise<Response>};
 const route=evaluate<Handler>(new URL('../src/app/'+routes[kind],import.meta.url),{
  'next/server':{NextRequest,NextResponse},'@/lib/api/client':client,'@/lib/stores/resolve-owned-store':resolve,
  '@/lib/api/merchant-security-scope':security,'@/lib/api/merchant-warehouse-scope':warehouse,'@letbuyy/commerce-core':commerce});
 const request=(body:unknown=input(kind),headers:Record<string,string>={})=>new NextRequest(admin+'/api/stores/qa/warehouse',{method:'POST',
  headers:{host:'admin.example.invalid',origin:admin,'Content-Type':'application/json','X-Idempotency-Key':key,'X-LetBuyy-Merchant-Context':actor,...headers},body:JSON.stringify(body)});
 return {calls,post:(body?:unknown,headers?:Record<string,string>)=>route.POST(request(body,headers),{params:Promise.resolve({store:'qa',id:id(3)})})};
}
async function configured(action:()=>Promise<void>) {
 const old=process.env.NEXT_PUBLIC_ADMIN_URL;process.env.NEXT_PUBLIC_ADMIN_URL=admin;
 try{await action();}finally{if(old===undefined)delete process.env.NEXT_PUBLIC_ADMIN_URL;else process.env.NEXT_PUBLIC_ADMIN_URL=old;}
}
for(const kind of kinds) {
 test(kind+' actual Next proxy and SDK preserve current actor/site/key and private acknowledgement',async()=>configured(async()=>{
  const route=load(kind),response=await route.post();assert.equal(response.status,kind.endsWith('.create')?201:200,await response.clone().text());
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(route.calls.map(x=>x.kind),['session','owner','gateway']);
  const call=route.calls[2];assert.equal(call.key,key);assert.equal(call.site,site);assert.equal((call.body as Record<string,unknown>).idempotency_key,key);
 }));
 for(const denial of ['origin','key','actor','owner','session','body-key','body-site'])test(kind+' refuses '+denial+' before stock dispatch',async()=>configured(async()=>{
  const route=load(kind,{foreignStore:denial==='owner',unauthenticated:denial==='session'}),body={...input(kind),
   ...(denial==='body-key'?{idempotency_key:id(90)}:{}),...(denial==='body-site'?{store_id:id(90)}:{})};
  const headers:Record<string,string>=denial==='origin'?{origin:'https://foreign.example.invalid'}:denial==='key'?{'X-Idempotency-Key':''}:denial==='actor'?{'X-LetBuyy-Merchant-Context':id(90)}:{};
  const response=await route.post(body,headers);assert.ok(response.status>=400);assert.equal(route.calls.filter(x=>x.kind==='gateway').length,0);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  if(denial==='origin'||denial==='key')assert.equal(route.calls.length,0);
 }));
 test(kind+' cannot expose a different actor acknowledgement as confirmation',async()=>configured(async()=>{
  const route=load(kind,{wrongActorReceipt:true}),response=await route.post();assert.equal(response.status,502);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 }));
}
test('versioned stop proxy returns a confirmed cancellation without representing it as an applied stock change',async()=>configured(async()=>{
 const route=load('stop',{cancelled:true}),response=await route.post();assert.equal(response.status,200);
 assert.equal((await response.json()).data.command_receipt.outcome,'cancelled');
}));
