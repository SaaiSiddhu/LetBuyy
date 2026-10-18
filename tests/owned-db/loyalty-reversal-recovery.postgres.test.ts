// Actual Gateway/status receipt -> owned PostgREST/ledger recovery. Synthetic
// accounts and paid setup are fixtures, not normal checkout/provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {consumeLoyaltyRefundJobs} from '../../services/queue-workers/src/platform-queue-consumer';
import {createSupabaseServiceClient} from '@letbuyy/infrastructure/supabase-adapter';
import {signSensitiveActionStepUp} from '../../services/api-gateway/src/lib/security-controls';
import {readFileSync} from 'node:fs';
import {merchantApprovalHeaders,TOTP_SECRET}from '../../services/api-gateway/src/__tests__/owned-db/merchant-stepup-fixture';
const STEP_UP_SECRET='synthetic-loyalty-refund-step-up-at-least-32-bytes';
const owned=requireOwnedDatabase();
async function fixture(){
 const site=newSyntheticTenant('loy-rev-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),buyer=crypto.randomUUID(),email=`syn-reversal-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);
 UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';
 INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${buyer}','syn-buyer-${buyer}@example.invalid',true);
 SELECT set_loyalty_program('${site.siteId}',p_is_active=>true,p_earn_rate_bps=>10000,p_actor_id=>'${owner}',p_actor_type=>'user');`);
 const paid=seedSyntheticOrder(owned.psql,site);
 owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${paid.orderId}';
 INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${paid.orderId}','${buyer}','${site.siteId}','authenticated_checkout');
 SELECT award_loyalty_points('${site.siteId}','${buyer}','${paid.orderId}','syn-reversal-earn-${paid.orderId}');`);
 const orderId=owned.psql(`SELECT create_checkout_order_for_buyer('${buyer}',1,'${site.siteId}','Synthetic Loyalty Buyer','syn-buyer-${buyer}@example.invalid','9000000099',
 '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}',
 '[{"product_id":"${paid.productId}","quantity":1}]','cod',NULL,NULL,NULL,'standard','syn-loy-checkout-${crypto.randomUUID()}',NULL,NULL,NULL,NULL,NULL,NULL,50)->>'id';`);
 const spend={orderId,productId:paid.productId};
 assert.equal(owned.psql(`SELECT total FROM orders WHERE id='${orderId}';`),'149.00');
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{STEP_UP_SIGNING_SECRET:STEP_UP_SECRET,TOTP_ENCRYPTION_KEY:TOTP_SECRET}));
 const balance=()=>owned.psql(`SELECT loyalty_balance(id)FROM loyalty_accounts WHERE site_id='${site.siteId}'AND buyer_account_id='${buyer}';`);
 const credits=()=>owned.psql(`SELECT count(*)FROM loyalty_ledger_entries WHERE order_id='${spend.orderId}'AND entry_type='refund_credit';`);
 return{...site,owner,buyer,email,paid,spend,gateway,balance,credits};
}
test('a cancelled order with a lost restoration is repaired by the same authenticated receipt retry',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),body={status:'cancelled',idempotency_key:key};assert.equal(f.balance(),'149');
 const call=async()=>f.gateway.request('/v1/orders/'+f.spend.orderId,{method:'PATCH',headers:await signedIdentityHeaders(f.owner,f.email,f.siteId),body:JSON.stringify(body)});
 const fault=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/restore_loyalty_on_refund'&&call.method==='POST'?restJson(503,{message:'synthetic-loyalty-restore-outage'}):forward());
 try{const first=await call();assert.equal(first.status,200,first.text);assert.equal(owned.psql(`SELECT status FROM orders WHERE id='${f.spend.orderId}';`),'cancelled');assert.equal(f.balance(),'149');assert.equal(f.credits(),'0');}
 finally{fault.restore();}
 const retried=await call();assert.equal(retried.status,200,retried.text);
 assert.equal(f.balance(),'199','an acknowledged cancellation must not permanently strand the buyer’s redeemed points after a transient restoration failure');
 assert.equal(f.credits(),'1');
 await call();assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
});

const terminal=(f:Awaited<ReturnType<typeof fixture>>,status='cancelled')=>owned.psql(`UPDATE orders SET status='${status}'WHERE id='${f.spend.orderId}';`);
const job=(f:Awaited<ReturnType<typeof fixture>>)=>owned.psql(`SELECT id FROM platform_queue_jobs WHERE queue_name='loyalty-refunds' AND site_id='${f.siteId}';`);
const worker=(name:string)=>consumeLoyaltyRefundJobs(owned.restEnv(),'syn-loyalty-'+name+'-'+crypto.randomUUID());
const due=(id:string)=>owned.psql(`UPDATE platform_queue_jobs SET available_at=now()-interval '1 second' WHERE id='${id}';`);
const drain=()=>worker('drain');

test('the owned worker repairs a committed cancellation without a client retry, even after pause and value changes',async()=>{
 const f=await fixture();terminal(f);owned.psql(`SELECT set_loyalty_program('${f.siteId}',p_is_active=>false,p_point_value_minor=>150);`);
 const result=await worker('independent');assert.equal(result[0].succeeded,1,JSON.stringify(result));assert.equal(f.balance(),'199');assert.equal(f.credits(),'1');
 assert.equal(owned.psql(`SELECT (metadata->>'point_value_minor_at_redemption')||'|'||(metadata->>'value_minor_at_redemption') FROM loyalty_ledger_entries WHERE order_id='${f.spend.orderId}'AND entry_type='refund_credit';`),'100|5000');
 assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${job(f)}';`),'succeeded');
 await drain();assert.equal(f.credits(),'1');
});

test('the real order resolver binds signed scope, permits owned no-hint bootstrap, and refuses foreign scope and failed lookup',async()=>{
 const a=await fixture(),b=await fixture();
 const call=async(owner:typeof a,scope:string|undefined,order:string,hint?:string)=>owner.gateway.request('/v1/orders/'+order,{method:'PATCH',headers:{...await signedIdentityHeaders(owner.owner,owner.email,scope),...(hint?{'X-Store-ID':hint}:{})},body:JSON.stringify({status:'cancelled',idempotency_key:crypto.randomUUID()})});
 for(const request of [()=>call(a,a.siteId,b.spend.orderId),()=>call(a,undefined,b.spend.orderId),()=>call(a,undefined,b.spend.orderId,b.siteId)]){
  const result=await request();assert.ok([403,404].includes(result.status),result.text);assert.equal(b.balance(),'149');assert.equal(b.credits(),'0');
 }
 const fault=tapRest(owned.restUrl,async(c,forward)=>c.resource==='orders'&&c.method==='GET'?restJson(503,{message:'synthetic-order-lookup-failed'}):forward());
 try{const failed=await call(a,undefined,a.spend.orderId);assert.equal(failed.status,500,failed.text);assert.equal(a.credits(),'0');}finally{fault.restore();}
 const good=await call(a,undefined,a.spend.orderId);assert.equal(good.status,200,good.text);assert.equal(a.balance(),'199');
 const signed=await fixture();const ignoresRaw=await call(signed,signed.siteId,signed.spend.orderId,b.siteId);assert.equal(ignoresRaw.status,200,ignoresRaw.text);assert.equal(signed.balance(),'199');
});

test('a transient worker failure backs off, retains its debt, and retries the same source once',async()=>{
 const f=await fixture();terminal(f);
 const fault=tapRest(owned.restUrl,async(c,forward)=>c.resource==='rpc/recover_loyalty_refund_job_v1'?restJson(503,{message:'synthetic-recovery-outage'}):forward());
 try{const r=await worker('outage');assert.equal(r[0].transient_failed,1,JSON.stringify(r));assert.equal(f.credits(),'0');}finally{fault.restore();}
 const id=job(f);assert.equal(owned.psql(`SELECT status||'|'||attempts||'|'||(available_at>now())::text FROM platform_queue_jobs WHERE id='${id}';`),'failed|1|true');
 due(id);const r=await drain();assert.equal(r[0].succeeded,1,JSON.stringify(r));assert.equal(f.balance(),'199');assert.equal(f.credits(),'1');
});

test('a committed restoration with a lost reply is retried without a second ledger credit',async()=>{
 const f=await fixture();terminal(f);let injected=false;
 const fault=tapRest(owned.restUrl,async(c,forward)=>{const response=await forward();if(!injected&&c.resource==='rpc/recover_loyalty_refund_job_v1'){injected=true;return restJson(503,{message:'synthetic-committed-reply-lost'});}return response;});
 try{const r=await worker('lost');assert.equal(r[0].failed,1,JSON.stringify(r));assert.equal(f.balance(),'199');}finally{fault.restore();}
 due(job(f));const r=await drain();assert.equal(r[0].succeeded,1,JSON.stringify(r));assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
});

test('abandoned worker leases recover through bounded failure and cannot authorize a stale or different worker',async()=>{
 const f=await fixture();terminal(f);owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(25);SELECT count(*) FROM claim_platform_queue_jobs('loyalty-refunds','syn-abandoned',25,120);`);
 const id=job(f);assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT recover_loyalty_refund_job_v1('${id}','syn-other-worker');`),/current worker lease/);
 owned.psql(`UPDATE platform_queue_jobs SET locked_at=now()-interval '121 seconds'WHERE id='${id}';`);
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT recover_loyalty_refund_job_v1('${id}','syn-abandoned');`),/current worker lease/);
 const recovered=await drain();assert.equal(recovered[0].claimed,0,JSON.stringify(recovered));assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${id}';`),'failed');
 due(id);await drain();assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
});

test('malformed cross-tenant source is quarantined and does not starve the next eligible entry',async()=>{
 const poison=await fixture(),healthy=await fixture();terminal(poison);terminal(healthy);
 owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(1);`);const id=job(poison);assert.ok(id);
 owned.psql(`UPDATE platform_queue_jobs SET site_id='${healthy.siteId}'WHERE id='${id}';SELECT enqueue_pending_loyalty_refunds_v1(1);`);
 const result=await drain();assert.equal(result[0].deterministic_failed,1,JSON.stringify(result));assert.equal(result[0].succeeded,1,JSON.stringify(result));
 assert.equal(poison.credits(),'0');assert.equal(poison.balance(),'149');assert.equal(healthy.credits(),'1');
 assert.equal(owned.psql(`SELECT status||'|'||(result->>'quarantined') FROM platform_queue_jobs WHERE id='${id}';`),'dead|true');
 assert.equal(owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(1);`),'0','dead debt remains visible rather than silently re-enqueued');
});

test('partial or unreversed orders cannot return all spent points and private RPCs refuse browser/tenant roles',async()=>{
 const f=await fixture();owned.psql(`UPDATE orders SET refund_status='partially_refunded'WHERE id='${f.spend.orderId}';`);
 assert.match(owned.psql(`SELECT restore_loyalty_on_refund('${f.siteId}','${f.spend.orderId}');`),/order_not_reversed/);
 assert.equal(owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(25);`),'0');assert.equal(f.balance(),'149');
 for(const role of ['anon','authenticated','app_tenant'])for(const signature of ['loyalty_order_reversal_eligible_v1(uuid,uuid)','restore_loyalty_on_refund(uuid,uuid,uuid,text)','enqueue_pending_loyalty_refunds_v1(integer)','recover_loyalty_refund_job_v1(uuid,text)','recover_expired_loyalty_refund_jobs_v1(integer)']){
  assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.${signature}','EXECUTE');`),'f',role+' '+signature);
  const invocation=signature.startsWith('restore_')?`restore_loyalty_on_refund('${f.siteId}','${f.spend.orderId}')`
   :signature.startsWith('loyalty_order_')?`loyalty_order_reversal_eligible_v1('${f.siteId}','${f.spend.orderId}')`
   :signature.startsWith('enqueue_')?'enqueue_pending_loyalty_refunds_v1(1)'
   :signature.startsWith('recover_expired_')?'recover_expired_loyalty_refund_jobs_v1(1)'
   :`recover_loyalty_refund_job_v1('${crypto.randomUUID()}','syn-denied-role')`;
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${invocation};`),/permission denied for function/);

 }
 terminal(f);assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT set_config('app.site_id','${crypto.randomUUID()}',true);SELECT restore_loyalty_on_refund('${f.siteId}','${f.spend.orderId}');`),/tenant context/);
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT restore_loyalty_on_refund('${crypto.randomUUID()}','${f.spend.orderId}');`),/scope mismatch/);assert.equal(f.credits(),'0');
 await drain();assert.equal(f.credits(),'1');
});

test('concurrent real consumers and fast-path restoration credit the canonical redemption once',async()=>{
 const f=await fixture();terminal(f);const db=createSupabaseServiceClient(owned.restEnv());
 const results=await Promise.all([worker('race-a'),worker('race-b'),db.rpc('restore_loyalty_on_refund',{p_site_id:f.siteId,p_order_id:f.spend.orderId})]);
 assert.equal(results[2].error,null,JSON.stringify(results[2].error));assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
 await drain();assert.equal(f.credits(),'1');
});

test('cached order receipts never bypass live ownership and mismatched request bodies remain refused',async()=>{
 const a=await fixture(),b=await fixture(),key=crypto.randomUUID();
 const call=async(subject:typeof a,status='cancelled')=>a.gateway.request('/v1/orders/'+a.spend.orderId,{method:'PATCH',headers:await signedIdentityHeaders(subject.owner,subject.email,a.siteId),body:JSON.stringify({status,idempotency_key:key})});
 assert.equal((await call(a)).status,200);const foreign=await call(b);assert.equal(foreign.status,403,foreign.text);
 const conflict=await call(a,'refunded');assert.equal(conflict.status,409,conflict.text);
 owned.psql(`UPDATE sites SET custom_user_id='${b.owner}'WHERE id='${a.siteId}';`);
 const revoked=await call(a);assert.equal(revoked.status,403,revoked.text);assert.equal(a.credits(),'1');
});

test('actual internal provider partial/full refund events restore tender only after canonical full refund',async()=>{
 const f=await fixture(),payment=crypto.randomUUID(),providerPayment='pay_syn_'+crypto.randomUUID();
 owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${f.spend.orderId}';
 INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)
 VALUES('${payment}','${f.siteId}','${f.spend.orderId}','razorpay','sandbox','captured',14900,'INR','${providerPayment}','syn-loy-pay-${payment}');`);
 const call=async(refund:string,type:string,status:string,amount:number)=>f.gateway.request('/v1/storefront/internal/payments/refund-event',{
  method:'POST',headers:{'Content-Type':'application/json','X-Internal-API-Secret':'owned-db-gateway-harness-internal-secret'},
  body:JSON.stringify({provider:'razorpay',providerPaymentId:providerPayment,providerRefundId:refund,providerEventId:type+':'+refund,eventType:type,status,amountMinor:amount,currency:'INR'})});
 for(const [index,amount]of [5000,9900].entries()){
  const refund='rfnd_syn_'+crypto.randomUUID();
  owned.psql(`INSERT INTO payment_attempts(site_id,order_id,payment_id,provider,attempt_type,status,amount,currency,provider_payment_id,idempotency_key,metadata)
   VALUES('${f.siteId}','${f.spend.orderId}','${payment}','razorpay','refund','pending',${amount/100},'INR','${providerPayment}','syn-loy-refund-${refund}',jsonb_build_object('provider_refund_id','${refund}'));`);
  const created=await call(refund,'refund.created','created',amount);assert.equal(created.status,200,created.text);await drain();assert.equal(f.credits(),'0');
  const processed=await call(refund,'refund.processed','processed',amount);assert.equal(processed.status,200,processed.text);
  const duplicate=await call(refund,'refund.processed','processed',amount);assert.equal(duplicate.status,200,duplicate.text);
  await drain();assert.equal(f.credits(),index===0?'0':'1');assert.equal(f.balance(),index===0?'149':'199');
  assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='${refund}';`),'1');
 }
});

function manualRefund(f:Awaited<ReturnType<typeof fixture>>){
 const id=crypto.randomUUID();owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${f.spend.orderId}';
 INSERT INTO refunds(id,site_id,order_id,amount,status,refund_method,provider,idempotency_key)
 VALUES('${id}','${f.siteId}','${f.spend.orderId}',149,'pending','manual','bank_transfer','syn-manual-${id}');`);return id;
}
test('a refund ID from another order or tenant is refused before any refund or canonical ledger write',async()=>{
 const a=await fixture(),b=await fixture(),refund=manualRefund(b);
 const response=await a.gateway.request('/v1/orders/'+a.spend.orderId+'/refund/complete',{method:'POST',headers:await refundHeaders(a),body:JSON.stringify({refund_id:refund,idempotency_key:crypto.randomUUID()})});
 assert.equal(response.status,404,response.text);
 assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${refund}';`),'pending','ownership must be checked before the completion RPC mutates another merchant’s refund');
 assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${refund}';`),'0');assert.equal(b.credits(),'0');
});

async function refundHeaders(f:Awaited<ReturnType<typeof fixture>>,options:{secret?:string;verifiedAt?:string}={}){
 if(!options.secret&&!options.verifiedAt)return merchantApprovalHeaders(f.gateway,f.owner,f.email,f.siteId);
 const proof=await signSensitiveActionStepUp({action:'refund.approve',actorId:f.owner,siteId:f.siteId,challengeId:'syn-refund-'+crypto.randomUUID(),signingSecret:options.secret??STEP_UP_SECRET,verifiedAt:options.verifiedAt});
 return{...await signedIdentityHeaders(f.owner,f.email,f.siteId),'X-Step-Up-Token':proof.token,'X-Step-Up-Verified-At':proof.verifiedAt};
}

test('manual full refund requires cryptographic step-up, refuses lookup faults, and restores the correct source immediately and once',async()=>{
 const f=await fixture(),refund=manualRefund(f),key=crypto.randomUUID(),body={refund_id:refund,idempotency_key:key};
 const call=async(headers:Record<string,string>)=>f.gateway.request('/v1/orders/'+f.spend.orderId+'/refund/complete',{method:'POST',headers,body:JSON.stringify(body)});
 for(const headers of [await signedIdentityHeaders(f.owner,f.email,f.siteId),await refundHeaders(f,{secret:'synthetic-forged-secret-at-least-32-bytes'}),await refundHeaders(f,{verifiedAt:new Date(Date.now()-11*60*1000).toISOString()})]){
  const denied=await call(headers);assert.equal(denied.status,428,denied.text);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${refund}';`),'pending');
 }
 const fault=tapRest(owned.restUrl,async(c,forward)=>c.resource==='refunds'&&c.method==='GET'?restJson(503,{message:'synthetic-refund-scope-outage'}):forward());
 try{const failed=await call(await refundHeaders(f));assert.equal(failed.status,500,failed.text);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${refund}';`),'pending');}finally{fault.restore();}
 const good=await call(await refundHeaders(f));assert.equal(good.status,200,good.text);assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
 const retry=await call(await refundHeaders(f));assert.equal(retry.status,200,retry.text);assert.equal(f.credits(),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${refund}';`),'1');
 // This denial needs a distinct owned order, not another checkout. Keep the
 // separately observed four-digit checkout number collision mapped to N6.
 const other=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total)
 VALUES('${other}','${f.siteId}','${f.siteId}','SYN-SCOPE-${other}','syn-scope-${other}@example.invalid','{}','[]',199,199);`);
 const second=await f.gateway.request('/v1/orders/'+other+'/refund/complete',{method:'POST',headers:await refundHeaders(f),body:JSON.stringify({refund_id:refund,idempotency_key:crypto.randomUUID()})});
 assert.equal(second.status,404,second.text);assert.equal(f.credits(),'1');
});

test('ten transient failures enter durable dead-letter state without dropping the original restoration obligation',async()=>{
 const f=await fixture();terminal(f);let attempts=0;
 const fault=tapRest(owned.restUrl,async(c,forward)=>c.resource==='rpc/recover_loyalty_refund_job_v1'?restJson(503,{message:'synthetic-persistent-recovery-outage'}):forward());
 try{
  for(let n=1;n<=10;n++){
   if(n>1)due(job(f));const result=await worker('exhaust-'+n);assert.equal(result[0].transient_failed,1,JSON.stringify(result));attempts++;
   assert.equal(owned.psql(`SELECT attempts||'|'||status FROM platform_queue_jobs WHERE id='${job(f)}';`),n+'|'+(n===10?'dead':'failed'));
  }
 }finally{fault.restore();}
 assert.equal(attempts,10);assert.equal(f.credits(),'0');assert.equal(f.balance(),'149');
 assert.equal(owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(25);`),'0');assert.equal((await drain())[0].claimed,0);
 const rollback=readFileSync(new URL('../../database/supabase/rollback/335_durable_loyalty_refund_recovery.rollback.sql',import.meta.url),'utf8');
 assert.match(owned.psqlExpectError(rollback),/rollback335 refuses outstanding or historical recovery jobs/);
 assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${job(f)}';`),'dead');
});

async function waitFor(sql:string,expected:string){
 const deadline=Date.now()+10000;while(Date.now()<deadline){if(owned.psql(sql)===expected)return;await new Promise(resolve=>setTimeout(resolve,50));}assert.fail('Owned lock barrier did not reach expected state');
}
test('restoration serializes its balance_after projection with a concurrent earn on the same account',async()=>{
 const f=await fixture();terminal(f);const other=seedSyntheticOrder(owned.psql,f);owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${other.orderId}';INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${other.orderId}','${f.buyer}','${f.siteId}','authenticated_checkout');`);
 const suffix=crypto.randomUUID().replaceAll('-','').slice(0,12),gate=String(BigInt('0x'+suffix)),fn='syn_restore_'+suffix,keeper='syn-restore-keeper-'+suffix,restore='syn-restore-'+suffix,earn='syn-earn-'+suffix;
 owned.psql(`CREATE FUNCTION public.${fn}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM pg_advisory_xact_lock(${gate}::bigint);RETURN NEW;END$$;
 CREATE TRIGGER ${fn} BEFORE INSERT ON loyalty_ledger_entries FOR EACH ROW WHEN(NEW.site_id='${f.siteId}'AND NEW.entry_type='refund_credit')EXECUTE FUNCTION public.${fn}();`);
 const held=owned.psqlAsync(`SET application_name='${keeper}';SELECT pg_advisory_lock(${gate}::bigint);SELECT pg_sleep(30);`).catch(()=> 'owned keeper stopped');
 const release=()=>owned.psql(`SELECT pg_cancel_backend(pid)FROM pg_stat_activity WHERE datname=current_database()AND application_name='${keeper}'AND pid<>pg_backend_pid();`);
 let restored:Promise<string>|undefined,earned:Promise<string>|undefined;
 try{
  await waitFor(`SELECT count(*)FROM pg_stat_activity WHERE datname=current_database()AND application_name='${keeper}'AND wait_event='PgSleep';`,'1');
  restored=owned.psqlAsync(`SET application_name='${restore}';SELECT restore_loyalty_on_refund('${f.siteId}','${f.spend.orderId}');`);
  await waitFor(`SELECT count(*)FROM pg_stat_activity WHERE datname=current_database()AND application_name='${restore}'AND wait_event_type='Lock';`,'1');
  earned=owned.psqlAsync(`SET application_name='${earn}';SELECT award_loyalty_points('${f.siteId}','${f.buyer}','${other.orderId}','syn-concurrent-earn');`);
  await waitFor(`SELECT count(*)FROM pg_stat_activity WHERE datname=current_database()AND application_name='${earn}'AND wait_event_type='Lock';`,'1');
  release();await held;await restored;await earned;assert.equal(f.balance(),'398');
  assert.equal(owned.psql(`SELECT balance_after FROM loyalty_ledger_entries WHERE order_id='${f.spend.orderId}'AND entry_type='refund_credit';`),'199');
  assert.equal(owned.psql(`SELECT balance_after FROM loyalty_ledger_entries WHERE order_id='${other.orderId}'AND entry_type='earned';`),'398');
 }finally{release();await held;await Promise.allSettled([restored,earned].filter((p):p is Promise<string>=>Boolean(p)));owned.psql(`DROP TRIGGER ${fn} ON loyalty_ledger_entries;DROP FUNCTION public.${fn}();`);}
});

test('a refunded payment status without its canonical ledger posting cannot manufacture point recovery',async()=>{
 const f=await fixture(),id=crypto.randomUUID();owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,refunded_amount_minor,currency,provider_payment_id,idempotency_key)
 VALUES('${id}','${f.siteId}','${f.spend.orderId}','razorpay','sandbox','refunded',14900,14900,'INR','syn-unposted-${id}','syn-unposted-${id}');`);
 assert.equal(owned.psql(`SELECT loyalty_order_reversal_eligible_v1('${f.siteId}','${f.spend.orderId}');`),'f');
 await drain();assert.equal(f.credits(),'0');assert.equal(f.balance(),'149');
});

test('a worker lost after committed credit but before acknowledgement recovers its expired lease and acknowledges once',async()=>{
 const f=await fixture();terminal(f);owned.psql(`SELECT enqueue_pending_loyalty_refunds_v1(25);SELECT count(*)FROM claim_platform_queue_jobs('loyalty-refunds','syn-credit-before-loss',25,120);`);
 const id=job(f);owned.psql(`SET ROLE service_role;SELECT recover_loyalty_refund_job_v1('${id}','syn-credit-before-loss');`);
 assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${id}';`),'running');
 owned.psql(`UPDATE platform_queue_jobs SET locked_at=now()-interval '121 seconds'WHERE id='${id}';`);await drain();due(id);const result=await drain();
 assert.equal(result[0].succeeded,1,JSON.stringify(result));assert.equal(f.credits(),'1');assert.equal(f.balance(),'199');
 assert.equal(owned.psql(`SELECT status||'|'||attempts FROM platform_queue_jobs WHERE id='${id}';`),'succeeded|2');
});

test('merchant archival, a paused programme and a closed account cannot forfeit an existing reversal obligation',async()=>{
 const f=await fixture();terminal(f);owned.psql(`UPDATE orders SET deleted_at=now()WHERE id='${f.spend.orderId}';
 UPDATE loyalty_accounts SET status='closed'WHERE site_id='${f.siteId}'AND buyer_account_id='${f.buyer}';
 SELECT set_loyalty_program('${f.siteId}',p_is_active=>false);`);
 const result=await drain();assert.equal(result[0].succeeded,1,JSON.stringify(result));assert.equal(f.balance(),'199');assert.equal(f.credits(),'1');
});
