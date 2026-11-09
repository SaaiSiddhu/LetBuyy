// Actual current437 source, paired DOWN, retained synthetic data and real
// prepared transactions. No fixture bypass of receipt immutability or RLS.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const up=readFileSync('database/supabase/migrations/437_inventory_batch_adjustment_receipts.sql','utf8');
const down=readFileSync('database/supabase/rollback/437_inventory_batch_adjustment_receipts.rollback.sql','utf8');
const strip=(sql:string)=>sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const tables=()=>JSON.parse(owned.psql("SELECT jsonb_agg(relname ORDER BY relname)FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')"))as string[];
function digest(){return owned.scriptLarge(`SET jit=off;SELECT jsonb_agg(to_jsonb(s)ORDER BY name)FROM(${tables().map(name=>`SELECT ${quote(name)}name,count(*)rows,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),'[]')::text,'UTF8')),'hex')hash FROM public."${name}"t ${name==='migration_privilege_journal'?"WHERE migration<>'437'":''}`).join(' UNION ALL ')})s`);}
const roles=()=>owned.psql("SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r)ORDER BY oid)FROM pg_roles r),'memberships',(SELECT jsonb_agg(to_jsonb(m)ORDER BY roleid,member,grantor)FROM pg_auth_members m))");
const profile=()=>owned.psql(`SELECT jsonb_build_object('functions',(SELECT jsonb_agg(jsonb_build_array(pg_get_functiondef(p.oid),p.proowner,p.proacl,p.procost,p.proconfig,obj_description(p.oid,'pg_proc'))ORDER BY p.proname)FROM pg_proc p WHERE p.oid IN(to_regprocedure('public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)'),to_regprocedure('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)'),to_regprocedure('public.apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)'))),'receipt',(SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relfrozenxid','relminmxid']::text[] FROM pg_class c WHERE oid='inventory_adjustment_receipts'::regclass),'columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,attnotnull,attacl)ORDER BY attnum)FROM pg_attribute WHERE attrelid='inventory_adjustment_receipts'::regclass AND attnum>0),'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid))ORDER BY conname)FROM pg_constraint WHERE conrelid='inventory_adjustment_receipts'::regclass),'triggers',(SELECT jsonb_agg(jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled)ORDER BY tgname)FROM pg_trigger WHERE tgrelid='inventory_adjustment_receipts'::regclass AND NOT tgisinternal),'policies',(SELECT jsonb_agg(to_jsonb(p)ORDER BY polname)FROM pg_policy p WHERE polrelid='inventory_adjustment_receipts'::regclass))`);
function world(tag:string){const site=newSyntheticTenant(tag),actor=randomUUID(),product=randomUUID();seedSyntheticTenant(owned.psql,site);owned.psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-batch-down-${actor}@example.invalid',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';INSERT INTO products(id,site_id,store_id,name,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic rollback stock',100,4,true,'active');SELECT set_inventory_level_available('${product}',NULL,'${site.locationId}',4,'${actor}');COMMIT;`);return{site,actor,product};}
function call(w:ReturnType<typeof world>,batch:boolean,key=randomUUID()){
 const command={product_id:w.product,variant_id:null,location_id:w.site.locationId,adjustment:2,reason:'correction',notes:null};
 return `BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${w.site.siteId}',true),set_config('app.actor_id','${w.actor}',true);SELECT public.${batch?'apply_inventory_adjustment_batch_v1':'apply_inventory_adjustment_v1'}('${w.site.siteId}','${w.actor}','${key}',${quote(JSON.stringify(batch?{adjustments:[command]}:command))}::jsonb);COMMIT;`;
}

test('437 empty DOWN/UP restores exact raw436 definition, receipt shape, roles and every unrelated row',()=>{
 const rows=digest(),authority=roles(),current=profile(),names=tables();
 const oldDown=readFileSync('database/supabase/rollback/436_canonical_transfer_reservations.rollback.sql','utf8');
 assert.match(owned.psqlScriptExpectError(oldDown),/rollback436 refuses changed function profile/);
 assert.equal(profile(),current);assert.equal(digest(),rows);assert.equal(roles(),authority);
 owned.script(down);assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='437'"),'0');
 assert.equal(owned.psql("SELECT to_regprocedure('public.apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)')IS NULL"),'t');
 assert.equal(owned.psql("SELECT encode(sha256(convert_to(pg_get_functiondef('public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)'::regprocedure),'UTF8')),'hex')"),'b37a25b4cc117f78202b7f308685e5c179eed42e6ccb9b6a84ed53cfb6e7d90c');
 assert.equal(digest(),rows);assert.equal(roles(),authority);assert.deepEqual(tables(),names);
 owned.script(up);assert.equal(profile(),current);assert.equal(digest(),rows);assert.equal(roles(),authority);
});

test('437 DOWN refuses changed function, receipt, policy, column grants and provenance without leaving effects',()=>{
 const current=profile(),rows=digest(),authority=roles();
 for(const fault of [
  "COMMENT ON FUNCTION apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)IS 'Synthetic unknown'",
  'ALTER FUNCTION adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)COST 101',
  'GRANT EXECUTE ON FUNCTION apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)TO service_role',
  'GRANT SELECT ON inventory_adjustment_receipts TO authenticated',
  'GRANT SELECT(command)ON inventory_adjustment_receipts TO authenticated',
  'ALTER TABLE inventory_adjustment_receipts NO FORCE ROW LEVEL SECURITY',
  'ALTER TABLE inventory_adjustment_receipts DISABLE TRIGGER inventory_adjustment_receipts_immutable',
  'CREATE POLICY synthetic_batch_leak ON inventory_adjustment_receipts FOR SELECT TO authenticated USING(true)',
  "UPDATE migration_privilege_journal SET object_definition_hash='synthetic-unknown'WHERE migration='437'",
 ]){
  assert.match(owned.psqlScriptExpectError('BEGIN;'+fault+';'+strip(down)+'COMMIT;'),/rollback437 refuses changed (function|receipt)/,fault);
  assert.equal(profile(),current);assert.equal(digest(),rows);assert.equal(roles(),authority);
 }
});

test('437 original dependency and receipt authority admission refuses unreviewed drift atomically',()=>{
 owned.script(down);const current=profile(),rows=digest(),authority=roles();
 try{
  for(const fault of [
   'ALTER FUNCTION apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)COST 101',
   'GRANT EXECUTE ON FUNCTION apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)TO authenticated',
   'GRANT SELECT(command)ON inventory_adjustment_receipts TO authenticated',
   'ALTER TABLE inventory_adjustment_receipts NO FORCE ROW LEVEL SECURITY',
  ]){
   assert.match(owned.psqlScriptExpectError('BEGIN;'+fault+';'+strip(up)+'COMMIT;'),/migration437 refuses changed (dependency|receipt|original receipt)/,fault);
   assert.equal(profile(),current);assert.equal(digest(),rows);assert.equal(roles(),authority);
  }
 }finally{owned.script(up);}
});

test('437 refuses actual prepared writers in both directions without changing data, authority or profiles',()=>{
 const site=newSyntheticTenant('batch-prepared');seedSyntheticTenant(owned.psql,site);
 for(const direction of ['rollback','migration']as const){
  if(direction==='migration')owned.script(down);
  const rows=digest(),authority=roles(),current=profile(),gid='syn-batch-'+randomUUID();
  owned.psql(`BEGIN;UPDATE sites SET name=name WHERE id='${site.siteId}';PREPARE TRANSACTION '${gid}'`);
  try{assert.equal(owned.psql(`SELECT count(*)FROM pg_prepared_xacts WHERE gid='${gid}'`),'1');assert.match(owned.psqlScriptExpectError(direction==='rollback'?down:up),new RegExp(direction+'437 refuses concurrent/prepared writes'));}
  finally{owned.psql(`ROLLBACK PREPARED '${gid}'`);}
  assert.equal(digest(),rows);assert.equal(roles(),authority);assert.equal(profile(),current);
  if(direction==='migration')owned.script(up);
 }
});

test('437 conserves preexisting immutable single receipts byte for byte through forward and safe reverse',()=>{
 owned.script(down);const w=world('batch-retained-old');owned.psql(call(w,false));
 const receipts=owned.psql(`SELECT jsonb_agg(to_jsonb(r)ORDER BY idempotency_key)FROM inventory_adjustment_receipts r WHERE store_id='${w.site.siteId}'`),rows=digest(),authority=roles();
 owned.script(up);assert.equal(digest(),rows);assert.equal(roles(),authority);assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(r)ORDER BY idempotency_key)FROM inventory_adjustment_receipts r WHERE store_id='${w.site.siteId}'`),receipts);
 owned.script(down);assert.equal(digest(),rows);assert.equal(roles(),authority);owned.script(up);
});

test('retained batch acknowledgements and new mandatory outbox identities refuse unsafe reverse and older436 DOWN',()=>{
 const w=world('batch-retained-new');owned.psql(call(w,true));const rows=digest(),authority=roles(),current=profile();
 assert.match(owned.psqlScriptExpectError(down),/rollback437 refuses retained inventory batch acknowledgements or adjustment effects/);
 const oldDown=readFileSync('database/supabase/rollback/436_canonical_transfer_reservations.rollback.sql','utf8');
 assert.match(owned.psqlScriptExpectError(oldDown),/rollback436 refuses retained inventory operations/);
 assert.equal(digest(),rows);assert.equal(roles(),authority);assert.equal(profile(),current);
 for(const role of ['anon','authenticated','app_tenant','service_role'])assert.equal(owned.psql(`SELECT has_table_privilege('${role}','inventory_adjustment_receipts','INSERT,UPDATE,DELETE,TRUNCATE')`),'f');
});
