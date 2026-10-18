// Eight LB-BIL-001/002 acceptance scenarios moved from the fake database lane.
// Real Gateway/PostgREST/PostgreSQL; only Razorpay HTTP is an explicit provider
// fixture. No real capture, provider eligibility or inbox delivery is certified.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test,{before,after,afterEach,mock} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET,tapRest} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let sequence=0;
const key='synthetic-owned-subscription-provider-secret';
type ProviderOrder={id:string;amount:number;currency:string;notes:Record<string,string>;receipt:string};
const orders=new Map<string,ProviderOrder>(),payments=new Map<string,{id:string;order_id:string;amount:number;currency:string;status:string}>();
let diagnostic:ReturnType<typeof tapRest>;
let restore:()=>void;let loseNextCreate=false;let createCount=0;
before(()=>{diagnostic=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
 const r=await forward();if(call.resource.startsWith('rpc/')&&!r.ok){const raw=await r.clone().json();const e=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};console.info('OWNED_CHECKOUT_RPC '+JSON.stringify({rpc:call.resource,status:r.status,code:e.code,message:e.message}));}return r;
});const original=globalThis.fetch;globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
 if(url.origin!=='https://api.razorpay.com')return original(input,init);
 const method=init?.method||'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(url.pathname==='/v1/orders'&&method==='POST'){
  createCount++;const row={id:'order_syn_'+crypto.randomUUID(),amount:body.amount,currency:body.currency,notes:body.notes||{},receipt:body.receipt};orders.set(row.id,row);if(loseNextCreate){loseNextCreate=false;throw new Error('Synthetic provider reply loss after object creation');}return json(row);
 }
 if(url.pathname==='/v1/orders'&&method==='GET')return json({items:[...orders.values()].filter(r=>r.receipt===url.searchParams.get('receipt'))});
 if(url.pathname.startsWith('/v1/orders/'))return orders.has(url.pathname.split('/').pop()!)?json(orders.get(url.pathname.split('/').pop()!)):json({error:{description:'Synthetic order not found'}},404);
 if(url.pathname.startsWith('/v1/payments/'))return payments.has(url.pathname.split('/').pop()!)?json(payments.get(url.pathname.split('/').pop()!)):json({error:{description:'Synthetic payment not found'}},404);
 throw new Error('Unexpected synthetic provider path '+url.pathname);
}) as typeof fetch;restore=()=>{globalThis.fetch=original;};});
after(()=>{restore();diagnostic.restore();});afterEach(()=>mock.timers.reset());
async function fixture(){
 const owner=crypto.randomUUID(),email=`syn-sub-verify-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);
 const stores=[newSyntheticTenant('sub-v-a-'+(++sequence)),newSyntheticTenant('sub-v-b-'+sequence)];
 for(const store of stores){seedSyntheticTenant(owned.psql,store);owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store.siteId}';`);}
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{RAZORPAY_KEY_ID:'synthetic-owned-provider-key',RAZORPAY_KEY_SECRET:key}));
 async function createCheckout(store=stores[0].siteId,key=crypto.randomUUID(),change:Record<string,unknown>={}){
  return gateway.request('/v1/payments/subscription/order',{method:'POST',headers:{...await signedIdentityHeaders(owner,email),'X-Idempotency-Key':key},
   body:JSON.stringify({store_id:store,plan_slug:'growth',site_type:'store',billing_period:'monthly',...change})});
 }
 async function capture(store=stores[0].siteId){
  const checkout=await createCheckout(store);
  assert.equal(checkout.status,200,checkout.text);const order=orders.get(checkout.json?.data.razorpay_order_id);assert.ok(order,'real checkout must create a provider-fixture order');
  const payment={id:'pay_syn_'+crypto.randomUUID(),order_id:order.id,amount:order.amount,currency:order.currency,status:'captured'};payments.set(payment.id,payment);return payment;
 }
 async function verify(payment:Awaited<ReturnType<typeof capture>>,store=stores[0].siteId){
  return gateway.request('/v1/payments/subscription/verify',{method:'POST',headers:{...await signedIdentityHeaders(owner,email),'X-Idempotency-Key':'sub-verify:'+payment.id+':'+store},body:JSON.stringify({
   store_id:store,plan_slug:'growth',site_type:'store',billing_period:'monthly',razorpay_order_id:payment.order_id,
   razorpay_payment_id:payment.id,razorpay_signature:createHmac('sha256',key).update(payment.order_id+'|'+payment.id).digest('hex'),
  })});
 }
 const webhook=(payment:Awaited<ReturnType<typeof capture>>,store=stores[0].siteId)=>gateway.request('/v1/internal/billing/subscriptions/activate',{
  method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({
   storeId:store,userId:owner,planSlug:'growth',billingPeriod:'monthly',provider:'razorpay',providerOrderId:payment.order_id,
   providerPaymentId:payment.id,amountPaid:payment.amount,externalSubscriptionId:payment.order_id,
  })});
 return {owner,email,stores,gateway,capture,verify,webhook,createCheckout};
}
function once(payment:string,responses:{status:number;text:string;json:Record<string,unknown>|null}[]){
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`),'1');
 const id=owned.psql(`SELECT id FROM subscriptions WHERE razorpay_payment_id='${payment}';`);
 for(const r of responses){assert.ok(r.status>=200&&r.status<300,r.text);assert.equal((r.json?.data as {subscription?:{id:string}})?.subscription?.id,id);}
}

test('LB-BIL-001: verify, then the webhook — one payment activates one subscription and is invoiced once',async()=>{
 const j=await fixture(),p=await j.capture();once(p.id,[await j.verify(p),await j.webhook(p)]);
});
test('LB-BIL-001: the webhook, then verify — the same, and the webhook subscription is not cancelled',async()=>{
 const j=await fixture(),p=await j.capture();once(p.id,[await j.webhook(p),await j.verify(p)]);assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE razorpay_payment_id='${p.id}';`),'active');
});
test('LB-BIL-001: verify and the webhook at the same moment — the database admits one activation',async()=>{
 const j=await fixture(),p=await j.capture();once(p.id,await Promise.all([j.verify(p),j.webhook(p)]));
});
test('a verify request replayed thirty application-clock days later starts no new period',async()=>{
 const j=await fixture(),p=await j.capture(),first=await j.verify(p);assert.equal(first.status,201,first.text);
 const end=owned.psql(`SELECT current_period_end FROM subscriptions WHERE razorpay_payment_id='${p.id}';`);
 mock.timers.enable({apis:['Date'],now:Date.now()+30*86400000});const replay=await j.verify(p);once(p.id,[first,replay]);
 assert.equal(owned.psql(`SELECT current_period_end FROM subscriptions WHERE razorpay_payment_id='${p.id}';`),end);
});
test('a legacy payment with no idempotency key or optional provider fields is read back without another activation',async()=>{
 const j=await fixture(),p=await j.capture(),id=crypto.randomUUID(),store=j.stores[0].siteId,end='2026-12-01T00:00:00.000Z';
 owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,site_id,plan,status,billing_period,razorpay_payment_id,amount_paid,current_period_end)
  VALUES('${id}','${j.owner}','${store}','${store}','growth','active','monthly','${p.id}',${p.amount},'${end}');
  UPDATE sites SET trial_status='paid' WHERE id='${store}';
  INSERT INTO billing_history(user_id,store_id,site_id,subscription_id,invoice_number,description,amount,total_amount,payment_gateway,payment_id,payment_status,billing_period)
  VALUES('${j.owner}','${store}','${store}','${id}','SYN-LEGACY-${id}','Synthetic retained legacy subscription',${p.amount},${p.amount},'razorpay','${p.id}','paid','monthly');
  SELECT allocate_founding_merchant('${store}','${id}','founding:${id}');`);
 const replay=await j.verify(p);once(p.id,[replay]);assert.equal(new Date((replay.json?.data.subscription.current_period_end as string)).toISOString(),end);
 assert.equal(owned.psql(`SELECT idempotency_key IS NULL FROM subscriptions WHERE id='${id}';`),'t');
});
test('a new payment for the same store still replaces the active subscription',async()=>{
 const j=await fixture(),first=await j.capture();assert.equal((await j.verify(first)).status,201);
 const next=await j.capture();once(next.id,[await j.verify(next)]);assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE razorpay_payment_id='${first.id}';`),'cancelled');
});
test('founding eligibility remains visible from verify when webhook activation landed first; delivery is not claimed',async()=>{
 const j=await fixture(),p=await j.capture();assert.equal((await j.webhook(p)).status,200);const verify=await j.verify(p);once(p.id,[verify]);assert.equal(verify.json?.data.subscription.founding.allocated,true);
});
test('LB-BIL-002: one payment cannot also activate a second store the same merchant owns',async()=>{
 const j=await fixture(),p=await j.capture();assert.equal((await j.verify(p)).status,201);
 const second=await j.verify(p,j.stores[1].siteId);assert.equal(second.status,409,second.text);
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${p.id}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${p.id}';`),'1');
});


test('source binding: payment created for store A cannot first activate store B, even when both have the same owner',async()=>{
 const j=await fixture(),p=await j.capture(j.stores[0].siteId);
 const wrongFirst=await j.verify(p,j.stores[1].siteId);assert.equal(wrongFirst.status,409,wrongFirst.text);
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${p.id}';`),'0');
 once(p.id,[await j.verify(p,j.stores[0].siteId)]);
});


test('a wrong-store trusted callback cannot be the first activator either',async()=>{
 const j=await fixture(),p=await j.capture();const r=await j.webhook(p,j.stores[1].siteId);assert.equal(r.status,409,r.text);
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${p.id}';`),'0');once(p.id,[await j.webhook(p)]);
});
test('exact capture proof rejects wrong currency, amount, returned ID and absent order reference without entitlements',async()=>{
 const j=await fixture(),p=await j.capture(),original={...p};
 for(const change of [{currency:'USD'},{amount:p.amount+1},{id:'pay_syn_wrong'},{order_id:''},{status:'authorized'}]){
  Object.assign(p,original,change);const r=await j.verify({...original});assert.equal(r.status,400,r.text);
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${original.id}';`),'0');
 }
 Object.assign(p,original);once(p.id,[await j.verify(p)]);
});
test('same logical checkout returns the same provider object and refuses changed request terms',async()=>{
 const j=await fixture(),key=crypto.randomUUID(),before=createCount;
 const first=await j.createCheckout(j.stores[0].siteId,key);assert.equal(first.status,200,first.text);
 const retry=await j.createCheckout(j.stores[0].siteId,key);assert.equal(retry.status,200,retry.text);assert.deepEqual(retry.json,first.json);
 const conflict=await j.createCheckout(j.stores[0].siteId,key,{billing_period:'yearly'});assert.equal(conflict.status,409,conflict.text);
 assert.equal(createCount-before,1);
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${j.stores[0].siteId}' AND subscription_checkout_key='${key}';`),'1');
});
test('lost provider create response is recovered by exact receipt without a second POST',async()=>{
 const j=await fixture(),key=crypto.randomUUID(),before=createCount;loseNextCreate=true;
 const lost=await j.createCheckout(j.stores[0].siteId,key);assert.equal(lost.status,503,lost.text);
 const recovered=await j.createCheckout(j.stores[0].siteId,key);assert.equal(recovered.status,200,recovered.text);assert.equal(createCount-before,1);
 const order=orders.get(recovered.json?.data.razorpay_order_id);assert.ok(order);
 assert.equal(owned.psql(`SELECT subscription_checkout_reference FROM billing_history WHERE subscription_checkout_key='${key}';`),order.id);
});
test('concurrent identical checkouts create at most one provider object',async()=>{
 const j=await fixture(),key=crypto.randomUUID(),before=createCount;
 const r=await Promise.all([j.createCheckout(j.stores[0].siteId,key),j.createCheckout(j.stores[0].siteId,key)]);
 assert.ok(r.some(x=>x.status===200),r.map(x=>x.text).join(' '));assert.ok(r.every(x=>[200,409,503].includes(x.status)),r.map(x=>x.text).join(' '));
 const retry=await j.createCheckout(j.stores[0].siteId,key);assert.equal(retry.status,200,retry.text);assert.equal(createCount-before,1);
});
test('activation consumes the saved entitlement terms and finalizes that same pending billing row',async()=>{
 const j=await fixture(),p=await j.capture(),store=j.stores[0].siteId;
 const charge=owned.psql(`SELECT id FROM billing_history WHERE subscription_checkout_reference='${p.order_id}';`);
 const planId=owned.psql(`SELECT id FROM plans WHERE slug='growth' AND site_type='store';`);
 const before=owned.psql(`SELECT row_to_json(p)::text FROM plans p WHERE id='${planId}';`);
 try{
  owned.psql(`UPDATE plans SET products_limit=17 WHERE id='${planId}';`);
  const r=await j.verify(p);assert.equal(r.status,201,r.text);
  assert.equal(owned.psql(`SELECT s.products_limit IS NOT DISTINCT FROM (b.subscription_checkout->'plan'->>'products_limit')::int FROM subscriptions s JOIN billing_history b ON b.subscription_id=s.id WHERE b.id='${charge}';`),'t');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${store}';`),'1');
  assert.equal(owned.psql(`SELECT payment_status FROM billing_history WHERE id='${charge}';`),'paid');
 }finally{const row=JSON.parse(before);owned.psql(`UPDATE plans SET products_limit=${row.products_limit===null?'NULL':Number(row.products_limit)} WHERE id='${planId}';`);}
});

test('unbound provider lookup with wrong source metadata stays pending and does not create again',async()=>{
 const j=await fixture(),key=crypto.randomUUID(),before=createCount;loseNextCreate=true;
 assert.equal((await j.createCheckout(j.stores[0].siteId,key)).status,503);
 const id=owned.psql(`SELECT id FROM billing_history WHERE subscription_checkout_key='${key}';`);
 const order=[...orders.values()].find(r=>r.receipt==='sub-'+id);assert.ok(order);const notes={...order.notes};order.notes.store_id=j.stores[1].siteId;
 const denied=await j.createCheckout(j.stores[0].siteId,key);assert.equal(denied.status,503,denied.text);
 assert.equal(owned.psql(`SELECT subscription_checkout_reference IS NULL FROM billing_history WHERE id='${id}';`),'t');
 order.notes=notes;assert.equal((await j.createCheckout(j.stores[0].siteId,key)).status,200);assert.equal(createCount-before,1);
});
test('retained checkout evidence prevents downgrade and private source controls reject ordinary database roles',async()=>{
 const j=await fixture(),p=await j.capture();
 for(const role of ['anon','authenticated','app_tenant'])for(const sql of [
  `claim_merchant_subscription_checkout_v1('${j.owner}','${j.stores[0].siteId}','role-denied','{}')`,
  `bind_merchant_subscription_checkout_v1('${j.owner}','${j.stores[0].siteId}','${crypto.randomUUID()}','order_denied')`,
  `read_merchant_subscription_checkout_v1('${j.owner}','${j.stores[0].siteId}','${p.order_id}','${p.id}','growth','monthly')`])
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.${sql};`),/permission denied for function/);
 const before=owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);");
 const rollback=await import('node:fs');
 assert.match(owned.psqlExpectError(rollback.readFileSync(new URL('../../../../../database/supabase/rollback/328_subscription_checkout_source.rollback.sql',import.meta.url),'utf8')),/refuses retained checkout evidence/);
 assert.equal(owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);"),before);
});


test('ordinary database roles cannot forge a financial source, alter its saved quote, or insert a paid subscription receipt',async()=>{
 const j=await fixture(),p=await j.capture(),store=j.stores[0].siteId;
 const charge=owned.psql(`SELECT id FROM billing_history WHERE subscription_checkout_reference='${p.order_id}';`);
 for(const role of ['anon','authenticated','app_tenant']){
  assert.match(owned.psql(`BEGIN;SET LOCAL ROLE ${role};SELECT count(*) FROM billing_history WHERE id='${charge}';ROLLBACK;`),/\n0\n/);
  try{assert.match(owned.psql(`BEGIN;SET LOCAL ROLE ${role};UPDATE billing_history SET subscription_checkout_reference='order_FORGED' WHERE id='${charge}' RETURNING id;ROLLBACK;`),/UPDATE 0/);}catch(error){assert.match(String(error),/permission denied|canonical backend|row-level security/);}
  for(const sql of [
   `INSERT INTO subscriptions(user_id,store_id,site_id,plan,status,billing_period,amount_paid) VALUES('${j.owner}','${store}','${store}','growth','active','monthly',69900)`,
   `INSERT INTO billing_history(user_id,store_id,site_id,invoice_number,description,amount,total_amount) VALUES('${j.owner}','${store}','${store}','FORGED-${role}','Forged source',1,1)`]){
   const result=owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};${sql};ROLLBACK;`);
   assert.match(result,/permission denied|canonical backend|row-level security/);
   assert.match(owned.psqlExpectError(`BEGIN;GRANT INSERT ON billing_history,subscriptions TO ${role};SET LOCAL ROLE ${role};${sql};ROLLBACK;`),/canonical backend/);
  }
 }
 once(p.id,[await j.verify(p)]);
});


test('store-scoped plan display uses the same founding price as checkout and denies a rival owner',async()=>{
 const j=await fixture(),store=j.stores[0].siteId;
 const displayed=await j.gateway.request('/v1/payments/plans?site_type=store&slug=growth&store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});
 assert.equal(displayed.status,200,displayed.text);
 const checkout=await j.createCheckout(store);assert.equal(checkout.status,200,checkout.text);
 assert.equal(displayed.json?.data[0].price_monthly_inr,checkout.json?.data.amount);
 const stranger=crypto.randomUUID(),email='syn-price-other-'+stranger+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${stranger}','${email}',true);`);
 const denied=await j.gateway.request('/v1/payments/plans?site_type=store&slug=growth&store_id='+store,{headers:await signedIdentityHeaders(stranger,email)});
 assert.equal(denied.status,403,denied.text);
});
test('founding price lookup outage cannot silently charge catalog price; same intent recovers before any provider create',async()=>{
 const j=await fixture(),key=crypto.randomUUID(),before=createCount;
 const fault=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>call.resource==='rpc/get_founding_program_public'
  ?new Response(JSON.stringify({code:'SYNTHETIC_PRICING_FAILURE',message:'synthetic pricing failure'}),{status:503,headers:{'Content-Type':'application/json'}}):forward());
 try{const failed=await j.createCheckout(j.stores[0].siteId,key);assert.equal(failed.status,503,failed.text);
  assert.equal(createCount,before);assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`),'0');
 }finally{fault.restore();}
 const recovered=await j.createCheckout(j.stores[0].siteId,key);assert.equal(recovered.status,200,recovered.text);assert.equal(createCount-before,1);
});


test('canonical catalog supplies server monthly/yearly charge totals and current billing retains a cancelled paid receipt',async()=>{
 const j=await fixture(),store=j.stores[0].siteId,headers=await signedIdentityHeaders(j.owner,j.email);
 const listed=await j.gateway.request('/v1/payments/plans?site_type=store&slug=growth&store_id='+store,{headers});assert.equal(listed.status,200,listed.text);
 const plan=listed.json?.data[0];assert.equal(plan.currency,'INR');assert.ok(Number.isSafeInteger(plan.billing_amount_monthly_minor));assert.ok(Number.isSafeInteger(plan.billing_amount_yearly_minor));
 const yearly=await j.createCheckout(store,crypto.randomUUID(),{billing_period:'yearly'});assert.equal(yearly.status,200,yearly.text);assert.equal(yearly.json?.data.amount,plan.billing_amount_yearly_minor);
 const p=await j.capture();assert.equal(p.amount,plan.billing_amount_monthly_minor);assert.equal((await j.verify(p)).status,201);
 const cancelled=await j.gateway.request('/v1/payments/subscription/cancel',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,j.email),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:store})});assert.equal(cancelled.status,200,cancelled.text);
 const current=await j.gateway.request('/v1/payments/subscription?store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});assert.equal(current.status,200,current.text);
 assert.equal(current.json?.data.subscription.plan,'growth');assert.equal(current.json?.data.subscription.status,'cancelled');assert.equal(current.json?.data.subscription.amount_paid,p.amount);
 assert.equal(current.json?.data.subscription.currency,'INR');assert.ok('products_limit' in current.json?.data.subscription);
 assert.equal(current.json?.data.product_usage.count,0);assert.equal(current.json?.data.product_usage.limit_known,false,'cancelled receipt must not advertise an active product entitlement');
});


test('paid invoice history uses canonical billing receipts, excludes unactivated quotes and survives entitlement cancellation',async()=>{
 const j=await fixture(),store=j.stores[0].siteId,p=await j.capture();assert.equal((await j.verify(p)).status,201);
 const pending=await j.createCheckout(store);assert.equal(pending.status,200,pending.text);
 const cancelled=await j.gateway.request('/v1/payments/subscription/cancel',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,j.email),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:store})});assert.equal(cancelled.status,200,cancelled.text);
 const history=await j.gateway.request('/v1/payments/subscription/history?store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});assert.equal(history.status,200,history.text);
 assert.equal(history.json?.data.length,1,'an unactivated checkout quote is not a paid invoice');
 const invoice=history.json?.data[0];
 assert.equal(invoice.id,owned.psql(`SELECT id FROM billing_history WHERE payment_id='${p.id}';`),'history must return the invoice ID, not its subscription ID');
 assert.equal(invoice.status,'paid','cancelling an entitlement must not rewrite invoice payment status');
 assert.equal(invoice.amount_paid,p.amount);assert.equal(invoice.currency,'INR');assert.ok(invoice.invoice_number);assert.equal(invoice.billing_period,'monthly');
 assert.equal(String(invoice.tax_amount),owned.psql(`SELECT tax_amount FROM billing_history WHERE payment_id='${p.id}';`));
 assert.equal(String(invoice.total_amount),owned.psql(`SELECT total_amount FROM billing_history WHERE payment_id='${p.id}';`));
 assert.equal('subscription_checkout_quote' in invoice,false,'private financial source quote must not be returned');
 const empty=await j.gateway.request('/v1/payments/subscription/history?store_id='+j.stores[1].siteId,{headers:await signedIdentityHeaders(j.owner,j.email)});assert.equal(empty.status,200,empty.text);assert.deepEqual(empty.json?.data,[]);
 const rival=crypto.randomUUID(),email=`syn-invoice-rival-${rival}@example.invalid`;owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${rival}','${email}',true);`);
 const denied=await j.gateway.request('/v1/payments/subscription/history?store_id='+store,{headers:await signedIdentityHeaders(rival,email)});assert.equal(denied.status,403,denied.text);assert.doesNotMatch(denied.text,new RegExp(invoice.invoice_number));
});


test('billing product usage reads the saved paid limit and a failed product read never becomes zero usage',async()=>{
 const j=await fixture(),store=j.stores[0].siteId,p=await j.capture();assert.equal((await j.verify(p)).status,201);
 const read=async()=>j.gateway.request('/v1/payments/subscription?store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});
 const current=await read();assert.equal(current.status,200,current.text);assert.equal(current.json?.data.product_usage.count,0);assert.equal(current.json?.data.product_usage.limit_known,true);
 assert.equal(String(current.json?.data.product_usage.limit),owned.psql(`SELECT coalesce(products_limit::text,'null') FROM subscriptions WHERE razorpay_payment_id='${p.id}';`));
 const fault=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>call.resource==='products'?new Response(JSON.stringify({message:'synthetic-product-count-fault'}),{status:503,headers:{'Content-Type':'application/json'}}):forward());
 try{const denied=await read();assert.equal(denied.status,500,denied.text);assert.doesNotMatch(denied.text,/synthetic-product-count-fault/);assert.equal(denied.json?.data,undefined);}finally{fault.restore();}
 const recovered=await read();assert.equal(recovered.status,200,recovered.text);assert.deepEqual(recovered.json?.data.product_usage,current.json?.data.product_usage);
});
