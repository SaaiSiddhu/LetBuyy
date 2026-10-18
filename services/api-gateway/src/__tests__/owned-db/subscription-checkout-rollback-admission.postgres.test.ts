// Development rollback contract proof only, on the existing verified owned fixture.
// Kept separate from normal checkout/provider API acceptance; no retained row deletion.
import assert from 'node:assert/strict';
import test,{before} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
// The current tax writer owns this family. Prove stale retirement is refused,
// then use its reviewed, empty-only rollback for the historical 347 control.
before(()=>{
 const signature='public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)';
 const current=owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`);
 assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/347_free_subscription_checkout_receipts.rollback.sql','utf8')),/360 refuses/);
 assert.equal(owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`),current);
});
const migration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../../../../database/supabase/'+direction+'/347_free_subscription_checkout_receipts'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
const names=['claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1'];
function functions(){return owned.psql(`SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('${names.join("','")}');`);}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function rows(){return owned.psql(`SELECT md5(jsonb_build_object('subscriptions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM subscriptions s),'billing_history',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM billing_history b),'audit_logs',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a),'idempotency_keys',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM idempotency_keys i))::text);`);}

import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';

async function until(check:()=>boolean,label:string){const end=Date.now()+10000;while(Date.now()<end){if(check())return;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('owned rollback barrier not reached: '+label);}
function session(name:string,sql:string){return {name,result:owned.psqlAsync(`SET application_name='${name}';SET statement_timeout='20s';${sql}`).then(out=>({ok:true,out,error:''}),error=>({ok:false,out:'',error:String(error)}))};}
async function gate(){
 const name='syn-free-gate-'+randomUUID(),key=`hashtextextended('${name}',0)`;
 const holder=session(name,`BEGIN;SELECT pg_advisory_xact_lock(${key});SELECT pg_sleep(20);ROLLBACK;`);
 await until(()=>owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='${name}' AND wait_event='PgSleep');`)==='t','gate holder');
 const pid=Number(owned.psql(`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name='${name}';`));assert.ok(Number.isInteger(pid)&&pid>0);
 let released=false;
 return {name,key,async release(){if(released)return;released=true;assert.equal(owned.psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND pid=${pid} AND application_name='${name}';`),'t','terminate only this exact owned barrier backend');const done=await holder.result;assert.equal(done.ok,false);}};
}
function waitKind(name:string,afterGuardGate:string){return owned.psql(`SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_stat_activity blocker WHERE blocker.pid=ANY(pg_blocking_pids(a.pid)) AND blocker.application_name='${afterGuardGate}') THEN 'passed_guard' WHEN a.wait_event_type='Lock' THEN 'draining_writer' ELSE 'not_waiting' END FROM pg_stat_activity a WHERE a.datname=current_database() AND a.application_name='${name}';`);}

test('DEV-347: rollback admission blocks a quote at the evidence/DDL window and rejects a cached forward call after downgrade',async()=>{
 const owner=randomUUID(),email='syn-free-admission-'+owner+'@example.invalid',store=newSyntheticTenant('free-dev-admit'),key=randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);seedSyntheticTenant(owned.psql,store);
 owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store.siteId}';INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,trial_days,status,purchasable) VALUES('store','free','Synthetic dev free',0,0,25,true,0,'available',true) ON CONFLICT(site_type,slug) DO NOTHING;`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));let releaseQuote:()=>void=()=>{},readyQuote:()=>void=()=>{};
 const quoteReady=new Promise<void>(resolve=>{readyQuote=resolve;}),quoteGate=new Promise<void>(resolve=>{releaseQuote=resolve;});
 const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/claim_merchant_subscription_checkout_v1'&&JSON.parse(call.body||'{}').p_quote){readyQuote();await quoteGate;}return forward();});
 const checkout=gateway.request('/v1/payments/subscription/order',{method:'POST',headers:{...await signedIdentityHeaders(owner,email),'X-Idempotency-Key':key},body:JSON.stringify({store_id:store.siteId,site_type:'store',plan_slug:'free',billing_period:'monthly'})});
 const rollbackGate=await gate(),rollbackName='syn-free-admit-'+randomUUID();let rollback:ReturnType<typeof session>|undefined;let settled=false;
 checkout.then(()=>{settled=true;},()=>{settled=true;});
 try{
  let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([quoteReady,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('quote did not reach actual RPC gate')),10000);})]);}finally{if(timer)clearTimeout(timer);}
  owned.script(readFileSync('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql','utf8'));
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${store.siteId}';`),'0');
  rollback=session(rollbackName,migration('rollback').replace('END $precondition$;',`END $precondition$;SELECT pg_advisory_xact_lock(${rollbackGate.key});`));
  await until(()=>waitKind(rollbackName,rollbackGate.name)==='passed_guard','rollback after absence check');
  releaseQuote();
  await until(()=>settled||owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE '%claim_merchant_subscription_checkout_v1%' AND application_name<>'${rollbackName}' AND pid<>pg_backend_pid() AND wait_event_type='Lock');`)==='t','quote completed or blocked by actual lifecycle lock');
  const during=owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`);
  await rollbackGate.release();const rolled=await rollback.result,response=await checkout;
  const after=owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`);
  console.info('N2_ROLLBACK_ADMISSION '+JSON.stringify({effectsBeforeDowngrade:Number(during),effectsAfterDowngrade:Number(after),rollbackSucceeded:rolled.ok,checkoutStatus:response.status}));
  assert.equal(during,'0','no free intent can commit between evidence check and downgrade');assert.equal(rolled.ok,true,rolled.error);
  assert.equal(after,'0','an already-entered forward function cannot commit after downgrade');assert.ok(response.status>=400,response.text);
 }finally{releaseQuote();await rollbackGate.release();if(rollback)await rollback.result;await checkout;tap.restore();await gateway.settle();owned.script(migration('migrations'));}
});
