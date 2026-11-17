// Complete worker and owned database; synthetic Console credentials are explicit
// service fixtures. Normal browser sign-in/TOTP is separately verified.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { tapRest } from './gateway-harness';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase();
const paths=['/v1/internal/console/summary','/v1/internal/console/analytics'];

async function overviewDependencyReady(expected:boolean) {
 // NOTIFY is asynchronous. Use invalid, null arguments that return before
 // session resolution or audit writes; never retry the application read.
 const key=owned.restEnv().SUPABASE_SERVICE_ROLE_KEY,deadline=Date.now()+15_000;
 do {
  const response=await fetch(owned.restUrl+'/rest/v1/rpc/read_console_overview_v1',{
   method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({p_session_id:null,p_cookie_sha256:null,p_permission_hash:null,p_kind:null}),
   signal:AbortSignal.timeout(5_000),
  });
  const payload=await response.json() as {accepted?:boolean;code?:string};
  if(response.status===200) {
   assert.equal(payload.accepted,false);assert.equal(payload.code,'CONSOLE_OVERVIEW_QUERY_INVALID');
   if(expected)return;
  } else {
   assert.equal(response.status,404,'permission, connection and other failures are not schema readiness');
   assert.ok(payload.code==='PGRST202'||(!expected&&payload.code==='42883'),'only the known absent RPC/cache entry may be retried');
   if(!expected)return;
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 } while(Date.now()<deadline);
 assert.fail('owned Console overview dependency did not reach readiness '+expected);
}

test('live MFA super-admin and existing exec:view viewer read only cross-site aggregates with mandatory attribution',async()=>{
 const f=await consoleFixture(owned);for(const kind of ['super','viewer'] as const) {
  const actor=await f.actor(kind);for(const path of paths) {
   const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,200,r.text);assert.equal(r.json?.success,true);
   assert.doesNotMatch(r.text,/syn-consent|@example|cookie_sha256|session_id/);
  }
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action IN('console.summary.read','console.analytics.read');`),'2');
 }
});

test('counts agree with retained canonical records and do not enumerate merchant or employee rows',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();
 for(const tag of ['console-count-a','console-count-b'])seedSyntheticTenant(owned.psql,newSyntheticTenant(tag));
 // Model retained legacy billing through the real empty360 retirement/reapply.
 // The current positive-insert guard remains active for all Gateway reads.
 const retireTax=readFileSync('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql','utf8');
 const applyTax=readFileSync('database/supabase/migrations/360_subscription_tax_quote_snapshot.sql','utf8');
 owned.script(retireTax);
 try {owned.psql(`INSERT INTO subscriptions(user_id,plan,status,amount_paid) VALUES('${actor.id}','starter','active',12345),('${actor.id}','starter','cancelled',67890);`);}
 finally {owned.script(applyTax);}
 assert.match(owned.psqlExpectError(`INSERT INTO subscriptions(user_id,plan,status,amount_paid)VALUES('${actor.id}','starter','active',1);`),/positive subscription requires the current canonical activation writer/);
 const r=await f.gateway.request(paths[0],{headers:actor.headers});assert.equal(r.status,200,r.text);
 assert.equal(r.json?.data.total_stores,Number(owned.psql('SELECT count(*) FROM sites;')));
 assert.equal(r.json?.data.total_users,Number(owned.psql('SELECT count(*) FROM users_custom;')));
 assert.equal(r.json?.data.monthly_revenue_paise,12345,'only the maintained active subscription aggregate belongs in this projection');
 assert.equal(r.json?.data.total_employees,Number(owned.psql('SELECT count(*) FROM employees WHERE store_id IS NULL AND deleted_at IS NULL;')));
 assert.deepEqual(Object.keys(r.json?.data).sort(),['total_users','total_stores','active_stores','total_subscriptions','active_subscriptions','total_employees','total_audit_logs','monthly_revenue_paise'].sort());
});

test('a bridge token and asserted actor/MFA fields cannot replace the bound human session',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();const h: Record<string,string>={...actor.headers};delete h['X-Platform-Console-Session'];
 for(const path of paths) {
  const r=await f.gateway.request(path+'?actor_id='+actor.id+'&mfa_verified=true',{headers:h});assert.equal(r.status,401,r.text);
 }
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action IN('console.summary.read','console.analytics.read');`),'0');
});

test('an actual operator without exec:view and a pre-MFA operator cannot read platform aggregates',async()=>{
 const f=await consoleFixture(owned);const lead=await f.actor('lead'),pending=await f.actor('super',false);
 for(const path of paths) {
  assert.equal((await f.gateway.request(path,{headers:lead.headers})).status,403);
  assert.equal((await f.gateway.request(path,{headers:pending.headers})).status,428);
 }
});

test('canonical session logout and live platform membership revocation deny retained cookies',async()=>{
 const f=await consoleFixture(owned);const actor=await f.actor();
 assert.equal((await f.gateway.request('/v1/internal/console/sessions/revoke',{method:'POST',headers:actor.headers,body:'{}'})).status,200);
 for(const path of paths)assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,401);
 const other=await f.actor();owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${other.id}';`);
 for(const path of paths)assert.equal((await f.gateway.request(path,{headers:other.headers})).status,401);
});

test('missing or wrong bridge remains unauthorized even with a real Console cookie',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();for(const path of paths) {
  const h: Record<string,string>={...actor.headers};delete h.Authorization;assert.equal((await f.gateway.request(path,{headers:h})).status,401);
  assert.equal((await f.gateway.request(path,{headers:{...actor.headers,Authorization:'Bearer synthetic-wrong-bridge'}})).status,401);
 }
});


test('new read RPC clean rollback and reapply retain accounts/sessions/audits and ordinary roles cannot execute it',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();const signature='public.read_console_overview_v1(uuid,text,text,text)';
 assert.equal((await f.gateway.request(paths[0],{headers:actor.headers})).status,200);
 const counts=()=>owned.psql('SELECT (SELECT count(*) FROM users_custom),(SELECT count(*) FROM sessions_v2),(SELECT count(*) FROM audit_logs);');
 const retained=counts();owned.script(readFileSync(new URL('../../../../../database/supabase/rollback/325_session_bound_console_overview.rollback.sql',import.meta.url),'utf8'));
 assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`),'t');assert.equal(counts(),retained);
 await overviewDependencyReady(false);
 const unavailable=await f.gateway.request(paths[0],{headers:actor.headers});
 assert.equal(unavailable.status,503,unavailable.text);assert.equal(unavailable.json?.data,undefined);assert.equal(counts(),retained);
 owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/325_session_bound_console_overview.sql',import.meta.url),'utf8'));
 assert.equal(counts(),retained);
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${signature.split('(')[0]}(NULL,NULL,NULL,'summary');`),/permission denied for function/);
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
 assert.equal(owned.psql(`SELECT prosecdef FROM pg_proc WHERE oid='${signature}'::regprocedure;`),'f');
 await overviewDependencyReady(true);assert.equal(counts(),retained,'readiness probes must not create sessions or audits');
 const restored=await f.gateway.request(paths[0],{headers:actor.headers});assert.equal(restored.status,200,restored.text);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='console.summary.read';`),'2','one initial and one recovered application read');
});

test('mandatory read audit failure returns503 without a success projection and retry records attribution',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();
 owned.psql(`CREATE FUNCTION syn_overview_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.action IN('console.summary.read','console.analytics.read') AND NEW.actor_id='${actor.id}' THEN RAISE EXCEPTION 'synthetic-private-audit-fault';END IF;RETURN NEW;END $$;
  CREATE TRIGGER syn_overview_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_overview_audit_fault();`);
 try {for(const path of paths){const r=await f.gateway.request(path,{headers:actor.headers});assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-audit-fault/);assert.equal(r.json?.data,undefined);}}
 finally {owned.psql('DROP TRIGGER syn_overview_audit_fault ON audit_logs;DROP FUNCTION syn_overview_audit_fault();');}
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action IN('console.summary.read','console.analytics.read');`),'0');
 for(const path of paths)assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,200);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action IN('console.summary.read','console.analytics.read');`),'2');
});

test('permission revocation between resolver and aggregate RPC cannot use the stale witness',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor('viewer');let changed=false;
 const tap=tapRest(owned.restEnv().SUPABASE_URL,(call,forward)=>{
  if(call.resource==='rpc/read_console_overview_v1'&&!changed){changed=true;owned.psql(`UPDATE employees SET role='support' WHERE user_id='${actor.id}' AND store_id IS NULL;`);}
  return forward();
 });
 try {assert.equal((await f.gateway.request(paths[0],{headers:actor.headers})).status,401);}finally{tap.restore();}
 assert.equal(changed,true);assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='console.summary.read';`),'0');
});

test('missing aggregate execution privilege stays503 and exact restoration recovers',async()=>{
 const f=await consoleFixture(owned),actor=await f.actor();const signature='public.read_console_overview_v1(uuid,text,text,text)';
 const acl=()=>owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid='${signature}'::regprocedure;`),before=acl();
 owned.psql(`REVOKE EXECUTE ON FUNCTION ${signature} FROM service_role;`);
 try {for(const path of paths)assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,503);}
 finally {owned.psql(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);}
 assert.equal(acl(),before);for(const path of paths)assert.equal((await f.gateway.request(path,{headers:actor.headers})).status,200);
});
