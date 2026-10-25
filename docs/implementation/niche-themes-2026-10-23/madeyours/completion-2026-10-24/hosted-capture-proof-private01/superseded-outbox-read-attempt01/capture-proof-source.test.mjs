// Executes only the exact private/baseline proof block with an in-memory,
// read-only query seam. No Worker, application, DB, network or provider import.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = '/Volumes/Projects/LetBuyy';
const privateRoot = '/private/tmp/letbuyy-hosted-capture-proof-prep-20261025-01';
const route = 'services/api-gateway/src/routes/checkout.ts';
const baseline = fs.readFileSync(path.join(root, route), 'utf8');
const proposed = fs.readFileSync(path.join(privateRoot, route), 'utf8');
function proofBlock(source) {
 const start = source.indexOf('            const { data: captureLedgerRow, error: captureLedgerError }');
 const end = source.indexOf('\n        }\n\n        const session = await persistCheckoutStep', start);
 assert.ok(start > 0 && end > start);
 return source.slice(start, end);
}
const site = '11111111-1111-4111-8111-111111111111', order = '22222222-2222-4222-8222-222222222222';
const payment = 'pay_synthetic_proof';
const browserKey = `checkout.confirm.capture:${order}:synthetic-original-confirm`;
const paidKey = `order.paid:${site}:${order}:razorpay:${payment}`;
const capture = (key = browserKey) => ({ id:'capture-original',site_id:site,source_type:'payment_capture',source_id:`razorpay:${payment}`,idempotency_key:key,deleted_at:null });
const event = () => ({ id:'event-original',site_id:site,aggregate_type:'order',aggregate_id:order,event_type:'order.paid',idempotency_key:paidKey,deleted_at:null });
async function execute(source, { captures = [capture()], events = [], failTable = null } = {}) {
 const rows = { ledger_transactions: structuredClone(captures), outbox_events: structuredClone(events) }, reads = [], emitted = [];
 const before = structuredClone(rows);
 const db = { from(table) {
  assert.ok(table in rows, 'only the two existing read authorities are reachable');
  const clauses=[];
  return { select(columns) { assert.equal(columns,'id');return this; },
   eq(key,value) { clauses.push([key,value]);return this; },
   is(key,value) { clauses.push([key,value]);return this; },
   async maybeSingle() {
    reads.push({table,clauses:structuredClone(clauses)});
    if (table===failTable) return {data:null,error:{message:'synthetic owned proof fault'}};
    const selected=rows[table].filter(row=>clauses.every(([key,value])=>row[key]===value));
    if (selected.length>1) return {data:null,error:{message:'ambiguous proof'}};
    return {data:selected[0]??null,error:null};
   },
  };
 }};
 const context=vm.createContext({db,verified:{handoff:{siteId:site}},providerPaymentId:payment,captureIdempotencyKey:browserKey,orderId:order,paidOrder:{id:order},order:{id:order},c:{env:{}},getRequestId:()=> 'synthetic-request',emitOrderPaidEvent:async (_env,_db,input)=>{emitted.push(input);}});
 const code='(async () => { let capturePostedToLedger=false;\n'+proofBlock(source)+'\nreturn capturePostedToLedger; })()';
 const flag=await vm.runInContext(code,context,{timeout:1000});
 assert.deepEqual(rows,before,'proof leaves original capture/key and existing event untouched');
 return {flag,reads,emitted};
}
test('baseline diagnostic: the actual old selector misses a genuine webhook-key capture',async()=>{
 const seen=await execute(baseline,{captures:[capture('synthetic-webhook-original')],events:[event()]});
 assert.equal(seen.flag,false);assert.equal(seen.emitted.length,0);
});
test('proposed proof recognizes the original webhook capture without another notification dispatch',async()=>{
 const seen=await execute(proposed,{captures:[capture('synthetic-webhook-original')],events:[event()]});
 assert.equal(seen.flag,true);assert.equal(seen.emitted.length,0);
 const predicates=seen.reads.find(r=>r.table==='ledger_transactions').clauses;
 assert.deepEqual(predicates,[['site_id',site],['source_type','payment_capture'],['source_id',`razorpay:${payment}`],['deleted_at',null]]);
});
test('browser-first newly posted capture emits the existing canonical paid event exactly once in this call',async()=>{
 const seen=await execute(proposed);assert.equal(seen.flag,true);assert.equal(seen.emitted.length,1);
 assert.equal(seen.emitted[0].idempotencyKey,`razorpay:${payment}`);
});
test('original-key recovery with recorded paid event preserves its flag and dispatches nothing new',async()=>{
 const seen=await execute(proposed,{events:[event()]});assert.equal(seen.flag,true);assert.equal(seen.emitted.length,0);
});
test('capture committed before paid-event persistence can recover the missing existing canonical emission',async()=>{
 const seen=await execute(proposed,{captures:[capture('synthetic-webhook-original')]});assert.equal(seen.flag,true);assert.equal(seen.emitted.length,1);
});
for(const [name,change] of Object.entries({foreign_site:{site_id:'33333333-3333-4333-8333-333333333333'},wrong_source_type:{source_type:'payment_refund'},foreign_payment:{source_id:'razorpay:pay_other'},wrong_provider:{source_id:`cashfree:${payment}`},deleted_capture:{deleted_at:'2026-10-24T00:00:00Z'}})) {
 test(`capture refusal: ${name}`,async()=>{const seen=await execute(proposed,{captures:[{...capture(),...change}]});assert.equal(seen.flag,false);assert.equal(seen.emitted.length,0);});
}
for(const [name,change] of Object.entries({foreign_event_site:{site_id:'33333333-3333-4333-8333-333333333333'},foreign_event_order:{aggregate_id:'33333333-3333-4333-8333-333333333333'},wrong_event_type:{event_type:'order.cancelled'},foreign_event_key:{idempotency_key:'different-event'},deleted_event:{deleted_at:'2026-10-24T00:00:00Z'}})) {
 test(`unrelated event cannot suppress the bound paid emission: ${name}`,async()=>{const seen=await execute(proposed,{events:[{...event(),...change}]});assert.equal(seen.flag,true);assert.equal(seen.emitted.length,1);});
}
test('ledger proof error fails closed before completion or emission',async()=>{await assert.rejects(execute(proposed,{failTable:'ledger_transactions'}),/capture ledger proof failed/);});
test('paid event lookup error fails closed without optimistic notification',async()=>{await assert.rejects(execute(proposed,{failTable:'outbox_events'}),/paid event proof failed/);});
test('ambiguous canonical capture is refused instead of choosing an arbitrary transaction',async()=>{await assert.rejects(execute(proposed,{captures:[capture(),{...capture('other-original'),id:'second-capture'}]}),/capture ledger proof failed/);});
test('the private correction preserves all source outside the one canonical proof/emission block',()=>{
 const normalize=s=>s.replace(/            \/\/ The canonical writer may already have posted this capture from\n            \/\/ the verified webhook\. Its original durable key must not be\n            \/\/ confused with this browser acknowledgement's attempt key\.\n/,'').replace(proofBlock(s),'PROOF_BLOCK');
 assert.equal(normalize(proposed),normalize(baseline));
});
test('baseline paid emission would resubmit after an already-recorded browser capture; proposal suppresses it',async()=>{
 const old=await execute(baseline,{events:[event()]});
 assert.equal(old.flag,true);assert.equal(old.emitted.length,1);
 const corrected=await execute(proposed,{events:[event()]});
 assert.equal(corrected.flag,true);assert.equal(corrected.emitted.length,0);
});
