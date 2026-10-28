// Ordinary fulfilment status changes must never invent payment/refund receipts.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateway:Gateway;
after(async()=>{await gateway?.settle();});
test('ordinary delivery/cancellation never manufacture paid/refunded state or a refund',async t=>{
 const a=newSyntheticTenant('status-truth');seedSyntheticTenant(owned.psql,a);
 const actor=randomUUID(),email=`status-${actor}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic order operator');UPDATE sites SET custom_user_id='${actor}' WHERE id='${a.siteId}';`);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 for(const target of ['delivered','cancelled']) await t.test(target,async()=>{
  const order=randomUUID();
  owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_email,customer_name,shipping_address,items,subtotal,total,status,payment_status,payment_method) VALUES('${order}','${a.siteId}','${a.siteId}','SYN-${order}','buyer@example.invalid','Synthetic buyer','{}','[]',1,1,'shipped','pending','cod');`);
  const response=await gateway.request('/v1/orders/'+order,{method:'PATCH',headers:await signedIdentityHeaders(actor,email,a.siteId),body:JSON.stringify({status:target,idempotency_key:'status-truth-'+order,version:1})});
  assert.equal(response.status,200,response.text);
  assert.equal(owned.psql(`SELECT status FROM orders WHERE id='${order}';`),target);
  assert.equal(owned.psql(`SELECT payment_status FROM orders WHERE id='${order}';`),'pending','a delivery/cancellation is not a PSP/COD collection or refund receipt');
  assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${order}' AND event_type='order.paid';`),'0','fulfilment must not publish a fabricated payment event');
 });
 await t.test('generic status edit cannot impersonate a completed refund',async()=>{
  const order=randomUUID();
  owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total,status,payment_status,payment_method) VALUES('${order}','${a.siteId}','${a.siteId}','SYN-${order}','buyer@example.invalid','{}','[]',1,1,'delivered','paid','razorpay');`);
  const before=owned.psql(`SELECT md5(to_jsonb(o)::text) FROM orders o WHERE id='${order}';`);
  const denied=await gateway.request('/v1/orders/'+order,{method:'PATCH',headers:await signedIdentityHeaders(actor,email,a.siteId),body:JSON.stringify({status:'refunded',idempotency_key:'forged-refund-'+order})});assert.equal(denied.status,400,denied.text);
  assert.equal(owned.psql(`SELECT md5(to_jsonb(o)::text) FROM orders o WHERE id='${order}';`),before);
 });
});
