// Source authorized; SQL/heavy execution requires the coordinator's full literal review.
// Real Gateway/PostgREST/PostgreSQL. Only provider HTTP is an explicit synthetic
// fixture; no payment capture, actual tax registration, device or live acceptance.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test,{before,after} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET,tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import webhookWorker from '../../services/webhook-service/src/index';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),secret='synthetic-tax-provider-secret';
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-only',profile_version:1,
 approval_status:'approved',approval_reference:'synthetic-approval-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,
 supplier:{name:'Synthetic Platform Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',
 address:{line1:'Synthetic Supplier Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};
type Order={id:string;amount:number;currency:string;receipt:string;notes:Record<string,string>};
type Payment={id:string;order_id:string;amount:number;currency:string;status:string;invoice_id?:string;captured?:boolean};
const orders=new Map<string,Order>(),payments=new Map<string,Payment>();
const nativePlans=new Map<string,{amount:number;currency:string;period:string;interval?:number;active?:boolean;tax_rate?:number|null;tax_id?:string|null;tax_group_id?:string|null}>();
type NativeAddon={item:{name:string;amount:number;currency:string};quantity?:number};
type NativeSubscription={id:string;entity:string;plan_id:string;quantity:number;status:string;notes:Record<string,string>;addons:NativeAddon[];current_start?:number;current_end?:number;paid_count:number};
const nativeSubscriptions=new Map<string,NativeSubscription>(),nativeInvoices=new Map<string,Record<string,unknown>>(),nativeReads:string[]=[];
function nativeCapture(reference:string,cycle:number,upfront=false):Payment{
 const sub=nativeSubscriptions.get(reference);assert.ok(sub);const configured=nativePlans.get(sub.plan_id);assert.ok(configured);
 const start=Date.UTC(2026,9+cycle,18)/1000,end=Date.UTC(2026,10+cycle,18)/1000;
 const lines=[{type:'plan',name:'Synthetic retained plan',quantity:1,unit_amount:configured.amount,gross_amount:configured.amount,tax_amount:0,currency:'INR'},
  ...(upfront?sub.addons.map(a=>({type:'addon',name:a.item.name,quantity:a.quantity??1,unit_amount:a.item.amount,gross_amount:a.item.amount*(a.quantity??1),tax_amount:0,currency:a.item.currency})):[])];
 const amount=lines.reduce((total,line)=>total+line.gross_amount,0),suffix=crypto.randomUUID().replaceAll('-','');
 const pay:Payment={id:'pay_Syn'+suffix,order_id:'order_Syn'+suffix,invoice_id:'inv_Syn'+suffix,amount,currency:'INR',status:'captured',captured:true};
 nativeInvoices.set(pay.invoice_id!,{id:pay.invoice_id,entity:'invoice',subscription_id:reference,payment_id:pay.id,order_id:pay.order_id,status:'paid',currency:'INR',
  amount,amount_paid:amount,amount_due:0,gross_amount:amount,partial_payment:false,billing_start:start,billing_end:end,line_items:lines});
 Object.assign(sub,{current_start:start,current_end:end,paid_count:cycle+1});payments.set(pay.id,pay);return pay;
}
let outerFetch:typeof fetch,creates=0,sequence=0;
const external:string[]=[];
const migration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../database/supabase/'+direction+'/360_subscription_tax_quote_snapshot'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
function privateState(site:string){
 return owned.psql(`SELECT jsonb_build_object(
  'subscriptions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM subscriptions s WHERE store_id='${site}'),
  'history',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM billing_history b WHERE site_id='${site}'),
  'documents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM merchant_billing_invoices i WHERE site_id='${site}'),
  'receipts',(SELECT jsonb_agg(to_jsonb(k) ORDER BY id) FROM idempotency_keys k WHERE site_id='${site}' AND scope LIKE 'subscription.checkout:%')
 );`);
}
function financialOutcome(pay:string){
 return JSON.parse(owned.psql(`SELECT jsonb_build_object(
  'subscription',(SELECT jsonb_build_object('id',s.id,'owner',s.user_id,'site',s.site_id,'plan',s.plan,'period',s.billing_period,
   'start',s.current_period_start,'end',s.current_period_end,'paid',s.amount_paid,'currency',s.currency,'payment',s.razorpay_payment_id,
   'snapshot',s.subscription_tax_snapshot,'source',s.subscription_tax_source_id) FROM subscriptions s WHERE razorpay_payment_id='${pay}'),
  'invoice',(SELECT to_jsonb(b) FROM billing_history b WHERE payment_id='${pay}'),
  'documents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM merchant_billing_invoices i JOIN billing_history b ON b.id=i.billing_history_id WHERE b.payment_id='${pay}'),
  'activations',(SELECT count(*) FROM audit_logs WHERE action='merchant_subscription.activated' AND metadata->>'payment_reference'='${pay}')
 );`));
}
async function fixture(config:unknown=profile,gst=true){
 const owner=crypto.randomUUID(),email='syn-tax-'+owner+'@example.invalid',site=newSyntheticTenant('tax-gross-'+(++sequence));
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);
 seedSyntheticTenant(owned.psql,site,{gst});
 owned.psql(`UPDATE sites SET custom_user_id='${owner}',invoice_address='{"line1":"Synthetic Billing Address","city":"Bengaluru","state":"Karnataka","state_code":"29","zip":"560001","country":"IN"}'::jsonb WHERE id='${site.siteId}';`);
 const env=gatewayEnv(owned,await newIdentityKeys(),{RAZORPAY_KEY_ID:'synthetic-tax-key',RAZORPAY_KEY_SECRET:secret,LETBUYY_AUTOPAY_MODE:'sandbox',
  ...(config===undefined?{}:{LETBUYY_SUBSCRIPTION_TAX_PROFILE:JSON.stringify(config)})});
 const gateway=new Gateway(env),headers=()=>signedIdentityHeaders(owner,email);
 const checkout=(key=crypto.randomUUID(),extra:Record<string,unknown>={})=>headers().then(h=>gateway.request('/v1/payments/subscription/order',{
  method:'POST',headers:{...h,'X-Idempotency-Key':key},body:JSON.stringify({store_id:site.siteId,site_type:'store',plan_slug:'growth',billing_period:'monthly',...extra})}));
 const verify=(pay:Payment,extra:Record<string,unknown>={})=>headers().then(h=>gateway.request('/v1/payments/subscription/verify',{
  method:'POST',headers:{...h,'X-Idempotency-Key':'tax-verify:'+pay.id},body:JSON.stringify({store_id:site.siteId,site_type:'store',plan_slug:'growth',billing_period:'monthly',
   razorpay_order_id:pay.order_id,razorpay_payment_id:pay.id,razorpay_signature:createHmac('sha256',secret).update(pay.order_id+'|'+pay.id).digest('hex'),...extra})}));
 const webhook=(pay:Payment,extra:Record<string,unknown>={})=>gateway.request('/v1/internal/billing/subscriptions/activate',{
  method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({
   storeId:site.siteId,userId:owner,planSlug:'growth',billingPeriod:'monthly',provider:'razorpay',providerOrderId:pay.order_id,
   providerPaymentId:pay.id,externalSubscriptionId:pay.order_id,amountPaid:pay.amount,...extra})});
 const signedHops:{path:string;body:unknown}[]=[];
 const signedEventId=(pay:Payment,event='payment.captured')=>'evt_syn_tax_'+event.replaceAll('.','_')+'_'+pay.id;
 const signedWebhook=async(pay:Payment,signatureOverride?:string,nativeReference?:string,nativeEvent='subscription.charged')=>{
  const native=nativeReference?nativeSubscriptions.get(nativeReference):null,order=native?null:orders.get(pay.order_id);
  assert.ok(native||order,'signed webhook uses actual retained synthetic provider notes');const event=native?nativeEvent:'payment.captured';
  const body=JSON.stringify({id:signedEventId(pay,event),entity:'event',event,created_at:Math.floor(Date.now()/1000),
   contains:native?['subscription','payment']:['payment'],payload:{payment:{entity:{...pay,entity:'payment',...(order?{notes:order.notes}:{})}},...(native?{subscription:{entity:native}}:{})}});
  const webhookSecret='synthetic-owned-tax-webhook-secret';
  const response=await webhookWorker.fetch(new Request('http://127.0.0.1/razorpay',{method:'POST',
   headers:{'Content-Type':'application/json','x-razorpay-signature':signatureOverride??createHmac('sha256',webhookSecret).update(body).digest('hex')},body}),{
   ...owned.restEnv(),RAZORPAY_WEBHOOK_SECRET:webhookSecret,STRIPE_WEBHOOK_SECRET:'synthetic-unused',
   RAZORPAY_KEY_ID:'synthetic-tax-key',RAZORPAY_KEY_SECRET:secret,INTERNAL_API_SECRET:INTERNAL_SECRET,ENVIRONMENT:'test',
   API_GATEWAY_SERVICE:{async fetch(input,init){
    const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(target.origin,'https://api-gateway');signedHops.push({path:target.pathname,body:JSON.parse(String(init?.body||'{}'))});
    const result=await gateway.request(target.pathname+target.search,init);
    return new Response(result.text,{status:result.status,headers:result.headers});
   }},
  });
  const text=await response.text();return {status:response.status,text,json:JSON.parse(text) as Record<string,unknown>};
 };
 async function capture(key=crypto.randomUUID(),extra:Record<string,unknown>={}){
  const response=await checkout(key,extra);assert.equal(response.status,200,response.text);
  const order=orders.get(response.json?.data.razorpay_order_id);assert.ok(order,'real checkout must create one provider-fixture order');
  const pay:Payment={id:'pay_syn_tax_'+crypto.randomUUID(),order_id:order.id,amount:order.amount,currency:order.currency,status:'captured'};
  payments.set(pay.id,pay);return {response,order,pay,key};
 }
 return {owner,email,site,env,gateway,headers,checkout,verify,webhook,signedWebhook,signedEventId,signedHops,capture,state:()=>privateState(site.siteId)};
}
const refundMigration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../database/supabase/'+direction+'/364_subscription_refund_source_references'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
let restoreRefund364=false;
let legacy:Awaited<ReturnType<typeof fixture>>,legacyId:string,legacyBefore:string;
before(async()=>{
 // A legacy row must be genuinely retained across360, not manufactured through
 // a post360 exception. Retire only the empty newly-provisioned360 source first.
 const refundFamily=owned.psql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('guard_subscription_refund_source_reference_v1','read_merchant_subscription_refund_source_v1','record_subscription_refund_source_reference_v1','assert_subscription_refund_source_profile_364','guard_subscription_refund_source_ddl_364');");
 assert.ok(['0','5'].includes(refundFamily),'partial364 must fail, never bypass its lifecycle');restoreRefund364=refundFamily==='5';
 if(restoreRefund364){assert.match(owned.psqlScriptExpectError(migration('rollback')),/360 rollback requires empty364 retirement first/);owned.script(refundMigration('rollback'));}
 owned.script(migration('rollback'));
 legacy=await fixture();legacyId=crypto.randomUUID();const sub=crypto.randomUUID();
 owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,site_id,plan,status,billing_period,amount_paid,current_period_end)
  VALUES('${sub}','${legacy.owner}','${legacy.site.siteId}','${legacy.site.siteId}','growth','active','monthly',69900,'2026-12-01T00:00:00Z');
  INSERT INTO billing_history(id,user_id,store_id,site_id,subscription_id,invoice_number,description,amount,tax_amount,total_amount,currency,payment_status)
  VALUES('${legacyId}','${legacy.owner}','${legacy.site.siteId}','${legacy.site.siteId}','${sub}','SYN-LEGACY-${legacyId}','Synthetic Retained Additive Invoice',69900,12582,82482,'INR','paid');`);
 legacyBefore=owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`);
 // Same default count with a changed expression must fail predecessor admission.
 // Capture the real predecessor definition; run each mutation in an aborted
 // transaction so no legacy rows, function definitions or ACLs are rewritten.
 const predecessor=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
  'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid)
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN('claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1');`);
 const retainedPredecessor=predecessor();
 for(const [signature,oldDefault,newDefault] of [
  ['claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)','DEFAULT NULL::jsonb',"DEFAULT '{}'::jsonb"],
  ['bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text)','DEFAULT NULL::text',"DEFAULT 'synthetic-changed-default'::text"],
 ] as const){
  const definition=owned.psql(`SELECT pg_get_functiondef('public.${signature}'::regprocedure);`);
  assert.ok(definition.includes(oldDefault),'observed canonical predecessor default expression');
  // Admission requires a fresh transaction, so commit this deliberate fixture
  // drift first and restore the captured predecessor in finally. The failing
  // migration itself must leave that drift and all retained rows untouched.
  owned.script(definition.replace(oldDefault,newDefault));
  const driftedPredecessor=predecessor();
  try {
   assert.match(owned.psqlScriptExpectError(migration('migrations')),/refuses changed predecessor signature\/config/);
   assert.equal(predecessor(),driftedPredecessor,'failed admission preserves the observed drifted predecessor');
  } finally { owned.script(definition); }
  assert.equal(predecessor(),retainedPredecessor,'fixture restores the captured predecessor definitions, owner and ACL');
 }
 owned.script(migration('migrations'));
 if(restoreRefund364)owned.script(refundMigration('migrations'));
 outerFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),method=init?.method||'GET';
  if(url.origin==='https://api.razorpay.com'){
   if(url.pathname==='/v1/orders'&&method==='POST'){
    const b=JSON.parse(String(init?.body));creates++;const row:Order={id:'order_syn_tax_'+crypto.randomUUID(),amount:b.amount,currency:b.currency,receipt:b.receipt,notes:b.notes||{}};
    orders.set(row.id,row);return Response.json(row);
   }
   if(url.pathname==='/v1/orders'&&method==='GET')return Response.json({items:[...orders.values()].filter(x=>x.receipt===url.searchParams.get('receipt'))});
   if(url.pathname.startsWith('/v1/plans/')&&method==='GET'){
    const id=url.pathname.split('/').pop()!,plan=nativePlans.get(id);if(!plan)return restJson(404,{error:{description:'Synthetic configured plan absent'}});
    return Response.json({id,entity:'plan',interval:plan.interval??1,period:plan.period,item:{active:plan.active??true,amount:plan.amount,currency:plan.currency,tax_rate:plan.tax_rate??null,tax_id:plan.tax_id??null,tax_group_id:plan.tax_group_id??null}});
   }
   if(url.pathname==='/v1/subscriptions'&&method==='POST'){
    const body=JSON.parse(String(init?.body));assert.ok(nativePlans.has(body.plan_id));assert.equal(body.start_at,undefined);assert.equal(body.quantity,1);
    const row:NativeSubscription={id:'sub_Syn'+crypto.randomUUID().replaceAll('-',''),entity:'subscription',plan_id:body.plan_id,quantity:1,status:'created',notes:body.notes,addons:body.addons||[],paid_count:0};
    nativeSubscriptions.set(row.id,row);creates++;return Response.json(row);
   }
   if(url.pathname.startsWith('/v1/subscriptions/')&&method==='GET'){nativeReads.push(url.pathname);const row=nativeSubscriptions.get(url.pathname.split('/').pop()!);return row?Response.json(row):restJson(404,{error:{description:'Synthetic subscription absent'}});}
   if(url.pathname.startsWith('/v1/invoices/')&&method==='GET'){nativeReads.push(url.pathname);const row=nativeInvoices.get(url.pathname.split('/').pop()!);return row?Response.json(row):restJson(404,{error:{description:'Synthetic invoice absent'}});}

   if(url.pathname.startsWith('/v1/payments/')&&method==='GET'){nativeReads.push(url.pathname);return payments.has(url.pathname.split('/').pop()!)?Response.json(payments.get(url.pathname.split('/').pop()!)):restJson(404,{error:{description:'Synthetic payment absent'}});}
   if(url.pathname.startsWith('/v1/orders/')&&method==='GET')return orders.has(url.pathname.split('/').pop()!)?Response.json(orders.get(url.pathname.split('/').pop()!)):restJson(404,{error:{description:'Synthetic order absent'}});
   throw new Error('Unexpected synthetic provider operation');
  }
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){external.push(url.hostname);throw new Error('Owned tax fixture forbids external transport');}
  const response=await outerFetch(input,init);
  if(!response.ok && url.pathname.startsWith('/rest/v1/rpc/')) {
   const detail=await response.clone().json().catch(()=>({}));
   console.info('SYNTHETIC_SQL_DIAGNOSTIC',JSON.stringify({rpc:url.pathname.split('/').pop(),code:(detail as Record<string,unknown>).code,message:(detail as Record<string,unknown>).message}));
  }
  return response;
 }) as typeof fetch;
});
after(async()=>{await legacy?.gateway.settle();if(outerFetch)globalThis.fetch=outerFetch;assert.deepEqual(external,[]);});
test('empty360 rollback/reapply preserves the full retained legacy invoice and private RPC execution grants',()=>{
 const catalog=()=>owned.psql(`SELECT jsonb_build_object(
  'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a WHERE a.attrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass) AND a.attname IN('subscription_tax_snapshot','subscription_tax_source_id')),
  'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass,'public.merchant_billing_invoices'::regclass)),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)),
  'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid IN('public.billing_history'::regclass,'public.subscriptions'::regclass)),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('class',to_jsonb(c),'index',to_jsonb(i)) ORDER BY c.oid) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.merchant_billing_invoices'::regclass)
 );`);
 const originalCatalog=catalog(),originalLegacy=owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`);
 const mutations:[string,RegExp][]=[
  ["ALTER TABLE public.billing_history ALTER COLUMN subscription_tax_snapshot SET DEFAULT '{}'::jsonb",/360 refuses changed tax column schema or grants/],
  ["GRANT SELECT(subscription_tax_snapshot) ON public.billing_history TO authenticated",/360 refuses changed tax column schema or grants/],
  ['ALTER TABLE public.billing_history DISABLE TRIGGER billing_history_tax_writer_360',/360 refuses changed tax trigger shape/],
  ['ALTER TRIGGER subscriptions_tax_source_immutable_360 ON public.subscriptions RENAME TO synthetic_wrong_tax_trigger',/360 refuses replaced tax trigger identity/],
  ['CREATE TRIGGER synthetic_extra_tax_trigger BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tax_rows_360()',/360 refuses unknown incoming function dependency/],
  ['ALTER POLICY subscription_tax_history_backend_read_360 ON public.billing_history TO authenticated',/360 refuses changed tax policy shape/],
  ['ALTER POLICY subscription_tax_current_backend_read_360 ON public.subscriptions USING(true)',/360 refuses changed tax policy shape/],
  ['ALTER TABLE public.billing_history DISABLE ROW LEVEL SECURITY',/360 refuses changed tax policy shape/],
  ['ALTER TABLE public.subscriptions ALTER CONSTRAINT subscriptions_subscription_tax_source_id_fkey DEFERRABLE INITIALLY DEFERRED',/360 refuses replaced native RI trigger identity/],
  ['ALTER TABLE public.billing_history DROP CONSTRAINT billing_history_subscription_tax_source_id_fkey',/360 refuses replaced native RI trigger identity/],
  ['CREATE INDEX synthetic_unknown_tax_expression ON public.subscriptions ((subscription_tax_snapshot->>\'gross_minor\'))',/360 refuses unknown tax column dependency/],
  ['CREATE VIEW public.synthetic_unknown_tax_view AS SELECT subscription_tax_snapshot FROM public.billing_history',/360 refuses unknown tax column dependency/],
  ['ALTER TABLE public.billing_history ADD CONSTRAINT synthetic_unknown_tax_check CHECK(subscription_tax_snapshot IS NULL)',/360 refuses unknown tax column dependency/],
  ['ALTER INDEX public.merchant_billing_tax_source_360_uidx SET(fillfactor=80)',/360 refuses changed historical invoice index identity\/expression/],
 ];
 for(const [mutation,expected] of mutations){
  assert.match(owned.psqlExpectError(`BEGIN;${mutation};ROLLBACK;`),expected,'exact tax guard must reject '+mutation);
  assert.equal(catalog(),originalCatalog,'refused DDL preserves complete observed column/trigger/policy/constraint/index rows');
  assert.equal(owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`),originalLegacy);
 }
 assert.equal(owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`),legacyBefore);
 const fullBefore=privateState(legacy.site.siteId);
 assert.match(owned.psqlExpectError(`DELETE FROM billing_history WHERE id='${legacyId}';`),/retained subscription financial source is immutable/);
 for(const table of ['billing_history','subscriptions'])assert.match(owned.psqlExpectError(`TRUNCATE public.${table} CASCADE;`),/retained subscription financial sources cannot be truncated/);
 assert.equal(privateState(legacy.site.siteId),fullBefore);
 for(const role of ['anon','authenticated','app_tenant'])for(const sql of ["read_merchant_subscription_checkout_key_v1(null,null,'synthetic-key','{}')","record_merchant_subscription_invoice_v1('{}')","record_merchant_subscription_failure_v1('{}')","sync_merchant_subscription_state_v1('{}')"])
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.${sql};`),/permission denied for function/);
});
test('real quote/provider/capture/paid invoice conserve69900 and canonical interstate10663, including concurrent internal notification',async()=>{
 const f=legacy;const count=creates,c=await f.capture();assert.equal(c.order.amount,69900);assert.equal(c.response.json?.data.tax.gross_minor,69900);
 const beforeInvalid=f.state(),hopsBefore=f.signedHops.length;
 const invalid=await f.signedWebhook(c.pay,'0'.repeat(64));assert.equal(invalid.status,400,invalid.text);
 assert.equal(f.state(),beforeInvalid);assert.equal(f.signedHops.length,hopsBefore);
 assert.equal(owned.psql(`SELECT count(*) FROM payment_webhook_events WHERE provider='razorpay' AND provider_event_id='${f.signedEventId(c.pay)}';`).trim(),'0','bad HMAC cannot claim an event');
 const replies=await Promise.all([f.verify(c.pay),f.webhook(c.pay),f.signedWebhook(c.pay)]);
 assert.deepEqual(replies.map(x=>x.status).sort(),[200,200,201],replies.map(x=>x.text).join(' '));
 assert.equal(owned.psql(`SELECT processing_status FROM payment_webhook_events WHERE provider='razorpay' AND provider_event_id='${f.signedEventId(c.pay)}';`).trim(),'processed');
 assert.equal(f.signedHops.filter(x=>x.path==='/v1/internal/billing/subscriptions/activate').length,1);
 assert.equal(f.signedHops.filter(x=>x.path==='/v1/internal/events/domain').length,1);

 const o=financialOutcome(c.pay.id);assert.equal(o.subscription.paid,69900);assert.equal(o.invoice.amount,69900);assert.equal(o.invoice.total_amount,69900);assert.equal(o.invoice.tax_amount,10663);
 assert.equal(o.documents.length,1);assert.equal(o.documents[0].subtotal_minor,59237);assert.equal(o.documents[0].igst_minor,10663);assert.equal(o.documents[0].cgst_minor+o.documents[0].sgst_minor,0);assert.equal(o.documents[0].total_minor,69900);assert.equal(o.activations,1);assert.equal(creates-count,1);
 const before=financialOutcome(c.pay.id),again=await f.verify(c.pay);assert.equal(again.status,201,again.text);assert.deepEqual(financialOutcome(c.pay.id),before);assert.equal(creates-count,1);
 const hopCount=f.signedHops.length,duplicate=await f.signedWebhook(c.pay);
 assert.equal(duplicate.status,200,duplicate.text);assert.equal(duplicate.json.duplicate,true);assert.equal(f.signedHops.length,hopCount);
 assert.deepEqual(financialOutcome(c.pay.id),before,'signed terminal event replay retains the exact canonical paid source');

 const retainedBefore=privateState(f.site.siteId),auditBefore=owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM audit_logs a WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1';");
 for(const table of ['billing_history','subscriptions','merchant_billing_invoices'])assert.match(owned.psqlExpectError(`TRUNCATE public.${table} CASCADE;`),/retained subscription (financial sources|billing documents) cannot be truncated/);
 for(const sql of ["TRUNCATE public.audit_logs CASCADE;","DELETE FROM audit_logs WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1';","UPDATE audit_logs SET action='synthetic-change' WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1';"])assert.match(owned.psqlExpectError(sql),/retained subscription tax audits (cannot be truncated|are immutable)/);
 assert.equal(privateState(f.site.siteId),retainedBefore);assert.equal(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM audit_logs a WHERE metadata?'subscription_tax_source_id' OR metadata->>'subscription_tax_policy'='D-SUB-TAX-INCLUSIVE-V1';"),auditBefore);
 console.info('N2_TAX_GROSS '+JSON.stringify({quote:c.response.json?.data.amount,provider:c.order.amount,captured:c.pay.amount,paid:o.subscription.paid,invoice:o.invoice.total_amount,tax:o.invoice.tax_amount}));
});
test('canonical intrastate allocation5331+5332 conserves gross and blank recipient GSTIN does not select exemption',async()=>{
 const intra={...profile,supplier:{...profile.supplier,gstin:'29AAAAA0000A1Z5',state_code:'29'}};const f=await fixture(intra,false);
 try{const c=await f.capture(),response=await f.verify(c.pay);assert.equal(response.status,201,response.text);const o=financialOutcome(c.pay.id);
  assert.equal(o.invoice.total_amount,69900);assert.equal(o.documents[0].cgst_minor,5331);assert.equal(o.documents[0].sgst_minor,5332);assert.equal(o.documents[0].igst_minor,0);assert.equal(o.documents[0].subtotal_minor,59237);
 }finally{await f.gateway.settle();}
});
test('missing, invalid and unsupported supplier or recipient facts refuse before claim/provider/effects',async()=>{
 for(const config of [null,{}, {...profile,approval_status:'draft'},{...profile,rate_bps:0},{...profile,supply_category:'export'},
  {...profile,supplier:{...profile.supplier,gstin:null}},{...profile,supplier:{...profile.supplier,state_code:'29'}}]){
  const f=await fixture(config);try{const before=f.state(),count=creates,response=await f.checkout();assert.equal(response.status,503,response.text);assert.equal(response.json?.error.code,'SUBSCRIPTION_TAX_SETUP_REQUIRED');assert.equal(f.state(),before);assert.equal(creates,count);}finally{await f.gateway.settle();}
 }
 const f=await fixture();try{delete f.env.LETBUYY_SUBSCRIPTION_TAX_PROFILE;const before=f.state(),count=creates,r=await f.checkout();assert.equal(r.status,503);assert.equal(f.state(),before);assert.equal(creates,count);}finally{await f.gateway.settle();}
});
test('free347zero has no profile/provider requirement and remains a single durable receipt',async()=>{
 const f=await fixture(null);try{
  owned.psql(`INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,requires_contact,trial_days,status,purchasable)
   VALUES('store','free','Synthetic Internal Free Fallback',0,0,25,true,false,0,'available',true) ON CONFLICT(site_type,slug) DO NOTHING;`);
  delete f.env.LETBUYY_SUBSCRIPTION_TAX_PROFILE;Reflect.deleteProperty(f.env,'RAZORPAY_KEY_ID');Reflect.deleteProperty(f.env,'RAZORPAY_KEY_SECRET');
  const key=crypto.randomUUID(),count=creates,a=await f.checkout(key,{plan_slug:'free'});assert.equal(a.status,201,a.text);const before=f.state(),b=await f.checkout(key,{plan_slug:'free'});assert.equal(b.status,201,b.text);assert.equal(a.json?.data.subscription.id,b.json?.data.subscription.id);assert.equal(f.state(),before);assert.equal(creates,count);
 }finally{await f.gateway.settle();}
});
test('saved discounted source prevails across supplier/coupon changes and exact request retry',async()=>{
 const f=await fixture(),code='SYN-TAX-'+crypto.randomUUID();try{
  owned.psql(`INSERT INTO subscription_coupons(code,discount_type,amount_off_minor,per_merchant_limit) VALUES('${code}','fixed_amount',1000,10);`);
  const c=await f.capture(crypto.randomUUID(),{coupon_code:code}),quoted=owned.psql(`SELECT subscription_tax_snapshot FROM billing_history WHERE subscription_checkout_reference='${c.order.id}';`);
  assert.equal(c.order.amount,68900);f.env.LETBUYY_SUBSCRIPTION_TAX_PROFILE='{}';
  owned.psql(`UPDATE subscription_coupons SET amount_off_minor=2000,is_active=false WHERE code='${code}';`);
  const retry=await f.checkout(c.key,{coupon_code:code});assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data.razorpay_order_id,c.order.id);
  const r=await f.verify(c.pay);assert.equal(r.status,201,r.text);const o=financialOutcome(c.pay.id);assert.equal(o.invoice.total_amount,c.pay.amount);assert.equal(o.invoice.subscription_tax_snapshot.source.discount_minor,1000);
  assert.equal(owned.psql(`SELECT subscription_tax_snapshot FROM billing_history WHERE subscription_checkout_reference='${c.order.id}';`),quoted);
 }finally{await f.gateway.settle();}
});
test('committed activation reply loss recovers one source/invoice without new provider POST',async()=>{
 const f=await fixture();const c=await f.capture();let losses=0;const observed=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  const response=await forward();if(call.resource==='rpc/activate_merchant_subscription_v1'&&response.ok&&losses++===0)return restJson(503,{message:'Synthetic committed response loss'});return response;
 });try{
  const count=creates,first=await f.verify(c.pay);assert.equal(first.status,503,first.text);const before=financialOutcome(c.pay.id);
  const retry=await f.verify(c.pay);assert.equal(retry.status,201,retry.text);assert.deepEqual(financialOutcome(c.pay.id),before);assert.equal(creates,count);
 }finally{await f.gateway.settle();observed.restore();}
});
test('current owner transfer and conflicting source terms deny effect and cached paid replay',async()=>{
 const f=await fixture(),other=await fixture();try{
  const c=await f.capture();assert.equal((await f.verify(c.pay)).status,201);const before=f.state();
  for(const extra of [{billing_period:'yearly'},{plan_slug:'launch'},{razorpay_order_id:'order_syn_foreign'}])assert.ok([400,409].includes((await f.verify(c.pay,extra)).status));
  owned.psql(`UPDATE sites SET custom_user_id='${other.owner}',user_id=NULL WHERE id='${f.site.siteId}';`);
  assert.equal((await f.verify(c.pay)).status,403);assert.equal(f.state(),before);
  const foreign=await f.gateway.request('/v1/payments/subscription/history?store_id='+other.site.siteId,{headers:await f.headers()});
  assert.ok([403,404].includes(foreign.status));
 }finally{await f.gateway.settle();await other.gateway.settle();}
});
test('duplicate internal invoice uses original payment source and changed identity/money/period conflicts',async()=>{
 const f=await fixture();try{
  const c=await f.capture();assert.equal((await f.verify(c.pay)).status,201);const o=financialOutcome(c.pay.id),before=f.state();
  const body={externalSubscriptionId:c.order.id,provider:'razorpay',amount:c.pay.amount,currency:'INR',taxAmount:o.invoice.tax_amount,totalAmount:c.pay.amount,paymentId:c.pay.id,paymentStatus:'paid'};
  const notify=(extra:Record<string,unknown>={})=>f.gateway.request('/v1/internal/billing/subscriptions/invoice',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({...body,...extra})});
  assert.equal((await notify()).status,200);assert.equal((await notify()).status,200);assert.equal(f.state(),before);
  for(const extra of [{invoiceNumber:'SYN-CHANGED'},{amount:c.pay.amount+1,totalAmount:c.pay.amount+1},{periodEnd:'2030-01-01T00:00:00Z'}])assert.equal((await notify(extra)).status,409);
  for(const extra of [{currency:'USD'},{amount:1.5,totalAmount:1.5}])assert.equal((await notify(extra)).status,400);
  assert.equal(f.state(),before);
 }finally{await f.gateway.settle();}
});
test('sandbox paid and failed producers conserve source/components once and keep live refusal',async()=>{
 for(const paymentStatus of ['paid','failed']){
  const f=await fixture();try{
   const key=crypto.randomUUID(),body={store_id:f.site.siteId,plan_slug:'growth',billing_period:'monthly',idempotency_key:key,sandbox_payment_status:paymentStatus};
   const run=()=>f.headers().then(h=>f.gateway.request('/v1/billing/subscribe',{method:'POST',headers:h,body:JSON.stringify(body)}));
   const count=creates,a=await run();assert.equal(a.status,201,a.text);const source=JSON.parse(owned.psql(`SELECT to_jsonb(b) FROM billing_history b WHERE site_id='${f.site.siteId}' AND subscription_checkout_key='${key}';`));
   assert.equal(source.total_amount,source.amount);assert.equal(source.tax_amount,source.subscription_tax_snapshot.tax_minor);assert.equal(source.payment_status,paymentStatus);assert.equal(creates,count);
   const before=f.state(),b=await run();assert.equal(b.status,200,b.text);assert.equal(f.state(),before);
   f.env.LETBUYY_AUTOPAY_MODE='live';const live=await run();assert.equal(live.status,503);assert.equal(live.json?.error.code,'AUTOPAY_PROVIDER_SETUP_REQUIRED');assert.equal(f.state(),before);
   assert.doesNotMatch(JSON.stringify(a.json),/gstin|approval_reference|Synthetic Platform Supplier|subscription_tax_snapshot/);
  }finally{await f.gateway.settle();}
 }
});

test('configured recurring provider mismatch refuses before quote claim or provider POST with full financial conservation',async()=>{
 const configured='plan_SyntheticTaxInvalid',f=await fixture();
 const original=JSON.parse(owned.psql("SELECT jsonb_build_object('id',id,'price',price_monthly_inr,'provider',razorpay_plan_id_monthly) FROM plans WHERE site_type='store' AND slug='growth';"));
 const paused=owned.psql("SELECT paused FROM founding_merchant_program WHERE program_key='v1';").trim();
 try{
  owned.psql(`UPDATE founding_merchant_program SET paused=true WHERE program_key='v1';UPDATE plans SET razorpay_plan_id_monthly='${configured}' WHERE id='${original.id}';`);
  const base={amount:Number(original.price),currency:'INR',period:'monthly'},before=f.state(),posts=creates;
  for(const change of [{amount:Number(original.price)+1},{currency:'USD'},{period:'yearly'},{period:'month'},{period:'year'},{period:'weekly'},{period:'daily'},{interval:2},{active:false},{tax_rate:18},{tax_id:'tax_Synthetic'},{tax_group_id:'taxgroup_Synthetic'}]){
   nativePlans.set(configured,{...base,...change});const response=await f.checkout();
   assert.equal(response.status,503,response.text);assert.equal(response.json?.error.code,'SUBSCRIPTION_TAX_SETUP_REQUIRED');assert.equal(creates,posts);assert.equal(f.state(),before);
  }
 }finally{
  nativePlans.delete(configured);owned.psql(`UPDATE plans SET razorpay_plan_id_monthly=${original.provider===null?'NULL':"'"+String(original.provider).replaceAll("'","''")+"'"} WHERE id='${original.id}';UPDATE founding_merchant_program SET paused=${paused==='t'?'true':'false'} WHERE program_key='v1';`);await f.gateway.settle();
 }
});
test('two fixed native cycles retain distinct immutable invoice sources and late first-payment replay ignores current pointer/catalog/profile',async()=>{
 const configured='plan_SyntheticTaxFixed',f=await fixture();
 const original=JSON.parse(owned.psql("SELECT jsonb_build_object('id',id,'price',price_monthly_inr,'provider',razorpay_plan_id_monthly,'active',is_active) FROM plans WHERE site_type='store' AND slug='growth';"));
 const paused=owned.psql("SELECT paused FROM founding_merchant_program WHERE program_key='v1';");
 try{
  // Exercise the existing no-founding-offer branch without changing any price.
  // Both provider binding and program state are disposable fixture configuration.
  owned.psql(`UPDATE founding_merchant_program SET paused=true WHERE program_key='v1';UPDATE plans SET razorpay_plan_id_monthly='${configured}' WHERE id='${original.id}';`);
  nativePlans.set(configured,{amount:original.price,currency:'INR',period:'monthly'});
  const count=creates,checkout=await f.checkout();assert.equal(checkout.status,200,checkout.text);assert.equal(checkout.json?.data.checkout_mode,'razorpay_subscription');
  const reference=checkout.json?.data.razorpay_subscription_id;assert.ok(reference);assert.equal(checkout.json?.data.amount,original.price);
  let cycle=0;const make=()=>nativeCapture(reference,cycle++);
  const verifyNative=(pay:Payment)=>f.verify(pay,{razorpay_order_id:undefined,razorpay_subscription_id:reference,
   razorpay_signature:createHmac('sha256',secret).update(pay.id+'|'+reference).digest('hex')});
  const first=make(),firstReplies=await Promise.all([verifyNative(first),f.signedWebhook(first,undefined,reference)]);
  assert.deepEqual(firstReplies.map(x=>x.status).sort(),[200,201],firstReplies.map(x=>x.text).join(' '));const firstSource=financialOutcome(first.id);
  f.env.LETBUYY_SUBSCRIPTION_TAX_PROFILE='{}';owned.psql(`UPDATE plans SET price_monthly_inr=price_monthly_inr+100 WHERE id='${original.id}';`);
  const second=make(),secondReplies=await Promise.all([f.webhook(second,{providerOrderId:null,externalSubscriptionId:reference}),f.signedWebhook(second,undefined,reference)]);
  assert.deepEqual(secondReplies.map(x=>x.status),[200,200],secondReplies.map(x=>x.text).join(' '));
  const secondSource=financialOutcome(second.id);assert.notEqual(secondSource.invoice.id,firstSource.invoice.id);assert.equal(secondSource.invoice.total_amount,first.amount);
  assert.equal(secondSource.subscription.source,secondSource.invoice.id);assert.equal(firstSource.subscription.source,firstSource.invoice.id);
  const sync=(status:string,start=secondSource.subscription.start,end=secondSource.subscription.end)=>f.gateway.request('/v1/internal/billing/subscriptions/sync',{
   method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({externalSubscriptionId:reference,status,currentPeriodStart:new Date(start).toISOString(),currentPeriodEnd:new Date(end).toISOString()})});
  const pastDue=await sync('past_due');assert.equal(pastDue.status,200,pastDue.text);assert.equal(pastDue.json?.data.subscription.id,secondSource.subscription.id);
  assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE id='${secondSource.subscription.id}';`).trim(),'past_due');
  assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE id='${firstSource.subscription.id}';`).trim(),'cancelled');
  const beforeBadSync=f.state();const changedPeriod=await sync('active',secondSource.subscription.start,new Date(Date.parse(secondSource.subscription.end)+86400000).toISOString());
  assert.equal(changedPeriod.status,409,changedPeriod.text);assert.equal(f.state(),beforeBadSync);
  const invalidState=await sync('unknown');assert.equal(invalidState.status,400,invalidState.text);assert.equal(f.state(),beforeBadSync);
  const ownerBefore=JSON.parse(owned.psql(`SELECT jsonb_build_object('custom',custom_user_id,'user',user_id) FROM sites WHERE id='${f.site.siteId}';`));
  owned.psql(`UPDATE sites SET custom_user_id='${legacy.owner}',user_id=NULL WHERE id='${f.site.siteId}';`);
  try{const foreign=await sync('active');assert.equal(foreign.status,403,foreign.text);assert.equal(f.state(),beforeBadSync);}
  finally{owned.psql(`UPDATE sites SET custom_user_id='${ownerBefore.custom}',user_id=${ownerBefore.user===null?'NULL':"'"+ownerBefore.user+"'"} WHERE id='${f.site.siteId}';`);}
  const restored=await sync('active');assert.equal(restored.status,200,restored.text);assert.equal(restored.json?.data.subscription.id,secondSource.subscription.id);
  assert.deepEqual(financialOutcome(first.id).invoice,firstSource.invoice);assert.deepEqual(financialOutcome(first.id).documents,firstSource.documents);
  owned.psql(`UPDATE plans SET is_active=false WHERE id='${original.id}';`);
  const old=await verifyNative(first);assert.equal(old.status,201,old.text);assert.equal(old.json?.data.subscription.id,firstSource.subscription.id);
  const oldInternal=await f.webhook(first,{providerOrderId:null,externalSubscriptionId:reference});assert.equal(oldInternal.status,200,oldInternal.text);
  const notification=await f.gateway.request('/v1/internal/billing/subscriptions/invoice',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({
   externalSubscriptionId:reference,provider:'razorpay',amount:first.amount,currency:'INR',taxAmount:firstSource.invoice.tax_amount,totalAmount:first.amount,paymentId:first.id,paymentStatus:'paid'})});
  assert.equal(notification.status,200,notification.text);assert.equal(notification.json?.data.invoice.id,firstSource.invoice.id);
  assert.deepEqual(financialOutcome(first.id).invoice,firstSource.invoice);assert.deepEqual(financialOutcome(first.id).documents,firstSource.documents);assert.deepEqual(financialOutcome(second.id),secondSource);assert.equal(creates-count,1);
 }finally{
  owned.psql(`UPDATE plans SET price_monthly_inr=${original.price},razorpay_plan_id_monthly=${original.provider===null?'NULL':"'"+String(original.provider).replaceAll("'","''")+"'"},is_active=${original.active?'true':'false'} WHERE id='${original.id}';UPDATE founding_merchant_program SET paused=${paused==='t'?'true':'false'} WHERE program_key='v1';`);
  nativePlans.delete(configured);await f.gateway.settle();
 }
});
test('approved native upfront and later base invoices conserve their own gross across signed first events, renewal and retained replay',async()=>{
 const configured='plan_SyntheticTaxUpfront',f=await fixture();
 const original=JSON.parse(owned.psql("SELECT jsonb_build_object('id',id,'price',price_monthly_inr,'provider',razorpay_plan_id_monthly,'active',is_active) FROM plans WHERE site_type='store' AND slug='growth';"));
 const paused=owned.psql("SELECT paused FROM founding_merchant_program WHERE program_key='v1';");
 try{
  owned.psql(`UPDATE founding_merchant_program SET paused=true WHERE program_key='v1';UPDATE plans SET razorpay_plan_id_monthly='${configured}' WHERE id='${original.id}';`);
  nativePlans.set(configured,{amount:original.price,currency:'INR',period:'monthly'});
  const posts=creates,checkout=await f.checkout(crypto.randomUUID(),{approved_usage_charges:[{meter_name:'synthetic-meter',description:'Synthetic approved upfront',amount_minor:2000,quantity:1,idempotency_key:'synthetic-upfront-once'}]});
  assert.equal(checkout.status,200,checkout.text);const reference=checkout.json?.data.razorpay_subscription_id;assert.ok(reference);assert.equal(checkout.json?.data.amount,Number(original.price)+2000);
  const initial=nativeCapture(reference,0,true),base=nativeCapture(reference,1,false);
  const verify=(pay:Payment)=>f.verify(pay,{razorpay_order_id:undefined,razorpay_subscription_id:reference,razorpay_signature:createHmac('sha256',secret).update(pay.id+'|'+reference).digest('hex')});
  const financialBefore=f.state(),invoice=nativeInvoices.get(initial.invoice_id!)!,status=invoice.status;invoice.status='unpaid';
  try{const refused=await verify(initial);assert.equal(refused.status,409,refused.text);assert.equal(f.state(),financialBefore);}finally{invoice.status=status;}
  const first=await Promise.all([verify(initial),f.signedWebhook(initial,undefined,reference,'subscription.authenticated'),f.signedWebhook(initial,undefined,reference)]);
  assert.deepEqual(first.map(x=>x.status),[201,200,200],first.map(x=>x.text).join(' '));const a=financialOutcome(initial.id);
  assert.equal(a.invoice.amount,initial.amount);assert.equal(a.invoice.total_amount,initial.amount);assert.equal(a.documents.length,1);assert.equal(a.documents[0].total_minor,initial.amount);assert.equal(a.activations,1);
  assert.equal(a.invoice.subscription_tax_snapshot.gross_minor,initial.amount);assert.equal(a.invoice.subscription_tax_snapshot.taxable_minor+a.invoice.subscription_tax_snapshot.tax_minor,initial.amount);
  assert.equal(a.documents[0].metadata.provider_invoice.phase,'initial_with_upfront');
  f.env.LETBUYY_SUBSCRIPTION_TAX_PROFILE='{}';owned.psql(`UPDATE plans SET price_monthly_inr=price_monthly_inr+111 WHERE id='${original.id}';`);
  const second=await Promise.all([verify(base),f.webhook(base,{providerOrderId:null,externalSubscriptionId:reference}),f.signedWebhook(base,undefined,reference)]);
  assert.deepEqual(second.map(x=>x.status),[201,200,200],second.map(x=>x.text).join(' '));const b=financialOutcome(base.id);
  assert.equal(b.invoice.total_amount,Number(original.price));assert.equal(b.documents[0].total_minor,Number(original.price));assert.equal(b.documents[0].metadata.provider_invoice.phase,'base_cycle');
  assert.notEqual(a.invoice.id,b.invoice.id);assert.equal(a.invoice.subscription_tax_source_id,b.invoice.subscription_tax_source_id);assert.equal(b.activations,1);assert.equal(creates-posts,1);
  const originalAfter=financialOutcome(initial.id),native=nativeSubscriptions.get(reference)!;Object.assign(native,{current_start:1893456000,current_end:1896134400,paid_count:40});
  const reads=nativeReads.length;assert.equal((await verify(initial)).status,201);assert.equal(nativeReads.length,reads,'durable paid invoice replay makes zero provider reads');assert.deepEqual(financialOutcome(initial.id),originalAfter);assert.deepEqual(financialOutcome(base.id),b);
  const noProof=JSON.parse(owned.psql(`SELECT public.activate_merchant_subscription_v1(jsonb_build_object('user_id','${f.owner}','store_id','${f.site.siteId}','plan_id','${original.id}','plan_slug','growth','billing_period','monthly',
   'amount_paid',${initial.amount},'payment_gateway','razorpay','external_subscription_id','${reference}','razorpay_order_id','${initial.order_id}','razorpay_payment_id','${initial.id}',
   'period_start','${a.subscription.start}','period_end','${a.subscription.end}','tax_amount',${a.invoice.tax_amount},'total_amount',${initial.amount},'subscription_tax_source_id','${a.invoice.subscription_tax_source_id}'));`));
  assert.equal(noProof.accepted,false);assert.equal(noProof.code,'SUBSCRIPTION_CONTEXT_INVALID');assert.deepEqual(financialOutcome(initial.id),originalAfter);assert.deepEqual(financialOutcome(base.id),b);
 }finally{nativePlans.delete(configured);owned.psql(`UPDATE plans SET price_monthly_inr=${original.price},is_active=${original.active?'true':'false'},razorpay_plan_id_monthly=${original.provider===null?'NULL':"'"+String(original.provider).replaceAll("'","''")+"'"} WHERE id='${original.id}';UPDATE founding_merchant_program SET paused=${paused==='t'?'true':'false'} WHERE program_key='v1';`);await f.gateway.settle();}
});
test('history API and raw roles preserve legacy values while hiding new private party sources',async()=>{
 const f=legacy;const before=owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`),r=await f.gateway.request('/v1/payments/subscription/history?store_id='+f.site.siteId,{headers:await f.headers()});
 assert.equal(r.status,200);const row=r.json?.data.find((x:{id:string})=>x.id===legacyId);assert.ok(row);assert.equal(Number(row.total_amount),82482);assert.equal(Number(row.tax_amount),12582);assert.equal(before,legacyBefore);
 assert.doesNotMatch(r.text,/gstin|approval_reference|Synthetic Platform Supplier|subscription_tax_snapshot/);
 for(const role of ['anon','authenticated','app_tenant']){
  const out=owned.psql(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('app.site_id','${f.site.siteId}',true);SELECT count(*) FROM billing_history WHERE site_id='${f.site.siteId}' AND subscription_tax_snapshot IS NOT NULL;ROLLBACK;`);
  assert.match(out,/\n0\n/);
 }
});
test('new tax financial rows and populated retirement reject direct changes without clearing evidence',async()=>{
 const f=legacy;const pending=await f.checkout();assert.equal(pending.status,200,pending.text);
 const pendingId=owned.psql(`SELECT id FROM billing_history WHERE subscription_checkout_reference='${pending.json?.data.razorpay_order_id}';`).trim();assert.match(pendingId,/^[0-9a-f-]{36}$/);
 const before=f.state();
 assert.match(owned.psqlExpectError(`UPDATE billing_history SET tax_amount=tax_amount+1 WHERE id='${legacyId}';`),/legacy subscription financial source is immutable/);
 assert.match(owned.psqlExpectError(`UPDATE subscriptions SET amount_paid=amount_paid+1 WHERE id=(SELECT subscription_id FROM billing_history WHERE id='${legacyId}');`),/legacy subscription financial source is immutable/);
 assert.equal(owned.psql(`SELECT to_jsonb(b)-'subscription_tax_snapshot'-'subscription_tax_source_id' FROM billing_history b WHERE id='${legacyId}';`),legacyBefore);
 for(const mutation of ["subscription_tax_snapshot#-'{source,gross_before_discount_minor}'", "jsonb_set(subscription_tax_snapshot,'{recipient,gstin}','\"29INVALID\"'::jsonb)", "jsonb_set(subscription_tax_snapshot,'{profile,schema_version}','2'::jsonb)"]){
  assert.equal(owned.psql(`SELECT public.valid_subscription_tax_snapshot_360(${mutation}) FROM billing_history WHERE site_id='${f.site.siteId}' AND subscription_tax_snapshot IS NOT NULL LIMIT 1;`).trim(),'f');
 }
 assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL letbuyy.subscription_tax_writer='activate_merchant_subscription_v1:360';UPDATE billing_history SET amount=amount+1,total_amount=total_amount+1 WHERE id='${pendingId}';ROLLBACK;`),/quote money and source identity are immutable/);
 assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL letbuyy.subscription_tax_writer='activate_merchant_subscription_v1:360';UPDATE subscriptions SET amount_paid=amount_paid+1 WHERE store_id='${f.site.siteId}' AND subscription_tax_snapshot IS NOT NULL;ROLLBACK;`),/financial fields must equal their immutable paid invoice source/);
 const issuedId=owned.psql(`SELECT b.id FROM billing_history b WHERE b.site_id='${f.site.siteId}' AND b.subscription_tax_snapshot IS NOT NULL AND b.payment_status='paid' ORDER BY b.id LIMIT 1;`).trim();
 const documentBefore=owned.psql(`SELECT to_jsonb(i) FROM merchant_billing_invoices i WHERE billing_history_id='${issuedId}';`);
 owned.psql(`SELECT public.issue_subscription_tax_invoice_360('${issuedId}');`);
 assert.equal(owned.psql(`SELECT to_jsonb(i) FROM merchant_billing_invoices i WHERE billing_history_id='${issuedId}';`),documentBefore);
 for(const mutation of ["i.period_start+interval '1 day',i.period_end,i.status,i.metadata", "i.period_start,i.period_end+interval '1 day',i.status,i.metadata", "i.period_start,i.period_end,'payment_failed',i.metadata", `i.period_start,i.period_end,i.status,jsonb_set(i.metadata,'{source_id}',to_jsonb('${randomUUID()}'::text))`, "i.period_start,i.period_end,i.status,jsonb_set(i.metadata,'{basis}','\"exclusive\"'::jsonb)"]){
  assert.match(owned.psqlExpectError(`INSERT INTO merchant_billing_invoices(site_id,subscription_id,billing_history_id,invoice_number,currency,subtotal_minor,cgst_minor,sgst_minor,igst_minor,total_minor,period_start,period_end,status,metadata,created_by,updated_by)
   SELECT i.site_id,i.subscription_id,i.billing_history_id,i.invoice_number,i.currency,i.subtotal_minor,i.cgst_minor,i.sgst_minor,i.igst_minor,i.total_minor,${mutation},i.created_by,i.updated_by FROM merchant_billing_invoices i WHERE i.billing_history_id='${issuedId}';`),/subscription tax invoice differs from canonical source/);
 }
 assert.match(owned.psqlExpectError(`UPDATE billing_history SET total_amount=total_amount+1 WHERE site_id='${f.site.siteId}' AND subscription_tax_snapshot IS NOT NULL;`),/immutable|canonical writer/);
 assert.match(owned.psqlExpectError(`BEGIN;SET ROLE service_role;INSERT INTO subscriptions(user_id,store_id,site_id,plan,status,billing_period,amount_paid) VALUES('${f.owner}','${f.site.siteId}','${f.site.siteId}','growth','active','monthly',69900);ROLLBACK;`),/canonical activation writer/);
 assert.match(owned.psqlScriptExpectError(migration('rollback')),/refuses retained tax evidence/);assert.equal(f.state(),before);
});
