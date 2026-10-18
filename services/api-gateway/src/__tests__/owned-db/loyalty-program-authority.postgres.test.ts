// Canonical merchant settings writer on the fully migrated owned database.
// Synthetic SQL actors here prove database authority; normal merchant UI is a separate gate.
import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {readFileSync} from 'node:fs';
import {startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';

const owned=requireOwnedDatabase();
function fixture(){
 const site=newSyntheticTenant('loy-config-'+crypto.randomUUID().slice(0,6));
 seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),email=`syn-loy-owner-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`);
 return {...site,owner,email};
}
const setter=(site:string,rate:number,actor:string)=>`SELECT public.set_loyalty_program('${site}',p_is_active=>true,p_earn_rate_bps=>${rate},p_actor_id=>'${actor}',p_actor_type=>'user');`;
const tenant=(site:string,sql:string)=>`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${site}',true);${sql}COMMIT;`;

test('the actual tenant role can write its scoped programme and cannot use a different or absent scope',()=>{
 const a=fixture(),b=fixture();
 const positive=owned.psql(tenant(a.siteId,setter(a.siteId,100,a.owner)));
 assert.match(positive,/"created": true/);
 assert.match(owned.psqlExpectError(tenant(a.siteId,setter(b.siteId,200,b.owner))),/tenant context|permission denied/);
 const absent=owned.psqlExpectError(tenant('',setter(b.siteId,300,b.owner)));
 assert.match(absent,/tenant context|permission denied/,'an app_tenant caller without app.site_id must fail closed');
 assert.equal(owned.psql(`SELECT count(*) FROM loyalty_programs WHERE site_id='${b.siteId}';`),'0');
});

async function waitFor(sql:string,expected:string,label:string){
 const end=Date.now()+8000;
 while(Date.now()<end){if(owned.psql(sql)===expected)return;await new Promise(resolve=>setTimeout(resolve,40));}
 assert.equal(owned.psql(sql),expected,label);
}
test('two first-time saves serialize before reading and form one creation followed by one attributable update',async()=>{
 const site=fixture(),suffix=crypto.randomUUID().replaceAll('-','').slice(0,12),gate=String(BigInt('0x'+suffix));
 const keeper='syn-loy-keeper-'+suffix,writers=[1,2].map(n=>'syn-loy-write-'+suffix+'-'+n);
 const fn='syn_loy_gate_'+suffix,trigger='syn_loy_gate_'+suffix;
 owned.psql(`CREATE FUNCTION public.${fn}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM pg_advisory_xact_lock(${gate}::bigint);RETURN NEW;END$$;
  CREATE TRIGGER ${trigger} BEFORE INSERT ON public.loyalty_programs FOR EACH ROW WHEN(NEW.site_id='${site.siteId}') EXECUTE FUNCTION public.${fn}();`);
 const holding=owned.psqlAsync(`SET application_name='${keeper}';SELECT pg_advisory_lock(${gate}::bigint);SELECT pg_sleep(30);`).catch(()=> 'cancelled owned keeper');
 let writes:Promise<string>[]=[];
 const release=()=>owned.psql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${keeper}' AND pid<>pg_backend_pid();`);
 try{
  await waitFor(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${keeper}' AND wait_event='PgSleep';`,'1','owned keeper holds the insertion barrier');
  writes=writers.map((name,n)=>owned.psqlAsync(`SET application_name='${name}';${tenant(site.siteId,setter(site.siteId,(n+1)*100,site.owner))}`));
  await waitFor(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name IN('${writers.join("','")}') AND wait_event_type='Lock';`,'2','both real transactions reached a deterministic lock boundary');
  release();await holding;
  const results=await Promise.all(writes);
  assert.equal(results.filter(result=>/"created": true/.test(result)).length,1,'one first-time save creates; the second sees the committed programme');
  assert.equal(results.filter(result=>/"created": false/.test(result)).length,1);
  const audits=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('action',action,'before',old_values,'after',new_values)ORDER BY created_at,id)
   FROM audit_logs WHERE resource_type='loyalty_program' AND resource_id='${site.siteId}';`));
  assert.equal(audits.length,2);
  const creation=audits.find((row:{action:string})=>row.action==='loyalty_program.created');
  const update=audits.find((row:{action:string})=>row.action==='loyalty_program.updated');
  assert.ok(creation);assert.ok(update);assert.equal(creation.before,null);
  assert.deepEqual(update.before,creation.after,'the update audit starts at the actual prior committed configuration');
 }finally{
  release();await holding;await Promise.allSettled(writes);
  owned.psql(`DROP TRIGGER ${trigger} ON public.loyalty_programs;DROP FUNCTION public.${fn}();`);
 }
});

let proxy:OwnedPooledSqlProxy|undefined;
after(async()=>{await proxy?.stop();});
async function apiFixture(){
 const f=fixture();proxy??=await startOwnedPooledSqlProxy(owned);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 const save=async(intent:Record<string,unknown>,version:string|null=null,key=crypto.randomUUID(),actor=f.owner,email=f.email)=>gateway.request('/v1/loyalty/program',{
  method:'PUT',headers:{...await signedIdentityHeaders(actor,email),'X-Idempotency-Key':key},
  body:JSON.stringify({store_id:f.siteId,expected_updated_at:version,...intent}),
 });
 const read=async(actor=f.owner,email=f.email)=>gateway.request('/v1/loyalty/program?store_id='+f.siteId,{headers:await signedIdentityHeaders(actor,email)});
 const audits=()=>owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_type='loyalty_program' AND resource_id='${f.siteId}';`);
 const receipts=()=>owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.siteId}' AND scope LIKE 'merchant-loyalty-program-v1:%';`);
 return {...f,gateway,save,read,audits,receipts};
}
test('the actual worker/pooled tenant route creates, reads exact values and updates only the submitted fields',async()=>{
 const f=await apiFixture(),empty=await f.read();assert.equal(empty.status,200,empty.text);
 assert.equal(empty.json?.data.enrolled,false);assert.equal(empty.json?.data.program,null);
 const created=await f.save({is_active:true,earn_rate_bps:1000,point_value_minor:'9007199254740993'});
 assert.equal(created.status,200,created.text);assert.equal(created.json?.data.point_value_minor,'9007199254740993');
 const read=await f.read();assert.equal(read.status,200,read.text);
 assert.equal(read.json?.data.program.point_value_minor,'9007199254740993');
 assert.equal(read.json?.data.outstanding_points,'0');assert.equal(read.json?.data.value_decrease_allowed,true);
 assert.equal(read.json?.data.program.updated_at,created.json?.data.updated_at,'microsecond version survives pooled read and JSON');
 const updated=await f.save({is_active:false},read.json?.data.program.updated_at);
 assert.equal(updated.status,200,updated.text);assert.equal(updated.json?.data.is_active,false);
 assert.equal(updated.json?.data.earn_rate_bps,1000);assert.equal(updated.json?.data.point_value_minor,'9007199254740993');
 assert.notEqual(updated.json?.data.updated_at,created.json?.data.updated_at);
 assert.equal(f.audits(),'2');assert.equal(f.receipts(),'2');
});
test('same-key concurrent saves and a committed lost reply replay exactly once; changed intent conflicts',async()=>{
 const f=await apiFixture(),key=crypto.randomUUID(),intent={is_active:true,earn_rate_bps:200};
 const results=await Promise.all([1,2,3].map(()=>f.save(intent,null,key)));
 results.forEach(result=>assert.equal(result.status,200,result.text));
 assert.equal(new Set(results.map(result=>result.json?.data.updated_at)).size,1);
 assert.equal(results.filter(result=>result.headers.get('X-Idempotency-Replayed')==='false').length,1);
 // Deliberately discard the first committed response, then resend identical bytes/key.
 const recovered=await f.save(intent,null,key);assert.equal(recovered.status,200,recovered.text);
 assert.equal(recovered.headers.get('X-Idempotency-Replayed'),'true');assert.deepEqual(recovered.json?.data,results[0].json?.data);
 const conflict=await f.save({is_active:false},null,key);assert.equal(conflict.status,409,conflict.text);
 assert.equal(conflict.json?.error.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.audits(),'1');assert.equal(f.receipts(),'1');
});
test('different saves racing an initial or existing version cannot silently overwrite a newer configuration',async()=>{
 const f=await apiFixture();
 const initial=await Promise.all([f.save({earn_rate_bps:100}),f.save({earn_rate_bps:200})]);
 assert.deepEqual(initial.map(reply=>reply.status).sort(),[200,409]);
 const version=initial.find(reply=>reply.status===200)?.json?.data.updated_at;
 const updates=await Promise.all([f.save({is_active:true},version),f.save({redeem_cap_bps:2000},version)]);
 assert.deepEqual(updates.map(reply=>reply.status).sort(),[200,409]);
 assert.equal(updates.find(reply=>reply.status===409)?.json?.error.code,'LOYALTY_VERSION_CONFLICT');
 assert.equal(f.audits(),'2');assert.equal(f.receipts(),'2');
});
test('unknown subjects, active staff and a changed owner cannot read, save or replay another merchant receipt',async()=>{
 const f=await apiFixture(),other=fixture(),key=crypto.randomUUID();
 const created=await f.save({is_active:true},null,key);assert.equal(created.status,200,created.text);
 owned.psql(`INSERT INTO employees(store_id,user_id,email,role,status,is_active,permissions,created_by)
  VALUES('${f.siteId}','${other.owner}','${other.email}','manager','active',true,'{"granted":["settings:write"]}','${f.owner}');`);
 for(const [actor,email] of [[other.owner,other.email],[crypto.randomUUID(),f.email]]){
  for(const response of [await f.read(actor,email),await f.save({is_active:true},null,key,actor,email)])assert.equal(response.status,403,response.text);
 }
 owned.psql(`UPDATE sites SET custom_user_id='${other.owner}' WHERE id='${f.siteId}';`);
 const stale=await f.save({is_active:true},null,key);assert.equal(stale.status,403,stale.text);
 assert.equal(f.audits(),'1');assert.equal(f.receipts(),'1');
});
test('a mandatory audit or receipt failure rolls back all effects, then the same request recovers',async()=>{
 for(const table of ['audit_logs','idempotency_keys']){
 const f=await apiFixture(),key=crypto.randomUUID();
 owned.psql(`CREATE FUNCTION syn_loy_audit_fault()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF NEW.resource_type='loyalty_program' AND NEW.resource_id='${f.siteId}' THEN RAISE EXCEPTION 'Synthetic mandatory loyalty audit failure';END IF;RETURN NEW;END$$;
  CREATE TRIGGER syn_loy_audit_fault BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION syn_loy_audit_fault();`);
 try{
  const failed=await f.save({is_active:true},null,key);assert.equal(failed.status,500,failed.text);
  assert.equal(owned.psql(`SELECT count(*) FROM loyalty_programs WHERE site_id='${f.siteId}';`),'0');assert.equal(f.audits(),'0');assert.equal(f.receipts(),'0');
 }finally{owned.psql(`DROP TRIGGER syn_loy_audit_fault ON ${table};DROP FUNCTION syn_loy_audit_fault();`);}
 const recovered=await f.save({is_active:true},null,key);assert.equal(recovered.status,200,recovered.text);assert.equal(f.audits(),'1');assert.equal(f.receipts(),'1');
 }
});
function paidOrder(f:ReturnType<typeof fixture>,buyer:string){
 const id=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,site_id,store_id,order_number,customer_email,shipping_address,items,total,subtotal,payment_status)
  VALUES('${id}','${f.siteId}','${f.siteId}','SYN-${id}','syn-loy-${id}@example.invalid','{}','[]',1000,1000,'paid');
  INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${id}','${buyer}','${f.siteId}','authenticated_checkout');`);return id;
}
function buyer(){const id=crypto.randomUUID();owned.psql(`INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${id}','syn-loy-${id}@example.invalid',true);`);return id;}
test('the owner policy blocks decreases with points, permits increases and permits decreases only after full redemption',async()=>{
 const f=await apiFixture(),subject=buyer();const c=await f.save({is_active:true,earn_rate_bps:1000});assert.equal(c.status,200,c.text);
 const order=paidOrder(f,subject);owned.psql(`SELECT award_loyalty_points('${f.siteId}','${subject}','${order}','syn-policy-earn');`);
 const blocked=await f.save({point_value_minor:'50'},c.json?.data.updated_at);
 assert.equal(blocked.status,409,blocked.text);assert.equal(blocked.json?.error.code,'LOYALTY_VALUE_DECREASE_BLOCKED');
 assert.equal(f.audits(),'1');assert.equal(f.receipts(),'1');assert.equal((await f.read()).json?.data.value_decrease_allowed,false);
 const raised=await f.save({point_value_minor:'150'},c.json?.data.updated_at);assert.equal(raised.status,200,raised.text);
 assert.equal(raised.json?.data.liability_delta_minor,'5000');assert.equal(raised.json?.data.outstanding_points,'100');
 // A fresh order with enough authoritative payable amount consumes all 100 points.
 const spend=paidOrder(f,subject);owned.psql(`UPDATE orders SET total=1000 WHERE id='${spend}';
  SELECT redeem_loyalty_points('${f.siteId}','${subject}','${spend}',100,'syn-policy-spend',100000);`);
 const lowered=await f.save({point_value_minor:'50'},raised.json?.data.updated_at);assert.equal(lowered.status,200,lowered.text);
 assert.equal(lowered.json?.data.outstanding_points,'0');assert.equal(lowered.json?.data.value_decrease_allowed,true);
 const restore=owned.psql(`UPDATE orders SET status='cancelled'WHERE id='${spend}';SELECT restore_loyalty_on_refund('${f.siteId}','${spend}');`);assert.match(restore,/"restored": true/);
 assert.equal((await f.read()).json?.data.value_decrease_allowed,false,'refunded points still count as outstanding');
 assert.equal((await f.save({point_value_minor:'25'},lowered.json?.data.updated_at)).status,409);
});

test('a value decrease waits for an in-flight earn or refund and then refuses the newly outstanding points',async()=>{
 for(const kind of ['earned','refund_credit']){
  const f=fixture(),subject=buyer(),order=paidOrder(f,subject);
  owned.psql(setter(f.siteId,1000,f.owner));
  let posting=`SELECT award_loyalty_points('${f.siteId}','${subject}','${order}','syn-earn-race');`;
  if(kind==='refund_credit'){
   owned.psql(posting);owned.psql(`SELECT redeem_loyalty_points('${f.siteId}','${subject}','${order}',100,'syn-refund-race-spend',100000);UPDATE orders SET status='cancelled'WHERE id='${order}';`);
   posting=`SELECT restore_loyalty_on_refund('${f.siteId}','${order}');`;
  }
  assert.equal(owned.psql(`SELECT loyalty_outstanding_points('${f.siteId}');`),'0');
  const suffix=crypto.randomUUID().replaceAll('-','').slice(0,12),gate=String(BigInt('0x'+suffix));
  const fn='syn_loy_credit_'+suffix,keeper='syn-credit-keeper-'+suffix,credit='syn-credit-'+suffix,edit='syn-edit-'+suffix;
  owned.psql(`CREATE FUNCTION public.${fn}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM pg_advisory_xact_lock(${gate}::bigint);RETURN NEW;END$$;
   CREATE TRIGGER ${fn} BEFORE INSERT ON loyalty_ledger_entries FOR EACH ROW WHEN(NEW.site_id='${f.siteId}' AND NEW.entry_type='${kind}')EXECUTE FUNCTION public.${fn}();`);
  const held=owned.psqlAsync(`SET application_name='${keeper}';SELECT pg_advisory_lock(${gate}::bigint);SELECT pg_sleep(30);`).catch(()=> 'cancelled owned keeper');
  const release=()=>owned.psql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${keeper}' AND pid<>pg_backend_pid();`);
  let credited:Promise<string>|undefined,edited:Promise<string>|undefined;
  try{
   await waitFor(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${keeper}' AND wait_event='PgSleep';`,'1','owned insertion barrier is held');
   credited=owned.psqlAsync(`SET application_name='${credit}';${posting}`).catch(error=>String(error.message));
   await waitFor(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${credit}' AND wait_event_type='Lock';`,'1','credit holds shared programme authority while waiting at insertion');
   edited=owned.psqlAsync(`SET application_name='${edit}';${tenant(f.siteId,`SELECT set_loyalty_program('${f.siteId}',p_point_value_minor=>50,p_actor_id=>'${f.owner}');`)}`).catch(error=>String(error.message));
   await waitFor(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${edit}' AND wait_event_type='Lock';`,'1','decrease waits for in-flight points');
   release();await held;assert.match(await credited,new RegExp(kind==='earned'?'"awarded": true':'"restored": true'));
   assert.match(await edited,/LOYALTY_VALUE_DECREASE_BLOCKED/);
   assert.equal(owned.psql(`SELECT point_value_minor FROM loyalty_programs WHERE site_id='${f.siteId}';`),'100');
   assert.equal(owned.psql(`SELECT loyalty_outstanding_points('${f.siteId}');`),'100');
  }finally{
   release();await held;await Promise.allSettled([credited,edited].filter((value):value is Promise<string>=>Boolean(value)));
   owned.psql(`DROP TRIGGER ${fn} ON loyalty_ledger_entries;DROP FUNCTION public.${fn}();`);
  }
 }
});

test('a decrease committed before the next earn uses the new allowed value and retains its at-earn snapshot',()=>{
 const f=fixture(),subject=buyer(),order=paidOrder(f,subject);owned.psql(setter(f.siteId,1000,f.owner));
 owned.psql(`SELECT set_loyalty_program('${f.siteId}',p_point_value_minor=>50);SELECT award_loyalty_points('${f.siteId}','${subject}','${order}','syn-after-lower');`);
 assert.equal(owned.psql(`SELECT metadata->>'point_value_minor' FROM loyalty_ledger_entries WHERE order_id='${order}' AND entry_type='earned';`),'50');
 assert.match(owned.psqlExpectError(`SELECT set_loyalty_program('${f.siteId}',p_point_value_minor=>25);`),/LOYALTY_VALUE_DECREASE_BLOCKED/);
});

test('all ordinary roles are refused raw table writes and browser roles cannot invoke settings authority',()=>{
 for(const role of ['anon','authenticated','app_tenant','service_role']){
  assert.equal(owned.psql(`SELECT has_table_privilege('${role}','public.loyalty_programs','INSERT,UPDATE,DELETE');`),'f');
 }
 for(const role of ['anon','authenticated'])for(const signature of ['public.set_loyalty_program(uuid,boolean,integer,integer,bigint,uuid,text,text,text)',
  'public.mutate_loyalty_program_v1(uuid,uuid,jsonb,text,timestamptz,text)','public.read_loyalty_program_v1(uuid,uuid)'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
 const f=fixture();assert.match(owned.psqlExpectError(tenant('',`SELECT mutate_loyalty_program_v1('${f.siteId}','${f.owner}','{"is_active":true}','syn-empty-context',NULL);`)),/tenant context/);
 assert.match(owned.psqlExpectError(tenant(f.siteId,setter(f.siteId,100,crypto.randomUUID()))),/owner is required/);
 assert.match(owned.psqlExpectError(tenant('',`SELECT read_loyalty_program_v1('${f.siteId}','${f.owner}');`)),/tenant context/);
 assert.match(owned.psqlExpectError(tenant(f.siteId,`SELECT read_loyalty_program_v1('${f.siteId}','${crypto.randomUUID()}');`)),/owner is required/);
 for(const table of ['loyalty_accounts','loyalty_ledger_entries']){
  assert.equal(owned.psql(`SELECT has_table_privilege('app_tenant','public.${table}','SELECT');`),'f','aggregate reading must not grant private buyer rows');
 }
});
test('334 refuses rollback ABI drift and reapply preserves settings, immutable entries, receipts, definitions and grants',()=>{
 const forward=readFileSync('database/supabase/migrations/334_loyalty_program_authority.sql','utf8'),rollback=readFileSync('database/supabase/rollback/334_loyalty_program_authority.rollback.sql','utf8');
 const snapshot=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('set_loyalty_program','mutate_loyalty_program_v1','read_loyalty_program_v1','award_loyalty_points','redeem_loyalty_points','restore_loyalty_on_refund');`);
 const retained=()=>owned.psql(`SELECT jsonb_build_object('programs',(SELECT jsonb_agg(to_jsonb(x)ORDER BY site_id)FROM loyalty_programs x),'entries',(SELECT count(*)FROM loyalty_ledger_entries),
  'audit',(SELECT count(*)FROM audit_logs WHERE resource_type='loyalty_program'),'receipts',(SELECT count(*)FROM idempotency_keys WHERE scope LIKE 'merchant-loyalty-program-v1:%'));`);
 // This is the334 rollback contract. Unwind the later335 definition first,
 // then prove the original round-trip and reapply335 to preserve current source.
 const latest=snapshot();
 const reversalRollback=readFileSync('database/supabase/rollback/335_durable_loyalty_refund_recovery.rollback.sql','utf8');
 const reversalForward=readFileSync('database/supabase/migrations/335_durable_loyalty_refund_recovery.sql','utf8');
 owned.script(reversalRollback);
 const before=snapshot(),data=retained(),body=rollback.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
 const drift=owned.psqlExpectError(`BEGIN;CREATE FUNCTION public.set_loyalty_program(synthetic_arg integer)RETURNS integer LANGUAGE sql AS $$SELECT 1$$;${body}COMMIT;`);
 assert.match(drift,/rollback 334 refuses to run/);assert.equal(snapshot(),before);
 owned.script(rollback);assert.equal(retained(),data);assert.equal(owned.psql("SELECT to_regprocedure('public.mutate_loyalty_program_v1(uuid,uuid,jsonb,text,timestamptz,text)') IS NULL;"),'t');
 owned.script(forward);assert.equal(snapshot(),before);assert.equal(retained(),data);
 assert.equal(owned.psql("SELECT has_table_privilege('service_role','public.loyalty_programs','UPDATE');"),'f');
 owned.script(reversalForward);assert.equal(snapshot(),latest);assert.equal(retained(),data);
});
