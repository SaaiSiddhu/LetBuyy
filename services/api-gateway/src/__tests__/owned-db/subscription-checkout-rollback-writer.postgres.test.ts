// Development rollback contract proof only, on the existing verified owned fixture.
// Kept separate from normal checkout/provider API acceptance; no retained row deletion.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
const migration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../../../../database/supabase/'+direction+'/347_free_subscription_checkout_receipts'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
const names=['claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1'];
function functions(){return owned.psql(`SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('${names.join("','")}');`);}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function rows(){return owned.psql(`SELECT md5(jsonb_build_object('subscriptions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM subscriptions s),'billing_history',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM billing_history b),'audit_logs',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a),'idempotency_keys',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM idempotency_keys i))::text);`);}

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

test('DEV-347: rollback drains a free writer before absence check and refuses its committed intent/activation',async()=>{
 const owner=randomUUID(),store=newSyntheticTenant('free-dev-writer'),key=randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','syn-free-dev-${owner}@example.invalid',true);`);seedSyntheticTenant(owned.psql,store);
 owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${store.siteId}';INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,trial_days,status,purchasable) VALUES('store','free','Synthetic dev free',0,0,25,true,0,'available',true) ON CONFLICT(site_type,slug) DO NOTHING;`);
 const writerGate=await gate(),rollbackGate=await gate(),writerName='syn-free-writer-'+randomUUID(),rollbackName='syn-free-rollback-'+randomUUID(),before=hash(functions());
 const writer=session(writerName,`BEGIN;SET LOCAL ROLE service_role;
 DO $dev$ DECLARE p public.plans%ROWTYPE;receipt jsonb;activated jsonb;request jsonb;BEGIN
  SELECT * INTO p FROM public.plans WHERE site_type='store' AND slug='free';
  request:=jsonb_build_object('plan_slug','free','site_type','store','billing_period','monthly','approved_usage_charges','[]'::jsonb,'coupon_code',NULL);
  receipt:=public.claim_merchant_subscription_checkout_v1('${owner}','${store.siteId}','${key}',request,jsonb_build_object('mode','free_activation','amount_minor',0,'currency','INR','plan',to_jsonb(p),'response',jsonb_build_object('checkout_mode','free_activation','amount',0,'currency','INR','billing_period','monthly','recurring',false,'is_promo',false)));
  IF receipt->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'synthetic dev claim failed: %, binding: %',receipt,split_part(pg_get_functiondef('public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)'::regprocedure),E'\nAS ',1);END IF;
  activated:=public.activate_merchant_subscription_v1(jsonb_build_object('user_id','${owner}','store_id','${store.siteId}','plan_id',p.id,'plan_slug','free','plan_name',p.name,'billing_period','monthly','amount_paid',0,'payment_gateway',NULL,'external_subscription_id',receipt->'charge'->>'subscription_checkout_reference','razorpay_order_id',NULL,'razorpay_payment_id',NULL,'period_start',now(),'period_end',now()+interval '1 month','promo_ends_at',NULL,'products_limit',25,'invoice_number','SYN-DEV-${key}','invoice_description','Synthetic development rollback writer','tax_amount',0,'total_amount',0,'subscription_checkout_id',receipt->'charge'->>'id','subscription_checkout_key','${key}','subscription_checkout_request',request));
  IF activated->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'synthetic dev activation failed: %',activated;END IF;
 END $dev$;SELECT pg_advisory_xact_lock(${writerGate.key});COMMIT;`);
 let writerDone:Awaited<typeof writer.result>|undefined;void writer.result.then(done=>{writerDone=done;});
 let rollback:ReturnType<typeof session>|undefined;
 try{
  await until(()=>{if(writerDone)assert.fail('writer ended before barrier: '+writerDone.error);return waitKind(writerName,writerGate.name)==='passed_guard';},'free writer at commit barrier');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}';`),'0','uncommitted source remains invisible');
  const script=migration('rollback').replace('END $precondition$;',`END $precondition$;SELECT pg_advisory_xact_lock(${rollbackGate.key});`);
  rollback=session(rollbackName,script);
  let kind='';await until(()=>{kind=waitKind(rollbackName,rollbackGate.name);return ['passed_guard','draining_writer'].includes(kind);},'rollback drain or broken post-check gate');
  await writerGate.release();const written=await writer.result;assert.equal(written.ok,true,written.error);
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE subscription_checkout_key='${key}' AND subscription_id IS NOT NULL;`),'1');
  await rollbackGate.release();const rolled=await rollback.result;
  console.info('N2_ROLLBACK_WRITER '+JSON.stringify({observedWait:kind,rollbackSucceeded:rolled.ok,functionsUnchanged:hash(functions())===before}));
  assert.equal(kind,'draining_writer','rollback must drain effect writers before absence check');
  assert.equal(rolled.ok,false);assert.match(rolled.error,/347 rollback refuses retained free checkout evidence/);assert.equal(hash(functions()),before);
 }finally{await writerGate.release();await rollbackGate.release();await writer.result;if(rollback)await rollback.result;owned.script(migration('migrations'));}
});
