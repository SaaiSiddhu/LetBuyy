import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {merchantFixture,activeFactor,issue,explain} from './merchant-stepup-fixture';
import {seedSyntheticOrder} from './synthetic-tenant';
import {bindSyntheticRefundCredential} from './refund-credential-fixture';
import {PAYMENT_KEYRING_PREFIX} from '../../lib/payment-encryption-keyring';
import {tapRest} from './gateway-harness';

const owned=requireOwnedDatabase();
test('409 empty-history DOWN/up conserves existing records and the schema binds new refunds to the original payment connection',async t=>{
 const before=owned.psql(`SELECT count(*) FROM payment_attempts;`);
 owned.script(readFileSync('database/supabase/rollback/409_refund_attempt_credential_binding.rollback.sql','utf8'));
 assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts;`),before);
 owned.script(readFileSync('database/supabase/migrations/409_refund_attempt_credential_binding.sql','utf8'));
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor);assert.equal(proof.status,201,explain(proof));
 const headers={'X-Step-Up-Token':String(proof.json?.data.step_up_token),'X-Step-Up-Verified-At':String(proof.json?.data.verified_at)};
 const wrapping=randomUUID();f.gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=wrapping;
 const fixture=()=>{
  const order=seedSyntheticOrder(owned.psql,f),id=randomUUID(),providerPayment='pay_syn_'+randomUUID().replaceAll('-','');
  owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,provider_payment_id,idempotency_key)
   VALUES('${id}','${f.siteId}','${order.orderId}','razorpay','sandbox','captured',10000,'${providerPayment}','syn-${id}');`);
  return {id,orderId:order.orderId,providerPayment};
 };
 const first=fixture(),original=await bindSyntheticRefundCredential(owned,f.gateway,f.siteId,[first.id]);
 const newer=fixture(),replacement=await bindSyntheticRefundCredential(owned,f.gateway,f.siteId,[newer.id]);
 owned.psql(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${replacement.id}';
  UPDATE sites SET online_payment_enabled=false,payment_settings=jsonb_build_object('mode','ownAccount','razorpay',jsonb_build_object('credential_id','${replacement.id}')) WHERE id='${f.siteId}';`);
 f.gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=PAYMENT_KEYRING_PREFIX+JSON.stringify({active:randomUUID(),previous:[wrapping]});
 Object.assign(f.gateway.env,{RAZORPAY_KEY_ID:['rzp','test','decoy'].join('_'),RAZORPAY_KEY_SECRET:randomUUID()});
 let observed:Record<string,unknown>={},providerStatus=200,reads=0,creates=0,lastCreated='';
 const native=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.hostname==='api.razorpay.com'){
   assert.equal(new Headers(init?.headers).get('Authorization'),original.authorization,'refunds drain the capturing connection, never selected/global replacement');
   if(init?.method==='POST'){
    creates++;const body=JSON.parse(String(init.body)),id='rfnd_syn_'+randomUUID().replaceAll('-','');lastCreated=id;
    observed={id,payment_id:first.providerPayment,amount:body.amount,currency:'INR',status:'processed'};
    return Response.json(observed);
   }
   reads++;assert.equal(init?.method||'GET','GET');return Response.json(observed,{status:providerStatus});
  }
  return native(input,init);
 });
 const send=(payment=first,ref?:string,key=randomUUID(),amount=1000)=>f.call('POST',`/payments/${payment.id}/refund`,{
  idempotency_key:key,amount_minor:amount,...(ref?{provider_refund_id:ref}:{}),
 },headers);
 const ledgers=()=>owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${f.siteId}' AND source_type='refund';`);
 await t.test('manual refund ID, payment, amount and currency must match the provider; errors never reserve money',async()=>{
  for(const patch of [{id:'rfnd_wrong'},{payment_id:'pay_wrong'},{amount:1},{currency:'USD'}]){
   const ref='rfnd_syn_'+randomUUID().replaceAll('-','');observed={id:ref,payment_id:first.providerPayment,amount:1000,currency:'INR',status:'processed',...patch};
   const result=await send(first,ref);assert.equal(result.status,409,result.text);assert.equal(result.json?.error.code,'REFUND_PROOF_MISMATCH');
  }
  providerStatus=503;observed={error:{description:'Synthetic private provider failure'}};
  const result=await send(first,'rfnd_syn_unavailable');assert.equal(result.status,503,result.text);assert.doesNotMatch(result.text,/Synthetic private/);providerStatus=200;
  assert.equal(ledgers(),'0');assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${first.id}';`),'0');
 });
 await t.test('a provider-created manual refund remains pending with the exact credential and no financial reversal',async()=>{
  const ref='rfnd_syn_'+randomUUID().replaceAll('-','');observed={id:ref,payment_id:first.providerPayment,amount:1000,currency:'INR',status:'created'};
  const result=await send(first,ref);assert.equal(result.status,202,result.text);assert.equal(result.json?.data.pending,true);assert.equal(ledgers(),'0');
  assert.equal(owned.psql(`SELECT status||':'||credential_id::text||':'||credential_mode FROM payment_attempts WHERE payment_id='${first.id}' AND metadata->>'provider_refund_id'='${ref}';`),`pending:${original.id}:sandbox`);
 });
 await t.test('automatic refund uses the old retained key, verifies its provider response and reverses exactly once',async()=>{
  const key=randomUUID(),beforeCreates=creates,beforeReads=reads;
  const result=await send(first,undefined,key,2000);assert.equal(result.status,200,result.text);assert.equal(result.json?.data.refunded,true);
  assert.equal(creates,beforeCreates+1);assert.equal(reads,beforeReads+1);assert.equal(ledgers(),'1');
  const afterReads=reads,replay=await send(first,undefined,key,2000);assert.equal(replay.status,200,replay.text);assert.equal(creates,beforeCreates+1);assert.equal(reads,afterReads);
  assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${first.id}';`),'2000');
  assert.equal(owned.psql(`SELECT credential_id::text||':'||credential_mode FROM payment_attempts WHERE payment_id='${first.id}' AND metadata->>'provider_refund_id'='${lastCreated}';`),`${original.id}:sandbox`);
 });
 await t.test('a guessed manual reference cannot record a refund while provider status is failed',async()=>{
  const ref='rfnd_syn_'+randomUUID().replaceAll('-','');observed={id:ref,payment_id:first.providerPayment,amount:1000,currency:'INR',status:'failed'};
  const result=await send(first,ref);assert.equal(result.status,409,result.text);assert.equal(result.json?.error.code,'REFUND_PROVIDER_FAILED');assert.equal(ledgers(),'1');
  assert.equal(owned.psql(`SELECT status FROM payment_attempts WHERE payment_id='${first.id}' AND metadata->>'provider_refund_id'='${ref}';`),'failed');
 });
 await t.test('disabled and unbound historical connections fail before reservation or provider contact',async()=>{
  const unbound=fixture(),beforeReads=reads,beforeCreates=creates;
  const missing=await send(unbound);assert.equal(missing.status,409,missing.text);assert.equal(missing.json?.error.code,'REFUND_CONNECTION_REQUIRED');
  owned.psql(`UPDATE payment_credentials SET status='disabled' WHERE id='${original.id}';`);
  try{const disabled=await send();assert.equal(disabled.status,503,disabled.text);assert.equal(disabled.json?.error.code,'REFUND_CONNECTION_UNAVAILABLE');}
  finally{owned.psql(`UPDATE payment_credentials SET status='active' WHERE id='${original.id}';`);}
  assert.equal(reads,beforeReads);assert.equal(creates,beforeCreates);assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${unbound.id}';`),'0');
 });
 await t.test('the database binds refund attempts itself and rejects a forged credential without provider contact',async()=>{
  const beforeCreates=creates;
  assert.match(owned.psqlExpectError(`INSERT INTO payment_attempts(site_id,order_id,payment_id,provider,attempt_type,status,amount,credential_id,credential_mode)
   VALUES('${f.siteId}','${first.orderId}','${first.id}','razorpay','refund','pending',1,'${replacement.id}','sandbox');`),/credential scope mismatch/);
  const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
   if(call.resource==='payment_attempts'&&call.method==='GET'&&call.search.get('select')==='credential_id,credential_mode')return Response.json({credential_id:replacement.id,credential_mode:'sandbox'});
   return forward();
  });
  try{const result=await send(first,undefined,randomUUID(),100);assert.equal(result.status,409,result.text);assert.equal(result.json?.error.code,'REFUND_CONNECTION_REVIEW');}
  finally{tap.restore();}
  assert.equal(creates,beforeCreates);assert.equal(ledgers(),'1');
 });
 await t.test('history prevents DOWN from dropping the binding guard and preserves exact rows',()=>{
  const before=owned.psql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text FROM payment_attempts a WHERE site_id='${f.siteId}';`);
  assert.match(owned.psqlScriptExpectError(readFileSync('database/supabase/rollback/409_refund_attempt_credential_binding.rollback.sql','utf8')),/409 rollback requires retaining/);
  assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text FROM payment_attempts a WHERE site_id='${f.siteId}';`),before);
 });
 await f.gateway.settle();
});
