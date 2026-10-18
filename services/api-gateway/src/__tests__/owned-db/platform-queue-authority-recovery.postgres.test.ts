import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant,seedSyntheticTenant } from './synthetic-tenant';
const owned=requireOwnedDatabase();
const signatures=['public.claim_platform_queue_jobs(text,text,integer,integer)','public.complete_platform_queue_job(uuid,text,jsonb)',
 'public.fail_platform_queue_job(uuid,text,text,integer,jsonb)','public.quarantine_platform_queue_job(uuid,text,text,jsonb)'];
const signature=signatures[0];
const migration=readFileSync('database/supabase/migrations/323_protect_platform_queue_authority.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/323_protect_platform_queue_authority.rollback.sql','utf8');
const journal=()=>owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration='323';");
const others=()=>owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration<>'323';");
const snapshot=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner,
 'body',pg_get_functiondef(p.oid),'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',a.grantee,'grantor',a.grantor,'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.proname)
 FROM pg_proc p WHERE p.oid=ANY(ARRAY[${signatures.map(s=>"'"+s+"'::regprocedure").join(',')}]);`);
after(()=>owned.script(migration));
test('concurrent323 reapply preserves every queue-control identity/body/owner/ACL and journal',async()=>{
 const before=snapshot(),j=journal(),other=others();await Promise.all([owned.psqlAsync(migration),owned.psqlAsync(migration)]);
 assert.equal(snapshot(),before);assert.equal(journal(),j);assert.equal(others(),other);
});
test('actual ordinary roles deny claim/complete/fail/quarantine, while backend leases and effects still work',()=>{
 for(const role of ['anon','authenticated','app_tenant'])for(const call of [
  "claim_platform_queue_jobs('analytics-events','syn-denied',1,120)","complete_platform_queue_job(NULL,'syn-denied','{}')",
  "fail_platform_queue_job(NULL,'syn-denied','synthetic',60,'{}')","quarantine_platform_queue_job(NULL,'syn-denied','synthetic','{}')"]) {
  assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.${call}; ROLLBACK;`),/permission denied for function/);
 }
 const site=newSyntheticTenant('queue-backend');seedSyntheticTenant(owned.psql,site);const ids=Array.from({length:3},()=>crypto.randomUUID());
 const values=ids.map(id=>`('${id}','${site.siteId}',gen_random_uuid(),'analytics-events','synthetic.authority','{}','syn-${id}')`).join(',');
 const result=owned.script(`BEGIN; INSERT INTO platform_queue_jobs(id,site_id,event_id,queue_name,job_type,payload,idempotency_key) VALUES ${values};
 SET LOCAL ROLE service_role; SELECT count(*) FROM claim_platform_queue_jobs('analytics-events','syn-real-backend',3,120);
 SELECT (complete_platform_queue_job('${ids[0]}','syn-real-backend','{}')).status;
 SELECT (fail_platform_queue_job('${ids[1]}','syn-real-backend','synthetic',60,'{}')).status;
 SELECT (quarantine_platform_queue_job('${ids[2]}','syn-real-backend','synthetic','{}')).status; ROLLBACK;`);
 assert.equal(result,'3\nsucceeded\nfailed\ndead');
});
test('clean323 rollback/reapply exactly restores predecessor grants for all four RPCs and preserves unrelated journals',()=>{
 const fixed=snapshot(),other=others();owned.script(rollback);owned.script(rollback);const predecessor=snapshot();
 signatures.forEach(s=>assert.equal(owned.psql(`SELECT has_function_privilege('app_tenant','${s}','EXECUTE');`),'t'));
 owned.script(migration);assert.equal(snapshot(),fixed);owned.script(rollback);assert.equal(snapshot(),predecessor);
 owned.script(migration);assert.equal(snapshot(),fixed);assert.equal(others(),other);
});
test('PUBLIC inherited backend execution and ordinary named grant options survive exact323 recovery',()=>{
 owned.script(rollback);const original=signatures.map(s=>owned.psql(`SELECT coalesce(proacl,acldefault('f',proowner))::text FROM pg_proc WHERE oid='${s}'::regprocedure;`));
 // Capture original grants as grant statements, not an ACL string assignment.
 const grants=signatures.map(s=>owned.psql(`SELECT string_agg('GRANT EXECUTE ON FUNCTION ${s} TO '||CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END||CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION;' ELSE ';' END,E'\n') FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='${s}'::regprocedure;`));
 try {
  for(const s of signatures)owned.script(`REVOKE EXECUTE ON FUNCTION ${s} FROM service_role,app_tenant; GRANT EXECUTE ON FUNCTION ${s} TO PUBLIC; GRANT EXECUTE ON FUNCTION ${s} TO app_tenant WITH GRANT OPTION;`);
  const before=snapshot();owned.script(migration);signatures.forEach(s=>assert.equal(owned.psql(`SELECT has_function_privilege('service_role','${s}','EXECUTE');`),'t'));
  owned.script(rollback);assert.equal(snapshot(),before);
 } finally {
  owned.script(rollback);signatures.forEach((s,i)=>owned.script(`REVOKE EXECUTE ON FUNCTION ${s} FROM PUBLIC,anon,authenticated,app_tenant,service_role;`+grants[i]));owned.script(migration);
 }
});
test('queue ABI/owner/body/grant and partial/whole journal drift refuse reapply and rollback atomically',()=>{
 const saved=snapshot(),j=journal();const ddl=owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`);
 for(const drift of [`ALTER FUNCTION ${signature} STABLE;`,`ALTER FUNCTION ${signature} OWNER TO service_role;`,
  `DROP FUNCTION ${signature};${ddl};`,`GRANT EXECUTE ON FUNCTION ${signature} TO app_tenant;`,
  "DELETE FROM migration_privilege_journal WHERE migration='323' AND object_signature='"+signature+"';",
  "DELETE FROM migration_privilege_journal WHERE migration='323';"])for(const source of [migration,rollback]) {
  assert.match(owned.psqlExpectError('BEGIN;'+drift+source),/migration323 refuses/);assert.equal(snapshot(),saved);assert.equal(journal(),j);
 }
});
test('retained worker jobs refuse privilege reopening and preserve every original record',()=>{
 const saved=snapshot(),j=journal(),site=newSyntheticTenant('queue-retained');seedSyntheticTenant(owned.psql,site);const id=crypto.randomUUID();
 assert.match(owned.psqlExpectError(`BEGIN; INSERT INTO platform_queue_jobs(id,site_id,event_id,queue_name,job_type,payload,idempotency_key)
 VALUES('${id}','${site.siteId}',gen_random_uuid(),'analytics-events','synthetic.retained','{}','syn-${id}');${rollback}`),/rollback323 refuses retained/);
 assert.equal(snapshot(),saved);assert.equal(journal(),j);assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE id='${id}';`),'0');
});
