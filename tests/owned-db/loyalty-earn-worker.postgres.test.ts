// Real scheduled earning implementation against owned PostgreSQL/PostgREST.
// Paid orders and ownership links are synthetic worker input, not payment,
// checkout, normal merchant configuration, provider or device acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {runLoyaltyEarnSweeper} from '../../services/queue-workers/src/loyalty-earn';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {seedBuyerAccount,tapRest,restJson,newBarrier} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {createSupabaseServiceClient} from '@letbuyy/infrastructure/supabase-adapter';
import {readFileSync} from 'node:fs';

const owned=requireOwnedDatabase();
function fixture(tag:string){
 const site=newSyntheticTenant(tag.slice(0,12)+'-'+crypto.randomUUID().slice(0,6));seedSyntheticTenant(owned.psql,site);
 const a=seedBuyerAccount(owned.psql,tag.slice(0,15)+'-a'),b=seedBuyerAccount(owned.psql,tag.slice(0,15)+'-b');
 owned.psql(`SELECT public.set_loyalty_program('${site.siteId}',p_is_active=>true,p_earn_rate_bps=>1000,p_actor_type=>'system');`);
 const paid=(buyer:string,age:number,options:{total?:number;linked?:boolean}={})=>{
  const id=crypto.randomUUID();
  owned.psql(`INSERT INTO public.orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total,payment_status,created_at)
   VALUES('${id}','${site.siteId}','${site.siteId}','SYN-LOY-${id}','syn-loyalty-${id}@example.invalid','{}','[]',${options.total??1000},${options.total??1000},'paid',now()-interval '${age} minutes');
   ${options.linked===false?'':`INSERT INTO public.buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${id}','${buyer}','${site.siteId}','authenticated_checkout');`}`);
  return id;
 };
 const count=(id:string)=>Number(owned.psql(`SELECT count(*) FROM public.loyalty_ledger_entries WHERE site_id='${site.siteId}' AND order_id='${id}' AND entry_type='earned';`));
 const pause=()=>owned.psql(`SELECT public.set_loyalty_program('${site.siteId}',p_is_active=>false,p_actor_type=>'system');`);
 return {site,a,b,paid,count,pause};
}
test('the real earning worker awards a paid order to its explicit buyer once and preserves its value snapshot',async()=>{
 const f=fixture('loyalty-worker-positive');const order=f.paid(f.a.id,2);
 try{
  const first=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-positive-'+crypto.randomUUID(),limit:1});
  assert.equal(first.awarded,1);assert.equal(f.count(order),1);
  assert.equal(owned.psql(`SELECT (metadata->>'point_value_minor')||'|'||(metadata->>'value_minor') FROM loyalty_ledger_entries WHERE order_id='${order}' AND entry_type='earned';`),'100|10000');
  await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-retry-'+crypto.randomUUID(),limit:1});
  assert.equal(f.count(order),1,'retry cannot award a second entry');
 }finally{f.pause();}
});

test('unowned, below-minimum and frozen-account candidates do not occupy the earning window',async()=>{
 for(const kind of ['unowned','minimum','frozen'] as const){
  const f=fixture('loyalty-eligible-'+kind),eligible=f.paid(f.a.id,2);
  const blocked=f.paid(f.b.id,1,{linked:kind!=='unowned',total:kind==='minimum'?0.01:1000});
  if(kind==='frozen')owned.psql(`INSERT INTO loyalty_accounts(site_id,buyer_account_id,status)VALUES('${f.site.siteId}','${f.b.id}','frozen');`);
  try{
   const result=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-eligible-'+crypto.randomUUID(),limit:1});
   assert.equal(result.awarded,1);assert.equal(f.count(eligible),1);assert.equal(f.count(blocked),0);
   if(kind==='frozen'){
    owned.psql(`UPDATE loyalty_accounts SET status='active' WHERE site_id='${f.site.siteId}' AND buyer_account_id='${f.b.id}';`);
    const resumed=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-unfreeze-'+crypto.randomUUID(),limit:1});
    assert.equal(resumed.awarded,1);assert.equal(f.count(blocked),1);
   }
  }finally{f.pause();}
 }
});

test('two real workers racing the same pending order post exactly one immutable credit',async()=>{
 const f=fixture('loyalty-race'),order=f.paid(f.a.id,1),barrier=newBarrier(2);
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(call.method==='POST'&&call.resource==='rpc/award_loyalty_points')await barrier.arrive();
  return forward();
 });
 try{
  const results=await Promise.all([1,2].map(n=>runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-race-'+n,limit:1})));
  assert.equal(results.reduce((sum,result)=>sum+result.awarded,0),1);assert.equal(f.count(order),1);
  assert.equal(owned.psql(`SELECT public.loyalty_balance(id) FROM loyalty_accounts WHERE site_id='${f.site.siteId}' AND buyer_account_id='${f.a.id}';`),'100');
 }finally{tap.restore();f.pause();}
});

test('the RPC fences an owner change after the worker read and the next sweep credits the current owner',async()=>{
 const f=fixture('loyalty-owner-race'),order=f.paid(f.a.id,1);let changed=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  const response=await forward();
  if(!changed&&call.method==='GET'&&call.resource==='buyer_order_links'){
   changed=true;owned.psql(`UPDATE buyer_order_links SET buyer_account_id='${f.b.id}',link_basis='operator_resolution' WHERE order_id='${order}';`);
  }
  return response;
 });
 try{
  const denied=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-stale-owner',limit:1});
  assert.ok(changed);assert.equal(denied.failed,1);assert.equal(f.count(order),0);
  tap.restore();
  const recovered=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-current-owner',limit:1});
  assert.equal(recovered.awarded,1);assert.equal(f.count(order),1);
  assert.equal(owned.psql(`SELECT a.buyer_account_id::text FROM loyalty_accounts a JOIN loyalty_ledger_entries l ON l.loyalty_account_id=a.id WHERE l.order_id='${order}';`),f.b.id);
 }finally{tap.restore();f.pause();}
});

test('pre-write failure retries, and a lost committed response cannot post twice',async()=>{
 for(const when of ['before','after'] as const){
  const f=fixture('loyalty-response-'+when),order=f.paid(f.a.id,1);let failed=false;
  const tap=tapRest(owned.restUrl,async(call,forward)=>{
   if(!failed&&call.method==='POST'&&call.resource==='rpc/award_loyalty_points'){
    failed=true;if(when==='after')assert.equal((await forward()).status,200);
    return restJson(503,{message:'synthetic-owned-earning-response-loss'});
   }
   return forward();
  });
  try{
   const first=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-loss-'+when,limit:1});
   assert.ok(failed);assert.equal(first.failed,1);assert.equal(f.count(order),when==='after'?1:0);
   tap.restore();
   const recovered=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-recover-'+when,limit:1});
   assert.equal(recovered.awarded,when==='after'?0:1);assert.equal(f.count(order),1);
  }finally{tap.restore();f.pause();}
 }
});

test('selection failure or malformed discovery never masquerades as no pending work',async()=>{
 for(const kind of ['unavailable','malformed'] as const){
  const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/pending_loyalty_earn_orders_v1'
   ?restJson(kind==='unavailable'?503:200,kind==='unavailable'?{message:'synthetic-discovery-outage'}:null):forward());
  try{await assert.rejects(runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-discovery-'+kind,limit:1}));}
  finally{tap.restore();}
 }
});

test('private earning discovery/calculation and posting are unavailable to browser and tenant roles',()=>{
 for(const role of ['anon','authenticated','app_tenant']){
  for(const signature of ['public.pending_loyalty_earn_orders_v1(integer)','public.loyalty_points_for_order_total_v1(numeric,integer)','public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)']){
   assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
  }
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT * FROM public.pending_loyalty_earn_orders_v1(1);`),/permission denied/);
 }
 assert.equal(owned.psql("SELECT has_function_privilege('service_role','public.pending_loyalty_earn_orders_v1(integer)','EXECUTE');"),'t');
 assert.match(owned.psqlExpectError('SET ROLE service_role;SELECT * FROM public.pending_loyalty_earn_orders_v1(0);'),/between 1 and 500/);
});

test('333 rollback refuses ABI drift and paired reapply preserves retained entries, definitions and grants',()=>{
 const forward=readFileSync('database/supabase/migrations/333_loyalty_pending_earn_authority.sql','utf8');
 const rollback=readFileSync('database/supabase/rollback/333_loyalty_pending_earn_authority.rollback.sql','utf8');
 const state=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',p.proowner::regrole::text)ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('award_loyalty_points','pending_loyalty_earn_orders_v1','loyalty_points_for_order_total_v1');`);
 const head=state(),entries=owned.psql('SELECT count(*) FROM loyalty_ledger_entries;');
 // Reverse the newer dependent migration before exercising333 at its own point.
 const newer=owned.psql("SELECT to_regprocedure('public.mutate_loyalty_program_v1(uuid,uuid,jsonb,text,timestamptz,text)') IS NOT NULL;")==='t';
 if(newer)owned.script(readFileSync('database/supabase/rollback/334_loyalty_program_authority.rollback.sql','utf8'));
 const before=state();
 const body=rollback.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
 const error=owned.psqlExpectError(`BEGIN;CREATE FUNCTION public.award_loyalty_points(synthetic_arg integer)RETURNS integer LANGUAGE sql AS $$SELECT 1$$;${body}COMMIT;`);
 assert.match(error,/rollback 333 refuses to run/);assert.equal(state(),before);
 owned.psql(rollback);assert.equal(owned.psql("SELECT to_regprocedure('public.pending_loyalty_earn_orders_v1(integer)') IS NULL;"),'t');
 assert.equal(owned.psql('SELECT count(*) FROM loyalty_ledger_entries;'),entries);
 owned.psql(forward);assert.equal(state(),before);assert.equal(owned.psql('SELECT count(*) FROM loyalty_ledger_entries;'),entries);
 assert.equal(owned.psql("SELECT has_function_privilege('anon','public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)','EXECUTE');"),'f');
 if(newer)owned.script(readFileSync('database/supabase/migrations/334_loyalty_program_authority.sql','utf8'));
 assert.equal(state(),head,'historical recovery must restore the latest dependent authority');
});
test('the canonical award RPC rejects a buyer who does not own the paid order',async()=>{
 const f=fixture('loyalty-wrong-owner');const order=f.paid(f.a.id,2);
 try{
  const result=await createSupabaseServiceClient(owned.restEnv()).rpc('award_loyalty_points',{
   p_site_id:f.site.siteId,p_buyer_account_id:f.b.id,p_order_id:order,p_idempotency_key:`loyalty.earn:${order}`,
  });
  assert.ok(result.error,`a stale or wrong worker subject must not receive the award: ${JSON.stringify(result.data)}`);
  assert.equal(f.count(order),0);
 }finally{f.pause();}
});
test('an earning retry cannot reuse a receipt for another buyer or order',async()=>{
 const f=fixture('loyalty-receipt');const a=f.paid(f.a.id,2),b=f.paid(f.b.id,1),db=createSupabaseServiceClient(owned.restEnv());
 try{
  const input={p_site_id:f.site.siteId,p_buyer_account_id:f.a.id,p_order_id:a,p_idempotency_key:`loyalty.earn:${a}`};
  const first=await db.rpc('award_loyalty_points',input);assert.equal(first.error,null);assert.equal(first.data.awarded,true);
  const retry=await db.rpc('award_loyalty_points',input);assert.equal(retry.error,null);assert.equal(retry.data.replayed,true);
  const alternate=await db.rpc('award_loyalty_points',{...input,p_idempotency_key:`loyalty.earn:${a}:different-key`});
  assert.equal(alternate.error,null);
  const earnedCount=f.count(a);
  const conflict=await db.rpc('award_loyalty_points',{...input,p_buyer_account_id:f.b.id,p_order_id:b});
  assert.equal(earnedCount,1,'changing the key cannot earn the same paid order again');
  assert.ok(conflict.error,'same receipt with different owner/order must be denied');assert.equal(f.count(a),1);assert.equal(f.count(b),0);
 }finally{f.pause();}
});
test('a completed newest order cannot hide an older buyer still owed points at the batch boundary',async()=>{
 const f=fixture('loyalty-worker-backlog');const older=f.paid(f.a.id,2),newer=f.paid(f.b.id,1);
 try{
  const seeded=JSON.parse(owned.psql(`SELECT public.award_loyalty_points('${f.site.siteId}','${f.b.id}','${newer}','loyalty.earn:${newer}');`));
  assert.equal(seeded.awarded,true,'positive canonical award proves the fixture is valid');
  const result=await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-backlog-'+crypto.randomUUID(),limit:1});
  assert.equal(result.awarded,1,`the current batch must reach the unpaid loyalty work: ${JSON.stringify(result)}`);
  assert.equal(f.count(older),1);assert.equal(f.count(newer),1);
  assert.equal(owned.psql(`SELECT buyer_account_id::text FROM loyalty_accounts a JOIN loyalty_ledger_entries l ON l.loyalty_account_id=a.id WHERE l.order_id='${older}';`),f.a.id);
 }finally{f.pause();}
});
