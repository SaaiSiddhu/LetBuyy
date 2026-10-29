import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test,{after} from 'node:test';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';
import {encryptPaymentSecret} from '../../lib/store-payment-config';
import {PAYMENT_KEYRING_PREFIX} from '../../lib/payment-encryption-keyring';
import {tapRest} from './gateway-harness';
import {parseDomainEventPayload} from '@letbuyy/event-core';
import {readFileSync} from 'node:fs';

const owned=requireOwnedDatabase();let gateway:Gateway;
after(async()=>{await gateway?.settle();});

test('canonical capture cannot accept an invented provider reference without its bound connection and provider proof',async()=>{
 const site=newSyntheticTenant('capture-proof');seedSyntheticTenant(owned.psql,site);
 const actor=randomUUID(),email=`syn-capture-proof-${actor}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic Capture Owner');
  UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';`);
 const {orderId}=seedSyntheticOrder(owned.psql,site),payment=randomUUID(),key=randomUUID();
 owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,provider_order_id,idempotency_key)
  VALUES('${payment}','${site.siteId}','${orderId}','razorpay','sandbox','requires_action',19900,'order_syn_${payment.replaceAll('-','')}','syn-${payment}');`);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const result=await gateway.request(`/v1/payments/${payment}/capture`,{method:'POST',headers:{
  ...await signedIdentityHeaders(actor,email,site.siteId),'X-Idempotency-Key':key},
  body:JSON.stringify({idempotency_key:key,provider_payment_id:'pay_syn_unverified_'+payment.replaceAll('-','')})});
 const journals=owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}';`);
 assert.equal(result.status,409,JSON.stringify({http:result.status,body:result.json,capture_journals:journals}));
 assert.equal(result.json?.error.code,'PAYMENT_CONNECTION_REQUIRED');
 assert.equal(journals,'0');
 assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${payment}' AND site_id='${site.siteId}';`),'requires_action');
});

test('canonical capture verifies the exact saved key and provider order/amount before one balanced financial effect',async t=>{
 const site=newSyntheticTenant('capture-account');seedSyntheticTenant(owned.psql,site);
 const actor=randomUUID(),email=`syn-capture-account-${actor}@example.invalid`,credential=randomUUID();
 const wrapping=randomUUID(),replacementWrapping=randomUUID(),secret=randomUUID().replaceAll('-','');
 const keyId=['rzp','test',randomUUID().replaceAll('-','')].join('_');
 const encrypted=await encryptPaymentSecret(secret,wrapping,{siteId:site.siteId,keyId,environment:'sandbox',credentialId:credential});
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic Account Capture Owner');
  UPDATE sites SET custom_user_id='${actor}',online_payment_enabled=false WHERE id='${site.siteId}';
  INSERT INTO payment_credentials(id,site_id,provider,mode,status,provider_key_id,last_verified_at,encrypted_credentials)
  VALUES('${credential}','${site.siteId}','razorpay','sandbox','active','${keyId}',now(),'${JSON.stringify({key_secret_ciphertext:encrypted})}'::jsonb);`);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{
  PAYMENT_CONFIG_ENCRYPTION_KEY:PAYMENT_KEYRING_PREFIX+JSON.stringify({active:replacementWrapping,previous:[wrapping]}),
  RAZORPAY_KEY_ID:['rzp','test','syntheticDecoy'].join('_'),RAZORPAY_KEY_SECRET:randomUUID(),
 }));
 let observed:Record<string,unknown>={},providerStatus=200,calls=0;
 const original=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.hostname==='api.razorpay.com'){
   calls++;assert.equal(new Headers(init?.headers).get('Authorization'),'Basic '+btoa(keyId+':'+secret),'the payment freezes its key; global and current replacements have no authority');
   return Response.json(observed,{status:providerStatus});
  }
  return original(input,init);
 });
 const fixture=(amount=19900)=>{
  const {orderId}=seedSyntheticOrder(owned.psql,site),id=randomUUID(),providerOrder='order_syn_'+randomUUID().replaceAll('-',''),providerPayment='pay_syn_'+randomUUID().replaceAll('-','');
  owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,provider_order_id,credential_id,idempotency_key)
   VALUES('${id}','${site.siteId}','${orderId}','razorpay','sandbox','requires_action',${amount},'${providerOrder}','${credential}','syn-${id}');`);
  return {id,orderId,providerOrder,providerPayment};
 };
 const send=async(f:ReturnType<typeof fixture>,key=randomUUID())=>gateway.request(`/v1/payments/${f.id}/capture`,{method:'POST',headers:{
  ...await signedIdentityHeaders(actor,email,site.siteId),'X-Idempotency-Key':key},body:JSON.stringify({
   idempotency_key:key,provider_payment_id:f.providerPayment,metadata:{credential_id:credential,amount_minor:1},
  })});
 const journals=()=>owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}';`);
 await t.test('uncaptured, mismatched identity/order/amount/currency and provider outage have zero capture effects',async()=>{
  for(const patch of [{status:'authorized',captured:false},{captured:false},{id:'pay_syn_wrong'},
   {order_id:'order_syn_wrong'},{amount:1},{currency:'USD'}]){
   const f=fixture();observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true,...patch};
   const refused=await send(f);assert.equal(refused.status,409,refused.text);
   assert.equal(journals(),'0');assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${f.id}';`),'requires_action');
  }
  const f=fixture();providerStatus=503;observed={error:{description:'Synthetic private provider detail'}};
  const unavailable=await send(f);assert.equal(unavailable.status,503,unavailable.text);assert.doesNotMatch(unavailable.text,/Synthetic private provider detail/);
  assert.equal(journals(),'0');providerStatus=200;
 });
 await t.test('a fresh provider capture retries the same command after pending status, posting one balanced capture with immutable credentials',async()=>{
  const f=fixture(),key=randomUUID();observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'authorized',captured:false};
  assert.equal((await send(f,key)).status,409);
  observed={...observed,status:'captured',captured:true};
  const accepted=await send(f,key);assert.equal(accepted.status,200,accepted.text);assert.equal(accepted.json?.data.captured,true);
  const beforeCalls=calls;const replay=await send(f,key);assert.equal(replay.status,200,replay.text);assert.equal(calls,beforeCalls);
  assert.equal(journals(),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${f.id}' AND credential_id='${credential}' AND credential_mode='sandbox' AND attempt_type='capture';`),'1');
  assert.equal(owned.psql(`SELECT sum(CASE WHEN side='debit' THEN amount_minor ELSE -amount_minor END) FROM ledger_entries WHERE site_id='${site.siteId}';`),'0');
  assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${f.orderId}' AND payload->>'payment_id'='${f.id}' AND event_type='payment.captured';`),'1');
  const payload=JSON.parse(owned.psql(`SELECT payload FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${f.orderId}' AND event_type='payment.captured';`));
  assert.deepEqual(parseDomainEventPayload('payment.captured',payload),payload,'the atomic outbox follows the existing typed event contract');
  assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope='payment.capture:${f.id}' AND key='${key}';`),'completed');
 });
 await t.test('each payment, attempt, event and receipt failure rolls back the entire capture; the same command then succeeds once',async()=>{
  for(const table of ['payments','payment_attempts','outbox_events','idempotency_keys']){
   const f=fixture(),key=randomUUID();observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true};
   const before=journals(),beforePayment=owned.psql(`SELECT to_jsonb(p)::text FROM payments p WHERE id='${f.id}';`);
   const condition=table==='payments'?`NEW.id='${f.id}' AND NEW.status='captured'`:table==='payment_attempts'?`NEW.payment_id='${f.id}'`:
    table==='outbox_events'?`NEW.aggregate_id='${f.orderId}' AND NEW.event_type='payment.captured'`:`NEW.key='${key}' AND NEW.scope='payment.capture:${f.id}' AND NEW.status='completed'`;
   owned.script(`CREATE FUNCTION synthetic_capture_fault() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN
    IF ${condition} THEN RAISE EXCEPTION 'Synthetic private capture persistence fault'; END IF; RETURN NEW;END $f$;
    CREATE TRIGGER synthetic_capture_fault BEFORE ${table==='payments'||table==='idempotency_keys'?'UPDATE':'INSERT'} ON ${table}
    FOR EACH ROW EXECUTE FUNCTION synthetic_capture_fault();`);
   try{
    const failed=await send(f,key);assert.equal(failed.status,503,failed.text);assert.doesNotMatch(failed.text,/Synthetic private/);
    assert.equal(journals(),before);assert.equal(owned.psql(`SELECT to_jsonb(p)::text FROM payments p WHERE id='${f.id}';`),beforePayment);
    assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${f.id}';`),'0');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${f.orderId}' AND event_type='payment.captured';`),'0');
    assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope='payment.capture:${f.id}' AND key='${key}';`),'failed');
   }finally{owned.script(`DROP TRIGGER synthetic_capture_fault ON ${table};DROP FUNCTION synthetic_capture_fault();`);}
   const retried=await send(f,key);assert.equal(retried.status,200,retried.text);assert.equal(Number(journals()),Number(before)+1);
  }
 });
 await t.test('a lost committed RPC reply preserves the completed capture receipt and retries without another provider observation or journal',async()=>{
  const f=fixture(),key=randomUUID(),before=Number(journals());observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true};
  let lost=false;const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
   const result=await forward();if(!lost&&call.resource==='rpc/commit_canonical_payment_capture_v1'&&result.ok){lost=true;return Response.json({message:'Synthetic lost committed reply'},{status:503});}return result;
  });
  try{
   assert.equal((await send(f,key)).status,503);assert.equal(lost,true);
   assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope='payment.capture:${f.id}' AND key='${key}';`),'completed');
   const beforeCalls=calls;const result=await send(f,key);assert.equal(result.status,200,result.text);assert.equal(calls,beforeCalls);
   assert.equal(Number(journals()),before+1);assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${f.id}' AND attempt_type='capture';`),'1');
  }finally{tap.restore();}
 });
 await t.test('a changed payment, stale receipt or mismatched proof at transaction admission cannot post',async()=>{
  for(const patch of [{p_amount_minor:1},{p_order_id:randomUUID()},{p_credential_id:randomUUID()},
   {p_claim_id:randomUUID()},{p_request_hash:'0'.repeat(64)}]){
   const f=fixture(),before=journals();observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true};
   const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
    if(call.resource==='rpc/commit_canonical_payment_capture_v1')return forward({body:JSON.stringify({...call.json as Record<string,unknown>,...patch})});return forward();
   });
   try{const result=await send(f);assert.equal(result.status,409,result.text);assert.equal(journals(),before);
    assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${f.id}';`),'requires_action');
   }finally{tap.restore();}
  }
 });
 await t.test('two independently keyed capture commands contend on the real payment row and produce one balanced effect',async()=>{
  const f=fixture(),before=Number(journals());observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true};
  let arrived=0,release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
  const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
   if(call.resource==='rpc/commit_canonical_payment_capture_v1'){
    arrived++;if(arrived===2)release();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([barrier,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Synthetic capture barrier did not receive both commands')),10000);})]);}
    finally{clearTimeout(timer);}
   }return forward();
  });
  try{
   const results=await Promise.all([send(f),send(f)]);assert.equal(arrived,2);
   for(const result of results)assert.equal(result.status,200,result.text);
   assert.equal(Number(journals()),before+1);assert.equal(owned.psql(`SELECT count(*) FROM payment_attempts WHERE payment_id='${f.id}' AND attempt_type='capture';`),'1');
   assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${f.orderId}' AND event_type='payment.captured';`),'1');
   assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope='payment.capture:${f.id}' AND status='completed';`),'2');
   assert.equal(owned.psql(`SELECT sum(CASE side WHEN 'debit' THEN amount_minor ELSE -amount_minor END) FROM ledger_entries WHERE site_id='${site.siteId}';`),'0');
  }finally{release();tap.restore();}
 });
 await t.test('current owner and selected store are checked before replay or any provider request',async()=>{
  const f=fixture(),foreign=newSyntheticTenant('capture-foreign');seedSyntheticTenant(owned.psql,foreign);
  const before=calls,otherActor=randomUUID(),otherEmail=`syn-${otherActor}@example.invalid`;
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${otherActor}','${otherEmail}',true);`);
  for(const headers of [{},await signedIdentityHeaders(otherActor,otherEmail,site.siteId),await signedIdentityHeaders(actor,email,foreign.siteId)]){
   const key=randomUUID();const denied=await gateway.request(`/v1/payments/${f.id}/capture`,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify({idempotency_key:key,provider_payment_id:f.providerPayment})});
   assert.ok([401,403,404].includes(denied.status),denied.text);
  }
  assert.equal(calls,before);assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${f.id}';`),'requires_action');
 });
 await t.test('a disabled original credential fails closed without falling back to the global decoy key',async()=>{
  const f=fixture(),before=calls;owned.psql(`UPDATE payment_credentials SET status='disabled' WHERE id='${credential}';`);
  try{const result=await send(f);assert.equal(result.status,503,result.text);assert.equal(calls,before);
   assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${f.id}';`),'requires_action');
  }finally{owned.psql(`UPDATE payment_credentials SET status='active' WHERE id='${credential}';`);}
 });
 await t.test('deterministic randomized exact paise, including one paise and amounts above int32, remain balanced without rake',async()=>{
  let state=408;const amounts=[1,99,100,101,2147483647,2147483648,9999999999];
  for(let i=0;i<25;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;amounts.push(state+1);}
  for(const amount of amounts){
   const f=fixture(amount);observed={id:f.providerPayment,order_id:f.providerOrder,amount,currency:'INR',status:'captured',captured:true};
   const result=await send(f);assert.equal(result.status,200,result.text);assert.equal(result.json?.data.payment.amount_minor,amount);
   assert.equal(owned.psql(`SELECT sum(CASE e.side WHEN 'debit' THEN e.amount_minor ELSE -e.amount_minor END)
    FROM ledger_entries e JOIN payments p ON p.capture_ledger_transaction_id=e.transaction_id WHERE p.id='${f.id}' AND p.site_id='${site.siteId}';`),'0');
   assert.equal(owned.psql(`SELECT string_agg(a.account_code||':'||e.amount_minor::text,',' ORDER BY a.account_code)
    FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id JOIN payments p ON p.capture_ledger_transaction_id=e.transaction_id
    WHERE p.id='${f.id}' AND p.site_id='${site.siteId}';`),`merchant_payable:${amount},pa_clearing:${amount}`);
   assert.equal(owned.psql(`SELECT round(amount*100)::bigint FROM payment_attempts WHERE payment_id='${f.id}' AND attempt_type='capture';`),String(amount));
  }
 });
 await t.test('unbound prior capture journals require reconciliation rather than a second canonical posting',async()=>{
  for(const prefix of ['', 'razorpay:']){
   const f=fixture(),before=Number(journals());observed={id:f.providerPayment,order_id:f.providerOrder,amount:19900,currency:'INR',status:'captured',captured:true};
   owned.psql(`SELECT public.post_settlement_ledger_transaction('${site.siteId}','payment_capture','${prefix+f.providerPayment}',
    'synthetic-prior:${f.id}','[{"account_code":"pa_clearing","side":"debit","amount_minor":19900},{"account_code":"merchant_payable","side":"credit","amount_minor":19900}]'::jsonb,
    '{"payment_id":"${f.id}","order_id":"${f.orderId}"}'::jsonb,'synthetic-prior');`);
   const result=await send(f);assert.equal(result.status,409,result.text);assert.equal(result.json?.error.code,'PAYMENT_CAPTURE_REVIEW');
   assert.equal(Number(journals()),before+1);assert.equal(owned.psql(`SELECT status FROM payments WHERE id='${f.id}';`),'requires_action');
  }
 });
 await t.test('non-service roles cannot invoke the writer; rollback/up preserve all financial history and revoke exposure',()=>{
  const signature='public.commit_canonical_payment_capture_v1(uuid,uuid,uuid,text,uuid,uuid,text,text,bigint,text,text,jsonb)';
  for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
  const fingerprint=()=>owned.psql(`SELECT jsonb_build_object('payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p WHERE site_id='${site.siteId}'),
   'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM payment_attempts a WHERE site_id='${site.siteId}'),
   'ledger',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM ledger_transactions l WHERE site_id='${site.siteId}'),
   'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM outbox_events e WHERE site_id='${site.siteId}'),
   'receipts',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM idempotency_keys i WHERE site_id='${site.siteId}'))::text;`);
  const before=fingerprint();owned.script(readFileSync('database/supabase/rollback/408_atomic_canonical_payment_capture.rollback.sql','utf8'));
  assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`),'t');assert.equal(fingerprint(),before);
  owned.script(readFileSync('database/supabase/migrations/408_atomic_canonical_payment_capture.sql','utf8'));assert.equal(fingerprint(),before);
 });
});
