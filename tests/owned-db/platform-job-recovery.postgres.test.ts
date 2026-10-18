// Protected Console recovery of exhausted canonical loyalty debt. Synthetic
// operator credentials exercise actual Gateway/session/RPC paths; normal local
// Identity/MFA/browser acceptance belongs to the separate browser fixture.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {SignJWT} from 'jose';
import {operatorIdentityKeys} from '../../services/api-gateway/src/__tests__/owned-db/operator-identity-fixture';
import {consoleFixture} from '../../services/api-gateway/src/__tests__/owned-db/console-session-fixture';
import {Gateway,tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {consumeLoyaltyRefundJobs} from '../../services/queue-workers/src/platform-queue-consumer';
const owned=requireOwnedDatabase();

async function exhaustedDebt() {
 const site=newSyntheticTenant('jobrec-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),buyer=crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','syn-job-owner-${owner}@example.invalid',true);
 UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';
 INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${buyer}','syn-job-buyer-${buyer}@example.invalid',true);
 SELECT set_loyalty_program('${site.siteId}',p_is_active=>true,p_earn_rate_bps=>10000,p_actor_id=>'${owner}',p_actor_type=>'user');`);
 const paid=seedSyntheticOrder(owned.psql,site);
 owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${paid.orderId}';
 INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${paid.orderId}','${buyer}','${site.siteId}','authenticated_checkout');
 SELECT award_loyalty_points('${site.siteId}','${buyer}','${paid.orderId}','syn-job-earn-${paid.orderId}');`);
 const order=owned.psql(`SELECT create_checkout_order_for_buyer('${buyer}',1,'${site.siteId}','Synthetic Job Buyer','syn-job-buyer-${buyer}@example.invalid','9000000099',
 '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}',
 '[{"product_id":"${paid.productId}","quantity":1}]','cod',NULL,NULL,NULL,'standard','syn-job-checkout-${crypto.randomUUID()}',NULL,NULL,NULL,NULL,NULL,NULL,50)->>'id';`);
 owned.psql(`UPDATE orders SET status='cancelled'WHERE id='${order}';SELECT enqueue_pending_loyalty_refunds_v1(100);`);
 const job=owned.psql(`SELECT id FROM platform_queue_jobs WHERE queue_name='loyalty-refunds'AND site_id='${site.siteId}';`);
 assert.ok(job);
 // Simulated exhausted retry state, retaining the canonical persisted job/source.
 owned.psql(`UPDATE platform_queue_jobs SET status='dead',attempts=max_attempts,failed_at=now(),error_message='Synthetic exhausted transient recovery',result='{"synthetic_private_marker":"do-not-project"}'WHERE id='${job}';`);
 const balance=()=>owned.psql(`SELECT loyalty_balance(id)FROM loyalty_accounts WHERE site_id='${site.siteId}'AND buyer_account_id='${buyer}';`);
 const credits=()=>owned.psql(`SELECT count(*)FROM loyalty_ledger_entries WHERE order_id='${order}'AND entry_type='refund_credit';`);
 return {...site,owner,buyer,order,job,balance,credits};
}

test('a currently permitted Console super admin can inspect retained exhausted loyalty debt without exposing private job contents',async()=>{
 const debt=await exhaustedDebt(),console=await consoleFixture(owned),maker=await console.actor('super');
 assert.equal(debt.balance(),'149');assert.equal(debt.credits(),'0');
 const before=owned.psql(`SELECT count(*)FROM platform_queue_jobs WHERE site_id='${debt.siteId}'AND queue_name='loyalty-refunds';`);
 const drain=await consumeLoyaltyRefundJobs(owned.restEnv(),'syn-exhausted-before-'+crypto.randomUUID());
 assert.equal(drain[0].claimed,0,JSON.stringify(drain));
 assert.equal(owned.psql(`SELECT count(*)FROM platform_queue_jobs WHERE site_id='${debt.siteId}'AND queue_name='loyalty-refunds';`),before,'exhausted debt is retained, never silently duplicated');
 const result=await console.gateway.request('/v1/internal/console/platform-jobs?job_id='+debt.job,{headers:maker.headers});
 assert.equal(result.status,200,result.text);
 assert.equal(result.json?.data.items[0].id,debt.job);
 assert.equal(result.json?.data.items[0].eligible,true);
 assert.doesNotMatch(result.text,/do-not-project|synthetic_private_marker|"payload"|"error_message"/);
 assert.equal(debt.credits(),'0','inspection is not a financial recovery');
 await console.gateway.settle();
});

const forward=readFileSync(new URL('../../database/supabase/migrations/353_approved_platform_job_recovery.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../../database/supabase/rollback/353_approved_platform_job_recovery.rollback.sql',import.meta.url),'utf8');
const q=(value:unknown)=>"'"+String(value).replaceAll("'","''")+"'";
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
type Operator={id:string;email:string;token:string;headers:Record<string,string>};
const session=(actor:Operator)=>owned.psql(`SELECT id FROM sessions_v2 WHERE metadata->>'cookie_sha256'=${q(digest(actor.token))};`);
async function journey(){
 const debt=await exhaustedDebt(),ops=await consoleFixture(owned);
 const maker:Operator=await ops.actor('super'),checker:Operator=await ops.actor('super');
 const inspected=await ops.gateway.request('/v1/internal/console/platform-jobs?job_id='+debt.job,{headers:maker.headers});assert.equal(inspected.status,200,inspected.text);
 const snapshot=inspected.json?.data.items[0];assert.equal(snapshot.eligible,true);
 const body={site_id:debt.siteId,source_fingerprint:String(snapshot.source_fingerprint),reason:'Synthetic independent review of exhausted loyalty debt',request_key:crypto.randomUUID(),expected_session_id:session(maker)};
 return{debt,ops,maker,checker,snapshot,body};
}
type Journey=Awaited<ReturnType<typeof journey>>;
const inspect=(j:Journey,actor=j.maker,query='job_id='+j.debt.job)=>j.ops.gateway.request('/v1/internal/console/platform-jobs?'+query,{headers:actor.headers});
const request=(j:Journey,overrides:Record<string,unknown>={},actor=j.maker,job=j.debt.job,gateway=j.ops.gateway)=>gateway.request('/v1/internal/console/platform-jobs/'+job+'/approvals',{method:'POST',headers:actor.headers,body:JSON.stringify({...j.body,...overrides})});
async function approval(j:Journey){const result=await request(j);assert.equal(result.status,201,result.text);return result.json?.data.approval;}
const decision=(j:Journey,a:any,value='approve',actor=j.checker,hash=a.payload_hash)=>j.ops.gateway.request('/v1/internal/console/approvals/'+a.id+'/decision',{method:'POST',headers:actor.headers,body:JSON.stringify({decision:value,payload_hash:hash})});
async function approved(j:Journey){const a=await approval(j);const result=await decision(j,a);assert.equal(result.status,200,result.text);return a;}
const redrive=(j:Journey,a:any,overrides:Record<string,unknown>={},actor=j.maker,job=j.debt.job,gateway=j.ops.gateway)=>gateway.request('/v1/internal/console/platform-jobs/'+job+'/redrive',{method:'POST',headers:actor.headers,body:JSON.stringify({approval_id:a.id,site_id:j.debt.siteId,reason:j.body.reason,request_key:j.body.request_key,...overrides})});
const queuedState=(j:Journey)=>owned.psql(`SELECT status||'|'||attempts||'|'||max_attempts FROM platform_queue_jobs WHERE id='${j.debt.job}';`);
const auditCount=(j:Journey)=>owned.psql(`SELECT count(*)FROM audit_logs WHERE action='platform.job.redriven'AND resource_id='${j.debt.job}';`);
const recoveryCount=(j:Journey)=>owned.psql(`SELECT count(*)FROM sensitive_action_approvals WHERE action='platform.job.redrive'AND resource_id='${j.debt.job}';`);
async function drain(j:Journey){await consumeLoyaltyRefundJobs(owned.restEnv(),'syn-redrive-'+crypto.randomUUID());assert.equal(j.debt.credits(),'1');assert.equal(j.debt.balance(),'199');}
function conserved(j:Journey){assert.equal(queuedState(j),'dead|10|10');assert.equal(j.debt.credits(),'0');assert.equal(j.debt.balance(),'149');assert.equal(auditCount(j),'0');}

const recoveryFamilies=['console_platform_job_snapshot_v1','read_console_platform_jobs_v1','create_console_platform_job_recovery_v1','execute_console_platform_job_recovery_v1'];
const familyState=()=>owned.script(`SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid))ORDER BY p.oid)::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[${recoveryFamilies.map(q).join(',')}]);`);

// Hash retained state locally; logs contain only synthetic backend IDs and digests.
const maintenanceState=()=>owned.script(`SELECT jsonb_build_object(
 'family',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid))ORDER BY p.oid)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[${recoveryFamilies.map(q).join(',')}])),
 'constraint',(SELECT jsonb_build_array(c.oid,t.relowner,pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.conrelid='sensitive_action_approvals'::regclass AND c.conname='sensitive_action_approvals_action_check'),
 'journal',(SELECT jsonb_agg(to_jsonb(j)ORDER BY object_signature)FROM migration_privilege_journal j WHERE migration='353'),
 'queue',(SELECT jsonb_agg(to_jsonb(j)ORDER BY id)FROM platform_queue_jobs j),
 'ledger',(SELECT jsonb_agg(to_jsonb(l)ORDER BY id)FROM loyalty_ledger_entries l),
 'approvals',(SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM sensitive_action_approvals a),
 'audit',(SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a),
 'sessions',(SELECT jsonb_agg(to_jsonb(s)ORDER BY id)FROM sessions_v2 s));`);

for(const mode of ['rollback','forward'] as const)test('353 '+mode+' refuses native uncommitted CREATE FUNCTION without a cooperative catalog lock',{timeout:40000},async()=>{
 if(mode==='forward')owned.script(rollback);
 const before=maintenanceState(),family=recoveryFamilies[0],token=crypto.randomUUID().replaceAll('-','');
 const table='syn_job_gate_'+token,holderName='syn-job-holder-'+token,creatorName='syn-job-create-'+token;
 const key=crypto.getRandomValues(new Uint32Array(1))[0]%1000000000+1000000000;
 owned.script(`CREATE TABLE public.${table}(released boolean NOT NULL);INSERT INTO public.${table} VALUES(false);`);
 const holder=owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${holderName}';SELECT pg_advisory_xact_lock(${key}::bigint);
 DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '15 seconds';BEGIN
  WHILE NOT(SELECT released FROM public.${table})LOOP
   IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'Synthetic native DDL gate not released';END IF;PERFORM pg_sleep(0.01);
  END LOOP;
 END$$;COMMIT;`).then(()=>null,(error:Error)=>error);
 let creator:Promise<Error|null>|undefined;
 try{
  const holderDeadline=Date.now()+5000;
  while(owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database()AND a.application_name='${holderName}'AND l.locktype='advisory'AND l.classid=0 AND l.objid=${key} AND l.granted);`)!=='t'){
   assert.ok(Date.now()<holderDeadline,'exact owned advisory holder is ready');await new Promise(resolve=>setTimeout(resolve,25));
  }
  // Native CREATE first, then wait for the separate gate. No explicit pg_proc lock.
  creator=owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${creatorName}';
   CREATE FUNCTION public.${family}()RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
   SELECT pg_advisory_xact_lock(${key}::bigint);COMMIT;`).then(()=>null,(error:Error)=>error);
  const creatorDeadline=Date.now()+5000;
  while(owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database()AND a.application_name='${creatorName}'AND l.locktype='advisory'AND l.classid=0 AND l.objid=${key} AND NOT l.granted)
   AND EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database()AND a.application_name='${creatorName}'AND l.locktype='transactionid'AND l.mode='ExclusiveLock'AND l.granted);`)!=='t'){
   assert.ok(Date.now()<creatorDeadline,'native CREATE completed and its actual write XID is held at the gate');await new Promise(resolve=>setTimeout(resolve,25));
  }
  const barrier=JSON.parse(owned.script(`SELECT jsonb_build_object('database',current_database(),'database_oid',a.datid,'backend_pid',a.pid,'backend_xid',a.backend_xid::text,
   'native_catalog_relation_lock_count',(SELECT count(*)FROM pg_locks l WHERE l.pid=a.pid AND l.relation='pg_catalog.pg_proc'::regclass AND l.granted),
   'write_xid_lock_count',(SELECT count(*)FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='transactionid'AND l.mode='ExclusiveLock'AND l.granted))FROM pg_stat_activity a WHERE a.application_name='${creatorName}'AND a.datname=current_database();`));
  assert.equal(barrier.write_xid_lock_count,1);assert.ok(barrier.backend_xid);
  const failure=owned.psqlExpectError("SET statement_timeout='3s';"+(mode==='rollback'?rollback:forward));
  const after=maintenanceState();
  console.info('OWNED_353_NATIVE_DDL '+JSON.stringify({mode,...barrier,maintenance_refused:failure!=='',failure:failure.slice(0,300),before_sha256:digest(before),after_sha256:digest(after),state_conserved:before===after}));
  assert.match(failure,/353 refuses concurrent\/prepared writes or non-read-committed state|canceling statement due to statement timeout/);
  assert.equal(digest(after),digest(before),'all committed family definitions, constraint, journal, queue, ledger, approvals, audit and sessions are conserved while the native writer is uncommitted');
  owned.script(`UPDATE public.${table} SET released=true;`);
  const [released,created]=await Promise.all([holder,creator]);assert.equal(released,null);assert.equal(created,null);
  assert.equal(owned.psql(`SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[${recoveryFamilies.map(q).join(',')}]);`),mode==='rollback'?'5':'1');
 }finally{
  owned.script(`UPDATE public.${table} SET released=true;`);await Promise.all([holder,creator]);
  owned.script(`DROP FUNCTION IF EXISTS public.${family}()RESTRICT;DROP TABLE public.${table};`);
  if(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='353';")==='0')owned.script(forward);
  assert.equal(owned.psql(`SELECT to_regclass('public.${table}')IS NULL;`),'t');
  assert.equal(owned.psql(`SELECT count(*)FROM pg_stat_activity WHERE datname=current_database()AND application_name IN('${holderName}','${creatorName}');`),'0');
 }
});


for(const mode of ['rollback','forward']as const)test('353 '+mode+' refuses non-read-committed catalog state before any mutation',()=>{
 if(mode==='forward')owned.script(rollback);
 const before=maintenanceState();
 try{
  for(const isolation of ['REPEATABLE READ','SERIALIZABLE','READ UNCOMMITTED']){
   const failure=owned.psqlExpectError('BEGIN ISOLATION LEVEL '+isolation+';SELECT count(*)FROM pg_proc;'+(mode==='rollback'?rollback:forward));
   assert.match(failure,/353 refuses concurrent\/prepared writes or non-read-committed state/,isolation);
   assert.equal(digest(maintenanceState()),digest(before),isolation+' refusal conserves the exact committed authority and retained data');
  }
 }finally{if(mode==='forward')owned.script(forward);}
});

for(const mode of ['rollback','forward']as const)test('353 '+mode+' preserves authority at the actual prepared-transaction boundary',()=>{
 if(mode==='forward')owned.script(rollback);
 const before=maintenanceState(),gid='syn353-'+crypto.randomUUID(),family=recoveryFamilies[0];
 const capacity=Number(owned.psql('SHOW max_prepared_transactions;'));
 try{
  const prepare=`BEGIN;CREATE FUNCTION public.${family}()RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;PREPARE TRANSACTION '${gid}';`;
  if(capacity===0){
   assert.match(owned.psqlExpectError(prepare),/prepared transactions are disabled/);
   assert.equal(owned.psql(`SELECT count(*)FROM pg_prepared_xacts WHERE gid='${gid}';`),'0');
   console.info('OWNED_353_PREPARED_BOUNDARY '+JSON.stringify({mode,max_prepared_transactions:capacity,native_prepare_refused_by_configuration:true,prepared_guard_branch_exercised:false}));
  }else{
   owned.script(prepare);
   assert.equal(owned.psql(`SELECT count(*)FROM pg_prepared_xacts WHERE gid='${gid}'AND database=current_database();`),'1');
   assert.equal(owned.psql(`SELECT count(*)FROM pg_locks WHERE locktype='transactionid'AND pid IS NULL AND mode='ExclusiveLock'AND transactionid=(SELECT transaction FROM pg_prepared_xacts WHERE gid='${gid}');`),'1');
   assert.match(owned.psqlExpectError("SET statement_timeout='3s';"+(mode==='rollback'?rollback:forward)),/353 refuses concurrent\/prepared writes or non-read-committed state/);
   console.info('OWNED_353_PREPARED_BOUNDARY '+JSON.stringify({mode,max_prepared_transactions:capacity,actual_prepared_write_refused:true,prepared_guard_branch_exercised:true}));
  }
  assert.equal(digest(maintenanceState()),digest(before),'prepared boundary retains the full committed definition/journal/constraint/data snapshot');
 }finally{
  if(owned.psql(`SELECT count(*)FROM pg_prepared_xacts WHERE gid='${gid}';`)==='1')owned.script(`ROLLBACK PREPARED '${gid}';`);
  assert.equal(owned.psql(`SELECT to_regprocedure('public.${family}()')IS NULL;`),'t');
  if(mode==='forward')owned.script(forward);
 }
});

for(const family of recoveryFamilies)test('353 rollback refuses unexpected overload of '+family+' before any authority mutation',()=>{
 const original=familyState();
 owned.script(`CREATE FUNCTION public.${family}()RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS 'SELECT ''{}''::jsonb';`);
 const before=familyState();
 try{
  const failure=owned.psqlExpectError(rollback);
  assert.match(failure,/rollback353 refuses unexpected platform job recovery function family/);
  assert.equal(familyState(),before,'refusal conserves the entire typed family including the unknown overload');
 }finally{
  owned.script(`DROP FUNCTION IF EXISTS public.${family}() RESTRICT;`);
  // The red witness uses the old unsafe rollback. Restore only its own four
  // removed canonical definitions when that rollback incorrectly committed.
  if(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='353';")==='0')owned.script(forward);
 }
 assert.equal(familyState(),original);
});

for(const family of recoveryFamilies)test('353 forward refuses pre-existing unknown overload of '+family+' without overwriting it',()=>{
 owned.script(rollback);
 const priorCheck=owned.psql("SELECT pg_get_constraintdef(oid)FROM pg_constraint WHERE conrelid='sensitive_action_approvals'::regclass AND conname='sensitive_action_approvals_action_check';");
 owned.script(`CREATE FUNCTION public.${family}()RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS 'SELECT ''{}''::jsonb';`);
 const before=familyState();
 try{
  assert.match(owned.psqlExpectError(forward),/migration353 refuses unexpected platform job recovery function family/);
  assert.equal(familyState(),before);
  assert.equal(owned.psql("SELECT pg_get_constraintdef(oid)FROM pg_constraint WHERE conrelid='sensitive_action_approvals'::regclass AND conname='sensitive_action_approvals_action_check';"),priorCheck);
  assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='353';"),'0');
 }finally{owned.script(`DROP FUNCTION public.${family}() RESTRICT;`);owned.script(forward);}
});

test('353 rollback refuses a missing typed member and changed constraint or provenance without changing retained authority',()=>{
 for(const change of [
  'DROP FUNCTION public.console_platform_job_snapshot_v1(uuid) RESTRICT;',
  "ALTER TABLE sensitive_action_approvals DROP CONSTRAINT sensitive_action_approvals_action_check;ALTER TABLE sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action<>'synthetic_unknown_action');",
  "DELETE FROM migration_privilege_journal WHERE migration='353'AND object_signature='public.sensitive_action_approvals:sensitive_action_approvals_action_check';",
 ]){
  const before=familyState(),journal=owned.psql("SELECT jsonb_agg(to_jsonb(j)ORDER BY object_signature)::text FROM migration_privilege_journal j WHERE migration='353';");
  assert.match(owned.psqlExpectError('BEGIN;'+change+rollback),/rollback353 refuses (unexpected platform job recovery function family|changed action constraint or provenance)/);
  assert.equal(familyState(),before);assert.equal(owned.psql("SELECT jsonb_agg(to_jsonb(j)ORDER BY object_signature)::text FROM migration_privilege_journal j WHERE migration='353';"),journal);
 }
});

test('353 rollback serializes with concurrent catalog DDL and sees the committed unknown overload before any mutation',{timeout:30000},async()=>{
 const family=recoveryFamilies[0],name='syn_job_ddl_'+crypto.randomUUID().slice(0,8),before=familyState();
 const ddl=owned.psqlAsync(`SET application_name='${name}';BEGIN;LOCK TABLE pg_catalog.pg_proc IN ROW EXCLUSIVE MODE;SELECT pg_sleep(2);CREATE FUNCTION public.${family}()RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';COMMIT;`);
 let rollbackResult:Promise<string>|undefined;
 try{
  const deadline=Date.now()+10000;
  while(owned.psql(`SELECT count(*)FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${name}'AND l.relation='pg_catalog.pg_proc'::regclass AND l.mode='RowExclusiveLock'AND l.granted;`)!=='1'){
   assert.ok(Date.now()<deadline,'exact owned DDL backend acquires its catalog lock');await new Promise(resolve=>setTimeout(resolve,25));
  }
  let settled=false;
  rollbackResult=owned.psqlAsync(rollback).then(()=>'',error=>String(error)).finally(()=>{settled=true;});
  await new Promise(resolve=>setTimeout(resolve,150));assert.equal(settled,false,'rollback waits for catalog DDL instead of racing the family check');
  await ddl;assert.match(await rollbackResult,/rollback353 refuses unexpected platform job recovery function family/);
  assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='353';"),'5');
 }finally{
  await ddl;await rollbackResult;owned.script(`DROP FUNCTION IF EXISTS public.${family}() RESTRICT;`);
 }
 assert.equal(familyState(),before,'all four exact original OID/body/owner/grants survive the serialized refusal');
});

test('353 clean rollback/reapply preserves all original financial/session/queue authority and data',()=>{
 const old=owned.psql(`SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid))ORDER BY p.oid)::text FROM pg_proc p WHERE p.oid=ANY(ARRAY[
 'public.claim_platform_queue_jobs(text,text,integer,integer)'::regprocedure,'public.fail_platform_queue_job(uuid,text,text,integer,jsonb)'::regprocedure,
 'public.complete_platform_queue_job(uuid,text,jsonb)'::regprocedure,'public.quarantine_platform_queue_job(uuid,text,text,jsonb)'::regprocedure,
 'public.decide_console_approval_v1(uuid,text,uuid,text,text)'::regprocedure,'public.read_console_approvals_v1(uuid,text,uuid,integer,integer)'::regprocedure]);`);
 const counts=()=>owned.psql('SELECT (SELECT count(*)FROM platform_queue_jobs),(SELECT count(*)FROM loyalty_ledger_entries),(SELECT count(*)FROM sensitive_action_approvals),(SELECT count(*)FROM audit_logs);');const before=counts();
 owned.script(rollback);
 const priorCheck=owned.psql("SELECT pg_get_constraintdef(oid)FROM pg_constraint WHERE conrelid='public.sensitive_action_approvals'::regclass AND conname='sensitive_action_approvals_action_check';");
 assert.doesNotMatch(priorCheck,/platform\.job\.redrive/);assert.match(priorCheck,/operator\.mfa\.reset/);
 owned.script(forward);owned.script(rollback);
 assert.equal(owned.psql("SELECT pg_get_constraintdef(oid)FROM pg_constraint WHERE conrelid='public.sensitive_action_approvals'::regclass AND conname='sensitive_action_approvals_action_check';"),priorCheck);
 owned.script(forward);assert.equal(counts(),before);
 assert.equal(owned.psql(`SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid))ORDER BY p.oid)::text FROM pg_proc p WHERE p.oid=ANY(ARRAY[
 'public.claim_platform_queue_jobs(text,text,integer,integer)'::regprocedure,'public.fail_platform_queue_job(uuid,text,text,integer,jsonb)'::regprocedure,
 'public.complete_platform_queue_job(uuid,text,jsonb)'::regprocedure,'public.quarantine_platform_queue_job(uuid,text,text,jsonb)'::regprocedure,
 'public.decide_console_approval_v1(uuid,text,uuid,text,text)'::regprocedure,'public.read_console_approvals_v1(uuid,text,uuid,integer,integer)'::regprocedure]);`),old);
});

test('rollback refuses each retained review/receipt status independently without leaving test records',async()=>{
 const j=await journey(),maker=session(j.maker),checker=session(j.checker),mh=digest(j.maker.token),ch=digest(j.checker.token);
 await j.ops.gateway.settle();
 const original=queuedState(j),before=recoveryCount(j);
 for(const state of ['pending','rejected','cancelled','approved','consumed']){
  const key=crypto.randomUUID();
  const prefix=`BEGIN;SET LOCAL ROLE service_role;DO $scenario$ DECLARE a jsonb;r jsonb;w text;BEGIN
   w:=public.console_permission_snapshot_v1('${maker}','${mh}',true)->>'evidence_hash';
   a:=public.create_console_platform_job_recovery_v1('${maker}','${mh}',w,'${j.debt.job}','${j.debt.siteId}',${q(j.body.source_fingerprint)},${q(j.body.reason)},'${key}');
   IF a->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Synthetic request failed: %',a;END IF;
   ${state==='pending'?'':`r:=public.decide_console_approval_v1('${state==='cancelled'?maker:checker}','${state==='cancelled'?mh:ch}',(a->'approval'->>'id')::uuid,'${state==='cancelled'?'cancel':state==='rejected'?'reject':'approve'}',a->'approval'->>'payload_hash');
   IF r->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Synthetic decision failed: %',r;END IF;`}
   ${state!=='consumed'?'':`r:=public.execute_console_platform_job_recovery_v1('${maker}','${mh}',w,(a->'approval'->>'id')::uuid,'${j.debt.job}','${j.debt.siteId}',${q(j.body.reason)},'${key}');
   IF r->>'accepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Synthetic execution failed: %',r;END IF;`}
   END $scenario$;RESET ROLE;`;
  assert.match(owned.psqlExpectError(prefix+rollback),/rollback353 refuses retained platform job recovery review or receipt evidence/,state);
  assert.equal(recoveryCount(j),before,'the intentionally failed transaction rolls back its own review/receipt');assert.equal(queuedState(j),original);assert.equal(auditCount(j),'0');
 }
});

test('rollback refuses changed typed function body, owner, ACL and missing provenance before any drop',()=>{
 const changes=[
  "ALTER FUNCTION public.console_platform_job_snapshot_v1(uuid) SECURITY DEFINER;",
  "ALTER FUNCTION public.console_platform_job_snapshot_v1(uuid) OWNER TO service_role;",
  "GRANT EXECUTE ON FUNCTION public.console_platform_job_snapshot_v1(uuid) TO anon;",
  "DELETE FROM public.migration_privilege_journal WHERE migration='353'AND object_signature='public.console_platform_job_snapshot_v1(uuid)';",
 ];
 for(const change of changes){assert.match(owned.psqlExpectError('BEGIN;'+change+rollback),/rollback353 refuses changed RPC body, ownership, grants or provenance/);
  assert.equal(owned.psql("SELECT prosecdef FROM pg_proc WHERE oid='public.console_platform_job_snapshot_v1(uuid)'::regprocedure;"),'f');}
});

test('actual ordinary roles cannot call the four private recovery RPCs; forged witness and foreign GUC fail closed',async()=>{
 const j=await journey(),sid=session(j.maker),cookie=digest(j.maker.token);
 const signatures=['public.console_platform_job_snapshot_v1(uuid)','public.read_console_platform_jobs_v1(uuid,text,text,uuid,uuid,integer,integer)',
  'public.create_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,text,text,uuid)','public.execute_console_platform_job_recovery_v1(uuid,text,text,uuid,uuid,uuid,text,uuid)'];
 for(const role of ['anon','authenticated','app_tenant']){
  assert.equal(owned.psql(`SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='${role}';`),'f');
  for(const signature of signatures)assert.equal(owned.psql(`SELECT has_function_privilege('${role}',${q(signature)},'EXECUTE');`),'f');
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.console_platform_job_snapshot_v1('${j.debt.job}');`),/permission denied/);
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.read_console_platform_jobs_v1('${sid}','${cookie}','${'a'.repeat(64)}',NULL,NULL,1,25);`),/permission denied/);
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.create_console_platform_job_recovery_v1('${sid}','${cookie}','${'a'.repeat(64)}','${j.debt.job}','${j.debt.siteId}','${'b'.repeat(64)}','Synthetic forbidden direct request','${crypto.randomUUID()}');`),/permission denied/);
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.execute_console_platform_job_recovery_v1('${sid}','${cookie}','${'a'.repeat(64)}','${crypto.randomUUID()}','${j.debt.job}','${j.debt.siteId}','Synthetic forbidden direct effect','${crypto.randomUUID()}');`),/permission denied/);
 }
 const falseWitness=JSON.parse(owned.script(`SET ROLE service_role;SELECT public.read_console_platform_jobs_v1('${sid}','${cookie}','${'a'.repeat(64)}',NULL,NULL,1,25);`));assert.equal(falseWitness.code,'PERMISSION_CHANGED');
 const foreign=crypto.randomUUID();
 const scopedRows=owned.script(`BEGIN;SET LOCAL ROLE service_role;
 SELECT set_config('app.site_id','${foreign}',true);
 SELECT public.read_console_platform_jobs_v1('${sid}','${cookie}',public.console_permission_snapshot_v1('${sid}','${cookie}',false)->>'evidence_hash','${j.debt.siteId}',NULL,1,25);
 ROLLBACK;`);
 const foreignScope=JSON.parse(scopedRows.split('\n').at(-1)!);
 assert.equal(foreignScope.code,'APPROVAL_TARGET_NOT_FOUND');conserved(j);
});

test('inspection is bounded and rejects service-only, wrong-realm and non-super sessions despite typed actor/MFA headers',async()=>{
 const j=await journey(),lead=await j.ops.actor('lead');
 const invalidHeaders:Record<string,string>[]=[{Authorization:j.maker.headers.Authorization},{...j.maker.headers,'X-Platform-Console-Session':crypto.randomUUID()}];
 for(const headers of invalidHeaders){
  const r=await j.ops.gateway.request('/v1/internal/console/platform-jobs',{headers});assert.equal(r.status,401,r.text);
 }
 assert.equal((await inspect(j,lead)).status,403);
 const keys=await operatorIdentityKeys(j.ops.env.PLATFORM_CONSOLE_SESSION_SECRET!);
 const wrongRealm=await new SignJWT({realm:'merchant',token_use:'platform_session',email:j.maker.email,mfa_verified:true,mfa_verified_at:Math.floor(Date.now()/1000)})
  .setProtectedHeader({alg:'ES256',typ:'JWT',kid:keys.kid}).setIssuer(j.ops.env.LETBUYY_IDENTITY_ISSUER!)
  .setAudience('letbuyy:platform-session').setSubject(j.maker.id).setIssuedAt().setExpirationTime('5m').setJti(crypto.randomUUID()).sign(keys.privateKey);
 const realmDenied=await j.ops.gateway.request('/v1/internal/console/platform-jobs',{headers:{...j.maker.headers,'X-Platform-Console-Session':wrongRealm}});assert.equal(realmDenied.status,401,realmDenied.text);
 const r=await j.ops.gateway.request('/v1/internal/console/platform-jobs',{headers:{...lead.headers,'X-Platform-Console-Actor-ID':j.maker.id,'X-Platform-Console-MFA':'true'}});assert.equal(r.status,403,r.text);
 for(const query of ['limit=51','limit=0','page=10001','site_id=bad','job_id=bad','payload=please'])assert.equal((await inspect(j,j.maker,query)).status,400,query);
 const mismatch=await inspect(j,j.maker,'job_id='+j.debt.job+'&site_id='+crypto.randomUUID());assert.equal(mismatch.status,200);assert.deepEqual(mismatch.json?.data.items,[]);
 conserved(j);
});

test('two current super sessions independently consent; same-key concurrent execution grants one attempt and the actual worker restores once',async()=>{
 const j=await journey();const requested=await Promise.all([request(j),request(j),request(j)]);
 assert.ok(requested.every(r=>r.status===200||r.status===201),JSON.stringify(requested.map(r=>[r.status,r.text])));
 const a=requested[0].json?.data.approval;assert.equal(new Set(requested.map(r=>r.json?.data.approval.id)).size,1);assert.equal(recoveryCount(j),'1');
 assert.equal((await redrive(j,a)).status,428);assert.equal((await decision(j,a,'approve',j.maker)).status,403);
 assert.equal((await decision(j,a,'approve',await j.ops.actor('lead'))).status,403);
 assert.equal((await decision(j,a,'approve',j.checker,'0'.repeat(64))).status,409);conserved(j);
 assert.equal((await decision(j,a)).status,200);
 const effects=await Promise.all([redrive(j,a),redrive(j,a),redrive(j,a)]);assert.ok(effects.every(r=>r.status===200),JSON.stringify(effects.map(r=>r.text)));
 assert.equal(queuedState(j),'queued|10|11');assert.equal(auditCount(j),'1');assert.equal(j.debt.credits(),'0');
 await drain(j);assert.equal(queuedState(j),'succeeded|11|11');
 const again=await redrive(j,a);assert.equal(again.status,200,again.text);assert.equal(again.json?.data.replayed,true);
 assert.equal(queuedState(j),'succeeded|11|11');assert.equal(auditCount(j),'1');assert.equal(j.debt.credits(),'1');
});

test('request and execution reply loss plus a fresh Gateway instance reuse the original review and effect',async()=>{
 const j=await journey();let lost=false;
 const fault=tapRest(owned.restUrl,async(call,forward)=>{const response=await forward();if(!lost&&call.resource==='rpc/create_console_platform_job_recovery_v1'){lost=true;return restJson(503,{message:'Synthetic committed review reply lost'});}return response;});
 try{assert.equal((await request(j)).status,503);}finally{fault.restore();}
 assert.equal(recoveryCount(j),'1');const freshGateway=new Gateway(j.ops.env);
 const retried=await request(j,{},j.maker,j.debt.job,freshGateway);assert.equal(retried.status,200,retried.text);const a=retried.json?.data.approval;
 assert.equal((await decision(j,a)).status,200);lost=false;
 const effectFault=tapRest(owned.restUrl,async(call,forward)=>{const response=await forward();if(!lost&&call.resource==='rpc/execute_console_platform_job_recovery_v1'){lost=true;return restJson(503,{message:'Synthetic committed recovery reply lost'});}return response;});
 try{assert.equal((await redrive(j,a)).status,503);}finally{effectFault.restore();}
 assert.equal(queuedState(j),'queued|10|11');assert.equal(auditCount(j),'1');
 const replay=await redrive(j,a,{},j.maker,j.debt.job,freshGateway);assert.equal(replay.status,200,replay.text);assert.equal(replay.json?.data.replayed,true);await drain(j);
});

test('changed request/reason/key/job/site and a changed browser sign-in cannot rebind an intent or approval',async()=>{
 const j=await journey(),a=await approved(j),other=await exhaustedDebt();
 assert.equal((await request(j,{reason:'A different operational reason'})).status,409);
 assert.equal((await request(j,{expected_session_id:crypto.randomUUID(),request_key:crypto.randomUUID()})).status,409);
 assert.equal((await request(j,{site_id:other.siteId},j.maker,other.job)).status,409);
 for(const body of [{reason:'A different operational reason'},{request_key:crypto.randomUUID()},{site_id:other.siteId},{actor_id:j.checker.id},{payload:{retry_budget:100}}]){
  const r=await redrive(j,a,body);assert.ok([400,409].includes(r.status),r.text);
 }
 assert.equal((await redrive(j,a,{},j.maker,other.job)).status,409);conserved(j);
 const rotated=await j.ops.reauthenticate(j.maker);const old=await redrive(j,a);assert.equal(old.status,401,old.text);
 const fresh=await redrive(j,a,{},rotated);assert.equal(fresh.status,403,fresh.text);conserved(j);
});

test('source drift, settled debt, deleted/completed jobs and active leases cannot consume an old approval',async()=>{
 for(const kind of ['payload','foreign_site','deleted','completed','lease','settled']){
  const j=await journey(),a=await approved(j);
  if(kind==='payload')owned.psql(`UPDATE platform_queue_jobs SET payload=payload||'{"private":"not-a-source"}'WHERE id='${j.debt.job}';`);
  if(kind==='foreign_site'){const other=await exhaustedDebt();owned.psql(`UPDATE platform_queue_jobs SET site_id='${other.siteId}'WHERE id='${j.debt.job}';`);}
  if(kind==='deleted')owned.psql(`UPDATE platform_queue_jobs SET deleted_at=now()WHERE id='${j.debt.job}';`);
  if(kind==='completed')owned.psql(`UPDATE platform_queue_jobs SET status='succeeded',completed_at=now()WHERE id='${j.debt.job}';`);
  if(kind==='lease')owned.psql(`UPDATE platform_queue_jobs SET status='queued',max_attempts=11 WHERE id='${j.debt.job}';SET ROLE service_role;SELECT count(*)FROM claim_platform_queue_jobs('loyalty-refunds','syn-competing-worker',25,120);`);
  if(kind==='settled')owned.psql(`SET ROLE service_role;SELECT restore_loyalty_on_refund('${j.debt.siteId}','${j.debt.order}',NULL,NULL);`);
  const r=await redrive(j,a);assert.ok([404,409].includes(r.status),kind+':'+r.text);
  assert.equal(auditCount(j),'0');assert.equal(owned.psql(`SELECT consumed_at IS NULL FROM sensitive_action_approvals WHERE id='${a.id}';`),'t');
  assert.equal(j.debt.credits(),kind==='settled'?'1':'0');
 }
});

test('current checker revocation denies a cached successful result without a second budget or financial effect',async()=>{
 const j=await journey(),a=await approved(j);assert.equal((await redrive(j,a)).status,200);await drain(j);
 owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.checker.id}';`);
 const replay=await redrive(j,a);assert.ok([401,403,428].includes(replay.status),replay.text);assert.equal(queuedState(j),'succeeded|11|11');assert.equal(auditCount(j),'1');assert.equal(j.debt.credits(),'1');
});

test('fresh-MFA expiry denies first execution of an unconsumed recovery intent',{timeout:60000},async()=>{
 const j=await journey();j.maker=await j.ops.seedAgedSession(j.maker,590);j.body.expected_session_id=session(j.maker);
 const a=await approved(j);await new Promise(resolve=>setTimeout(resolve,11000));
 const r=await redrive(j,a);assert.equal(r.status,428,r.text);conserved(j);
});


// Consumed-receipt expiry proof uses real elapsed deadlines. The review-only
// case is an explicit owned short-TTL consent fixture; it never edits a receipt.
const consumedEffects=(j:Journey,id:string)=>owned.script(`SELECT jsonb_build_object(
 'job',(SELECT to_jsonb(v)FROM platform_queue_jobs v WHERE id='${j.debt.job}'),
 'jobs_for_source',(SELECT count(*)FROM platform_queue_jobs WHERE queue_name='loyalty-refunds'AND site_id='${j.debt.siteId}'AND event_id='${j.snapshot.redeemed_entry_id}'),
 'ledger',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM loyalty_ledger_entries v WHERE site_id='${j.debt.siteId}'AND order_id='${j.debt.order}'),
 'balance',(SELECT loyalty_balance(id)FROM loyalty_accounts WHERE site_id='${j.debt.siteId}'AND buyer_account_id='${j.debt.buyer}'),
 'receipt',(SELECT to_jsonb(v)FROM sensitive_action_approvals v WHERE id='${id}'),
 'audit',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM audit_logs v WHERE resource_id IN('${j.debt.job}','${id}')
  AND action IN('platform.job.redriven','sensitive_action.requested','sensitive_action.approved')));`);
const consumedDeadlines=(j:Journey,id:string)=>JSON.parse(owned.script(`WITH
 m AS(SELECT console_session_state_v1('${session(j.maker)}','${digest(j.maker.token)}')s),
 c AS(SELECT console_session_state_v1('${session(j.checker)}','${digest(j.checker.token)}')s),
 mp AS(SELECT console_permission_snapshot_v1('${session(j.maker)}','${digest(j.maker.token)}',true)s),
 cp AS(SELECT console_permission_snapshot_v1('${session(j.checker)}','${digest(j.checker.token)}',true)s)
 SELECT jsonb_build_object('observedMs',extract(epoch FROM clock_timestamp())*1000,
  'reviewDeadlineMs',extract(epoch FROM a.expires_at)*1000,
  'makerMfaDeadlineMs',extract(epoch FROM((m.s->>'mfa_verified_at')::timestamptz+interval '10 minutes'))*1000,
  'checkerMfaDeadlineMs',extract(epoch FROM((c.s->>'mfa_verified_at')::timestamptz+interval '10 minutes'))*1000,
  'makerActive',(m.s->>'accepted')::boolean,'checkerActive',(c.s->>'accepted')::boolean,
  'makerSuper',(m.s->>'is_super_admin')::boolean,'checkerSuper',(c.s->>'is_super_admin')::boolean,
  'makerActor',m.s->>'actor_id','checkerActor',c.s->>'actor_id',
  'makerFresh',coalesce((mp.s->>'accepted')::boolean,false),'checkerFresh',coalesce((cp.s->>'accepted')::boolean,false),
  'reviewExpired',a.expires_at<=clock_timestamp(),'consumed',a.consumed_at IS NOT NULL)
 FROM sensitive_action_approvals a CROSS JOIN m CROSS JOIN c CROSS JOIN mp CROSS JOIN cp WHERE a.id='${id}';`));
async function shortReviewedConsent(j:Journey){
 const a=await approval(j),name='a_syn_job_review_ttl_'+crypto.randomUUID().slice(0,8);
 assert.equal(owned.psql("SELECT tgenabled FROM pg_trigger WHERE tgrelid='sensitive_action_approvals'::regclass AND tgname='protect_sensitive_approval_v1';"),'O');
 // This single-row fixture shortens only a real independent pending->approved
 // decision. The canonical immutable-intent/expiry trigger remains enabled.
 owned.script(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $ttl$
 BEGIN IF NEW.id='${a.id}'AND OLD.status='pending'AND NEW.status='approved' THEN
  NEW.expires_at:=least(NEW.expires_at,clock_timestamp()+interval '10 seconds');END IF;RETURN NEW;END $ttl$;
 CREATE TRIGGER ${name} BEFORE UPDATE ON sensitive_action_approvals FOR EACH ROW EXECUTE FUNCTION public.${name}();`);
 try{const decided=await decision(j,a);assert.equal(decided.status,200,decided.text);return decided.json?.data.approval;}
 finally{owned.script(`DROP TRIGGER ${name} ON sensitive_action_approvals;DROP FUNCTION public.${name}();`);}
}
for(const expiry of ['maker','checker','review']as const)test('consumed recovery receipt replay is denied after '+expiry+' expiry without another budget, credit, receipt or effect audit',{timeout:45000},async()=>{
 const j=await journey();
 if(expiry==='maker'){j.maker=await j.ops.seedAgedSession(j.maker,590);j.body.expected_session_id=session(j.maker);}
 if(expiry==='checker')j.checker=await j.ops.seedAgedSession(j.checker,590);
 const a=expiry==='review'?await shortReviewedConsent(j):await approved(j);
 assert.equal((await redrive(j,a)).status,200);assert.equal(queuedState(j),'queued|10|11');
 await drain(j);assert.equal(queuedState(j),'succeeded|11|11');assert.equal(auditCount(j),'1');
 await j.ops.gateway.settle();
 const before=consumedEffects(j,a.id),fresh=consumedDeadlines(j,a.id);
 assert.equal(fresh.consumed,true);assert.equal(fresh.makerFresh,true);assert.equal(fresh.checkerFresh,true);assert.equal(fresh.reviewExpired,false);
 const positive=await redrive(j,a);assert.equal(positive.status,200,positive.text);assert.equal(positive.json?.data.replayed,true);
 assert.equal(digest(consumedEffects(j,a.id)),digest(before),'a valid cached replay does not mutate its consumed receipt or financial source');
 const deadline=expiry==='review'?fresh.reviewDeadlineMs:Math.max(fresh.reviewDeadlineMs,expiry==='maker'?fresh.makerMfaDeadlineMs:fresh.checkerMfaDeadlineMs);
 if(expiry==='review'){
  assert.ok(fresh.reviewDeadlineMs+1000<fresh.makerMfaDeadlineMs&&fresh.reviewDeadlineMs+1000<fresh.checkerMfaDeadlineMs,'short synthetic review deadline precedes both real MFA freshness deadlines');
 }
 const wait=deadline-Date.now()+200;assert.ok(wait>0&&wait<=15000,'the actual consumed receipt deadline is near but not yet expired');
 await new Promise(resolve=>setTimeout(resolve,wait));
 const expired=consumedDeadlines(j,a.id);
 assert.equal(expired.makerActive,true);assert.equal(expired.checkerActive,true);assert.equal(expired.makerSuper,true);assert.equal(expired.checkerSuper,true);
 assert.equal(expired.makerActor,j.maker.id);assert.equal(expired.checkerActor,j.checker.id);assert.notEqual(expired.makerActor,expired.checkerActor);
 assert.equal(expired.reviewExpired,true);assert.equal(expired.consumed,true);
 assert.equal(expired.makerFresh,expiry!=='maker');assert.equal(expired.checkerFresh,expiry!=='checker');
 const denied=await redrive(j,a);assert.equal(denied.status,428,denied.text);
 assert.equal(denied.json?.error?.code,expiry==='maker'?'STEP_UP_REQUIRED':'APPROVAL_EXPIRED_OR_REVOKED');
 await j.ops.gateway.settle();const after=consumedEffects(j,a.id);
 assert.equal(digest(after),digest(before),'expiry refusal conserves the complete job/budget, original ledger credit, consumed receipt and effect audits');
 assert.equal(queuedState(j),'succeeded|11|11');assert.equal(j.debt.credits(),'1');assert.equal(j.debt.balance(),'199');assert.equal(auditCount(j),'1');assert.equal(recoveryCount(j),'1');
 console.info('OWNED_353_CONSUMED_EXPIRY '+JSON.stringify({expiry,fresh,expired,deniedStatus:denied.status,deniedCode:denied.json?.error?.code,
  beforeEffectsSha256:digest(before),afterEffectsSha256:digest(after),stateConserved:before===after,syntheticShortConsentTtl:expiry==='review',normalBrowserOrProcessRestartClaim:false}));
});

test('job, audit, receipt and in-transaction authority faults roll back the entire operation',async()=>{
 const j=await journey(),a=await approved(j),checkerSession=session(j.checker);
 for(const kind of ['job','audit','receipt','authority']){
  const suffix=crypto.randomUUID().slice(0,8),name='syn_job_fault_'+suffix;
  const table=kind==='audit'?'audit_logs':kind==='receipt'?'sensitive_action_approvals':'platform_queue_jobs';
  const condition=kind==='audit'?`NEW.action='platform.job.redriven'AND NEW.resource_id='${j.debt.job}'`:kind==='receipt'?`NEW.id='${a.id}'AND NEW.consumed_at IS NOT NULL`:`NEW.id='${j.debt.job}'AND NEW.status='queued'`;
  const effect=kind==='authority'?`UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp()WHERE id='${checkerSession}';`:`RAISE EXCEPTION 'Synthetic ${kind} transaction fault';`;
  owned.psql(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN IF ${condition} THEN ${effect} END IF;RETURN NEW;END $fault$;CREATE TRIGGER ${name} BEFORE ${kind==='audit'?'INSERT':'UPDATE'} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${name}();`);
  try{const r=await redrive(j,a);assert.equal(r.status,503,kind+':'+r.text);conserved(j);assert.equal(owned.psql(`SELECT consumed_at IS NULL FROM sensitive_action_approvals WHERE id='${a.id}';`),'t');
   assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${checkerSession}';`),'active');}
  finally{owned.psql(`DROP TRIGGER ${name} ON public.${table};DROP FUNCTION public.${name}();`);}
 }
 assert.equal((await redrive(j,a)).status,200);await drain(j);
});

test('an exhausted retry needs a new independent approval; old receipt cannot silently extend the budget',async()=>{
 const j=await journey(),first=await approved(j);assert.equal((await redrive(j,first)).status,200);
 const fault=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/recover_loyalty_refund_job_v1'?restJson(503,{message:'Synthetic further transient outage'}):forward());
 try{await consumeLoyaltyRefundJobs(owned.restEnv(),'syn-new-exhaustion-'+crypto.randomUUID());}finally{fault.restore();}
 assert.equal(queuedState(j),'dead|11|11');assert.equal(j.debt.credits(),'0');
 assert.equal((await redrive(j,first)).status,200);assert.equal(queuedState(j),'dead|11|11');
 const current=await inspect(j);const fingerprint=String(current.json?.data.items[0].source_fingerprint);
 assert.equal((await request(j,{source_fingerprint:fingerprint})).status,409);
 j.body={...j.body,request_key:crypto.randomUUID(),source_fingerprint:fingerprint};
 const next=await approved(j);assert.notEqual(next.id,first.id);assert.equal((await redrive(j,next)).status,200);assert.equal(queuedState(j),'queued|11|12');
 await drain(j);assert.equal(queuedState(j),'succeeded|12|12');assert.equal(auditCount(j),'2');assert.equal(j.debt.credits(),'1');
});

test('attempt overflow and poisoned source stay ineligible rather than accepting another review',async()=>{
 const j=await journey();owned.psql(`UPDATE platform_queue_jobs SET attempts=2147483647,max_attempts=2147483647 WHERE id='${j.debt.job}';`);
 const current=await inspect(j);assert.equal(current.json?.data.items[0].eligible,false);assert.equal(current.json?.data.items[0].reason_code,'attempt_limit');
 const r=await request(j,{source_fingerprint:current.json?.data.items[0].source_fingerprint});assert.equal(r.status,409,r.text);assert.equal(recoveryCount(j),'0');assert.equal(auditCount(j),'0');
});

test('a conflicting ledger receipt is an invalid source, not a claim that the debt was settled',async()=>{
 const j=await journey();
 owned.psql(`INSERT INTO loyalty_ledger_entries(site_id,loyalty_account_id,order_id,entry_type,points,balance_after,idempotency_key,metadata)
  SELECT r.site_id,r.loyalty_account_id,r.order_id,'adjustment_credit',0,149,'loyalty.refund_credit:'||r.order_id::text||':'||r.id::text,'{}'
  FROM loyalty_ledger_entries r WHERE r.id='${j.snapshot.redeemed_entry_id}';`);
 const r=await inspect(j);assert.equal(r.json?.data.items[0].eligible,false);assert.equal(r.json?.data.items[0].reason_code,'source_unavailable');
 assert.equal((await request(j,{source_fingerprint:r.json?.data.items[0].source_fingerprint})).status,409);assert.equal(j.debt.credits(),'0');assert.equal(j.debt.balance(),'149');
});
