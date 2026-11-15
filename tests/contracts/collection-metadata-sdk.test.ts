import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {createLetbuyyApiClient}from '../../packages/typescript/api-client/src/index';
const f=JSON.parse(readFileSync(new URL('../fixtures/collection-metadata-contracts.json',import.meta.url),'utf8'));
function fixture(reply:unknown=f.receipt){
 const calls:{url:string;init:RequestInit}[]=[];
 const client=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',storeId:f.command.store_id,fetch:(async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({data:reply});})as typeof fetch});
 return{client,calls};
}
const input=()=>{const {collection_type:_kind,store_id:_store,idempotency_key:_key,...body}=f.command;return structuredClone(body)};
const options={storeId:f.command.store_id,idempotencyKey:f.command.idempotency_key,headers:{'X-Letbuyy-Expected-Actor':f.actor}};
test('smart SDK binds the observed version and exact original key/store/actor with a canonical receipt',async()=>{
 const h=fixture();const receipt=await h.client.smartCollections.update(f.row.id,input(),options);assert.equal(receipt.version,8);
 assert.equal(h.calls.length,1);const call=h.calls[0],headers=new Headers(call.init.headers);
 assert.equal(headers.get('X-Idempotency-Key'),f.command.idempotency_key);assert.equal(headers.get('X-Store-ID'),f.command.store_id);
 assert.deepEqual(JSON.parse(String(call.init.body)),input());assert.equal(call.init.method,'PATCH');
});
test('smart acknowledgement identity, revision and original fields cannot silently change',async()=>{
 for(const patch of [{actor_id:f.command.store_id},{id:f.actor},{version:7},{expected_version:6},{idempotency_key:f.actor},{request:{...f.receipt.request,conditions:[]}}]){
  const h=fixture({...f.receipt,...patch});await assert.rejects(h.client.smartCollections.update(f.row.id,input(),options));assert.equal(h.calls.length,1);
 }
 const h=fixture();await assert.rejects(h.client.smartCollections.update(f.row.id,input()));assert.equal(h.calls.length,0,'No new key is silently created after a lost original intent.');
});
test('SDK list retains exact population metadata and preview scopes its disclosed sample',async()=>{
 const client=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',fetch:(async(url)=>Response.json(String(url).includes('/preview')?{data:f.preview}:f.page))as typeof fetch});
 const page=await client.smartCollections.list({store_id:f.command.store_id});assert.equal(page.meta.total,1);assert.equal(page.data[0].created_at,null);
 const preview=await client.smartCollections.preview(f.row.id,{store_id:f.command.store_id});assert.equal(preview.count_is_exact,false);assert.equal(preview.catalog_count,1005);
 await assert.rejects(client.smartCollections.preview(f.actor,{store_id:f.command.store_id}));
});
test('SDK freezes nested intent before a delayed token lookup',async()=>{
 let release!:(value:string)=>void,entered!:()=>void;const began=new Promise<void>(r=>entered=r),gate=new Promise<string>(r=>release=r),calls:RequestInit[]=[];
 const body=input(),client=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',getHeaders:async()=>{entered();return {Authorization:'Bearer '+await gate}},fetch:(async(_url,init)=>{calls.push(init!);return Response.json({data:f.receipt})})as typeof fetch});
 const save=client.smartCollections.update(f.row.id,body,options);await began;body.conditions[0].value='Changed after dispatch';release(crypto.randomUUID());await save;
 assert.equal(JSON.parse(String(calls[0].body)).conditions[0].value,f.command.conditions[0].value);
});
