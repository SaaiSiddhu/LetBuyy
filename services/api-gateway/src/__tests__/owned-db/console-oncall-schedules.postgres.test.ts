// Real mounted worker/PostgREST/owned PostgreSQL. Synthetic trusted-issuer
// credentials here are not normal browser sign-in or provider email evidence.
import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { tapRest, IDENTITY_ISSUER } from './gateway-harness';
import { operatorIdentityKeys } from './operator-identity-fixture';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';

const owned=requireOwnedDatabase();
const path='/v1/internal/console/operations/oncall/schedules';
const signature='public.read_console_oncall_schedules_v1(uuid,text,text,integer,integer,text,text)';
const migration362=readFileSync('database/supabase/migrations/362_console_oncall_schedules.sql','utf8');
const rollback362=readFileSync('database/supabase/rollback/362_console_oncall_schedules.rollback.sql','utf8');
const gateways:Array<Awaited<ReturnType<typeof consoleFixture>>['gateway']>=[];
async function fixture(){const f=await consoleFixture(owned);gateways.push(f.gateway);return f;}
afterEach(async()=>{for(const gateway of gateways.splice(0))await gateway.settle();});
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function seedCurrent(){
 const id=crypto.randomUUID(),team='synthetic-current-oncall-'+crypto.randomUUID();
 owned.script(`INSERT INTO oncall_schedules(id,team_name,rotation_name,starts_at,ends_at,active,paging_adapter,metadata)VALUES
  ('${id}','${team}','Synthetic current',clock_timestamp()-interval '1 millisecond',NULL,true,'dry_run','{"private_marker":"synthetic-private-oncall"}');`);
 return {id,team};
}
function collection(){return owned.script("SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]'),'sha256'),'hex')FROM oncall_schedules s;");}
function readAudits(actor:string){return owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${actor}'AND action='console.oncall.schedules.read';`);}
function maintenanceState(){return digest(owned.script(`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid)FROM pg_proc p WHERE(pronamespace='public'::regnamespace AND proname='read_console_oncall_schedules_v1')OR(prokind IN('f','p')AND prosrc ILIKE '%read_console_oncall_schedules_v1%')),
 'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature)FROM migration_privilege_journal j WHERE migration='362'),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
  (SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0))ORDER BY c.oid)FROM pg_class c WHERE c.oid IN('oncall_schedules'::regclass,'audit_logs'::regclass)),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolcanlogin,rolbypassrls,rolconfig)ORDER BY oid)FROM pg_roles WHERE rolname IN('service_role','anon','authenticated','app_tenant')),
 'oncall',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id)FROM oncall_schedules s),
 'audits',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id)FROM audit_logs a));`));}
let maintenanceId:string;
before(()=>{maintenanceId=seedCurrent().id;owned.script("INSERT INTO audit_logs(actor_type,action,resource_type,metadata)VALUES('system','synthetic.oncall.retained','oncall_schedule','{}');");});

test('362 clean retirement/reapply retains all preexisting schedule and audit data',()=>{
 const schedules=collection(),audits=owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;');
 owned.script(rollback362);assert.equal(owned.psql(`SELECT to_regprocedure('${signature}')IS NULL;`),'t');
 assert.equal(collection(),schedules);assert.equal(owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;'),audits);
 owned.script(migration362);assert.equal(collection(),schedules);assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='362';"),'2');
});
test('362 rollback refuses an unknown overload without changing authority',()=>{
 owned.script("CREATE FUNCTION public.read_console_oncall_schedules_v1(integer)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;");
 try{const s=maintenanceState();assert.match(owned.psqlExpectError(rollback362),/rollback362 refuses unexpected current oncall function family/);assert.equal(maintenanceState(),s);}
 finally{owned.script('DROP FUNCTION public.read_console_oncall_schedules_v1(integer)RESTRICT;');}
});
test('362 forward refuses a preexisting family without changing it',()=>{
 owned.script(rollback362);owned.script("CREATE FUNCTION public.read_console_oncall_schedules_v1(integer)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;");
 try{const s=maintenanceState();assert.match(owned.psqlExpectError(migration362),/migration362 refuses preexisting function family/);assert.equal(maintenanceState(),s);}
 finally{owned.script('DROP FUNCTION public.read_console_oncall_schedules_v1(integer)RESTRICT;');owned.script(migration362);}
});
const drifts=[
 ['body/default',`CREATE OR REPLACE FUNCTION public.read_console_oncall_schedules_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,p_page integer,p_limit integer,p_active text,p_team_name text DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$BEGIN RETURN '{}'::jsonb;END$$;`],
 ['owner',`ALTER FUNCTION ${signature} OWNER TO service_role;`],
 ['grant option',`GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION;`],
 ['ordinary ACL',`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`],
 ['role profile','ALTER ROLE service_role LOGIN;'],
 ['source column shape','ALTER TABLE oncall_schedules ADD COLUMN synthetic_unknown text;'],
 ['source default',"ALTER TABLE oncall_schedules ALTER COLUMN timezone SET DEFAULT 'Synthetic unknown';"],
 ['canonical body',`CREATE OR REPLACE FUNCTION public.console_session_state_v1(p_session_id uuid,p_cookie_sha256 text)RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$BEGIN RETURN '{}'::jsonb;END$$;`],
 ['provenance',"UPDATE migration_privilege_journal SET object_definition_hash=repeat('0',64)WHERE migration='362';"],
 ['external view',`CREATE VIEW public.syn_oncall_dependency AS SELECT public.read_console_oncall_schedules_v1(NULL::uuid,NULL::text,NULL::text,1,25,'all',NULL);`],
 ['external routine',`CREATE FUNCTION public.syn_oncall_dependency()RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN RETURN public.read_console_oncall_schedules_v1(NULL,NULL,NULL,1,25,'all',NULL);END$$;`],
 ['function kind',`DROP FUNCTION ${signature} RESTRICT;CREATE PROCEDURE public.read_console_oncall_schedules_v1(uuid,text,text,integer,integer,text,text)LANGUAGE plpgsql AS $$BEGIN NULL;END$$;`],
]as const;
for(const[label,change]of drifts)test('362 rollback refuses changed '+label+' before any retirement',()=>{
 const s=maintenanceState();assert.match(owned.psqlExpectError('BEGIN;'+change+rollback362),/rollback362 refuses/);assert.equal(maintenanceState(),s);
});
for(const[label,change]of [
 ['source shape','ALTER TABLE oncall_schedules ADD COLUMN synthetic_unknown text;'],
 ['role profile','ALTER ROLE service_role LOGIN;'],
 ['default grants','ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticator;'],
 ['canonical body',`CREATE OR REPLACE FUNCTION public.console_session_state_v1(p_session_id uuid,p_cookie_sha256 text)RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$BEGIN RETURN '{}'::jsonb;END$$;`],
]as const)test('362 forward refuses unknown '+label+' without authority change',()=>{
 owned.script(rollback362);try{const s=maintenanceState();assert.match(owned.psqlExpectError('BEGIN;'+change+migration362),/migration362 (refuses|requires)/);assert.equal(maintenanceState(),s);}finally{owned.script(migration362);}
});
for(const direction of ['forward','rollback']as const)test('362 '+direction+' refuses a stale or non-read-committed maintenance snapshot',()=>{
 if(direction==='forward')owned.script(rollback362);
 try{for(const isolation of ['REPEATABLE READ','SERIALIZABLE','READ UNCOMMITTED']){const s=maintenanceState();assert.match(owned.psqlExpectError('BEGIN ISOLATION LEVEL '+isolation+';SELECT count(*)FROM pg_proc;'+(direction==='forward'?migration362:rollback362)),/362 refuses concurrent\/prepared writes or non-read-committed state/);assert.equal(maintenanceState(),s);}}
 finally{if(direction==='forward')owned.script(migration362);}
});

for (const kind of ['catalog', 'source'] as const) for (const direction of ['forward', 'rollback'] as const) test('362 ' + direction + ' refuses a natural uncommitted ' + kind + ' writer without a cooperative catalog lock', { timeout: 40000 }, async () => {
    if (direction === 'forward') owned.script(rollback362);
    const token = crypto.randomUUID().replaceAll('-', '');
    const table = 'syn_oncall_gate_' + token;
    const holderName = 'syn-oncall-hold-' + token;
    const creatorName = 'syn-oncall-create-' + token;
    const key = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000 + 1000000000;
    const before = maintenanceState();
    owned.script(`CREATE TABLE public.${table}(released boolean NOT NULL);INSERT INTO public.${table} VALUES(false);`);
    const holder = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${holderName}';SELECT pg_advisory_xact_lock(${key}::bigint);
      DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '15 seconds';BEGIN
       WHILE NOT(SELECT released FROM public.${table}) LOOP
        IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'Synthetic oncall gate not released';END IF;PERFORM pg_sleep(0.01);
       END LOOP;END$$;COMMIT;`).then(() => null, (e: Error) => e);
    let creator: Promise<Error | null> | undefined;
    try {
        const deadline = Date.now() + 5000;
        while (owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${holderName}' AND a.datname=current_database() AND l.locktype='advisory' AND l.objid=${key} AND l.granted);`) !== 't') {
            assert.ok(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 25));
        }
        const statement = kind === 'catalog' ? `CREATE FUNCTION public.read_console_oncall_schedules_v1() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
            : `UPDATE oncall_schedules SET rotation_name=rotation_name WHERE id='${maintenanceId}';`;
        creator = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${creatorName}';${statement}SELECT pg_advisory_xact_lock(${key}::bigint);${kind === 'catalog' ? 'COMMIT' : 'ROLLBACK'};`).then(() => null, (e: Error) => e);
        const creatorDeadline = Date.now() + 5000;
        while (owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND a.datname=current_database() AND l.locktype='advisory' AND l.objid=${key} AND NOT l.granted)
          AND EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted);`) !== 't') {
            assert.ok(Date.now() < creatorDeadline); await new Promise(resolve => setTimeout(resolve, 25));
        }
        //360's native DDL guard may read pg_proc. AccessShareLock does not
        // serialize this writer with the maintenance ShareRowExclusive lock.
        assert.equal(owned.psql(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.relation='pg_proc'::regclass AND l.granted AND l.mode<>'AccessShareLock';`), '0');
        assert.match(owned.psqlExpectError("SET statement_timeout='3s';" + (direction === 'forward' ? migration362 : rollback362)), /362 refuses concurrent\/prepared writes or non-read-committed state|canceling statement due to statement timeout/);
        assert.equal(maintenanceState(), before, 'committed function/role/schema/data authority is conserved while the native writer remains invisible');
    } finally {
        owned.script(`UPDATE public.${table} SET released=true;`);
        const results = await Promise.all([holder, ...(creator ? [creator] : [])]);
        assert.ok(results.every(result => result === null));
        if (kind === 'catalog') owned.script('DROP FUNCTION public.read_console_oncall_schedules_v1() RESTRICT;');
        owned.script(`DROP TABLE public.${table};`);
        if (direction === 'forward') owned.script(migration362);
    }
});


test('362 paired reapply reaches the real typed RPC through the current REST cache',{timeout:15000},async()=>{
 const f=await fixture(),actor=await f.actor(),deadline=Date.now()+10000;const statuses:number[]=[];
 for(;;){let cacheMiss=false;const tap=tapRest(owned.restUrl,async(call,forward)=>{const reply=await forward();if(call.resource==='rpc/read_console_oncall_schedules_v1'&&reply.status===404){const body=await reply.clone().json()as{code?:string};cacheMiss=body.code==='PGRST202';}return reply;});
  let r:Awaited<ReturnType<typeof f.gateway.request>>;try{r=await f.gateway.request(path,{headers:actor.headers});}finally{tap.restore();}statuses.push(r.status);
  if(r.status===200){assert.equal(r.json?.success,true);break;}
  assert.equal(r.status,503,JSON.stringify(statuses));assert.equal(cacheMiss,true,'only an observed real404/PGRST202 is retried');assert.ok(Date.now()<deadline);await new Promise(resolve=>setTimeout(resolve,25));
 }
});
function seedList(){
 const team='synthetic-list-owned-'+crypto.randomUUID();
 owned.script(`INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,ends_at,active,metadata)
 VALUES('${team}','Current',now(),NULL,true,'{"private_marker":"synthetic-private-oncall"}');
 INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,ends_at,active,metadata)
 SELECT '${team}','History '||n,now()-interval '1 day'-n*interval '1 minute',now()-interval '1 hour',false,'{"private_marker":"synthetic-private-oncall"}' FROM generate_series(0,16)n;
 INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,active,deleted_at)VALUES('${team}','Deleted',now(),true,now());`);
 return team;
}
test('current MFA super reads seven public fields with consistent count, order and pagination',async()=>{
 const f=await fixture(),actor=await f.actor(),team=seedList(),before=collection();
 const read=(page:number)=>f.gateway.request(path+'?team_name='+encodeURIComponent(team)+'&active=all&limit=3&page='+page,{headers:actor.headers});
 const first=await read(1);assert.equal(first.status,200,first.text);assert.match(first.headers.get('cache-control')??'',/no-store/);
 assert.equal(first.json?.data.total,18);assert.equal(first.json?.data.has_next,true);assert.equal(first.json?.data.page,1);assert.equal(first.json?.data.limit,3);
 assert.deepEqual(first.json?.data.items.map((s:any)=>s.rotation_name),['Current','History 0','History 1']);
 for(const row of first.json?.data.items??[])assert.deepEqual(Object.keys(row).sort(),['id','team_name','rotation_name','primary_employee_id','starts_at','ends_at','active'].sort());
 const second=await read(2);assert.equal(second.status,200,second.text);assert.deepEqual(second.json?.data.items.map((s:any)=>s.rotation_name),['History 2','History 3','History 4']);
 const last=await read(6);assert.equal(last.status,200,last.text);assert.deepEqual(last.json?.data.items.map((s:any)=>s.rotation_name),['History 14','History 15','History 16']);assert.equal(last.json?.data.has_next,false);
 assert.doesNotMatch(first.text,/private_marker|synthetic-private-oncall|metadata|backup_employee_ids|escalation_tiers|session_id|paging_adapter/);assert.equal(collection(),before);assert.equal(readAudits(actor.id),'3');
 assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${actor.id}'AND action='console.oncall.schedules.read'AND actor_type='super_admin'AND resource_id IS NULL AND metadata->>'permission_scope'='incident:view';`),'3');
});
test('active filters, team scoping and verified empty pages remain distinct from read failures',async()=>{
 const f=await fixture(),actor=await f.actor(),team=seedList(),before=collection();
 for(const[active,total]of [['true',1],['false',17],['all',18]]as const){const r=await f.gateway.request(path+'?team_name='+team+'&active='+active,{headers:actor.headers});assert.equal(r.status,200,r.text);assert.equal(r.json?.data.total,total);assert.equal(r.json?.data.items.length,total);}
 for(const q of ['team_name=missing-'+crypto.randomUUID(),'team_name='+team+'&active=all&page=10000']){const r=await f.gateway.request(path+'?'+q,{headers:actor.headers});assert.equal(r.status,200,r.text);assert.deepEqual(r.json?.data.items,[]);assert.equal(r.json?.data.has_next,false);}
 assert.equal(collection(),before);assert.equal(readAudits(actor.id),'5');
});
test('equal start times use deterministic descending IDs without omitting history',async()=>{
 const f=await fixture(),actor=await f.actor(),team='synthetic-tie-'+crypto.randomUUID(),ids=[crypto.randomUUID(),crypto.randomUUID()].sort().reverse();
 owned.script(`INSERT INTO oncall_schedules(id,team_name,rotation_name,starts_at,active)VALUES('${ids[0]}','${team}','Tie A','2026-01-01T00:00:00Z',true),('${ids[1]}','${team}','Tie B','2026-01-01T00:00:00Z',true);`);
 const before=collection();for(const page of [1,2]){const r=await f.gateway.request(path+'?team_name='+team+'&limit=1&page='+page,{headers:actor.headers});assert.equal(r.status,200,r.text);assert.equal(r.json?.data.items[0].id,ids[page-1]);assert.equal(r.json?.data.total,2);}
 assert.equal(collection(),before);
});
test('a bridge or forged actor/MFA cannot replace a current bound human session',async()=>{
 const f=await fixture(),actor=await f.actor();const h={...actor.headers}as Record<string,string>;delete h['X-Platform-Console-Session'];h['X-Actor-ID']=actor.id;h['X-MFA-Verified']='true';
 assert.equal((await f.gateway.request(path,{headers:h})).status,401);
 for(const bridge of ['', 'synthetic-wrong-bridge']){const wrong={...actor.headers,Authorization:'Bearer '+bridge};assert.equal((await f.gateway.request(path,{headers:wrong})).status,401);}
 assert.equal(readAudits(actor.id),'0');
});
test('pre-MFA and actual non-super operators retain their denials',async()=>{
 const f=await fixture();for(const[kind,mfa,status]of [['super',false,428],['lead',true,403],['viewer',true,403]]as const){const actor=await f.actor(kind,mfa);assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,status);assert.equal(readAudits(actor.id),'0');}
});
test('wrong signed realm or audience cannot reach the read',async()=>{
 const f=await fixture(),actor=await f.actor(),keys=await operatorIdentityKeys(f.env.PLATFORM_CONSOLE_SESSION_SECRET??'');
 for(const[realm,audience]of [['buyer','letbuyy:platform-session'],['platform','letbuyy:merchant-session']]){
  const now=Math.floor(Date.now()/1000),token=await new SignJWT({realm,token_use:'platform_session',email:actor.email,mfa_verified:true,mfa_verified_at:now}).setProtectedHeader({alg:'ES256',typ:'JWT',kid:keys.kid}).setIssuer(IDENTITY_ISSUER).setAudience(audience).setSubject(actor.id).setIssuedAt(now).setExpirationTime(now+3600).setJti(crypto.randomUUID()).sign(keys.privateKey);
  assert.equal((await f.gateway.request(path,{headers:{...actor.headers,'X-Platform-Console-Session':token}})).status,401);
 }assert.equal(readAudits(actor.id),'0');
});
test('expired, logged out and inactive platform membership cannot replay a read',async()=>{
 const f=await fixture(),expired=await f.actor(),aged=await f.seedAgedSession(expired,60);
 // seedAgedSession verifies its token; seed a valid past session, then expire only that durable row.
 owned.script(`UPDATE sessions_v2 SET absolute_expires_at=clock_timestamp()-interval '1 second' WHERE realm='admin'AND metadata->>'cookie_sha256'='${digest(aged.token)}';`);
 assert.equal(owned.psql(`SELECT count(*)FROM sessions_v2 WHERE realm='admin'AND metadata->>'cookie_sha256'='${digest(aged.token)}'AND absolute_expires_at<=clock_timestamp();`),'1');
 assert.equal((await f.gateway.request(path,{headers:aged.headers})).status,401);assert.equal(readAudits(expired.id),'0');
 const out=await f.actor();assert.equal((await f.gateway.request('/v1/internal/console/sessions/revoke',{method:'POST',headers:out.headers,body:'{}'})).status,200);assert.equal((await f.gateway.request(path,{headers:out.headers})).status,401);assert.equal(readAudits(out.id),'0');
 const disabled=await f.actor();owned.script(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${disabled.id}';`);assert.equal((await f.gateway.request(path,{headers:disabled.headers})).status,401);assert.equal(readAudits(disabled.id),'0');
});
test('a retained MFA session cannot outlive changed, reset-required or retired canonical factor state',async()=>{
 const f=await fixture();for(const change of ["jsonb_build_object('fingerprint',repeat('a',64))","jsonb_build_object('reset_required',true)","jsonb_build_object('retired',jsonb_build_array(metadata->'console_mfa_factor'->>'fingerprint'))"]){
  const actor=await f.actor();owned.script(`UPDATE principals SET metadata=jsonb_set(metadata,'{console_mfa_factor}',(metadata->'console_mfa_factor')||${change})WHERE realm='admin'AND legacy_user_id='${actor.id}';`);
  const before=collection(),r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,401,r.text);assert.equal(r.json?.error?.code,'CONSOLE_FACTOR_PROOF_REQUIRED');assert.equal(readAudits(actor.id),'0');assert.equal(collection(),before);
 }
});
test('clock, actor and scope query parameters are rejected rather than authorizing or retargeting the read',async()=>{
 const f=await fixture(),actor=await f.actor();for(const q of ['now=2000-01-01','actor_id='+actor.id+'&mfa_verified=true','site_id='+crypto.randomUUID(),'active=yes','limit=0','page=10001','team_name=%20'])assert.equal((await f.gateway.request(path+'?'+q,{headers:actor.headers})).status,400);assert.equal(readAudits(actor.id),'0');
});
test('revocation at the Gateway-to-RPC boundary cannot use a stale permission witness',async()=>{
 const f=await fixture(),actor=await f.actor();let changed=false;const before=collection();const tap=tapRest(owned.restUrl,(call,forward)=>{if(call.resource==='rpc/read_console_oncall_schedules_v1'&&!changed){changed=true;owned.script(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${actor.id}';`);}return forward();});
 try{assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,401);}finally{tap.restore();}assert.equal(changed,true);assert.equal(collection(),before);assert.equal(readAudits(actor.id),'0');
});
async function directArgs(f:Awaited<ReturnType<typeof fixture>>,actor:Awaited<ReturnType<typeof f.actor>>){
 const id=owned.psql(`SELECT s.id FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id WHERE p.legacy_user_id='${actor.id}'AND s.status='active'AND s.metadata->>'mfa_verified_at'IS NOT NULL ORDER BY s.issued_at DESC LIMIT 1;`);
 const cookie=digest(actor.token);const snap=JSON.parse(owned.script(`SET ROLE service_role;SELECT console_permission_snapshot_v1('${id}','${cookie}',false)::text;`))as{evidence_hash:string};assert.match(snap.evidence_hash,/^[0-9a-f]{64}$/);return{id,cookie,witness:snap.evidence_hash};
}
test('backend witness, platform context and fresh snapshot are mandatory',async()=>{
 const f=await fixture(),actor=await f.actor(),a=await directArgs(f,actor);const call=`SELECT ${signature.split('(')[0]}('${a.id}','${a.cookie}','${a.witness}',1,25,'all',NULL)::text;`;
 const bad=JSON.parse(owned.script(`SET ROLE service_role;SELECT ${signature.split('(')[0]}('${a.id}','${a.cookie}',repeat('0',64),1,25,'all',NULL)::text;`));assert.equal(bad.accepted,false);assert.equal(bad.code,'PERMISSION_CHANGED');
 for(const guc of ['app.site_id','app.tenant_id'])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL "${guc}"='${crypto.randomUUID()}';${call}`),/Platform Console scope required/);
 for(const isolation of ['REPEATABLE READ','SERIALIZABLE'])assert.match(owned.psqlExpectError(`BEGIN ISOLATION LEVEL ${isolation};SET LOCAL ROLE service_role;${call}`),/Current Console snapshot required/);assert.equal(readAudits(actor.id),'0');
});
test('actual ordinary roles and non-backend owner cannot execute the private read',()=>{
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${signature.split('(')[0]}(NULL,NULL,NULL,1,25,'all',NULL);`),/permission denied for function/);
 assert.match(owned.psqlExpectError(`SELECT ${signature.split('(')[0]}(NULL,NULL,NULL,1,25,'all',NULL);`),/Backend Console reader required/);
 assert.equal(owned.psql(`SELECT prosecdef FROM pg_proc WHERE oid='${signature}'::regprocedure;`),'f');
});
test('mandatory read audit failure is sanitized503 and exact fault removal recovers',async()=>{
 const f=await fixture(),actor=await f.actor();seedCurrent();const before=collection();
 owned.script(`CREATE FUNCTION public.syn_oncall_audit_fault()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='console.oncall.schedules.read'AND NEW.actor_id='${actor.id}'THEN RAISE EXCEPTION 'synthetic-private-audit-fault';END IF;RETURN NEW;END$$;CREATE TRIGGER syn_oncall_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.syn_oncall_audit_fault();`);
 try{const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,503,r.text);assert.equal(r.json?.data,undefined);assert.doesNotMatch(r.text,/synthetic-private-audit-fault/);assert.equal(readAudits(actor.id),'0');assert.equal(collection(),before);}
 finally{owned.script('DROP TRIGGER syn_oncall_audit_fault ON audit_logs;DROP FUNCTION public.syn_oncall_audit_fault()RESTRICT;');}
 assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,200);assert.equal(readAudits(actor.id),'1');
});
test('missing read execution privilege stays503 and exact ACL restoration recovers',async()=>{
 const f=await fixture(),actor=await f.actor();const acl=()=>owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid='${signature}'::regprocedure;`),before=acl();owned.script(`REVOKE EXECUTE ON FUNCTION ${signature} FROM service_role;`);
 try{const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,503,r.text);assert.equal(r.json?.data,undefined);assert.equal(readAudits(actor.id),'0');}
 finally{owned.script(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);}assert.equal(acl(),before);assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,200);assert.equal(readAudits(actor.id),'1');
});
test('an in-transaction audit trigger cannot revoke authority and release a successful projection',async()=>{
 const f=await fixture(),actor=await f.actor();const before=collection(),sessions=owned.script(`SELECT jsonb_agg(to_jsonb(s)ORDER BY id)FROM sessions_v2 s;`),audits=owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;');
 owned.script(`CREATE FUNCTION public.syn_oncall_revoke_fault()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='console.oncall.schedules.read'AND NEW.actor_id='${actor.id}'THEN UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${actor.id}';END IF;RETURN NEW;END$$;CREATE TRIGGER syn_oncall_revoke_fault AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.syn_oncall_revoke_fault();`);
 try{const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,503,r.text);assert.equal(r.json?.data,undefined);assert.equal(owned.psql(`SELECT is_active FROM super_admin_allowlist WHERE user_id='${actor.id}';`),'t');assert.equal(collection(),before);assert.equal(owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;'),audits);assert.equal(owned.script('SELECT jsonb_agg(to_jsonb(s)ORDER BY id)FROM sessions_v2 s;'),sessions);}
 finally{owned.script('DROP TRIGGER syn_oncall_revoke_fault ON audit_logs;DROP FUNCTION public.syn_oncall_revoke_fault()RESTRICT;');}
 assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,200);
});
test('362 retirement after attributed reads preserves every schedule, session and audit row',()=>{
 const before=collection(),audits=owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;'),sessions=owned.script('SELECT jsonb_agg(to_jsonb(s)ORDER BY id)FROM sessions_v2 s;');
 assert.notEqual(owned.psql("SELECT count(*)FROM audit_logs WHERE action='console.oncall.schedules.read';"),'0');owned.script(rollback362);
 assert.equal(collection(),before);assert.equal(owned.script('SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_logs a;'),audits);assert.equal(owned.script('SELECT jsonb_agg(to_jsonb(s)ORDER BY id)FROM sessions_v2 s;'),sessions);
 owned.script(migration362);assert.equal(collection(),before);
});
