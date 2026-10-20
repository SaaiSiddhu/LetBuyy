// Actual internal Gateway/webhook activation path -> owned PostgREST/database.
// Synthetic trusted captured-payment notifications; no provider capture or real spend proof.
import assert from 'node:assert/strict';
import {planSubscriptionTaxSnapshot} from '@letbuyy/billing-core';
import test,{before,after} from 'node:test';
import {readFileSync} from 'node:fs';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,signedIdentityHeaders} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-only',profile_version:1,
 approval_status:'approved',approval_reference:'synthetic-approval-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,
 supplier:{name:'Synthetic Platform Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',
 address:{line1:'Synthetic Supplier Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};
const owned=requireOwnedDatabase();let sequence=0;
let diagnostic:ReturnType<typeof tapRest>;
before(()=>{diagnostic=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
 const response=await forward();
 if(call.resource==='rpc/activate_merchant_subscription_v1'&&!response.ok){
  const raw:unknown=await response.clone().json().catch(()=>({}));
  const error=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  console.info('OWNED_SUBSCRIPTION_RPC_DIAGNOSTIC '+JSON.stringify({status:response.status,code:error.code,message:error.message}));
 }
 return response;
});});
after(()=>diagnostic?.restore());

async function fixture(){
 const owner=crypto.randomUUID(),email=`syn-sub-owner-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);
 const stores=[newSyntheticTenant('sub-a-'+(++sequence)),newSyntheticTenant('sub-b-'+sequence)];
 for(const store of stores){seedSyntheticTenant(owned.psql,store);owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store.siteId}';`);}
 assert.equal(owned.psql("SELECT count(*) FROM plans WHERE slug='growth' AND site_type='store' AND is_active=true;"),'1','fixture uses the retained canonical growth catalog; no prices are changed');
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const sources=new Set<string>();
 const activate=(storeId:string,paymentId:string,extra:Record<string,unknown>={})=>{
  if(!sources.has(paymentId)){
   const plan=JSON.parse(owned.psql("SELECT to_jsonb(p) FROM plans p WHERE slug='growth' AND site_type='store';"));
   const key='core:'+paymentId,request={plan_slug:'growth',billing_period:'monthly'};
   const tax=planSubscriptionTaxSnapshot({profile,recipient:{name:'Synthetic Recipient',gstin:null,state_code:'29',country:'IN',address:{line1:'Synthetic Buyer Address',city:'Bengaluru',state:'Karnataka',zip:'560001',country:'IN'}},
    source:{actor_id:owner,site_id:storeId,request_key:key,plan_id:plan.id,plan_slug:'growth',billing_period:'monthly',price_version:'synthetic-'+plan.id,gross_before_discount_minor:99900,discount_minor:0,coupon_code:null},grossMinor:99900});
   const quote={plan,mode:'razorpay_order',amount_minor:99900,currency:'INR',subscription_tax_snapshot:tax,response:{amount:99900,currency:'INR'},provider_input:{amount:99900}};
   const literal=(v:unknown)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
   const result=JSON.parse(owned.psql(`SELECT claim_merchant_subscription_checkout_v1('${owner}','${storeId}','${key}',${literal(request)},${literal(quote)});`));
   assert.equal(result.accepted,true,JSON.stringify(result));
   owned.psql(`SELECT bind_merchant_subscription_checkout_v1('${owner}','${storeId}','${result.charge.id}','order_${paymentId}');`);
   sources.add(paymentId);
  }
  return gateway.request('/v1/internal/billing/subscriptions/activate',{method:'POST',
  headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},
  body:JSON.stringify({storeId,userId:owner,planSlug:'growth',billingPeriod:'monthly',provider:'razorpay',amountPaid:99900,
   providerOrderId:'order_'+paymentId,providerPaymentId:paymentId,...extra})});};
 return {owner,stores,gateway,activate};
}

test('private activation supports clean rollback/reapply without deleting records and ordinary roles cannot execute it',()=>{
 const rows=()=>owned.psql('SELECT (SELECT count(*) FROM subscriptions),(SELECT count(*) FROM billing_history),(SELECT count(*) FROM audit_logs);');
 const retained=rows();
 const current=owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);");
 assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/327_atomic_subscription_payment_ownership.rollback.sql','utf8')),/360 refuses/);
 assert.equal(owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);"),current);
 owned.script(readFileSync('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql','utf8'));
 owned.script(readFileSync('database/supabase/rollback/347_free_subscription_checkout_receipts.rollback.sql','utf8'));
 for(const rel of ['rollback/328_subscription_checkout_source.rollback.sql','rollback/327_atomic_subscription_payment_ownership.rollback.sql','migrations/327_atomic_subscription_payment_ownership.sql','migrations/328_subscription_checkout_source.sql'])
  owned.script(readFileSync(new URL('../../../../../database/supabase/'+rel,import.meta.url),'utf8'));
 owned.script(readFileSync('database/supabase/migrations/347_free_subscription_checkout_receipts.sql','utf8'));
 owned.script(readFileSync('database/supabase/migrations/360_subscription_tax_quote_snapshot.sql','utf8'));
 assert.equal(rows(),retained);
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.activate_merchant_subscription_v1('{}'::jsonb);`),/permission denied for function/);
});

test('one captured subscription payment cannot activate a second store of the same verified owner',async()=>{
 const j=await fixture(),payment='pay_syn_'+crypto.randomUUID();
 const first=await j.activate(j.stores[0].siteId,payment);assert.equal(first.status,200,first.text);
 const second=await j.activate(j.stores[1].siteId,payment);
 console.info('OWNED_SUBSCRIPTION_REUSE '+JSON.stringify({statuses:[first.status,second.status],subscriptions:Number(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`)),invoices:Number(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`))}));
 assert.equal(second.status,409,'cross-store reuse must be a canonical payment conflict: '+second.text);
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`),'1');
});

test('two owned stores racing the same payment yield one activation and one invoice',async()=>{
 const j=await fixture(),payment='pay_syn_'+crypto.randomUUID();
 const replies=await Promise.all(j.stores.map(store=>j.activate(store.siteId,payment)));
 console.info('OWNED_SUBSCRIPTION_RACE '+JSON.stringify({statuses:replies.map(r=>r.status),subscriptions:Number(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`)),invoices:Number(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`))}));
 assert.deepEqual(replies.map(r=>r.status).sort(),[200,409],replies.map(r=>r.text).join(' '));
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`),'1');
});

test('same store payment retry recovers its committed subscription and records no second invoice',async()=>{
 const j=await fixture(),payment='pay_syn_'+crypto.randomUUID(),store=j.stores[0].siteId;
 const first=await j.activate(store,payment);assert.equal(first.status,200,first.text);
 const retry=await j.activate(store,payment);assert.equal(retry.status,200,retry.text);
 assert.equal(retry.json?.data.subscription.id,first.json?.data.subscription.id);
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`),'1');
});


test('unknown/other current owner cannot activate or learn a conflicting payment receipt',async()=>{
 const j=await fixture(),stranger=crypto.randomUUID();owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${stranger}','syn-sub-other-${stranger}@example.invalid',true);`);
 const payment='pay_syn_'+crypto.randomUUID(),r=await j.activate(j.stores[0].siteId,payment,{userId:stranger});
 assert.equal(r.status,403,r.text);assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`),'0');
});

test('same payment conflicting amount, plan, period or provider order cannot alter the committed entitlement',async()=>{
 const j=await fixture(),payment='pay_syn_'+crypto.randomUUID(),store=j.stores[0].siteId;assert.equal((await j.activate(store,payment)).status,200);
 for(const change of [{amountPaid:99800},{planSlug:'launch'},{billingPeriod:'yearly'},{providerOrderId:'order_syn_different'}])
  assert.equal((await j.activate(store,payment,change)).status,409,JSON.stringify(change));
 assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${payment}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${payment}';`),'1');
});

for(const failure of ['invoice','audit'])test('mandatory '+failure+' failure rolls back activation, retirement and store state, and same payment retries',async()=>{
 const j=await fixture(),store=j.stores[0].siteId,first='pay_syn_'+crypto.randomUUID(),next='pay_syn_'+crypto.randomUUID();
 assert.equal((await j.activate(store,first)).status,200);
 const before=owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${store}';`);
 const table=failure==='invoice'?'billing_history':'audit_logs';
 const condition=failure==='invoice'?`NEW.payment_id='${next}'`:`NEW.action='merchant_subscription.activated' AND NEW.metadata->>'site_id'='${store}'`;
 owned.psql(`CREATE FUNCTION syn_subscription_write_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic-private-subscription-fault';END IF;RETURN NEW;END $$;
 CREATE TRIGGER syn_subscription_write_fault BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION syn_subscription_write_fault();`);
 try {
  const r=await j.activate(store,next);assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-subscription-fault/);
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${next}';`),'0');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${next}';`),'0');
  assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE razorpay_payment_id='${first}';`),'active');
  assert.equal(owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${store}';`),before);
 } finally {owned.psql(`DROP TRIGGER syn_subscription_write_fault ON ${table};DROP FUNCTION syn_subscription_write_fault();`);}
 const retry=await j.activate(store,next);assert.equal(retry.status,200,retry.text);
 assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE razorpay_payment_id='${first}';`),'cancelled');
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE payment_id='${next}';`),'1');
});

test('new private transaction clean rollback/reapply is exact and retained captures prevent guard reopening',async()=>{
 const j=await fixture(),payment='pay_syn_'+crypto.randomUUID();assert.equal((await j.activate(j.stores[0].siteId,payment)).status,200);
 const before=owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);");
 assert.match(owned.psqlExpectError(readFileSync(new URL('../../../../../database/supabase/rollback/327_atomic_subscription_payment_ownership.rollback.sql',import.meta.url),'utf8')),/360 refuses|refuses retained captured subscription payments/);
 assert.equal(owned.psql("SELECT pg_get_functiondef('public.activate_merchant_subscription_v1(jsonb)'::regprocedure);"),before);
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.activate_merchant_subscription_v1('{}'::jsonb);`),/permission denied for function/);
});


test('subscription cancellation receipt cannot replay after the current owner changes',async()=>{
 const j=await fixture(),site=j.stores[0].siteId,payment='pay_syn_'+crypto.randomUUID();
 try {
  assert.equal((await j.activate(site,payment)).status,200);
  const requestKey='cancel-owner:'+crypto.randomUUID(),email=`syn-sub-owner-${j.owner}@example.invalid`;
  const cancel=async()=>j.gateway.request('/v1/payments/subscription/cancel',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,email,site),'X-Idempotency-Key':requestKey},body:JSON.stringify({store_id:site,reason:'synthetic-current-owner-cancel'})});
  const first=await cancel();assert.equal(first.status,200,first.text);
  const successor=crypto.randomUUID();owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${successor}','syn-successor-${successor}@example.invalid',true);UPDATE sites SET custom_user_id='${successor}' WHERE id='${site}';`);
  const replay=await cancel();assert.equal(replay.status,403,replay.text);
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${site}' AND razorpay_payment_id='${payment}' AND status='cancelled';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${site}';`),'1');
 } finally {await j.gateway.settle();}
});
