// Actual Gateway/owned database. Synthetic order/payment inputs; no provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {requireOwnedDatabase}from './owned-db-support';
import {seedSyntheticOrder,newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
import {signedIdentityHeaders}from './gateway-harness';
import {merchantFixture,explain}from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
test('owner order detail carries a tenant predicate and returns its canonical payment link',async()=>{
 const f=await merchantFixture(owned),order=seedSyntheticOrder(owned.psql,f),payment=crypto.randomUUID();
 owned.psql(`UPDATE orders SET payment_id='syn-provider-${payment}'WHERE id='${order.orderId}';INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)VALUES('${payment}','${f.siteId}','${order.orderId}','razorpay','sandbox','captured',10000,'INR','syn-provider-${payment}','syn-pay-${payment}');`);
 for(const scoped of [true,false]){const result=await f.gateway.request('/v1/orders/'+order.orderId,{headers:await signedIdentityHeaders(f.owner,f.email,scoped?f.siteId:undefined)});assert.equal(result.status,200,explain(result));assert.equal(result.json?.data.id,order.orderId);assert.equal(result.json?.data.payment_id,'syn-provider-'+payment);assert.equal(result.json?.data.refund_payment_id,payment);assert.equal(result.json?.data.refund_payment_resolution,'available');}
});
test('another owner cannot read the complete order with no hint or a forged store hint',async()=>{
 const a=await merchantFixture(owned),b=await merchantFixture(owned),order=seedSyntheticOrder(owned.psql,a);
 for(const hint of [undefined,a.siteId,b.siteId]){const result=await b.call('GET','/orders/'+order.orderId,undefined,hint?{'X-Store-ID':hint}:{});assert.ok([403,404].includes(result.status),explain(result));assert.equal(result.json?.data,undefined);}
});
test('a supplied owned store hint cannot silently select another owned store order',async()=>{
 const f=await merchantFixture(owned),other=newSyntheticTenant('mfa-detail-other');seedSyntheticTenant(owned.psql,other);owned.psql(`UPDATE sites SET custom_user_id='${f.owner}'WHERE id='${other.siteId}';`);const order=seedSyntheticOrder(owned.psql,f);
 const selected=await f.gateway.request('/v1/orders/'+order.orderId,{headers:{...await signedIdentityHeaders(f.owner,f.email),'X-Store-ID':other.siteId}});assert.equal(selected.status,404,explain(selected));assert.equal(selected.json?.data,undefined);
 const signed=await f.call('GET','/orders/'+order.orderId,undefined,{'X-Store-ID':other.siteId});assert.equal(signed.status,200,explain(signed));assert.equal(signed.json?.data.id,order.orderId,'a raw hint overrode signed scope');
});
test('deleted order and revoked owner reads remain denied',async()=>{
 const f=await merchantFixture(owned),order=seedSyntheticOrder(owned.psql,f);owned.psql(`UPDATE orders SET deleted_at=now()WHERE id='${order.orderId}';`);
 const deleted=await f.call('GET','/orders/'+order.orderId);assert.equal(deleted.status,404,explain(deleted));
 const live=seedSyntheticOrder(owned.psql,f);owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${f.siteId}';`);const revoked=await f.call('GET','/orders/'+live.orderId);assert.ok([403,404].includes(revoked.status),explain(revoked));
});

for(const count of [0,2])test('owned order with '+count+' captured payment sources cannot pick an arbitrary refund UUID',async()=>{
 const f=await merchantFixture(owned),order=seedSyntheticOrder(owned.psql,f);
 for(let n=0;n<count;n++){const id=crypto.randomUUID();owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)VALUES('${id}','${f.siteId}','${order.orderId}','razorpay','sandbox','captured',10000,'INR','syn-provider-${id}','syn-pay-${id}');`);}
 const result=await f.call('GET','/orders/'+order.orderId);assert.equal(result.status,200,explain(result));assert.equal(result.json?.data.refund_payment_id,null);assert.equal(result.json?.data.refund_payment_resolution,count?'ambiguous':'not_found');
});
