// Actual Mobile BFF -> Gateway -> fully migrated owned PG/PostgREST. Identity
// credentials/manual refund sources are synthetic fixtures; not device/provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyInternalAppHeaders}from '@letbuyy/auth-core';
import mobileBff from '../../services/mobile-bff/src/index';
import {requireOwnedDatabase}from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {Gateway,gatewayEnv,newIdentityKeys,mintSession,INTERNAL_SECRET,MERCHANT_SESSION_AUDIENCE}from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {otp,STEP_SECRET,TOTP_SECRET}from '../../services/api-gateway/src/__tests__/owned-db/merchant-stepup-fixture';
const owned=requireOwnedDatabase();
async function fixture(){
 const tenant=newSyntheticTenant('nmfa-'+crypto.randomUUID().slice(0,8)),owner=crypto.randomUUID(),email=`syn-native-mfa-${owner}@example.invalid`,keys=await newIdentityKeys();seedSyntheticTenant(owned.psql,tenant);owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${tenant.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,keys,{TOTP_ENCRYPTION_KEY:TOTP_SECRET,STEP_UP_SIGNING_SECRET:STEP_SECRET,RESEND_API_KEY:''}));
 const token=await mintSession(keys,owner,{realm:'merchant',tokenUse:'merchant_session',audience:MERCHANT_SESSION_AUDIENCE});
 const persisted=await gateway.request('/v1/auth/custom/sessions/create',{method:'POST',headers:{'Content-Type':'application/json',...(await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET})).headers},body:JSON.stringify({user_id:owner,token})});assert.equal(persisted.status,201);
 const env={INTERNAL_API_SECRET:INTERNAL_SECRET,API_GATEWAY_SERVICE:{fetch:async(request:Request)=>{const url=new URL(request.url),result=await gateway.request(url.pathname+url.search,{method:request.method,headers:request.headers,...(['GET','HEAD'].includes(request.method)?{}:{body:await request.text()})});return new Response(result.text,{status:result.status,headers:result.headers});}}};
 const call=async(path:string,body:Record<string,unknown>,headers:Record<string,string>={},key=String(body.idempotency_key??crypto.randomUUID()))=>{
  const response=await mobileBff.fetch(new Request('https://mobile-bff.test/v1'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Store-ID':tenant.siteId,'X-Idempotency-Key':key,...headers},body:JSON.stringify(body)}),env as never);return{status:response.status,json:await response.json()as any};
 };
 const enrolled=await call('/2fa/totp/enroll',{});assert.equal(enrolled.status,201);const factor=String(enrolled.json.data.factor.id),secret=String(enrolled.json.data.secret),verifyKey=crypto.randomUUID();const activated=await call('/2fa/totp/verify',{factor_id:factor,code:otp(secret)},{},verifyKey);assert.equal(activated.status,200);assert.equal(activated.json.data.recovery_codes.length,8);
 const retried=await call('/2fa/totp/verify',{factor_id:factor,code:otp(secret)},{},verifyKey);assert.equal(retried.status,200);assert.equal(JSON.stringify(retried.json.data.recovery_codes)===JSON.stringify(activated.json.data.recovery_codes),true,'Activation retry changed the original recovery codes');
 const proof=async()=>{const result=await call('/security/step-up/challenges',{store_id:tenant.siteId,factor_id:factor,code:otp(secret),action:'refund.approve',idempotency_key:crypto.randomUUID()});assert.equal(result.status,201);return{'X-Step-Up-Token':String(result.json.data.step_up_token),'X-Step-Up-Verified-At':String(result.json.data.verified_at)};};return{...tenant,owner,call,proof,factor,secret};
}
async function refund(site:string){const order=crypto.randomUUID(),ret=crypto.randomUUID(),id=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,store_id,site_id,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${site}','${site}','syn-native@example.invalid','{}','[]',100,100,'paid');INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${site}','${order}','received','manual','syn-${ret}');INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${id}','${site}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${id}');`);return{order,ret,id};}
for(const kind of ['order','return'])test(`actual mobile transport enrolls/activates/challenges and completes one canonical ${kind} refund with replay`,async()=>{
 const f=await fixture(),r=await refund(f.siteId),path=kind==='order'?'/orders/'+r.order+'/refund/complete':'/returns/'+r.ret+'/refund/complete',key=crypto.randomUUID(),body={refund_id:r.id,idempotency_key:key};
 const missing=await f.call(path,body);assert.equal(missing.status,428);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${r.id}';`),'pending');
 const result=await f.call(path,body,await f.proof());assert.equal(result.status,200);assert.equal(kind==='order'?result.json.data.order.id:result.json.data.id,kind==='order'?r.order:r.ret);
 const retry=await f.call(path,body,await f.proof());assert.equal(retry.status,200);assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${r.id}';`),'1');assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${r.id}';`),'succeeded');
});
test('foreign ownership and disabled factor proofs cannot post through mobile transport',async()=>{
 const a=await fixture(),b=await fixture(),r=await refund(a.siteId),key=crypto.randomUUID(),proof=await a.proof();
 const foreign=await b.call('/orders/'+r.order+'/refund/complete',{refund_id:r.id,idempotency_key:key},proof);assert.ok([403,404,428].includes(foreign.status));assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${r.id}';`),'0');
 assert.equal((await a.call('/2fa/disable',{factor_id:a.factor,code:otp(a.secret)})).status,200);
 const disabled=await a.call('/returns/'+r.ret+'/refund/complete',{refund_id:r.id,idempotency_key:key},proof);assert.equal(disabled.status,428);assert.equal(owned.psql(`SELECT status FROM refunds WHERE id='${r.id}';`),'pending');
});
