// Proposed owned-only proof. Not published or executed until coordinator scope/lane review.
// Existing persisted override semantics only: no expiry/grace/price policy is inferred.
import assert from 'node:assert/strict';
import test, {before, after} from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,restJson} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';
const owned=requireOwnedDatabase();
let tenantSequence=0;
let sqlProxy:OwnedPooledSqlProxy;
let outerFetch:typeof fetch;
const external:string[]=[];
before(async()=>{
 sqlProxy=await startOwnedPooledSqlProxy(owned);
 outerFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
   external.push(url.hostname);throw new Error('Owned entitlement proof forbids external/provider transport');
  }
  return outerFetch(input,init);
 }) as typeof fetch;
});
after(async()=>{globalThis.fetch=outerFetch;await closePooledSqlClients();await sqlProxy?.stop();assert.deepEqual(external,[]);});
async function fixture(history=false){
 const owner=crypto.randomUUID(),email='syn-entitlement-'+owner+'@example.invalid',site=newSyntheticTenant('ent-authority-'+(++tenantSequence));
 owned.psql("INSERT INTO users_custom(id,email,email_verified) VALUES('"+owner+"','"+email+"',true);");
 seedSyntheticTenant(owned.psql,site);
 owned.psql("UPDATE sites SET custom_user_id='"+owner+"' WHERE id='"+site.siteId+"';");
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),sqlProxy.env()));
 const past=history?seedSyntheticOrder(owned.psql,site):null;
 const headers=()=>signedIdentityHeaders(owner,email);
 const create=(key=crypto.randomUUID())=>headers().then(h=>gateway.request('/v1/products',{method:'POST',
  headers:{...h,'X-Idempotency-Key':key},body:JSON.stringify({store_id:site.siteId,name:'Synthetic Restricted Product',price:199,stock:0,is_active:false})}));
 const restrict=()=>owned.psql("INSERT INTO site_entitlement_overrides(site_id,limits,reason) VALUES('"+site.siteId+"','{\"products\":0,\"orders_monthly\":0}'::jsonb,'Synthetic existing explicit creation restriction');");
 const state=()=>JSON.parse(owned.psql("SELECT jsonb_build_object('products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM products p WHERE store_id='"+site.siteId+"'),'inventory',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM inventory_levels i WHERE store_id='"+site.siteId+"'),'meters',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM site_usage_meters m WHERE site_id='"+site.siteId+"'),'usage',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM usage_meter_entries u WHERE site_id='"+site.siteId+"'),'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM orders o WHERE store_id='"+site.siteId+"'),'invoices',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM billing_history b WHERE site_id='"+site.siteId+"'));"));
 return {owner,email,site,gateway,past,headers,create,restrict,state};
}
test('persisted zero-product restriction denies new creation before any product effect',async()=>{
 const f=await fixture(true);try{
  f.restrict();const before=f.state();
  assert.equal(JSON.parse(owned.psql("SELECT resolve_site_entitlements('"+f.site.siteId+"');")).limits.products,0);
  const r=await f.create();assert.equal(r.status,403);assert.deepEqual(f.state(),before);
 }finally{await f.gateway.settle();}
});
test('named entitlement RPC unavailability cannot replace persisted denial with a fallback grant',async()=>{
 const f=await fixture(true);let faults=0;f.restrict();const before=f.state();
 const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(call.resource==='rpc/resolve_site_entitlements'){faults++;return restJson(503,{code:'PGRST202',message:'Could not find the function public.resolve_site_entitlements in the schema cache'});}
  return forward();
 });
 try{
  const r=await f.create();
  console.info('N2_ENTITLEMENT_FAULT '+JSON.stringify({status:r.status,faults,productCountBefore:before.products?.length||0,productCountAfter:f.state().products?.length||0}));
  assert.ok(faults>0,'real Gateway resolver reached named fault');
  assert.equal(r.status,503,'unresolved creation authority is unavailable, not a static free-tier grant');
  assert.deepEqual(f.state(),before,'fault cannot create product/inventory/usage effects');
 }finally{await f.gateway.settle();tap.restore();}
});
test('owned historical order and canonical invoice remain accessible under restriction and resolver outage',async()=>{
 const f=await fixture(true);
 try{
  owned.psql("INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,requires_contact,trial_days,status,purchasable) VALUES('store','free','Synthetic Internal Free Fallback',0,0,25,true,false,0,'available',true) ON CONFLICT(site_type,slug) DO NOTHING;");
  const activated=await f.gateway.request('/v1/payments/subscription/order',{method:'POST',headers:{...await f.headers(),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:f.site.siteId,plan_slug:'free',billing_period:'monthly',site_type:'store'})});
  assert.equal(activated.status,201);f.restrict();const before=f.state();assert.equal(before.invoices.length,1);assert.ok(f.past);
  for(const unavailable of [false,true]){
   const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>unavailable&&call.resource==='rpc/resolve_site_entitlements'?restJson(503,{code:'PGRST202',message:'Could not find the function public.resolve_site_entitlements in the schema cache'}):forward());
   try{
    assert.equal((await f.gateway.request('/v1/orders/'+f.past.orderId,{headers:await f.headers()})).status,200);
    const invoices=await f.gateway.request('/v1/payments/subscription/history?store_id='+f.site.siteId,{headers:await f.headers()});
    assert.equal(invoices.status,200);assert.match(invoices.text,new RegExp(before.invoices[0].id));
    assert.deepEqual(f.state(),before,'historical reads retain original obligation rows');
   }finally{await f.gateway.settle();tap.restore();}
  }
 }finally{await f.gateway.settle();}
});
test('cached product-creation result cannot bypass current owner revocation',async()=>{
 const f=await fixture();try{
  const key=crypto.randomUUID(),first=await f.create(key);assert.equal(first.status,201);const before=f.state();
  owned.psql("UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='"+f.site.siteId+"';");
  const replay=await f.create(key);
  console.info('N2_ENTITLEMENT_REPLAY_OWNER '+JSON.stringify({firstStatus:first.status,replayStatus:replay.status}));
  assert.equal(replay.status,403,'mutation replay rechecks current principal authority');
  assert.deepEqual(f.state(),before,'revoked replay makes no new effects');
 }finally{await f.gateway.settle();}
});


test('owned historical return and refund remain readable under restriction and unavailable entitlement authority',async()=>{
 const f=await fixture(),other=await fixture(),order=crypto.randomUUID(),ret=crypto.randomUUID(),refund=crypto.randomUUID();
 owned.psql("INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total,payment_status) VALUES('"+order+"','"+f.site.siteId+"','"+f.site.siteId+"','SYN-ENT-RETURN-"+order+"','syn-ent-buyer-"+order+"@example.invalid','{}','[]',100,100,'paid'); INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key) VALUES('"+ret+"','"+f.site.siteId+"','"+order+"','received','manual','syn-ret-"+ret+"'); INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key) VALUES('"+refund+"','"+f.site.siteId+"','"+order+"','"+ret+"',100,'pending','manual','bank_transfer','syn-refund-"+refund+"');");
 f.restrict();
 const snapshot=()=>owned.psql("SELECT jsonb_build_object('order',(SELECT to_jsonb(o) FROM orders o WHERE id='"+order+"'),'return',(SELECT to_jsonb(r) FROM returns r WHERE id='"+ret+"'),'refund',(SELECT to_jsonb(x) FROM refunds x WHERE id='"+refund+"'));");
 const before=snapshot();
 try{
  for(const unavailable of [false,true]){
   const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>unavailable&&call.resource==='rpc/resolve_site_entitlements'?restJson(503,{code:'PGRST202',message:'Could not find public.resolve_site_entitlements in the schema cache'}):forward());
   try{
    const read=await f.gateway.request('/v1/returns/'+ret,{headers:await signedIdentityHeaders(f.owner,f.email,f.site.siteId)});
    assert.equal(read.status,200);assert.match(read.text,new RegExp(refund));assert.match(read.text,/pending/);
    const denied=await f.gateway.request('/v1/returns/'+ret,{headers:await signedIdentityHeaders(other.owner,other.email,other.site.siteId)});
    assert.ok([403,404].includes(denied.status));assert.doesNotMatch(denied.text,new RegExp(refund));assert.equal(snapshot(),before);
   }finally{await f.gateway.settle();tap.restore();}
  }
 }finally{await f.gateway.settle();await other.gateway.settle();}
});
function historicalStatement(f:Awaited<ReturnType<typeof fixture>>){
 const order=seedSyntheticOrder(owned.psql,f.site),payment=crypto.randomUUID(),reference='syn-ent-capture-'+payment;
 const amount=Number(owned.psql("SELECT round(total*100)::bigint FROM orders WHERE id='"+order.orderId+"';"));
 owned.psql("UPDATE orders SET payment_status='paid' WHERE id='"+order.orderId+"'; INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key) VALUES('"+payment+"','"+f.site.siteId+"','"+order.orderId+"','razorpay','sandbox','captured',"+amount+",'INR','"+reference+"','syn-ent-capture-"+payment+"'); SET ROLE service_role; SELECT post_settlement_ledger_transaction('"+f.site.siteId+"','payment_capture','"+reference+"','capture:"+reference+"','[{\"account_code\":\"pa_clearing\",\"side\":\"debit\",\"amount_minor\":"+amount+"},{\"account_code\":\"merchant_payable\",\"side\":\"credit\",\"amount_minor\":"+amount+"}]','{\"compatibility_table\":\"payments\",\"payment_id\":\""+payment+"\",\"order_id\":\""+order.orderId+"\",\"provider_payment_id\":\""+reference+"\"}',NULL); RESET ROLE;");
 const number='SYN-ENT-STATEMENT-'+crypto.randomUUID(),quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
 const metadata=JSON.stringify({source_order_ids:[order.orderId],source_order_numbers:[owned.psql("SELECT order_number FROM orders WHERE id='"+order.orderId+"';")],commission_bps:0,gst_bps:0,synthetic_fixture:true});
 const id=owned.psql("SET ROLE service_role; SELECT create_payout_statement_with_effects('"+f.site.siteId+"',"+quote(number)+",'razorpay_route','sandbox','razorpay_route',"+amount+",0,0,"+amount+",NULL,NULL,CURRENT_DATE,'syn-ent-statement-"+crypto.randomUUID()+"',ARRAY['"+order.orderId+"'::uuid],NULL,"+quote(metadata)+"::jsonb,'"+f.owner+"'); RESET ROLE;").split('\n').find(x=>/^[0-9a-f-]{36}$/.test(x));
 assert.ok(id);return {id,number,amount};
}
test('historical statement and account obligations keep their existing financial guards under entitlement restriction/outage',async()=>{
 const f=await fixture(),other=await fixture(),statement=historicalStatement(f);f.restrict();
 const snapshot=()=>owned.psql("SELECT jsonb_build_object('statement',(SELECT to_jsonb(p) FROM payout_statements p WHERE id='"+statement.id+"'),'wallet',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM wallet_ledger_entries w WHERE site_id='"+f.site.siteId+"'),'ledger',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM ledger_entries l WHERE site_id='"+f.site.siteId+"'));");
 const before=snapshot(),headers=()=>signedIdentityHeaders(f.owner,f.email,f.site.siteId);
 try{
  const walletBaseline=await f.gateway.request('/v1/wallet?store_id='+f.site.siteId,{headers:await headers()});
  assert.ok(walletBaseline.status===200||(walletBaseline.status===409&&walletBaseline.json?.error?.code==='LEDGER_RECONCILIATION_REQUIRED'),'existing financial readiness guard is required; no entitlement error accepted as baseline');
  for(const unavailable of [false,true]){
   const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>unavailable&&call.resource==='rpc/resolve_site_entitlements'?restJson(503,{code:'PGRST202',message:'Could not find public.resolve_site_entitlements in the schema cache'}):forward());
   try{
    const list=await f.gateway.request('/v1/payouts?store_id='+f.site.siteId,{headers:await headers()});assert.equal(list.status,200);assert.match(list.text,new RegExp(statement.id));
    const detail=await f.gateway.request('/v1/payouts/'+statement.id,{headers:await headers()});assert.equal(detail.status,200);assert.match(detail.text,new RegExp(statement.number));
    const wallet=await f.gateway.request('/v1/wallet?store_id='+f.site.siteId,{headers:await headers()});assert.equal(wallet.status,walletBaseline.status);
    if(wallet.status===409)assert.equal(wallet.json?.error?.code,'LEDGER_RECONCILIATION_REQUIRED');
    const denied=await f.gateway.request('/v1/payouts/'+statement.id,{headers:await signedIdentityHeaders(other.owner,other.email,other.site.siteId)});
    assert.ok([403,404].includes(denied.status));assert.doesNotMatch(denied.text,new RegExp(statement.number));assert.equal(snapshot(),before);
   }finally{await f.gateway.settle();tap.restore();}
  }
 }finally{await f.gateway.settle();await other.gateway.settle();}
});

