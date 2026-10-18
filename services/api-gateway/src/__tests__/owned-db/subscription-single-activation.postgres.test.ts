// Eight LB-BIL-001/002 acceptance scenarios moved from the fake database lane.
// Real Gateway/PostgREST/PostgreSQL; only Razorpay HTTP is an explicit provider
// fixture. No real capture, provider eligibility or inbox delivery is certified.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test,{before,after,afterEach,mock} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET,tapRest} from './gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let sequence=0;
const key='synthetic-owned-subscription-provider-secret';
type ProviderOrder={id:string;amount:number;currency:string;notes:Record<string,string>;receipt:string};
const orders=new Map<string,ProviderOrder>(),payments=new Map<string,{id:string;order_id:string;amount:number;currency:string;status:string}>();
let diagnostic:ReturnType<typeof tapRest>;
let restore:()=>void;let loseNextCreate=false;let createCount=0;
const legacyFreeFixtures=new Map<string,{j:Awaited<ReturnType<typeof freeFixture>>;legacy:{accepted:boolean;subscription:{id:string}}}>();
before(async()=>{diagnostic=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
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
}) as typeof fetch;restore=()=>{globalThis.fetch=original;};
 // Build the two historical controls with the genuine predecessor writers,
 // before any new tax/free evidence exists. Retain them through both migrations.
 const taxFile=(dir:string)=>readFileSync(new URL('../../../../../database/supabase/'+dir+'/360_subscription_tax_quote_snapshot'+(dir==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
 owned.script(taxFile('rollback'));owned.script(freeMigration('rollback'));
 for(const status of ['failed','completed']) {
  const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const legacy=JSON.parse(owned.script(`SET ROLE service_role;SELECT activate_merchant_subscription_v1(jsonb_build_object(
  'user_id','${j.owner}','store_id','${store}','plan_id',p.id,'plan_slug','free','plan_name',p.name,
  'billing_period','monthly','amount_paid',0,'payment_gateway',NULL,'external_subscription_id','free:${store}:synthetic-legacy',
  'razorpay_order_id',NULL,'razorpay_payment_id',NULL,'period_start',now(),'period_end',now()+interval '1 month',
  'promo_ends_at',NULL,'products_limit',25,'invoice_number','SYN-LEGACY-FREE-${key}',
  'invoice_description','Synthetic old free activation without canonical checkout source','tax_amount',0,'total_amount',0))
  FROM plans p WHERE p.site_type='store' AND p.slug='free';`));
 assert.equal(legacy.accepted,true);
  legacyFreeFixtures.set(status,{j,legacy});
 }
 owned.script(freeMigration('migrations'));owned.script(taxFile('migrations'));
});
after(()=>{restore();diagnostic.restore();});afterEach(()=>mock.timers.reset());
async function fixture(){
 const owner=crypto.randomUUID(),email=`syn-sub-verify-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);
 const stores=[newSyntheticTenant('sub-v-a-'+(++sequence)),newSyntheticTenant('sub-v-b-'+sequence)];
 for(const store of stores){seedSyntheticTenant(owned.psql,store);owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store.siteId}';`);}
 const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-billing',profile_version:1,approval_status:'approved',approval_reference:'synthetic-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,supplier:{name:'Synthetic Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',address:{line1:'Synthetic Billing Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};
 for(const store of stores)owned.psql(`UPDATE sites SET invoice_address='${JSON.stringify({line1:'Synthetic Billing Address',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'})}'::jsonb WHERE id='${store.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{LETBUYY_SUBSCRIPTION_TAX_PROFILE:JSON.stringify(profile),RAZORPAY_KEY_ID:'synthetic-owned-provider-key',RAZORPAY_KEY_SECRET:key}));
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

// The retained internal free plan is exercised without changing catalog prices,
// public availability, provider configuration or the normal Gateway route.
async function freeFixture(){
 const j=await fixture();
 // 178 preserves an existing free fallback but deliberately seeds only paid V1
 // plans. Supply that synthetic retained row in this disposable database only;
 // never UPDATE/activate an existing plan or change a paid catalog amount.
 owned.psql(`INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,requires_contact,trial_days,status,purchasable)
  VALUES('store','free','Synthetic Internal Free Fallback',0,0,25,true,false,0,'available',true)
  ON CONFLICT(site_type,slug) DO NOTHING;`);
 assert.equal(owned.psql("SELECT count(*) FROM plans WHERE site_type='store' AND slug='free' AND is_active AND price_monthly_inr=0 AND price_yearly_inr=0;"),'1');
 return j;
}
function freeOutcome(store:string){
 return JSON.parse(owned.psql(`SELECT jsonb_build_object(
  'subscriptions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM subscriptions s WHERE s.store_id='${store}'),
  'invoices',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM billing_history b WHERE b.site_id='${store}' AND b.subscription_id IS NOT NULL),
  'activations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a WHERE a.action='merchant_subscription.activated' AND a.metadata->>'site_id'='${store}')
 );`)) as {subscriptions:Record<string,unknown>[]|null;invoices:Record<string,unknown>[]|null;activations:Record<string,unknown>[]|null};
}
function assertOneFreeEffect(store:string){
 const result=freeOutcome(store);
 assert.equal(result.subscriptions?.length,1,'one logical free checkout must create one subscription');
 assert.equal(result.invoices?.length,1,'one logical free checkout must create one invoice');
 assert.equal(result.activations?.length,1,'one logical free checkout must create one activation audit');
 return result;
}

const freeMigration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../../../../database/supabase/'+direction+
 '/347_free_subscription_checkout_receipts'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
function checkoutFunctionState(){
 return owned.psql(`SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  AND p.proname IN('claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1');`);
}
test('FREE-347: clean rollback/reapply preserves rows and restores exact forward bodies and privileges',()=>{
 const rows=()=>owned.psql('SELECT (SELECT count(*) FROM subscriptions),(SELECT count(*) FROM billing_history),(SELECT count(*) FROM audit_logs),(SELECT count(*) FROM idempotency_keys);');
 const taxFile=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../../../../database/supabase/'+direction+'/360_subscription_tax_quote_snapshot'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
 // The later tax migration replaces these writers and must retire empty first.
 const fullBefore=checkoutFunctionState(),retained=rows();
 assert.match(owned.psqlScriptExpectError(freeMigration('rollback')),/360 refuses/);
 assert.equal(checkoutFunctionState(),fullBefore);assert.equal(rows(),retained);
 owned.script(taxFile('rollback'));
 const before=checkoutFunctionState();
 owned.script(freeMigration('rollback'));
 assert.doesNotMatch(checkoutFunctionState(),/347: explicit retained free checkout/);
 assert.equal(rows(),retained);
 owned.script(freeMigration('migrations'));
 assert.equal(checkoutFunctionState(),before);assert.equal(rows(),retained);
 owned.script(taxFile('migrations'));assert.equal(checkoutFunctionState(),fullBefore);assert.equal(rows(),retained);
});

test('FREE-RECEIPT: same-key retry thirty application-clock days later preserves the original period and all effects',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID(),before=createCount;
 const first=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const committed=assertOneFreeEffect(store);
 mock.timers.enable({apis:['Date'],now:Date.now()+30*86400000});
 const retry=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(retry.status,201,retry.text);
 assert.equal(retry.json?.data.subscription.id,first.json?.data.subscription.id,'retry must recover the original activation');
 assert.deepEqual(assertOneFreeEffect(store),committed,'replay must not mutate subscription, invoice, audit or period');
 assert.equal(createCount,before,'free fallback never calls the paid provider');
});

test('FREE-RECEIPT: actual checkout middleware handoff still denies missing or invalid keys before a canonical claim',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,before=freeOutcome(store),providerBefore=createCount;
 let claims=0;
 const observed=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(call.resource==='rpc/claim_merchant_subscription_checkout_v1')claims++;
  return forward();
 });
 try{
  for(const key of [undefined,'tiny','x'.repeat(201)]){
   const denied=await j.gateway.request('/v1/payments/subscription/order',{method:'POST',
    headers:{...await signedIdentityHeaders(j.owner,j.email),...(key?{'X-Idempotency-Key':key}:{})},
    body:JSON.stringify({store_id:store,plan_slug:'free',site_type:'store',billing_period:'monthly'})});
   assert.equal(denied.status,400,denied.text);assert.equal(denied.json?.error.code,'IDEMPOTENCY_KEY_REQUIRED');
  }
  assert.equal(claims,0);assert.equal(createCount,providerBefore);assert.deepEqual(freeOutcome(store),before);
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${store}';`),'0');
 }finally{observed.restore();}
});

test('FREE-RECEIPT: concurrent same-key checkout produces one durable activation',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID(),before=createCount;
 const replies=await Promise.all([j.createCheckout(store,key,{plan_slug:'free'}),j.createCheckout(store,key,{plan_slug:'free'})]);
 assert.ok(replies.some(r=>r.status===201),replies.map(r=>r.text).join(' '));
 assert.ok(replies.every(r=>r.status===201||r.status===409),replies.map(r=>r.text).join(' '));
 const retry=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(retry.status,201,retry.text);
 const committed=assertOneFreeEffect(store);
 for(const r of [...replies,retry].filter(r=>r.status===201))assert.equal(r.json?.data.subscription.id,committed.subscriptions![0].id);
 assert.equal(createCount,before);
});

test('FREE-RECEIPT: fresh Gateway processes recover one free activation after reply loss and restart',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const run=async(lose:boolean)=>{
  const child=startOwnedClientRuntime(owned,'subscription-restart',{env:{
   LETBUYY_FREE_RESTART_ACTOR:j.owner,LETBUYY_FREE_RESTART_EMAIL:j.email,
   LETBUYY_FREE_RESTART_STORE:store,LETBUYY_FREE_RESTART_KEY:key,LETBUYY_FREE_RESTART_LOSE:lose?'1':'0',
  }});
  let stdout='';child.stdout.on('data',chunk=>{stdout+=String(chunk);});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const code=await Promise.race([new Promise<number|null>((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);}),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('owned subscription restart probe timed out')),45000);})]);
   assert.equal(code,0,'fixed owned restart probe exits successfully');
   const result=stdout.split('\n').find(line=>line.startsWith('N2_FREE_RESULT='));assert.ok(result,'owned restart result is present');
   return JSON.parse(result.slice('N2_FREE_RESULT='.length)) as {probePid:number;status:number;json:{data:{subscription:{id:string}}}};
  }finally{if(timer)clearTimeout(timer);await stopOwnedClientRuntime(child);}
 };
 const first=await run(true);assert.equal(first.status,503,JSON.stringify(first));
 const committed=assertOneFreeEffect(store);
 // The creating process is gone and its HTTP response was not retained by a
 // caller. The second process has only the same logical key and owned database.
 const restarted=await run(false);assert.equal(restarted.status,201,JSON.stringify(restarted));
 assert.ok(Number.isInteger(first.probePid)&&first.probePid>0);assert.notEqual(first.probePid,restarted.probePid);
 assert.equal(restarted.json.data.subscription.id,committed.subscriptions![0].id);
 assert.deepEqual(assertOneFreeEffect(store),committed);
});

test('FREE-RECEIPT: saved intent refuses changed plan, cadence, coupon, usage approval or site type without altering its outcome',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID(),before=createCount;
 const first=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const committed=assertOneFreeEffect(store);
 for(const change of [{plan_slug:'growth'},{billing_period:'yearly'},{coupon_code:'SYNTHETIC-CHANGE'},
  {approved_usage_charges:[{meter_name:'synthetic-meter',amount_minor:100,quantity:1,idempotency_key:'synthetic-usage-intent'}]},
  {site_type:'synthetic-other-type'}]){
  const denied=await j.createCheckout(store,key,{plan_slug:'free',...change});
  assert.equal(denied.status,409,JSON.stringify(change)+' '+denied.text);
 }
 assert.deepEqual(assertOneFreeEffect(store),committed);assert.equal(createCount,before);
});

test('FREE-RECEIPT: current-owner revocation denies replay before returning saved details',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const first=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const committed=assertOneFreeEffect(store),other=crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${other}','syn-free-new-owner-${other}@example.invalid',true);
  UPDATE sites SET custom_user_id='${other}',user_id=NULL WHERE id='${store}';`);
 const denied=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(denied.status,403,denied.text);
 assert.doesNotMatch(denied.text,new RegExp(String(committed.subscriptions![0].id)));
 const direct=JSON.parse(owned.script(`SET ROLE service_role;SELECT public.claim_merchant_subscription_checkout_v1('${j.owner}','${store}','${key}',
  '{"plan_slug":"free","site_type":"store","billing_period":"monthly","approved_usage_charges":[],"coupon_code":null}');`));
 assert.equal(direct.accepted,false);assert.equal(direct.code,'SUBSCRIPTION_OWNER_REQUIRED');
 assert.deepEqual(assertOneFreeEffect(store),committed);
});

test('FREE-RECEIPT: reply loss after the activation commit recovers the original invoice, audit and period',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID(),before=createCount;
 let lose=true;
 const fault=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  const response=await forward();
  if(lose&&call.resource==='rpc/activate_merchant_subscription_v1'&&response.ok){
   lose=false;return new Response(JSON.stringify({message:'synthetic-free-reply-loss'}),{status:503,headers:{'Content-Type':'application/json'}});
  }
  return response;
 });
 try{
  const lost=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(lost.status,503,lost.text);
  const committed=assertOneFreeEffect(store);
  const recovered=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(recovered.status,201,recovered.text);
  assert.equal(recovered.json?.data.subscription.id,committed.subscriptions![0].id);
  assert.deepEqual(assertOneFreeEffect(store),committed);assert.equal(createCount,before);
 }finally{fault.restore();}
});

for(const failure of ['invoice','audit','completion'])test('FREE-RECEIPT: mandatory '+failure+' failure rolls back all activation effects and same key recovers',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const first=await j.createCheckout(store,crypto.randomUUID(),{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const committed=assertOneFreeEffect(store),siteBefore=owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE s.id='${store}';`);
 const table=failure==='invoice'?'billing_history':failure==='audit'?'audit_logs':'idempotency_keys';
 const condition=failure==='invoice'?`NEW.site_id='${store}' AND NEW.subscription_id IS NOT NULL`:
  failure==='audit'?`NEW.action='merchant_subscription.activated' AND NEW.metadata->>'site_id'='${store}'`:
  `NEW.site_id='${store}' AND NEW.key='${key}' AND NEW.status='completed'`;
 owned.psql(`CREATE FUNCTION syn_free_checkout_write_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic-free-mandatory-write-fault';END IF;RETURN NEW;END $$;
  CREATE TRIGGER syn_free_checkout_write_fault BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION syn_free_checkout_write_fault();`);
 try{
  const failed=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(failed.status,503,failed.text);
  assert.doesNotMatch(failed.text,/synthetic-free-mandatory-write-fault/);
  assert.deepEqual(assertOneFreeEffect(store),committed,'old entitlement/invoice/audit must remain exact');
  assert.equal(owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE s.id='${store}';`),siteBefore);
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${store}' AND subscription_checkout_key='${key}' AND subscription_id IS NULL AND payment_status='pending';`),'1','only unfinished intent may remain');
 }finally{owned.psql(`DROP TRIGGER syn_free_checkout_write_fault ON ${table};DROP FUNCTION syn_free_checkout_write_fault();`);}
 const recovered=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(recovered.status,201,recovered.text);
 const result=freeOutcome(store);assert.equal(result.subscriptions?.length,2);assert.equal(result.invoices?.length,2);assert.equal(result.activations?.length,2);
 assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE id='${first.json?.data.subscription.id}';`),'cancelled');
 assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${store}' AND key='${key}' AND status='completed';`),'1');
});

test('FREE-RECEIPT: retrying an older completed intent never resurrects it or retires the newer entitlement',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const first=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const newer=await j.createCheckout(store,crypto.randomUUID(),{plan_slug:'free'});assert.equal(newer.status,201,newer.text);
 const committed=freeOutcome(store),retry=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(retry.status,201,retry.text);
 assert.equal(retry.json?.data.subscription.id,first.json?.data.subscription.id);
 assert.deepEqual(freeOutcome(store),committed);
 assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE id='${newer.json?.data.subscription.id}';`),'active');
});

test('FREE-RECEIPT: current billing and invoice history read the zero-charge canonical outcome without private quote internals',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const created=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(created.status,201,created.text);
 const current=await j.gateway.request('/v1/payments/subscription?store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});
 assert.equal(current.status,200,current.text);assert.equal(current.json?.data.subscription.id,created.json?.data.subscription.id);
 assert.equal(current.json?.data.subscription.amount_paid,0);assert.equal(current.json?.data.product_usage.limit,25);
 const history=await j.gateway.request('/v1/payments/subscription/history?store_id='+store,{headers:await signedIdentityHeaders(j.owner,j.email)});
 assert.equal(history.status,200,history.text);assert.equal(history.json?.data.length,1);assert.equal(history.json?.data[0].amount_paid,0);
 assert.equal(history.json?.data[0].status,'paid');assert.equal('subscription_checkout' in history.json?.data[0],false);
 assert.equal(owned.psql(`SELECT count(*) FROM founding_merchant_allocations WHERE site_id='${store}';`),'0');
});

test('FREE-347: free receipts are private and ordinary database roles cannot invoke or forge the canonical source',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const created=await j.createCheckout(store,key,{plan_slug:'free'});assert.equal(created.status,201,created.text);
 const charge=owned.psql(`SELECT id FROM billing_history WHERE site_id='${store}' AND subscription_checkout_key='${key}';`);
 const committed=assertOneFreeEffect(store);
 for(const role of ['anon','authenticated','app_tenant']){
  for(const invocation of [
   `activate_merchant_subscription_v1('{}')`,
   `claim_merchant_subscription_checkout_v1('${j.owner}','${store}','synthetic-rogue-key','{}')`,
   `bind_merchant_subscription_checkout_v1('${j.owner}','${store}','${charge}','order_synthetic-forged')`,
   `read_merchant_subscription_checkout_v1('${j.owner}','${store}','free_checkout:${charge}','pay_synthetic-forged','free','monthly')`,
  ])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.${invocation};`),/permission denied for function/);
  assert.match(owned.psql(`BEGIN;SET LOCAL ROLE ${role};SELECT count(*) FROM billing_history WHERE id='${charge}';ROLLBACK;`),/\n0\n/);
  assert.match(owned.psqlExpectError(`BEGIN;GRANT INSERT ON billing_history TO ${role};SET LOCAL ROLE ${role};
   INSERT INTO billing_history(user_id,store_id,site_id,invoice_number,description,amount,total_amount)
   VALUES('${j.owner}','${store}','${store}','SYN-FREE-FORGE-${role}','Synthetic forbidden free source',0,0);ROLLBACK;`),/canonical backend/);
 }
 for(const invocation of [
  `bind_merchant_subscription_checkout_v1('${j.owner}','${store}','${charge}','order_synthetic-forged')`,
  `read_merchant_subscription_checkout_v1('${j.owner}','${store}','free_checkout:${charge}','pay_synthetic-forged','free','monthly')`,
 ]){
  const result=JSON.parse(owned.script(`SET ROLE service_role;SELECT public.${invocation};`));
  assert.equal(result.accepted,false);assert.equal(result.code,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 }
 assert.deepEqual(assertOneFreeEffect(store),committed);
});

test('FREE-347: internal free and positive paid quote contracts cannot be crossed in the actual database',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId;
 for(const [mode,amount,slug] of [['razorpay_order',0,'free'],['razorpay_subscription',0,'free'],['free_activation',1,'free'],['free_activation',0,'growth']] as const){
  const key=crypto.randomUUID();
  const result=JSON.parse(owned.script(`SET ROLE service_role;SELECT claim_merchant_subscription_checkout_v1('${j.owner}','${store}','${key}',
   jsonb_build_object('plan_slug','${slug}','site_type','store','billing_period','monthly','approved_usage_charges','[]'::jsonb,'coupon_code',NULL),
   jsonb_build_object('mode','${mode}','amount_minor',${amount},'currency','INR','plan',to_jsonb(p),
    'response',jsonb_build_object('checkout_mode','${mode}','amount',${amount},'currency','INR','billing_period','monthly','is_promo',false,'recurring',false)))
   FROM plans p WHERE slug='${slug}' AND site_type='store';`));
  assert.equal(result.accepted,false,JSON.stringify({mode,amount,slug,result}));
  assert.equal(result.code,'SUBSCRIPTION_CONTEXT_INVALID');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`),'0');
 }
});

test('FREE-347: retained free intent or activation refuses downgrade without changing function bodies or evidence',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId;
 const first=await j.createCheckout(store,crypto.randomUUID(),{plan_slug:'free'});assert.equal(first.status,201,first.text);
 const functions=checkoutFunctionState(),committed=assertOneFreeEffect(store);
 assert.match(owned.psqlExpectError(freeMigration('rollback')),/347 rollback refuses retained free checkout evidence/);
 assert.equal(checkoutFunctionState(),functions);assert.deepEqual(assertOneFreeEffect(store),committed);
});

test('FREE-RECEIPT: order and recovery race through two real activation RPCs but share one free outcome',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID(),failed=crypto.randomUUID(),before=createCount;
 owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,site_id,plan,plan_id,status,billing_period,amount_paid)
  SELECT '${failed}','${j.owner}','${store}','${store}','free',id,'past_due','monthly',0 FROM plans WHERE slug='free' AND site_type='store';`);
 let arrivals=0,release:()=>void=()=>{};
 const both=new Promise<void>(resolve=>{release=resolve;});
 const barrier=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(call.resource==='rpc/activate_merchant_subscription_v1'){
   if(++arrivals===2)release();
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([both,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('both real free activation RPCs must reach the barrier')),10000);})]);}
   finally{if(timer)clearTimeout(timer);}
  }
  return forward();
 });
 try{
  const replies=await Promise.all([j.createCheckout(store,key,{plan_slug:'free'}),
   j.gateway.request('/v1/payments/subscription/recover',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,j.email),'X-Idempotency-Key':key},
    body:JSON.stringify({store_id:store,billing_period:'monthly'})})]);
  assert.deepEqual(replies.map(r=>r.status),[201,201],replies.map(r=>r.text).join(' '));
  assert.equal(arrivals,2);assert.equal(replies[0].json?.data.subscription.id,replies[1].json?.data.subscription.id);
  const result=freeOutcome(store);assert.equal(result.subscriptions?.length,2);assert.equal(result.invoices?.length,1);assert.equal(result.activations?.length,1);
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${store}' AND status='active';`),'1');
  assert.equal(replies[1].json?.data.recovery.subscription_id,failed);assert.equal(replies[1].json?.data.recovery.next_step,'activated');
  assert.equal(createCount,before);
 }finally{release();barrier.restore();}
});

test('FREE-RECEIPT: two same-route requests reach activation together and return one committed source',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 let arrivals=0,release:()=>void=()=>{};
 const both=new Promise<void>(resolve=>{release=resolve;});
 const barrier=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(call.resource==='rpc/activate_merchant_subscription_v1'){
   if(++arrivals===2)release();
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([both,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('same-route race must reach two real activation RPCs')),10000);})]);}
   finally{if(timer)clearTimeout(timer);}
  }
  return forward();
 });
 try{
  const replies=await Promise.all([j.createCheckout(store,key,{plan_slug:'free'}),j.createCheckout(store,key,{plan_slug:'free'})]);
  assert.deepEqual(replies.map(r=>r.status),[201,201],replies.map(r=>r.text).join(' '));
  assert.equal(arrivals,2);assert.equal(replies[0].json?.data.subscription.id,replies[1].json?.data.subscription.id);
  const committed=assertOneFreeEffect(store);assert.equal(committed.subscriptions![0].id,replies[0].json?.data.subscription.id);
 }finally{release();barrier.restore();}
});

for(const status of ['failed','completed'])test('FREE-347: ambiguous legacy HTTP '+status+' receipt cannot create a second free activation after rollout',async()=>{
 const {j,legacy}=legacyFreeFixtures.get(status)!;
 const store=j.stores[0].siteId,key=crypto.randomUUID();
 owned.psql(`INSERT INTO idempotency_keys(site_id,key,scope,request_hash,status,status_code,response_body,expires_at)
  VALUES('${store}','${key}','http:POST:/payments/subscription/order',repeat('0',64),'${status}',${status==='completed'?201:503},
   ${status==='completed'?`jsonb_build_object('data',jsonb_build_object('subscription',jsonb_build_object('id','${legacy.subscription.id}')))`:'NULL'},'infinity');`);
 const committed=assertOneFreeEffect(store),http=owned.psql(`SELECT to_jsonb(i)::text FROM idempotency_keys i WHERE site_id='${store}' AND key='${key}';`);
 const denied=await j.createCheckout(store,key,{plan_slug:'free'});
 assert.equal(denied.status,503,denied.text);assert.equal(denied.json?.error.code,'SUBSCRIPTION_LEGACY_CHECKOUT_PENDING');
 assert.deepEqual(assertOneFreeEffect(store),committed);
 assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`),'0');
 assert.equal(owned.psql(`SELECT to_jsonb(i)::text FROM idempotency_keys i WHERE site_id='${store}' AND key='${key}';`),http);
});

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


// Independent review follow-up. The frozen43case delivery remains immutable;
// these append-only probes are part of the next normal checkout tranche.
test('N7-F02: paid verify replay revalidates current owner before the completed HTTP receipt',async()=>{
 const j=await fixture(),payment=await j.capture(),first=await j.verify(payment);
 assert.equal(first.status,201,first.text);once(payment.id,[first]);
 const before=owned.psql(`SELECT to_jsonb(s)::text FROM subscriptions s WHERE razorpay_payment_id='${payment.id}';`);
 owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${j.stores[0].siteId}';`);
 const replay=await j.verify(payment);
 console.info('N2_PAID_VERIFY_REVOKED_REPLAY '+JSON.stringify({firstStatus:first.status,replayStatus:replay.status}));
 assert.equal(replay.status,403,'revoked owner must be denied before any cached response');
 assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM subscriptions s WHERE razorpay_payment_id='${payment.id}';`),before);
 await j.gateway.settle();
});

test('N7-F01: actual paid quote/capture/invoice witness is retained for tax-basis review only',async()=>{
 const j=await fixture(),payment=await j.capture(),verified=await j.verify(payment);
 assert.equal(verified.status,201,verified.text);once(payment.id,[verified]);
 const invoice=JSON.parse(owned.psql(`SELECT jsonb_build_object('capture_minor',${payment.amount},'quote_minor',b.amount,'paid_minor',(SELECT s.amount_paid FROM subscriptions s WHERE s.id=b.subscription_id),'tax_minor',b.tax_amount,'invoice_total_minor',b.total_amount,'currency',b.currency,'payment_status',b.payment_status,'quote_mode',b.subscription_checkout->>'mode') FROM billing_history b WHERE b.payment_id='${payment.id}';`));
 assert.equal(invoice.capture_minor,invoice.quote_minor);assert.equal(invoice.paid_minor,payment.amount);assert.equal(invoice.payment_status,'paid');
 console.info('N2_PAID_TAX_BASIS_WITNESS '+JSON.stringify({...invoice,conservationProved:invoice.invoice_total_minor===invoice.capture_minor,providerFixtureOnly:true,approvedTaxBasisInferred:false}));
 await j.gateway.settle();
});


test('NORMAL-FREE: signed store hint denies the wrong store before effect and the exact owner/site positive succeeds',async()=>{
 const j=await freeFixture(),store=j.stores[0].siteId,key=crypto.randomUUID();
 const request=async(hint:string)=>j.gateway.request('/v1/payments/subscription/order',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,j.email,hint),'X-Idempotency-Key':key},body:JSON.stringify({store_id:store,plan_slug:'free',billing_period:'monthly',site_type:'store'})});
 const denied=await request(j.stores[1].siteId);assert.equal(denied.status,403,denied.text);assert.equal(freeOutcome(store).subscriptions,null);
 const allowed=await request(store);assert.equal(allowed.status,201,allowed.text);assertOneFreeEffect(store);
 console.info('N2_FREE_SIGNED_STORE_HINT '+JSON.stringify({directRegressionCounterpart:true,wrongHintStatus:denied.status,exactHintStatus:allowed.status,normalBrowserAuthClaim:false}));await j.gateway.settle();
});
