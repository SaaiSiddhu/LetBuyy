import assert from 'node:assert/strict';
import test from 'node:test';
import {parseDomainEventPayload}from '@letbuyy/event-core';
import {requireOwnedDatabase}from './owned-db-support';
import {tapRest,restJson,newBarrier,signedIdentityHeaders}from './gateway-harness';
import {signSensitiveActionStepUp}from '../../lib/security-controls';
import {readFileSync}from 'node:fs';
import {merchantFixture,activeFactor,issue,otp,explain,STEP_SECRET}from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
test('same challenge command retries preserve one proof and audit instead of reminting it',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID(),first=await issue(f,factor,key);assert.equal(first.status,201,explain(first));
 const retry=await issue(f,factor,key);assert.equal(retry.status,201,explain(retry));assert.equal(retry.json?.data.step_up_token===first.json?.data.step_up_token,true,'a retry reminted an approval proof');
});
test('an existing challenge key cannot be rebound to another sensitive action',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID();assert.equal((await issue(f,factor,key)).status,201);
 const changed=await issue(f,factor,key,'payout.release');assert.equal(changed.status,409,explain(changed));assert.equal(owned.psql(`SELECT action FROM step_up_challenges WHERE site_id='${f.siteId}'AND idempotency_key='${key}';`),'refund.approve');
});
test('a disable committed after the factor read prevents issuing a new challenge',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f);let disabled=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(!disabled&&((call.resource==='step_up_challenges'&&call.method==='POST')||call.resource==='rpc/issue_merchant_step_up_v1')){disabled=true;const result=await f.call('POST','/2fa/disable',{factor_id:factor.id,code:otp(factor.secret)});assert.equal(result.status,200,explain(result));}return forward();});
 try{const result=await issue(f,factor);assert.equal(disabled,true);assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT count(*)FROM step_up_challenges WHERE actor_id='${f.owner}';`),'0');}finally{tap.restore();}
});
test('normal API proof is denied for a new refund after its factor is disabled',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor);assert.equal(proof.status,201,explain(proof));
 const order=crypto.randomUUID(),ret=crypto.randomUUID(),refund=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,store_id,site_id,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${f.siteId}','${f.siteId}','syn-proof@example.invalid','{}','[]',100,100,'paid');INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${f.siteId}','${order}','received','manual','syn-${ret}');INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${refund}','${f.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${refund}');`);
 assert.equal((await f.call('POST','/2fa/disable',{factor_id:factor.id,code:otp(factor.secret)})).status,200);
 const result=await f.call('POST','/returns/'+ret+'/refund/complete',{refund_id:refund,idempotency_key:crypto.randomUUID()},{'X-Step-Up-Token':proof.json?.data.step_up_token,'X-Step-Up-Verified-At':proof.json?.data.verified_at});assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${refund}';`),'pending');
});

async function refund(f:Awaited<ReturnType<typeof merchantFixture>>){
 const order=crypto.randomUUID(),ret=crypto.randomUUID(),id=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,store_id,site_id,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${f.siteId}','${f.siteId}','syn-proof@example.invalid','{}','[]',100,100,'paid');INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${f.siteId}','${order}','received','manual','syn-${ret}');INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${id}','${f.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${id}');`);return{order,ret,id};
}
async function complete(f:Awaited<ReturnType<typeof merchantFixture>>,r:Awaited<ReturnType<typeof refund>>,proof:{token:string;verifiedAt:string},key=crypto.randomUUID()){
 return f.call('POST','/returns/'+r.ret+'/refund/complete',{refund_id:r.id,idempotency_key:key},{'X-Step-Up-Token':proof.token,'X-Step-Up-Verified-At':proof.verifiedAt});
}
const proofOf=(r:{json:Record<string,unknown>|null})=>{const d=r.json?.data as {step_up_token:string;verified_at:string};return{token:d.step_up_token,verifiedAt:d.verified_at};};
for(const removeGuard of [false,true])test((removeGuard?'controlled removal confirms':'same transaction proof prevents')+' disable after gateway verification and before canonical refund posting',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),challenge=await issue(f,factor),r=await refund(f);assert.equal(challenge.status,201,explain(challenge));
 const definition=owned.psql(`SELECT pg_get_functiondef('complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure);`);
 const guard=" IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'refund.approve',p_intent->'_step_up')THEN RETURN jsonb_build_object('status',428,'error','STEP_UP_INVALID');END IF;";
 assert.ok(definition.includes(guard));if(removeGuard)owned.script(definition.replace(guard,''));let disabled=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(!disabled&&call.resource==='rpc/complete_owned_order_refund_v1'){disabled=true;assert.equal((await f.call('POST','/2fa/disable',{factor_id:factor.id,code:otp(factor.secret)})).status,200);}return forward();});
 try{const result=await complete(f,r,proofOf(challenge));assert.equal(disabled,true);assert.equal(result.status,removeGuard?200:428,explain(result));assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${r.id}';`),removeGuard?'1':'0');}
 finally{tap.restore();if(removeGuard)owned.script(definition);}
 assert.equal(owned.psql(`SELECT pg_get_functiondef('complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure);`),definition);
});
test('a valid MAC without its matching canonical challenge is refused before any refund write',async()=>{
 const f=await merchantFixture(owned),r=await refund(f),proof=await signSensitiveActionStepUp({action:'refund.approve',actorId:f.owner,siteId:f.siteId,challengeId:crypto.randomUUID(),signingSecret:STEP_SECRET});
 const response=await complete(f,r,proof);assert.equal(response.status,428,explain(response));assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${r.id}';`),'pending');
});
test('committed challenge reply loss recovers one encrypted proof, audit and outbox event',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID();let lost=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{const r=await forward();if(!lost&&call.resource==='rpc/issue_merchant_step_up_v1'){lost=true;return restJson(503,{message:'synthetic-challenge-committed-reply-lost'});}return r;});
 try{const first=await issue(f,factor,key);assert.equal(first.status,503,explain(first));}finally{tap.restore();}
 const retry=await issue(f,factor,key);assert.equal(retry.status,201,explain(retry));const again=await issue(f,factor,key);assert.equal(again.status,201,explain(again));assert.equal(proofOf(retry).token===proofOf(again).token,true,'retry did not recover its committed proof');
 const id=String(retry.json?.data.challenge.id);assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE action='merchant.step_up.verified'AND resource_id='${id}';`),'1');assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE idempotency_key='auth.stepup:${id}';`),'1');
 assert.equal(owned.psql(`SELECT merchant_result_ciphertext LIKE '%lb-stepup-v1%'FROM step_up_challenges WHERE id='${id}';`),'f');
});
for(const mode of ['same-intent','different-action'])test('concurrent same-key '+mode+' challenge requests preserve the original intent',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID(),barrier=newBarrier(2);
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/issue_merchant_step_up_v1')await barrier.arrive();return forward();});
 try{const results=await Promise.all([issue(f,factor,key),issue(f,factor,key,mode==='same-intent'?'refund.approve':'payout.release')]);assert.equal(results.filter(r=>r.status===201).length,mode==='same-intent'?2:1);assert.ok(results.every(r=>[201,409].includes(r.status)));if(mode==='same-intent')assert.equal(proofOf(results[0]).token===proofOf(results[1]).token,true,'same intent returned different proof');assert.equal(owned.psql(`SELECT count(*)FROM step_up_challenges WHERE site_id='${f.siteId}'AND idempotency_key='${key}';`),'1');}finally{tap.restore();}
});
test('a challenge receipt cannot be taken over after site ownership changes to a different actor',async()=>{
 const a=await merchantFixture(owned),b=await merchantFixture(owned),fa=await activeFactor(a),fb=await activeFactor(b),key=crypto.randomUUID();const first=await issue(a,fa,key);assert.equal(first.status,201,explain(first));
 owned.psql(`UPDATE sites SET custom_user_id='${b.owner}'WHERE id='${a.siteId}';`);
 const response=await b.gateway.request('/v1/security/step-up/challenges',{method:'POST',headers:await signedIdentityHeaders(b.owner,b.email,a.siteId),body:JSON.stringify({store_id:a.siteId,action:'refund.approve',factor_id:fb.id,code:otp(fb.secret),idempotency_key:key})});assert.equal(response.status,409,explain(response));assert.equal(owned.psql(`SELECT actor_id FROM step_up_challenges WHERE id='${first.json?.data.challenge.id}';`),a.owner);
});
test('expiry and source revocation deny old proof and old command retries without replacing history',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID(),first=await issue(f,factor,key),r=await refund(f);assert.equal(first.status,201,explain(first));const id=String(first.json?.data.challenge.id);
 owned.psql(`UPDATE step_up_challenges SET expires_at=clock_timestamp()-interval '1 second'WHERE id='${id}';`);
 const retry=await issue(f,factor,key);assert.equal(retry.status,428,explain(retry));assert.equal((await complete(f,r,proofOf(first))).status,428);assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${r.id}';`),'0');
});
test('a named audit failure rolls challenge, receipt and outbox back; same-key retry then completes',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),key=crypto.randomUUID(),name='syn_stepup_'+crypto.randomUUID().replaceAll('-','');
 owned.psql(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-stepup-audit-failure';END$$;CREATE TRIGGER ${name} BEFORE INSERT ON audit_logs FOR EACH ROW WHEN(NEW.actor_id='${f.owner}'AND NEW.action='merchant.step_up.verified')EXECUTE FUNCTION public.${name}();`);
 try{assert.equal((await issue(f,factor,key)).status,503);assert.equal(owned.psql(`SELECT count(*)FROM step_up_challenges WHERE actor_id='${f.owner}';`),'0');assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE actor_id='${f.owner}'AND event_type='auth.stepup';`),'0');}finally{owned.psql(`DROP TRIGGER ${name} ON audit_logs;DROP FUNCTION public.${name}();`);}
 assert.equal((await issue(f,factor,key)).status,201);
});
test('actual untrusted roles cannot issue or verify private merchant approval and history refuses rollback',async()=>{
 for(const role of ['anon','authenticated','app_tenant'])for(const expr of ["issue_merchant_step_up_v1(NULL,NULL,NULL,'refund.approve','synthetic-key',NULL,'{}')","verify_merchant_step_up_v1(NULL,NULL,'refund.approve','{}')"])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT ${expr};`),/permission denied for function/);
 const f=await merchantFixture(owned),factor=await activeFactor(f);assert.equal((await issue(f,factor)).status,201);const rollback=readFileSync('database/supabase/rollback/340_merchant_step_up_challenges.rollback.sql','utf8');assert.match(owned.psqlExpectError(rollback),/refuses merchant challenge history/);
});

test('the atomic auth event preserves its typed contract and original request correlation on retry',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),trace=crypto.randomUUID(),key=crypto.randomUUID(),body={store_id:f.siteId,action:'refund.approve',factor_id:factor.id,code:otp(factor.secret),idempotency_key:key};
 const first=await f.call('POST','/security/step-up/challenges',body,{'X-Request-ID':trace});assert.equal(first.status,201,explain(first));const id=String(first.json?.data.challenge.id);
 const payload=JSON.parse(owned.psql(`SELECT payload FROM outbox_events WHERE idempotency_key='auth.stepup:${id}';`));assert.doesNotThrow(()=>parseDomainEventPayload('auth.stepup',payload));
 assert.equal(owned.psql(`SELECT request_id||'|'||trace_id FROM outbox_events WHERE idempotency_key='auth.stepup:${id}';`),trace+'|'+trace);
 assert.equal((await f.call('POST','/security/step-up/challenges',body,{'X-Request-ID':crypto.randomUUID()})).status,201);assert.equal(owned.psql(`SELECT metadata->>'request_id'FROM audit_logs WHERE action='merchant.step_up.verified'AND resource_id='${id}';`),trace);
});
