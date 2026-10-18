// N1.4: exact full-chain Data API/backend ACLs, actual roles and identity-bound recovery.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase,requireOwnedHistoricalSqlDatabase } from './owned-db-support';

const owned=requireOwnedDatabase();
let sql:ReturnType<typeof requireOwnedHistoricalSqlDatabase>=owned;
const migration=readFileSync('database/supabase/migrations/309_close_final_definer_data_api_access.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/309_close_final_definer_data_api_access.rollback.sql','utf8');
const feed='public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)';
const origins='public.marketplace_origins()';
const callFeed='SELECT count(*) FROM public.marketplace_feed(NULL::text,NULL::text,10,NULL::timestamptz,NULL::uuid,NULL::text);';
const callOrigins='SELECT count(*) FROM public.marketplace_origins();';
const asRole=(role:string,sql:string)=>`BEGIN; SET LOCAL ROLE ${role}; ${sql} COMMIT;`;
interface Entry { name:string; signature:string; policy:boolean; anon:boolean; authenticated:boolean; public:boolean; app_tenant:boolean; service_role:boolean; app_tenant_grantable:boolean; service_role_grantable:boolean; acl:unknown; definition:string; owner:string }
function snapshot():Entry[] {
 return JSON.parse(sql.script(`BEGIN; SET LOCAL search_path=pg_catalog,public;
 SELECT jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,
 'owner',pg_get_userbyid(p.proowner),'definition',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'app_tenant',has_function_privilege('app_tenant',p.oid,'EXECUTE'),'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'),
 'app_tenant_grantable',has_function_privilege('app_tenant',p.oid,'EXECUTE WITH GRANT OPTION'),
 'service_role_grantable',has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION'),
 'public',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
 'acl',(SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),
 'policy',EXISTS(SELECT 1 FROM pg_policy pol WHERE (coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')||' '||coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')) ~ ('\\m'||p.proname||'\\s*\\('))) ORDER BY p.proname,p.oid)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef; ROLLBACK;`));
}
const backend=(rows:Entry[])=>rows.map(({signature,owner,definition,app_tenant,service_role,app_tenant_grantable,service_role_grantable})=>({signature,owner,definition,app_tenant,service_role,app_tenant_grantable,service_role_grantable}));
const journal=()=>sql.psql("SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY object_signature,grantee,privilege,action),'[]'::jsonb) FROM public.migration_privilege_journal j WHERE migration='309';");
function closed(rows=snapshot()) {
 assert.ok(rows.length>0);
 assert.deepEqual(rows.filter(row=>row.policy).map(row=>row.name),['is_super_admin'],'the explicit existing policy helper is preserved; new exceptions need review');
 assert.deepEqual(rows.filter(row=>!row.policy&&(row.anon||row.authenticated||row.public)),[],'non-policy definers cannot be executed by Data API roles');
}

test('actual Data API roles deny both RPCs while backend calls and the RLS helper keep working',()=>{
 closed();
 for(const role of ['anon','authenticated']) {
  for(const call of [callFeed,callOrigins]) assert.match(sql.psqlExpectError(asRole(role,call)),/permission denied for function marketplace_/);
  assert.equal(sql.script(asRole(role,'SELECT public.is_super_admin();')),'f','the existing policy helper still evaluates normally');
 }
 for(const role of ['app_tenant','service_role']) {
  assert.equal(sql.script(asRole(role,callFeed)),'0');
  assert.equal(sql.script(asRole(role,callOrigins)),'0');
 }
});

test('current HEAD refuses historical 309 retirement without changing any authority',()=>{
 const saved=journal(),roles=snapshot();
 assert.match(sql.psqlExpectError(rollback),/refuses.*later|subsequent|later migration/i);
 assert.equal(journal(),saved);assert.deepEqual(snapshot(),roles);
 // Current-head ACLs are swept above. Later migrations own the journal ABI;
 // historical recovery uses its actual schema point, with no REST exposure.
 sql=requireOwnedHistoricalSqlDatabase(309);
 closed();
});

test('rollback reproduces late direct-role grants; concurrent reapply preserves every backend/body/owner and journals once',async ()=>{
 const fixed=snapshot();const savedJournal=journal();
 assert.equal(JSON.parse(savedJournal).length,4,'only the two actual named role re-grants change in the default fixture');
 const otherJournal=sql.psql("SELECT jsonb_agg(jsonb_build_object('migration',migration,'object_signature',object_signature,'grantee',grantee,'privilege',privilege,'action',action,'recorded_at',recorded_at) ORDER BY migration,object_signature,grantee,privilege,action) FROM public.migration_privilege_journal j WHERE migration<>'309';");
 sql.script(rollback);
 const before=snapshot();
 assert.deepEqual(before.filter(row=>!row.policy&&(row.anon||row.authenticated||row.public)).map(row=>row.signature),[
  'marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)','marketplace_origins()',
 ]);
 for(const role of ['anon','authenticated'])for(const call of [callFeed,callOrigins])assert.equal(sql.script(asRole(role,call)),'0','positive control: the prior direct-role grant really executes');
 sql.script(migration);closed();
 assert.deepEqual(backend(snapshot()),backend(before),'all effective backend execution/grant options and function definitions/owners are conserved');
 assert.deepEqual(snapshot(),fixed);
 const firstJournal=journal();await Promise.all([sql.psqlAsync(migration),sql.psqlAsync(migration)]);assert.equal(journal(),firstJournal,'concurrent reapply cannot replace or duplicate the original privilege evidence');
 sql.script(rollback);assert.deepEqual(snapshot(),before,'rollback restores the complete prior semantic ACL snapshot');
 assert.equal(sql.psql("SELECT jsonb_agg(jsonb_build_object('migration',migration,'object_signature',object_signature,'grantee',grantee,'privilege',privilege,'action',action,'recorded_at',recorded_at) ORDER BY migration,object_signature,grantee,privilege,action) FROM public.migration_privilege_journal j WHERE migration<>'309';"),otherJournal);
 assert.equal(sql.psql("SELECT count(*) FROM pg_attribute WHERE attrelid='public.migration_privilege_journal'::regclass AND attname IN ('object_oid','object_owner','object_definition_hash') AND NOT attisdropped;"),'0');
 sql.script(migration);closed();
});

test('PUBLIC-inherited backend access and a named grant option survive closure and exact rollback',()=>{
 sql.script(rollback);
 sql.script(`REVOKE EXECUTE ON FUNCTION ${feed} FROM app_tenant,service_role; GRANT EXECUTE ON FUNCTION ${feed} TO PUBLIC;
  GRANT EXECUTE ON FUNCTION ${origins} TO anon WITH GRANT OPTION;`);
 const before=snapshot();
 try {
  sql.script(migration);closed();assert.deepEqual(backend(snapshot()),backend(before));
  assert.equal(sql.script(asRole('app_tenant',callFeed)),'0');assert.equal(sql.script(asRole('service_role',callFeed)),'0');
  const saved=journal();sql.script(migration);assert.equal(journal(),saved);
  sql.script(rollback);assert.deepEqual(snapshot(),before,'PUBLIC, named grant options and preserved backend grants restore exactly');
 } finally {
  sql.script(`REVOKE EXECUTE ON FUNCTION ${feed} FROM PUBLIC; GRANT EXECUTE ON FUNCTION ${feed} TO app_tenant,service_role;
   REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION ${origins} FROM anon;`);
  sql.script(migration);
 }
 closed();
});

test('rollback refuses changed definition, owner, recreated identity and journal loss atomically, then recovers',()=>{
 const saved=journal();const original=snapshot();
 const changedBody=`BEGIN; ALTER FUNCTION ${origins} VOLATILE;`;
 assert.match(sql.psqlExpectError(changedBody+rollback),/refuses changed function identity\/owner\/body/);
 assert.equal(journal(),saved);assert.deepEqual(snapshot(),original);
 assert.match(sql.psqlExpectError(changedBody+migration),/refuses a changed journaled function/);
 assert.deepEqual(snapshot(),original);
 assert.match(sql.psqlExpectError(`BEGIN; ALTER FUNCTION ${origins} OWNER TO service_role;`+rollback),/refuses changed function identity\/owner\/body/);
 assert.deepEqual(snapshot(),original);
 const definition=sql.psql(`SELECT pg_get_functiondef('${origins}'::regprocedure);`);
 assert.match(sql.psqlExpectError(`BEGIN; DROP FUNCTION ${origins}; ${definition};\n`+rollback),/refuses changed function identity\/owner\/body/);
 assert.deepEqual(snapshot(),original);
 assert.match(sql.psqlExpectError('BEGIN; ALTER TABLE public.migration_privilege_journal RENAME TO synthetic_saved_privilege_journal;'+rollback),/refuses to run without/);
 assert.equal(journal(),saved);
 sql.script(rollback);sql.script(migration);closed();
 assert.deepEqual(backend(snapshot()),backend(original));
});

test('inherited backend grant options are preserved without broadening other effective access',()=>{
 assert.equal(sql.psql("SELECT pg_has_role('app_tenant','anon','MEMBER');"),'f','the synthetic membership must not pre-exist');
 sql.script(rollback);
 let applied=false;
 try {
  sql.script(`GRANT anon TO app_tenant; GRANT EXECUTE ON FUNCTION ${origins} TO anon WITH GRANT OPTION;`);
  const before=snapshot();assert.equal(before.find(row=>row.name==='marketplace_origins')?.app_tenant_grantable,true);
  sql.script(migration);applied=true;closed();assert.deepEqual(backend(snapshot()),backend(before));
  assert.match(journal(),/GRANT OPTION FOR EXECUTE/,'the added named option is journaled separately from existing execution');
  sql.script(rollback);applied=false;assert.deepEqual(snapshot(),before);
 } finally {
  if(applied)sql.script(rollback);
  sql.script(`REVOKE anon FROM app_tenant; REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION ${origins} FROM anon;`);
  sql.script(migration);
 }
 closed();
});
