// Real production Worker -> isolated PostgREST/PostgreSQL. Only PSP responses are synthetic.
import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {createSupabaseServiceClient} from '@letbuyy/infrastructure/supabase-adapter';
import {hydratePaymentCredential} from '../../lib/payment-credential-history';
import {readStoreRazorpayTestCredentials} from '../../lib/store-payment-config';

const owned=requireOwnedDatabase();const gateways:Gateway[]=[];
after(async()=>{await Promise.all(gateways.map(g=>g.settle()));});

test('explicit managed sandbox connections retain per-store authority, immutable history and atomic receipts',async t=>{
 const a=newSyntheticTenant('managed-a'),b=newSyntheticTenant('managed-b');
 seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
 const actor=randomUUID(),email=`managed-${actor}@example.invalid`,wrapping=randomUUID(),secret=randomUUID();
 const keyId=['rzp','test',randomUUID().replaceAll('-','')].join('_');
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic Managed Owner');
 UPDATE sites SET custom_user_id='${actor}',online_payment_enabled=false,cod_enabled=true WHERE id IN('${a.siteId}','${b.siteId}');`);
 const down=readFileSync('database/supabase/rollback/417_managed_sandbox_payment_connections.rollback.sql','utf8');
 const up=readFileSync('database/supabase/migrations/417_managed_sandbox_payment_connections.sql','utf8');
 await t.test('unused migration DOWN/up conserves sites and restores the original uniqueness rule',()=>{
  const before=owned.psql(`SELECT md5(string_agg(to_jsonb(s)::text,'|' ORDER BY id)) FROM sites s WHERE id IN('${a.siteId}','${b.siteId}');`);
  owned.script(down);owned.script(up);
  assert.equal(owned.psql(`SELECT md5(string_agg(to_jsonb(s)::text,'|' ORDER BY id)) FROM sites s WHERE id IN('${a.siteId}','${b.siteId}');`),before);
 });
 const keys=await newIdentityKeys(),env=gatewayEnv(owned,keys,{ENVIRONMENT:'test',LETBUYY_PAYMENT_MODE:'sandbox',LETBUYY_RAZORPAY_MODE:'sandbox',
 LETBUYY_MANAGED_PAYMENTS_MODE:'sandbox',RAZORPAY_KEY_ID:keyId,RAZORPAY_KEY_SECRET:secret,PAYMENT_CONFIG_ENCRYPTION_KEY:wrapping});
 const gateway=new Gateway(env);gateways.push(gateway);
 const request=async(site:string,method:string,body?:Record<string,unknown>,key=randomUUID(),g=gateway)=>g.request(`/v1/stores/${site}/payment-config`,{
  method,headers:{...await signedIdentityHeaders(actor,email,site),'X-Idempotency-Key':key},...(body?{body:JSON.stringify(body)}:{})});
 let verificationCalls=0;const outerFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.origin==='https://api.razorpay.com'){
   assert.equal(url.pathname,'/v1/payments');assert.equal(new Headers(init?.headers).get('Authorization'),'Basic '+btoa(keyId+':'+secret));
   verificationCalls++;return Response.json({items:[]});
  }return outerFetch(input,init);
 });
 const revision=(site:string)=>owned.psql(`SELECT to_jsonb(updated_at)#>>'{}' FROM sites WHERE id='${site}';`);
 const credential=(site:string)=>owned.psql(`SELECT payment_settings->'razorpay'->>'credential_id' FROM sites WHERE id='${site}';`);
 await t.test('two stores explicitly connect the same platform test key with separate encrypted roots',async()=>{
  for(const site of [a.siteId,b.siteId]){
   const result=await request(site,'POST',{connection:'managed_sandbox'});assert.equal(result.status,200,result.text);
   assert.equal(result.json?.data.payment_settings.mode,'managedSandbox');assert.equal(result.json?.data.setup.connection,'managed_sandbox');
   assert.equal(result.json?.data.setup.can_enable_online,true);assert.equal(result.json?.data.online_payment_enabled,false);
   assert.equal(result.json?.data.cod_enabled,true);assert.equal(result.json?.data.setup.settlement_status,'not_available_in_test');
   assert.doesNotMatch(result.text,/key_secret|ciphertext|encrypted_credentials/);assert.ok(!result.text.includes(secret));
  }
  assert.notEqual(credential(a.siteId),credential(b.siteId));assert.equal(verificationCalls,2);
  assert.equal(owned.psql(`SELECT count(DISTINCT connection_id) FROM payment_credentials WHERE site_id IN('${a.siteId}','${b.siteId}') AND metadata->>'account_model'='managed_sandbox';`),'2');
  const db=createSupabaseServiceClient(owned.restEnv());
  const row=await hydratePaymentCredential(db,{id:a.siteId}); // explicit historical lookup below
  assert.equal(row.id,a.siteId);
  const bound=await hydratePaymentCredential(db,{id:a.siteId},{credentialId:credential(a.siteId)});
  assert.deepEqual(await readStoreRazorpayTestCredentials(bound.payment_settings,wrapping,a.siteId),{keyId,keySecret:secret});
  assert.equal(await readStoreRazorpayTestCredentials({...bound.payment_settings,mode:'ownAccount'},wrapping,a.siteId),null);
  const foreign=await hydratePaymentCredential(db,{id:b.siteId},{credentialId:credential(a.siteId)});
  assert.equal(await readStoreRazorpayTestCredentials(foreign.payment_settings,wrapping,b.siteId),null);
 });
 await t.test('lost-reply replay uses one committed credential and rechecks current ownership',async()=>{
  const key=randomUUID(),body={connection:'managed_sandbox',expected_revision:revision(a.siteId)};
  const first=await request(a.siteId,'POST',body,key),count=verificationCalls;assert.equal(first.status,200,first.text);
  const replay=await request(a.siteId,'POST',body,key);assert.equal(replay.status,200,replay.text);assert.equal(verificationCalls,count);
  assert.deepEqual(replay.json,first.json);
  owned.psql(`UPDATE sites SET custom_user_id=NULL WHERE id='${a.siteId}';`);
  const denied=await request(a.siteId,'POST',body,key);assert.ok([403,404].includes(denied.status),denied.text);
  assert.ok(!denied.text.includes(secret));assert.equal(verificationCalls,count);
  owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${a.siteId}';`);
 });
 await t.test('online activation is explicit; stale switches, key injection and live requests cannot overwrite it',async()=>{
  const rev=revision(a.siteId);const enabled=await request(a.siteId,'PATCH',{online_payment_enabled:true,expected_revision:rev});
  assert.equal(enabled.status,200,enabled.text);assert.equal(enabled.json?.data.setup.online_checkout_available,true);
  assert.equal((await request(a.siteId,'POST',{connection:'managed_sandbox',expected_revision:rev})).status,409);
  for(const extra of [{key_secret:'injected-secret-not-used'},{test_mode:false},{provider_account_id:'acct_injected'}]){
   assert.equal((await request(a.siteId,'POST',{connection:'managed_sandbox',...extra})).status,400);
  }
  assert.equal(owned.psql(`SELECT online_payment_enabled AND cod_enabled FROM sites WHERE id='${a.siteId}';`),'t');
 });
 await t.test('disabled flags and live platform keys cannot connect or enable managed checkout',async()=>{
  for(const change of [{LETBUYY_MANAGED_PAYMENTS_MODE:undefined},
   {LETBUYY_PAYMENT_MODE:'live'},{RAZORPAY_KEY_ID:keyId.replace('_test_','_live_')}]){
   const denied=new Gateway({...env,...change} as typeof env);gateways.push(denied);
   assert.equal((await request(b.siteId,'POST',{connection:'managed_sandbox'},randomUUID(),denied)).status,503);
   const read=await request(b.siteId,'GET',undefined,randomUUID(),denied);assert.equal(read.status,200,read.text);
   assert.equal(read.json?.data.setup.can_enable_online,false);
   assert.equal((await request(b.siteId,'PATCH',{online_payment_enabled:true},randomUUID(),denied)).status,409);
  }
 });
 await t.test('managed credential history prevents destructive rollback after use',()=>{
  const count=owned.psql(`SELECT count(*) FROM payment_credentials;`);
  assert.match(owned.psqlScriptExpectError(down),/415 rollback requires/);
  assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials;`),count);
 });
});
