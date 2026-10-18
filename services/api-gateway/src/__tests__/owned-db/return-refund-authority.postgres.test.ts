// Actual Gateway + owned database. Synthetic paid orders/refund intents are
// authorization fixtures, not normal checkout or provider acceptance proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,restJson,newBarrier} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';
import {signSensitiveActionStepUp} from '../../lib/security-controls';
import {readFileSync} from 'node:fs';
import {merchantApprovalHeaders,TOTP_SECRET}from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
const STEP_SECRET='synthetic-return-refund-step-up-with-at-least-32-bytes';
async function fixture(){
 const site=newSyntheticTenant('ret-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),email=`syn-return-${owner}@example.invalid`,order=crypto.randomUUID(),ret=crypto.randomUUID(),refund=crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);
 UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';
 INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total,payment_status)
 VALUES('${order}','${site.siteId}','${site.siteId}','SYN-RETURN-${order}','syn-buyer-${order}@example.invalid','{}','[]',100,100,'paid');
 INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${site.siteId}','${order}','received','manual','syn-ret-${ret}');
 INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)
 VALUES('${refund}','${site.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-refund-${refund}');`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{STEP_UP_SIGNING_SECRET:STEP_SECRET,TOTP_ENCRYPTION_KEY:TOTP_SECRET}));
 return {...site,owner,email,order,ret,refund,gateway};
}
test('a supplied foreign refund ID cannot mutate another merchant through an owned return',async()=>{
 const a=await fixture(),b=await fixture();
 const result=await a.gateway.request('/v1/returns/'+a.ret+'/refund/complete',{method:'POST',headers:await headers(a),body:JSON.stringify({refund_id:b.refund,idempotency_key:crypto.randomUUID()})});
 const status=owned.psql(`SELECT status FROM refunds WHERE id='${b.refund}';`),postings=owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${b.refund}';`);
 assert.equal(result.status,404,`HTTP${result.status}; foreign refund=${status}; canonical postings=${postings}; ${result.text}`);
 assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${b.refund}';`),'pending');
 assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${b.refund}';`),'0');
});

async function headers(f:Awaited<ReturnType<typeof fixture>>){
 return merchantApprovalHeaders(f.gateway,f.owner,f.email,f.siteId);
}
test('return completion requires cryptographic refund approval before any monetary write',async()=>{
 const f=await fixture();const result=await f.gateway.request('/v1/returns/'+f.ret+'/refund/complete',{method:'POST',headers:await signedIdentityHeaders(f.owner,f.email,f.siteId),body:JSON.stringify({refund_id:f.refund,idempotency_key:crypto.randomUUID()})});
 assert.equal(result.status,428,result.text);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${f.refund}';`),'pending');
});
test('different authenticated transport keys for one refund cannot post its monetary reversal twice',async()=>{
 const f=await fixture();for(let n=0;n<2;n++){
  const result=await f.gateway.request('/v1/returns/'+f.ret+'/refund/complete',{method:'POST',headers:await headers(f),body:JSON.stringify({refund_id:f.refund,idempotency_key:crypto.randomUUID()})});
  assert.equal(result.status,200,result.text);
 }
 assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${f.refund}';`),'1');
});

type Fixture=Awaited<ReturnType<typeof fixture>>;
const state=(f:Fixture)=>owned.psql(`SELECT status FROM refunds WHERE id='${f.refund}';`);
const posts=(f:Fixture)=>owned.psql(`SELECT count(*)FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='refund:${f.refund}';`);
const receipts=(f:Fixture)=>owned.psql(`SELECT count(*)FROM idempotency_keys WHERE site_id='${f.siteId}'AND scope LIKE 'owned-refund-complete-v1:%';`);
async function complete(f:Fixture,body:Record<string,unknown>,credential?:Record<string,string>){
 return f.gateway.request('/v1/returns/'+f.ret+'/refund/complete',{method:'POST',headers:credential??await headers(f),body:JSON.stringify(body)});
}
function sibling(f:Fixture,sameReturn=false){
 const ret=sameReturn?f.ret:crypto.randomUUID(),refund=crypto.randomUUID();
 if(!sameReturn)owned.psql(`INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${f.siteId}','${f.order}','received','manual','syn-ret-${ret}');`);
 owned.psql(`INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${refund}','${f.siteId}','${f.order}','${ret}',100,'pending','manual','bank_transfer','syn-refund-${refund}');`);
 return{ret,refund};
}
test('return reads bind signed scope, deny foreign and corrupt order links, and filter embedded foreign refunds',async()=>{
 const a=await fixture(),b=await fixture();
 const read=async(f:Fixture,scope?:string,hint?:string)=>a.gateway.request('/v1/returns/'+a.ret,{headers:{...await signedIdentityHeaders(f.owner,f.email,scope),...(hint?{'X-Store-ID':hint}:{})}});
 const noHint=await read(a);assert.equal(noHint.status,200,noHint.text);assert.equal(noHint.json?.data.id,a.ret);
 const signed=await read(a,a.siteId,b.siteId);assert.equal(signed.status,200,signed.text);
 for(const request of [()=>read(b,b.siteId),()=>read(b,undefined,a.siteId),()=>read(a,b.siteId,a.siteId)])assert.equal((await request()).status,404);
 owned.psql(`UPDATE refunds SET return_id='${a.ret}'WHERE id='${b.refund}';`);
 const filtered=await read(a,a.siteId);assert.equal(filtered.status,200,filtered.text);assert.ok(!filtered.text.includes(b.refund));
 owned.psql(`UPDATE returns SET order_id='${b.order}'WHERE id='${a.ret}';`);assert.equal((await read(a,a.siteId)).status,404);assert.equal(posts(a),'0');assert.equal(posts(b),'0');
});
test('a refund for a different return on the same owned order is refused before mutation',async()=>{
 const f=await fixture(),other=sibling(f);const result=await complete(f,{refund_id:other.refund,idempotency_key:crypto.randomUUID()});
 assert.equal(result.status,404,result.text);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${other.refund}';`),'pending');assert.equal(posts(f),'0');assert.equal(receipts(f),'0');
});
test('receipt replay rechecks live ownership and bound body rather than bypassing permission',async()=>{
 const a=await fixture(),b=await fixture(),key=crypto.randomUUID(),body={refund_id:a.refund,idempotency_key:key,notes:'synthetic original'};
 assert.equal((await complete(a,body)).status,200);assert.equal(receipts(a),'1');
 const conflict=await complete(a,{...body,notes:'synthetic changed'});assert.equal(conflict.status,409,conflict.text);
 const foreign=await complete(a,body,await headers(b));assert.equal(foreign.status,404,foreign.text);
 const priorProof=await headers(a);
 owned.psql(`UPDATE sites SET custom_user_id='${b.owner}'WHERE id='${a.siteId}';`);
 const revoked=await complete(a,body,priorProof);assert.equal(revoked.status,404,revoked.text);assert.equal(posts(a),'1');assert.equal(receipts(a),'1');
});
test('the database refuses ownership revoked between Gateway reads and the monetary command',async()=>{
 const a=await fixture(),b=await fixture();let changed=false;
 const fault=tapRest(owned.restUrl,async(c,forward)=>{if(!changed&&c.resource==='rpc/complete_owned_order_refund_v1'){changed=true;owned.psql(`UPDATE sites SET custom_user_id='${b.owner}'WHERE id='${a.siteId}';`);}return forward();});
 try{const result=await complete(a,{refund_id:a.refund,idempotency_key:crypto.randomUUID()});assert.equal(result.status,403,result.text);assert.equal(changed,true);assert.equal(state(a),'pending');assert.equal(posts(a),'0');assert.equal(receipts(a),'0');}finally{fault.restore();}
});
test('optional refund selection is unambiguous and an existing receipt keeps its original source after another intent appears',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),body={idempotency_key:key};
 const good=await complete(f,body);assert.equal(good.status,200,good.text);assert.equal(good.json?.data.refund_id,f.refund);
 const other=sibling(f,true);const retry=await complete(f,body);assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data.refund_id,f.refund);assert.equal(posts(f),'1');assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${other.refund}';`),'pending');
 const ambiguous=await fixture();sibling(ambiguous,true);const refused=await complete(ambiguous,{idempotency_key:crypto.randomUUID()});assert.equal(refused.status,409,refused.text);assert.equal(refused.json?.error.code,'REFUND_SELECTION_REQUIRED');assert.equal(posts(ambiguous),'0');
});
for(const mode of ['same-key','different-keys']as const)test('concurrent '+mode+' completions serialize one canonical refund',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),barrier=newBarrier(2);
 const tap=tapRest(owned.restUrl,async(c,forward)=>{if(c.resource==='rpc/complete_owned_order_refund_v1')await barrier.arrive();return forward();});
 try{
  const results=await Promise.all([complete(f,{refund_id:f.refund,idempotency_key:key}),complete(f,{refund_id:f.refund,idempotency_key:mode==='same-key'?key:crypto.randomUUID()})]);
  for(const result of results)assert.equal(result.status,200,result.text);assert.equal(posts(f),'1');assert.equal(receipts(f),mode==='same-key'?'1':'2');
 }finally{tap.restore();}
});
test('a committed lost reply is recovered by the exact receipt without another posting',async()=>{
 const f=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};let lost=false;
 const tap=tapRest(owned.restUrl,async(c,forward)=>{const result=await forward();if(!lost&&c.resource==='rpc/complete_owned_order_refund_v1'){lost=true;return restJson(503,{message:'synthetic-committed-refund-reply-lost'});}return result;});
 try{assert.equal((await complete(f,body)).status,500);assert.equal(state(f),'succeeded');assert.equal(posts(f),'1');assert.equal(receipts(f),'1');}finally{tap.restore();}
 const retry=await complete(f,body);assert.equal(retry.status,200,retry.text);assert.equal(posts(f),'1');assert.equal(receipts(f),'1');
});
test('failed return readback after commit can reload through its receipt safely',async()=>{
 const f=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};let committed=false;
 const tap=tapRest(owned.restUrl,async(c,forward)=>{if(committed&&c.resource==='returns'&&c.method==='GET')return restJson(503,{message:'synthetic-postcommit-return-read-outage'});const response=await forward();if(c.resource==='rpc/complete_owned_order_refund_v1')committed=true;return response;});
 try{assert.equal((await complete(f,body)).status,500);assert.equal(posts(f),'1');assert.equal(receipts(f),'1');}finally{tap.restore();}
 const retry=await complete(f,body);assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data.status,'refunded');assert.equal(posts(f),'1');
});
for(const target of ['ledger_transactions','idempotency_keys']as const)test('a named '+target+' insertion failure rolls the whole completion back',async()=>{
 const f=await fixture(),suffix=crypto.randomUUID().replaceAll('-',''),fn='syn_refund_'+suffix,body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};
 const condition=target==='ledger_transactions'?`NEW.site_id='${f.siteId}'AND NEW.source_type='refund'`:`NEW.site_id='${f.siteId}'AND NEW.scope LIKE 'owned-refund-complete-v1:%'`;
 owned.psql(`CREATE FUNCTION public.${fn}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-owned-refund-insert-fault';END$$;CREATE TRIGGER ${fn} BEFORE INSERT ON ${target} FOR EACH ROW WHEN(${condition})EXECUTE FUNCTION public.${fn}();`);
 try{const failed=await complete(f,body);assert.equal(failed.status,500,failed.text);assert.equal(state(f),'pending');assert.equal(posts(f),'0');assert.equal(receipts(f),'0');assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE idempotency_key='refund.succeeded:${f.refund}';`),'0');}
 finally{owned.psql(`DROP TRIGGER ${fn} ON ${target};DROP FUNCTION public.${fn}();`);}
 const retry=await complete(f,body);assert.equal(retry.status,200,retry.text);assert.equal(posts(f),'1');assert.equal(receipts(f),'1');
});
test('cryptographic approval refuses forged, expired and wrong-actor evidence',async()=>{
 const f=await fixture(),other=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};
 const wrong=await headers(other);const forged={...await headers(f),'X-Step-Up-Token':'synthetic-forged-token'};
 const expired=await signSensitiveActionStepUp({action:'refund.approve',actorId:f.owner,siteId:f.siteId,challengeId:'syn-expired',signingSecret:STEP_SECRET,verifiedAt:new Date(Date.now()-11*60*1000).toISOString()});
 for(const proof of [wrong,forged,{...await signedIdentityHeaders(f.owner,f.email,f.siteId),'X-Step-Up-Token':expired.token,'X-Step-Up-Verified-At':expired.verifiedAt}]){
  const identity={...await signedIdentityHeaders(f.owner,f.email,f.siteId),'X-Step-Up-Token':proof['X-Step-Up-Token'],'X-Step-Up-Verified-At':proof['X-Step-Up-Verified-At']};
  const denied=await complete(f,body,identity);assert.equal(denied.status,428,denied.text);
 }
 assert.equal(state(f),'pending');assert.equal(posts(f),'0');assert.equal(receipts(f),'0');
});
test('the actual database roles refuse both monetary entry points and transaction-local scope mismatch',async()=>{
 const f=await fixture(),other=await fixture(),intent=JSON.stringify({refund_id:f.refund,idempotency_key:crypto.randomUUID()});
 for(const role of ['anon','authenticated','app_tenant'])for(const invocation of [
  `complete_order_refund('${f.refund}',p_idempotency_key=>'syn-denied-key')`,
  `complete_owned_order_refund_v1('${f.siteId}','${f.order}','${f.ret}','${f.owner}','${intent}')`])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${invocation};`),/permission denied for function/);
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT set_config('app.site_id','${other.siteId}',true);SELECT complete_owned_order_refund_v1('${f.siteId}','${f.order}','${f.ret}','${f.owner}','${intent}');`),/tenant context mismatch/);
 const wrongActor=JSON.parse(owned.psql(`SET ROLE service_role;SELECT complete_owned_order_refund_v1('${f.siteId}','${f.order}','${f.ret}','${other.owner}','${intent}');`).split('\n').at(-1)!);assert.equal(wrongActor.status,403);
 assert.equal(posts(f),'0');assert.equal(receipts(f),'0');
});
test('provider references stay bound to the committed source even with another transport key',async()=>{
 const f=await fixture();const good=await complete(f,{refund_id:f.refund,idempotency_key:crypto.randomUUID(),provider_refund_id:'syn-manual-reference-A'});assert.equal(good.status,200,good.text);
 const conflict=await complete(f,{refund_id:f.refund,idempotency_key:crypto.randomUUID(),provider_refund_id:'syn-manual-reference-B'});assert.equal(conflict.status,409,conflict.text);
 const omitted=await complete(f,{refund_id:f.refund,idempotency_key:crypto.randomUUID()});assert.equal(omitted.status,200,omitted.text);assert.equal(posts(f),'1');
 assert.equal(owned.psql(`SELECT provider_refund_id FROM refunds WHERE id='${f.refund}';`),'syn-manual-reference-A');
});
function completeDefinition(name:string){const s=readFileSync('database/supabase/migrations/'+name,'utf8'),a=s.indexOf('CREATE OR REPLACE FUNCTION public.complete_order_refund('),e=s.indexOf('\n$$;',a)+4;return s.slice(a,e);}
const currentDefinition=()=>completeDefinition('336_owned_refund_completion.sql');
const oldDefinition=()=>completeDefinition('168_b1_b2_capture_refund_ledgering.sql');
test('a valid pre336 completion is reused; duplicated historical postings require review without deleting history',async()=>{
 for(const count of [1,2]){
  const f=await fixture();
  try{owned.script(oldDefinition());for(let n=0;n<count;n++)owned.psql(`SELECT complete_order_refund('${f.refund}',p_idempotency_key=>'syn-old-key-${n}');`);}
  finally{owned.script(currentDefinition());}
  assert.equal(posts(f),String(count));const result=await complete(f,{refund_id:f.refund,idempotency_key:crypto.randomUUID()});
  assert.equal(result.status,count===1?200:409,result.text);assert.equal(posts(f),String(count));assert.equal(receipts(f),count===1?'1':'0');
 }
});
test('a succeeded flag without a canonical posting refuses fabricated completion',async()=>{
 const f=await fixture();owned.psql(`UPDATE refunds SET status='succeeded'WHERE id='${f.refund}';`);
 const result=await complete(f,{refund_id:f.refund,idempotency_key:crypto.randomUUID()});assert.equal(result.status,409,result.text);assert.equal(posts(f),'0');assert.equal(receipts(f),'0');
});

test('completion history prevents rollback from weakening the live monetary boundary',async()=>{
 const f=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};assert.equal((await complete(f,body)).status,200);
 const rollback=readFileSync('database/supabase/rollback/336_owned_refund_completion.rollback.sql','utf8');
 assert.match(owned.psqlExpectError(rollback),/rollback336 refuses newer341 approval boundary/);
 const currentRollback=readFileSync('database/supabase/rollback/341_live_merchant_refund_approval.rollback.sql','utf8');
 assert.match(owned.psqlExpectError(currentRollback),/rollback341 refuses refund completion history/);assert.equal(posts(f),'1');assert.equal(receipts(f),'1');
});

test('a corrupted response receipt cannot substitute for the verified refund source',async()=>{
 const f=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};assert.equal((await complete(f,body)).status,200);
 owned.psql(`UPDATE idempotency_keys SET response_hash='synthetic-corrupt-hash'WHERE site_id='${f.siteId}'AND scope LIKE 'owned-refund-complete-v1:%';`);
 const result=await complete(f,body);assert.equal(result.status,409,result.text);assert.equal(posts(f),'1');assert.equal(receipts(f),'1');
});
test('order completion retries verify the current monetary source instead of bypassing it through an outer cached response',async()=>{
 const f=await fixture(),body={refund_id:f.refund,idempotency_key:crypto.randomUUID()};
 const call=async()=>f.gateway.request('/v1/orders/'+f.order+'/refund/complete',{method:'POST',headers:await headers(f),body:JSON.stringify(body)});
 const first=await call();assert.equal(first.status,200,first.text);
 owned.psql(`UPDATE refunds SET metadata=metadata-'canonical_ledger_transaction_id'WHERE id='${f.refund}';`);
 const result=await call();assert.equal(result.status,409,result.text);assert.equal(posts(f),'1');
});

test('different order-completion keys do not duplicate full-order events or canonical postings',async()=>{
 const f=await fixture();for(let n=0;n<2;n++){
  const result=await f.gateway.request('/v1/orders/'+f.order+'/refund/complete',{method:'POST',headers:await headers(f),body:JSON.stringify({refund_id:f.refund,idempotency_key:crypto.randomUUID()})});assert.equal(result.status,200,result.text);
 }
 assert.equal(posts(f),'1');assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE site_id='${f.siteId}'AND event_type='order.refunded'AND aggregate_id='${f.order}';`),'1');
});
for(const surface of ['orders','returns']as const)test(surface+' completion restores canonical gift-card tender only on full refund and once',async()=>{
 const f=await fixture(),seed=seedSyntheticOrder(owned.psql,f),code='SYN-GIFT-'+crypto.randomUUID();
 const account=owned.psql(`SELECT issue_gift_card('${f.siteId}','${code}',100,'INR',NULL,'{}','${f.owner}',NULL,'syn-gift-${code}')->>'id';`);
 const order=owned.psql(`SELECT create_checkout_order('${f.siteId}','Synthetic Gift Buyer','syn-gift-buyer@example.invalid','9000000099',
 '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}','[{"product_id":"${seed.productId}","quantity":1}]',
 'cod',NULL,NULL,'${code}','standard','syn-gift-checkout-${crypto.randomUUID()}','${f.owner}',NULL)->>'id';`);
 assert.equal(Number(owned.psql(`SELECT total FROM orders WHERE id='${order}';`)),99);
 owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${order}';UPDATE returns SET order_id='${order}'WHERE id='${f.ret}';
 UPDATE refunds SET order_id='${order}',amount=50 WHERE id='${f.refund}';`);
 const balance=()=>Number(owned.psql(`SELECT gift_card_available_balance('${account}','${f.siteId}');`));assert.equal(balance(),0);
 const call=async(refund:string,key:string)=>f.gateway.request('/v1/'+surface+'/'+(surface==='orders'?order:f.ret)+'/refund/complete',{method:'POST',headers:await headers(f),body:JSON.stringify({refund_id:refund,idempotency_key:key})});
 let restores=0;const observer=tapRest(owned.restUrl,async(c,forward)=>{if(c.resource==='rpc/restore_gift_card_on_refund')restores++;return forward();});
 try{
  const partial=await call(f.refund,crypto.randomUUID());assert.equal(partial.status,200,partial.text);assert.equal(balance(),0);assert.equal(restores,0);
  assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE event_type='order.refunded'AND aggregate_id='${order}';`),'0');
  const last=crypto.randomUUID(),key=crypto.randomUUID();owned.psql(`INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${last}','${f.siteId}','${order}','${f.ret}',49,'pending','manual','bank_transfer','syn-final-${last}');`);
  const full=await call(last,key);assert.equal(full.status,200,full.text);assert.equal(balance(),100);assert.equal(restores,1);
  const retry=await call(last,key);assert.equal(retry.status,200,retry.text);assert.equal(balance(),100);
  assert.equal(owned.psql(`SELECT count(*)FROM gift_card_ledger_entries WHERE site_id='${f.siteId}'AND order_id='${order}'AND entry_type='refund_credit';`),'1');
 }finally{observer.restore();}
});
