// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Real Gateway/DB. Provider-confirmed IDs and zero-value payout setup are
// synthetic authorization fixtures, not provider approval/capture evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {verifySensitiveActionStepUp}from '../../lib/security-controls';
import {sha256Hex}from '../../lib/crypto';
import {requireOwnedDatabase}from './owned-db-support';
import {tapRest,restJson,INTERNAL_SECRET}from './gateway-harness';
import {seedSyntheticOrder}from './synthetic-tenant';
import {merchantFixture,activeFactor,issue,otp,explain,STEP_SECRET}from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
const proofHeaders=(r:{json:Record<string,unknown>|null})=>{const d=r.json?.data as {step_up_token:string;verified_at:string};return{'X-Step-Up-Token':d.step_up_token,'X-Step-Up-Verified-At':d.verified_at};};
async function payment(f:Awaited<ReturnType<typeof merchantFixture>>,currency='INR'){
 const order=seedSyntheticOrder(owned.psql,f),id=crypto.randomUUID();owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)VALUES('${id}','${f.siteId}','${order.orderId}','razorpay','sandbox','captured',10000,'${currency}','syn-pay-${id}','syn-payment-${id}');`);return id;
}
async function statement(f:Awaited<ReturnType<typeof merchantFixture>>){const id=crypto.randomUUID();owned.psql(`INSERT INTO payout_statements(id,site_id,statement_number,status,provider,provider_mode,rail,currency)VALUES('${id}','${f.siteId}','SYN-MFA-${id}','pending','razorpay_route','sandbox','pa_split','INR');`);return id;}
async function disable(f:Awaited<ReturnType<typeof merchantFixture>>,factor:{id:string;secret:string}){const r=await f.call('POST','/2fa/disable',{factor_id:factor.id,code:otp(factor.secret)});assert.equal(r.status,200,explain(r));}
test('disabled factor proof cannot reserve or finalize a new manually recorded payment refund',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f);assert.equal(proof.status,201,explain(proof));await disable(f,factor);
 const result=await f.call('POST','/payments/'+id+'/refund',{amount_minor:1000,provider_refund_id:'syn-refund-'+crypto.randomUUID(),idempotency_key:crypto.randomUUID()},proofHeaders(proof));
 assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT count(*)FROM payment_attempts WHERE payment_id='${id}'AND attempt_type='refund';`),'0');assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${id}';`),'0');
});
test('disabled factor payout proof is refused before provider configuration is consulted',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor,crypto.randomUUID(),'payout.release'),id=await statement(f);assert.equal(proof.status,201,explain(proof));await disable(f,factor);
 const result=await f.call('POST','/payouts/'+id+'/settle',{idempotency_key:crypto.randomUUID()},proofHeaders(proof));assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${id}';`),'pending');
});
test('payment refund checks current approval again when disable wins before the reserve transaction',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f);assert.equal(proof.status,201,explain(proof));let disabled=false;
 const tap=tapRest(owned.restUrl,async(c,forward)=>{if(!disabled&&['rpc/reserve_payment_refund_attempt','rpc/reserve_owned_payment_refund_v1'].includes(c.resource)){disabled=true;await disable(f,factor);}return forward();});
 try{const result=await f.call('POST','/payments/'+id+'/refund',{amount_minor:1000,provider_refund_id:'syn-race-'+crypto.randomUUID(),idempotency_key:crypto.randomUUID()},proofHeaders(proof));assert.equal(disabled,true);assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT count(*)FROM payment_attempts WHERE payment_id='${id}'AND attempt_type='refund';`),'0');}finally{tap.restore();}
});
test('payout release claim rejects disable winning before claim; named lost-reply fault prevents all provider contact',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor,crypto.randomUUID(),'payout.release'),id=await statement(f);assert.equal(proof.status,201,explain(proof));
 Object.assign(f.gateway.env,{RAZORPAY_KEY_ID:'rzp_test_synthetic',RAZORPAY_ROUTE_KEY_SECRET:'synthetic-never-contacted-route-secret',RAZORPAY_ROUTE_ACCOUNT_ID:'acc_synthetic',RAZORPAY_ROUTE_MODE:'sandbox',RAZORPAY_ROUTE_PROVIDER_ENABLED:'true'});
 let intercepted=false;const tap=tapRest(owned.restUrl,async(c,forward)=>{if(!intercepted&&['rpc/claim_payout_statement_release','rpc/claim_owned_payout_release_v1'].includes(c.resource)){intercepted=true;await disable(f,factor);await forward();return restJson(503,{message:'synthetic-payout-claim-reply-lost-before-provider'});}return forward();});
 try{const response=await f.call('POST','/payouts/'+id+'/settle',{idempotency_key:crypto.randomUUID()},proofHeaders(proof));assert.equal(intercepted,true,explain(response));assert.equal(response.status,409,explain(response));assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${id}';`),'pending','disabled proof changed durable release claim before named reply loss');}finally{tap.restore();}
});

async function manual(f:Awaited<ReturnType<typeof merchantFixture>>,id:string,proof:{json:Record<string,unknown>|null},key:string,ref:string,amount=1000,embedded=false){
 return f.call('POST','/payments/'+id+'/refund',{amount_minor:amount,provider_refund_id:ref,idempotency_key:key,...(embedded?{metadata:{step_up_token:proofHeaders(proof)['X-Step-Up-Token'],step_up_verified_at:proofHeaders(proof)['X-Step-Up-Verified-At']}}:{})},embedded?{}:proofHeaders(proof));
}
test('full refund replay is live-owner/factor gated and survives factor replacement without another posting',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-full-'+crypto.randomUUID();
 const first=await manual(f,id,proof,key,ref,10000);assert.equal(first.status,200,explain(first));const replay=await manual(f,id,proof,key,ref,10000);assert.equal(replay.status,200,explain(replay));assert.equal(replay.headers.get('X-Idempotent-Replay'),'true');
 const other=await merchantFixture(owned),foreign=await other.call('POST','/payments/'+id+'/refund',{amount_minor:10000,provider_refund_id:ref,idempotency_key:key},{...proofHeaders(proof),'X-Store-ID':f.siteId});assert.ok([403,404].includes(foreign.status),explain(foreign));
 await disable(f,factor);assert.equal((await manual(f,id,proof,key,ref,10000)).status,428);
 const replacement=await activeFactor(f),fresh=await issue(f,replacement);assert.equal(fresh.status,201,explain(fresh));assert.equal((await manual(f,id,fresh,key,ref,10000)).status,200);
 assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${id}';`),'10000');assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='${ref}';`),'1');
});
test('a new transport key cannot reuse one provider refund reference to count the refund twice',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),ref='syn-ref-once-'+crypto.randomUUID();assert.equal((await manual(f,id,proof,crypto.randomUUID(),ref)).status,200);
 const duplicate=await manual(f,id,proof,crypto.randomUUID(),ref);assert.equal(duplicate.status,409,explain(duplicate));assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${id}';`),'1000');assert.equal(owned.psql(`SELECT count(*)FROM payment_attempts WHERE payment_id='${id}'AND attempt_type='refund';`),'1');
});
test('a committed full refund with lost HTTP receipt recovers the original source after lease expiry',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-full-recover-'+crypto.randomUUID();let faulted=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='idempotency_keys'&&call.method==='PATCH'&&(call.json as {status?:string})?.status==='completed'){faulted=true;return restJson(503,{message:'synthetic-refund-final-receipt-write-failed'});}return forward();});
 try{const first=await manual(f,id,proof,key,ref,10000);assert.equal(faulted,true);assert.ok([202,500,503].includes(first.status),explain(first));assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${id}';`),'refunded');}finally{tap.restore();}
 owned.psql(`UPDATE idempotency_keys SET locked_until=clock_timestamp()-interval '1 second'WHERE site_id='${f.siteId}'AND key='${key}'AND scope='payment.refund:${id}';`);
 const recovered=await manual(f,id,proof,key,ref,10000);assert.equal(recovered.status,200,explain(recovered));assert.equal(recovered.json?.data.refunded,true);assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='${ref}';`),'1');
});
test('a cached pending reply follows a subsequently reconciled trusted callback without another provider action',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-callback-'+crypto.randomUUID();
 const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/reconcile_payment_refund_attempt'?restJson(503,{message:'synthetic-provider-confirmed-local-reconcile-outage'}):forward());
 try{const pending=await manual(f,id,proof,key,ref,10000);assert.equal(pending.status,202,explain(pending));}finally{tap.restore();}
 const callback=await f.gateway.request('/v1/storefront/internal/payments/refund-event',{method:'POST',headers:{'Content-Type':'application/json','X-Internal-API-Secret':INTERNAL_SECRET},body:JSON.stringify({provider:'razorpay',providerPaymentId:'syn-pay-'+id,providerRefundId:ref,providerEventId:'refund.processed:'+ref,eventType:'refund.processed',status:'processed',amountMinor:10000,currency:'INR'})});assert.equal(callback.status,200,explain(callback));
 const current=await manual(f,id,proof,key,ref,10000);assert.equal(current.status,200,explain(current));assert.equal(current.json?.data.refunded,true);assert.equal(current.json?.data.payment.status,'refunded');
});
test('legacy body-carried approval is transient intent so a fresh valid proof can retry the same financial key',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-body-'+crypto.randomUUID();assert.equal((await manual(f,id,proof,key,ref,1000,true)).status,200);
 const fresh=await issue(f,factor);assert.equal(fresh.status,201,explain(fresh));assert.equal(proofHeaders(fresh)['X-Step-Up-Token']===proofHeaders(proof)['X-Step-Up-Token'],false);
 const retry=await manual(f,id,fresh,key,ref,1000,true);assert.equal(retry.status,200,explain(retry));assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${id}';`),'1000');
});

const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
async function evidence(f:Awaited<ReturnType<typeof merchantFixture>>,proof:{json:Record<string,unknown>|null},action:'refund.approve'|'payout.release'='refund.approve'){
 const headers=proofHeaders(proof),v=await verifySensitiveActionStepUp({action,actorId:f.owner,siteId:f.siteId,token:headers['X-Step-Up-Token'],verifiedAt:headers['X-Step-Up-Verified-At'],signingSecret:STEP_SECRET});assert.equal(v.ok,true);return{...v.metadata,token_sha256:await sha256Hex(headers['X-Step-Up-Token'])};
}
function configured(f:Awaited<ReturnType<typeof merchantFixture>>){Object.assign(f.gateway.env,{RAZORPAY_KEY_ID:'rzp_test_synthetic',RAZORPAY_ROUTE_KEY_SECRET:'synthetic-never-contacted-route-secret',RAZORPAY_ROUTE_ACCOUNT_ID:'acc_synthetic',RAZORPAY_ROUTE_MODE:'sandbox',RAZORPAY_ROUTE_PROVIDER_ENABLED:'true'});}
for(const mode of ['same-key','different-keys']as const)test('concurrent '+mode+' refunds cannot overspend capture or duplicate a source',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-concurrent-'+crypto.randomUUID();
 const results=await Promise.all([manual(f,id,proof,key,ref,10000),manual(f,id,proof,mode==='same-key'?key:crypto.randomUUID(),mode==='same-key'?ref:ref+'-other',10000)]);
 assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409].includes(r.status)));assert.equal(owned.psql(`SELECT refunded_amount_minor FROM payments WHERE id='${id}';`),'10000');assert.equal(owned.psql(`SELECT count(*)FROM payment_attempts WHERE payment_id='${id}'AND attempt_type='refund';`),'1');assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='merchant.payment_refund.authorized';`),'1');
});
test('omitted amount is recovered from the original full refund source and never recomputed as zero',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-omitted-'+crypto.randomUUID();
 const call=()=>f.call('POST','/payments/'+id+'/refund',{provider_refund_id:ref,idempotency_key:key},proofHeaders(proof));assert.equal((await call()).status,200);const replay=await call();assert.equal(replay.status,200,explain(replay));assert.equal(replay.json?.data.payment.refunded_amount_minor,10000);
});
test('the existing payment currency constraint rejects unsupported money before the refund boundary',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f);
 assert.match(owned.psqlExpectError(`UPDATE payments SET currency='USD'WHERE id='${id}';`),/payments_currency_check/);assert.equal(owned.psql(`SELECT currency FROM payments WHERE id='${id}';`),'INR');
 const response=await manual(f,id,proof,crypto.randomUUID(),'syn-currency-'+crypto.randomUUID());assert.equal(response.status,200,explain(response));
});
for(const mode of ['same-key','different-keys']as const)test('concurrent '+mode+' payout claims keep one authorized source before named provider-contact barrier',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor,crypto.randomUUID(),'payout.release'),id=await statement(f),key=crypto.randomUUID();configured(f);let calls=0;
 const tap=tapRest(owned.restUrl,async(c,forward)=>{if(c.resource==='rpc/claim_owned_payout_release_v1'){calls++;await forward();return restJson(503,{message:'synthetic-payout-claim-reply-loss-before-provider'});}return forward();});
 try{const results=await Promise.all([key,mode==='same-key'?key:crypto.randomUUID()].map(k=>f.call('POST','/payouts/'+id+'/settle',{idempotency_key:k},proofHeaders(proof))));assert.ok(results.every(r=>r.status===409));assert.equal(calls,2);assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${id}';`),'processing');assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE resource_id='${id}'AND action='merchant.payout_release.authorized';`),'1');}finally{tap.restore();}
});
test('an owned active payout proof reaches the explicit unavailable-provider gate without claiming money',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor,crypto.randomUUID(),'payout.release'),id=await statement(f);const result=await f.call('POST','/payouts/'+id+'/settle',{idempotency_key:crypto.randomUUID()},proofHeaders(proof));assert.equal(result.status,503,explain(result));assert.equal(result.json?.error.code,'PAYOUT_PROVIDER_UNAVAILABLE');assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${id}';`),'pending');
});
for(const kind of ['refund','payout']as const)test('a named '+kind+' approval-audit failure rolls the canonical claim back and same-key retry succeeds locally',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor,crypto.randomUUID(),kind==='refund'?'refund.approve':'payout.release'),id=kind==='refund'?await payment(f):await statement(f),key=crypto.randomUUID(),ref='syn-audit-'+crypto.randomUUID(),action=kind==='refund'?'merchant.payment_refund.authorized':'merchant.payout_release.authorized',name='syn_money_'+crypto.randomUUID().replaceAll('-','');
 if(kind==='payout')configured(f);
 const tap=tapRest(owned.restUrl,async(c,forward)=>{if(kind==='payout'&&c.resource==='rpc/claim_owned_payout_release_v1'){await forward();return restJson(503,{message:'synthetic-payout-provider-contact-barrier'});}return forward();});
 const call=()=>kind==='refund'?manual(f,id,proof,key,ref):f.call('POST','/payouts/'+id+'/settle',{idempotency_key:key},proofHeaders(proof));
 owned.psql(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-money-approval-audit-failed';END$$;CREATE TRIGGER ${name} BEFORE INSERT ON audit_logs FOR EACH ROW WHEN(NEW.actor_id='${f.owner}'AND NEW.action='${action}')EXECUTE FUNCTION public.${name}();`);
 try{assert.equal((await call()).status,409);assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='${action}';`),'0');if(kind==='refund')assert.equal(owned.psql(`SELECT count(*)FROM payment_attempts WHERE payment_id='${id}'AND attempt_type='refund';`),'0');else assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${id}';`),'pending');}
 finally{owned.psql(`DROP TRIGGER ${name} ON audit_logs;DROP FUNCTION public.${name}();`);}
 try{const retry=await call();assert.equal(retry.status,kind==='refund'?200:409,explain(retry));assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='${action}';`),'1');}finally{tap.restore();}
});
test('a completed refund whose canonical posting pointer changes is held for review instead of replaying cached success',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),key=crypto.randomUUID(),ref='syn-review-'+crypto.randomUUID();assert.equal((await manual(f,id,proof,key,ref)).status,200);
 owned.psql(`UPDATE payment_attempts SET metadata=metadata||jsonb_build_object('canonical_ledger_transaction_id','${crypto.randomUUID()}')WHERE payment_id='${id}'AND attempt_type='refund';`);
 const denied=await manual(f,id,proof,key,ref);assert.equal(denied.status,409,explain(denied));assert.equal(denied.json?.error.code,'REFUND_REVIEW_REQUIRED');assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='${ref}';`),'1');
});
test('actual database roles, owner substitutions, wrong action and tenant context cannot invoke another money claim',async()=>{
 for(const role of ['anon','authenticated','app_tenant'])for(const expression of ["reserve_owned_payment_refund_v1(NULL,NULL,NULL,1000,'synthetic-role-key','{}')","claim_owned_payout_release_v1(NULL,NULL,'synthetic-role-key',NULL,'{}')"])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT ${expression};`),/permission denied for function/);
 const f=await merchantFixture(owned),other=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f),sid=await statement(f),ev=quote(JSON.stringify(await evidence(f,proof)))+'::jsonb';
 const call=(expr:string,context='')=>JSON.parse(owned.script(`BEGIN;SET LOCAL ROLE service_role;${context}SELECT ${expr};ROLLBACK;`).trim())as{accepted:boolean;status:number;code:string};
 assert.equal(call(`reserve_owned_payment_refund_v1('${f.siteId}','${id}','${other.owner}',1000,'synthetic-owner-test',${ev})`).status,403);
 assert.equal(call(`reserve_owned_payment_refund_v1('${f.siteId}','${id}','${f.owner}',1000,'synthetic-context-test',${ev})`,`SET LOCAL app.site_id='${other.siteId}';`).code,'MONEY_TENANT_MISMATCH');
 assert.equal(call(`claim_owned_payout_release_v1('${f.siteId}','${sid}','synthetic-wrong-action','${f.owner}',${ev})`).status,428);
});
test('recorded merchant money authorization history prevents rollback from removing live guards',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor),id=await payment(f);assert.equal((await manual(f,id,proof,crypto.randomUUID(),'syn-history-'+crypto.randomUUID())).status,200);assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/342_live_merchant_money_claims.rollback.sql','utf8')),/refuses merchant money authorization history/);
});
