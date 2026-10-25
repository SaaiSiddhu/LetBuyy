// Exact source-block execution with an in-memory read seam only. No Worker,
// native/DB/browser/provider module, external notification or network import.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root='/Volumes/Projects/LetBuyy',privateRoot='/private/tmp/letbuyy-hosted-capture-proof-prep-20261025-01';
const route='services/api-gateway/src/routes/checkout.ts';
const baseline=fs.readFileSync(path.join(root,route),'utf8'),proposed=fs.readFileSync(path.join(privateRoot,route),'utf8');
function proofBlock(source){const start=source.indexOf('            const { data: captureLedgerRow, error: captureLedgerError }'),end=source.indexOf('\n        }\n\n        const session = await persistCheckoutStep',start);assert.ok(start>0&&end>start);return source.slice(start,end);}
const site='11111111-1111-4111-8111-111111111111',order='22222222-2222-4222-8222-222222222222',payment='pay_synthetic_proof';
const browserKey=`checkout.confirm.capture:${order}:synthetic-original-confirm`;
const capture=(key=browserKey)=>({id:'capture-original',site_id:site,source_type:'payment_capture',source_id:`razorpay:${payment}`,idempotency_key:key,deleted_at:null});
async function execute(source,{captures=[capture()],error=null}={}){
 const rows=structuredClone(captures),before=structuredClone(rows),reads=[],emitted=[];
 const db={from(table){assert.equal(table,'ledger_transactions');const clauses=[];let fields=[];
  return{select(columns){fields=columns.split(',').map(s=>s.trim());return this;},eq(key,value){clauses.push([key,value]);return this;},is(key,value){clauses.push([key,value]);return this;},async maybeSingle(){reads.push({table,fields,clauses});if(error)return{data:null,error:{message:error}};const found=rows.filter(row=>clauses.every(([k,v])=>row[k]===v));if(found.length>1)return{data:null,error:{message:'ambiguous canonical capture'}};return{data:found[0]?Object.fromEntries(fields.map(f=>[f,found[0][f]])):null,error:null};}};}};
 const context=vm.createContext({db,verified:{handoff:{siteId:site}},providerPaymentId:payment,captureIdempotencyKey:browserKey,orderId:order,paidOrder:{id:order},order:{id:order},c:{env:{}},getRequestId:()=> 'synthetic-request',emitOrderPaidEvent:async(_env,_db,input)=>{emitted.push(input);}});
 const flag=await vm.runInContext('(async()=>{let capturePostedToLedger=false;\n'+proofBlock(source)+'\nreturn capturePostedToLedger;})()',context,{timeout:1000});
 assert.deepEqual(rows,before,'original immutable capture/key untouched');return{flag,reads,emitted};
}
test('baseline diagnostic reproduces false metadata for an existing webhook-key capture',async()=>{const seen=await execute(baseline,{captures:[capture('synthetic-webhook-original')]});assert.equal(seen.flag,false);assert.equal(seen.emitted.length,0);});
test('current proposal recognizes webhook capture but preserves its existing notification owner',async()=>{const seen=await execute(proposed,{captures:[capture('synthetic-webhook-original')]});assert.equal(seen.flag,true);assert.equal(seen.emitted.length,0);assert.deepEqual(seen.reads[0].clauses,[['site_id',site],['source_type','payment_capture'],['source_id',`razorpay:${payment}`],['deleted_at',null]]);assert.deepEqual(seen.reads[0].fields,['id','idempotency_key']);});
test('browser-owned capture keeps the existing paid event/notification call and stable payment key',async()=>{const seen=await execute(proposed);assert.equal(seen.flag,true);assert.equal(seen.emitted.length,1);assert.equal(seen.emitted[0].idempotencyKey,`razorpay:${payment}`);});
test('source behavior preserves browser-owned retry; a durable event cannot suppress a failed notification retry',async()=>{const before=await execute(baseline),after=await execute(proposed);assert.equal(before.emitted.length,1);assert.equal(after.emitted.length,1);assert.doesNotMatch(proofBlock(proposed),/from\('outbox_events'\)/);});
test('capture under another durable owner is truthful without moving its event/notification authority',async()=>{const seen=await execute(proposed,{captures:[capture('different-original-capture-owner')]});assert.equal(seen.flag,true);assert.equal(seen.emitted.length,0);});
for(const[name,change]of Object.entries({foreign_site:{site_id:'33333333-3333-4333-8333-333333333333'},wrong_source_type:{source_type:'payment_refund'},foreign_payment:{source_id:'razorpay:pay_other'},wrong_provider:{source_id:`cashfree:${payment}`},deleted_capture:{deleted_at:'2026-10-24T00:00:00Z'}}))test(`capture proof refuses ${name}`,async()=>{const seen=await execute(proposed,{captures:[{...capture(),...change}]});assert.equal(seen.flag,false);assert.equal(seen.emitted.length,0);});
test('absent capture does not create metadata proof or emit a paid event',async()=>{const seen=await execute(proposed,{captures:[]});assert.equal(seen.flag,false);assert.equal(seen.emitted.length,0);});
test('ledger proof error fails closed',async()=>{await assert.rejects(execute(proposed,{error:'synthetic owned lookup failure'}),/capture ledger proof failed/);});
test('ambiguous capture is refused instead of selecting a convenient attempt',async()=>{await assert.rejects(execute(proposed,{captures:[capture(),{...capture('other-key'),id:'other-original-capture'}]}),/capture ledger proof failed/);});
test('canonical proof retains exact capture identity across repeated read-only acknowledgements',async()=>{const rows=[capture('synthetic-webhook-original')],first=await execute(proposed,{captures:rows}),retry=await execute(proposed,{captures:rows});assert.equal(first.flag,true);assert.equal(retry.flag,true);assert.equal(first.emitted.length+retry.emitted.length,0);assert.equal(rows[0].id,'capture-original');assert.equal(rows[0].idempotency_key,'synthetic-webhook-original');});
test('all source outside this capture-proof block is unchanged',()=>{const normalize=s=>s.replace(/            \/\/ The canonical writer may already have posted this capture from\n            \/\/ the verified webhook\. Its original durable key must not be\n            \/\/ confused with this browser acknowledgement's attempt key\.\n/,'').replace(proofBlock(s),'PROOF_BLOCK');assert.equal(normalize(proposed),normalize(baseline));});
