// Official provider-image rehearsal with synthetic data. This proves a local
// nonsuperuser migration environment, never hosted execution or API/device QA.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileManagedMigrationBatch } from '../../scripts/supabase/managed-migration-artifact.mjs';
import { requireOwnedDatabase, createOwnedManagedSupabaseFixture } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const parent = requireOwnedDatabase();
const root = 'database/supabase/migrations';
const files = readdirSync(root).filter(name => name.endsWith('.sql')).sort();
const read = (path: string) => readFileSync(path, 'utf8');
const up = read(root + '/436_canonical_transfer_reservations.sql');
const down = read('database/supabase/rollback/436_canonical_transfer_reservations.rollback.sql');
const replay = (from: number, through: number) => files.filter(name => {
 const prefix = Number(name.split('_')[0]); return prefix >= from && prefix <= through;
}).map(name => 'SET search_path=public,extensions;\n' + read(root + '/' + name)).join('\n');

test('436 and437 retain actual provider-admin locks, tenant fences and stock conservation as nonsuperuser managed postgres', { timeout: 420000 }, async t => {
 const fixture = await createOwnedManagedSupabaseFixture(parent);
 const { psql, admin } = fixture;
 const bootstrap = read('database/supabase/deploy/provider-admin-catalog-fence.sql');
 const retirement = read('database/supabase/deploy/provider-admin-catalog-fence.rollback.sql');
 const fence = up.match(/DO \$managed_catalog_fence\$[\s\S]*?END \$managed_catalog_fence\$;/)![0];
 try {
  assert.equal(psql("SELECT current_user='postgres' AND session_user='postgres' AND NOT rolsuper FROM pg_roles WHERE rolname=current_user"), 't');
  assert.equal(psql("SELECT current_setting('server_version_num')::integer/10000"), '17');
  admin('ALTER ROLE postgres SET search_path=public,extensions;');
  psql('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;');
  psql(replay(0,346));
  const provider = JSON.parse(read('tests/fixtures/supabase-provider-events-17.6.json')) as { functions: Array<{ owner:string; definition:string }> };
  for (const role of ['supabase_admin','postgres']) {
   const sql = provider.functions.filter(value=>value.owner===role).map(value=>value.definition+';').join('\n');
   if(role==='supabase_admin')admin(sql);else psql(sql);
  }
  psql("CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();");
  psql(replay(347,352));admin(bootstrap);
  // Existing reviewed admission adapts the provider's exact role membership.
  // Prerequisites use that explicit profile;436 below still exercises its
  // original native/provider-admin fence as the actual postgres session.
  admin("DO $cli$ BEGIN EXECUTE format('CREATE ROLE cli_login_postgres LOGIN NOINHERIT VALID UNTIL %L',clock_timestamp()+interval '15 minutes'); END $cli$; GRANT postgres TO cli_login_postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;");
  const prerequisites = compileManagedMigrationBatch(files.filter(name=>{
   const prefix=Number(name.split('_')[0]);return prefix>=353&&prefix<=435;
  }).map(name=>({name,source:read(root+'/'+name)})),randomUUID());
  const custody=join(mkdtempSync(join(tmpdir(),'letbuyy-transfer436-managed-')),'prerequisite-admission.json');
  writeFileSync(custody,JSON.stringify(prerequisites.manifest,null,2)+'\n',{mode:0o600});
  console.info('OWNED_TRANSFER436_PREREQUISITE_CUSTODY '+custody);
  fixture.migrator(prerequisites.sql);

  await t.test('missing provider helper refuses both source directions without creating a cutover', () => {
   admin(retirement);
   assert.match(fixture.psqlExpectError(up),/LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
   assert.match(fixture.psqlExpectError(down),/LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
   assert.equal(psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='436'"),'0');
   assert.equal(psql("SELECT count(*)FROM information_schema.columns WHERE table_schema='public'AND table_name='inventory_transfer_lines'AND column_name='reservation_id'"),'0');
   admin(bootstrap);
  });

  await t.test('the verified helper holds actual private and shared catalog locks until commit', async () => {
   const session=fixture.session();
   try {
    assert.equal(await session.query('SELECT 436'),'436','A complete query without a caller semicolon must execute before its completion marker');
    await session.query('BEGIN;'+fence);
    const locks=JSON.parse(await session.query(`SELECT jsonb_agg(c.relname ORDER BY c.relname)FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE l.pid=pg_backend_pid()AND l.granted AND l.mode='ShareRowExclusiveLock'AND n.nspname='pg_catalog'AND c.relname IN('pg_proc','pg_authid','pg_auth_members','pg_class','pg_trigger','pg_policy','pg_attribute')`)) as string[];
    assert.deepEqual(locks,['pg_attribute','pg_auth_members','pg_authid','pg_class','pg_policy','pg_proc','pg_trigger']);
    assert.match(fixture.psqlExpectError("SET lock_timeout='150ms';CREATE FUNCTION public.syn_transfer436_locked()RETURNS integer LANGUAGE sql AS 'SELECT 1'"),/lock timeout/);
    await session.query('COMMIT;');
    psql("CREATE FUNCTION public.syn_transfer436_locked()RETURNS integer LANGUAGE sql AS 'SELECT 1';DROP FUNCTION public.syn_transfer436_locked();");
   } finally { session.close(); await session.stopped(); }
  });

  await t.test('actual empty UP/DOWN/UP preserves closed execution owners and application-role fences', () => {
   psql(up);
   assert.equal(psql("SELECT count(*)FROM information_schema.columns WHERE table_schema='public'AND table_name='inventory_levels'AND column_name='free_quantity'"),'1');
   for(const role of ['anon','authenticated','app_tenant','service_role'])assert.equal(psql(`SELECT has_table_privilege('${role}','inventory_levels','INSERT,UPDATE,DELETE,TRUNCATE')`),'f');
   psql(down);psql(up);
   for(const role of ['anon','authenticated','app_tenant','service_role'])assert.equal(psql(`SELECT has_function_privilege('${role}','public.sync_inventory_catalog_cache_v1(uuid,uuid)','EXECUTE')`),'f');
  });

  await t.test('real bound reservation, ship and receive kernels conserve synthetic stock on the provider image', () => {
   const site=newSyntheticTenant('managed-transfer436'),product=randomUUID(),destination=randomUUID(),actor=randomUUID();
   seedSyntheticTenant(psql,site);
   psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-managed-transfer-${actor}@example.invalid',true);
    UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
    INSERT INTO products(id,store_id,site_id,name,slug,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic managed stock','syn-${product}',100,20,true,'active');
    SELECT set_inventory_level_available('${product}',NULL,'${site.locationId}',20,NULL);
    INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic managed destination','active');COMMIT;`);
   const made=JSON.parse(psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';SELECT create_inventory_transfer_with_lines('${site.siteId}','${site.locationId}','${destination}','[{"product_id":"${product}","variant_id":null,"quantity":4}]',NULL,'${actor}','syn-managed-transfer','syn-${randomUUID()}');COMMIT;`));
   const id=made.transfer.id;
   assert.equal(psql(`SELECT available||'|'||reserved||'|'||free_quantity FROM inventory_levels WHERE product_id='${product}'AND location_id='${site.locationId}'`),'20|4|16');
   psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';SELECT ship_inventory_transfer('${id}','${actor}','syn-managed-ship','syn-${randomUUID()}');COMMIT;`);
   assert.equal(psql(`SELECT available||'|'||reserved||'|'||on_hand_quantity FROM inventory_levels WHERE product_id='${product}'AND location_id='${site.locationId}'`),'16|0|16');
   psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';SELECT receive_inventory_transfer('${id}',NULL,'${actor}','syn-managed-receive','syn-${randomUUID()}');COMMIT;`);
   assert.equal(psql(`SELECT sum(available)||'|'||sum(reserved)FROM inventory_levels WHERE product_id='${product}'`),'20|0');
   const before=psql(`SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i WHERE product_id='${product}'`);
   assert.match(fixture.psqlExpectError(down),/rollback436 refuses retained inventory operations/);
   assert.equal(psql(`SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i WHERE product_id='${product}'`),before);
  });

  await t.test('raw stock setters deny foreign and missing tenant contexts on the actual managed roles', async cases => {
   console.info('OWNED_TRANSFER436_CALLER_CONTROL '+psql("SELECT jsonb_build_object('postgres_super',rolsuper,'postgres_bypass',rolbypassrls,'set_app_execute',has_function_privilege('app_tenant','public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)','EXECUTE'),'set_anon_execute',has_function_privilege('anon','public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)','EXECUTE'))FROM pg_roles WHERE rolname='postgres'"));
   let callerOrdinal=0;
   for(const role of ['app_tenant','service_role','postgres']as const)for(const operation of ['set','adjust']as const)for(const context of ['foreign','unset']as const){
    await cases.test(`${role} ${operation} refuses ${context} context with no inventory or audit effect`,()=>{
     const ordinal=++callerOrdinal,a=newSyntheticTenant('managed-caller-a-'+ordinal),b=newSyntheticTenant('managed-caller-b-'+ordinal),actor=randomUUID(),product=randomUUID();
     seedSyntheticTenant(psql,a);seedSyntheticTenant(psql,b);
     psql(`BEGIN;SET LOCAL app.site_id='${a.siteId}';INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-managed-caller-${actor}@example.invalid',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${a.siteId}';
      INSERT INTO products(id,store_id,site_id,name,slug,price,stock,is_active,status)VALUES('${product}','${a.siteId}','${a.siteId}','Synthetic caller fence','syn-${product}',100,20,true,'active');SELECT set_inventory_level_available('${product}',NULL,'${a.locationId}',20,NULL);COMMIT;`);
     const inContext=(scope:string,sql:string,selectedRole:typeof role=role)=>`BEGIN;SET LOCAL ROLE ${selectedRole};SELECT set_config('app.site_id','${scope}',true),set_config('app.actor_id','${actor}',true);${sql};COMMIT;`;
     const count=(scope:string)=>psql(inContext(scope,`SELECT count(*)FROM inventory_levels WHERE product_id='${product}'`,'app_tenant')).split(/\r?\n/).at(-1);
     assert.equal(count(a.siteId),'1','Positive tenant read must see the actual populated level');assert.equal(count(b.siteId),'0');assert.equal(count(''),'0');
     const fn=operation==='set'?'set_inventory_level_available':'adjust_inventory_level';
     const call=(value:number)=>`SELECT ${fn}('${product}',NULL,'${a.locationId}',${value},'${actor}','adjustment','Synthetic caller fence','syn-caller-${randomUUID()}')`;
     psql(inContext(a.siteId,call(operation==='set'?21:1)));
     assert.equal(psql(`SELECT stock FROM products WHERE id='${product}'`),'21','The same role/kernel must actually write its authorized positive control');
     const world=()=>psql(`SELECT jsonb_build_object('product',(SELECT to_jsonb(p)FROM products p WHERE id='${product}'),'levels',(SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i WHERE product_id='${product}'),'events',(SELECT jsonb_agg(to_jsonb(e)ORDER BY id)FROM inventory_events e WHERE product_id='${product}'),'adjustments',(SELECT jsonb_agg(to_jsonb(j)ORDER BY id)FROM inventory_adjustments j WHERE product_id='${product}'));`);
     psql(inContext(a.siteId,call(operation==='set'?21:0)));
     assert.equal(psql(`SELECT stock FROM products WHERE id='${product}'`),'21','An authorized unchanged-quantity call is a valid positive control');
     const before=world();let denied=false;
     try{psql(inContext(context==='foreign'?b.siteId:'',call(operation==='set'?99:7)));}catch{denied=true;}
     const after=world(),stock=psql(`SELECT stock FROM products WHERE id='${product}'`);
     assert(denied,`Managed caller fence missing: role=${role} operation=${operation} context=${context}; authorized stock21 became${stock}; world_changed=${before!==after}`);
     assert.equal(after,before,'A refused kernel call cannot change stock, cached product, events or audit rows');
     let unchangedDenied=false;try{psql(inContext(context==='foreign'?b.siteId:'',call(operation==='set'?21:0)));}catch{unchangedDenied=true;}
     assert(unchangedDenied,'A wrong/missing tenant context cannot read a stock acknowledgement by submitting the existing quantity');
     assert.equal(world(),before,'A refused unchanged-quantity call cannot change stock or audit rows');
    });
   }
  });
  // The new batch receipt expands the same private single-adjustment owner.
  // Apply original437 bytes after original436; the provider fence is never
  // replaced with advisory locks or an assumed superuser role.
  const batchUp=read(root+'/437_inventory_batch_adjustment_receipts.sql');
  const batchDown=read('database/supabase/rollback/437_inventory_batch_adjustment_receipts.rollback.sql');
  await t.test('437 refuses a missing verified provider helper, then safe UP/DOWN/UP keeps all previous stock and closed receipt authority',()=>{
   const before=psql("SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i");
   admin(retirement);
   try{
    assert.match(fixture.psqlExpectError(batchUp),/LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
    assert.match(fixture.psqlExpectError(batchDown),/LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
    assert.equal(psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='437'"),'0');
   }finally{admin(bootstrap);}
   psql(batchUp);psql(batchDown);psql(batchUp);
   assert.equal(psql("SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i"),before);
   for(const role of ['anon','authenticated','app_tenant','service_role'])assert.equal(psql(`SELECT has_table_privilege('${role}','inventory_adjustment_receipts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`),'f');
   assert.equal(psql("SELECT has_function_privilege('app_tenant','apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)','EXECUTE')"),'t');
   for(const role of ['anon','authenticated'])assert.equal(psql(`SELECT has_function_privilege('${role}','apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)','EXECUTE')`),'f');
   assert.equal(psql("SELECT count(*)FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a WHERE p.oid='apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)'::regprocedure AND a.grantee NOT IN(p.proowner,'app_tenant'::regrole)"),'0');
   //164 grants app_tenant membership to service_role. PG17 provider roles
   // inherit that EXECUTE; the kernel's strict current-role check still denies
   // invocation. Do not mistake the provider membership for a direct grant or
   // alter cluster roles to make a structural privilege assertion green.
   assert.equal(psql("SELECT has_function_privilege('service_role','apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)','EXECUTE')=pg_has_role('service_role','app_tenant','USAGE')"),'t');
  });
  await t.test('437 preserves raw tenant checks and one audit/event per child with exact owner batch replay on the actual provider image',()=>{
   const site=newSyntheticTenant('managed-batch437'),actor=randomUUID(),product=randomUUID(),key=randomUUID();seedSyntheticTenant(psql,site);
   psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-managed-batch-${actor}@example.invalid',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';INSERT INTO products(id,store_id,site_id,name,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic managed batch',100,4,true,'active');SELECT set_inventory_level_available('${product}',NULL,'${site.locationId}',4,'${actor}');COMMIT;`);
   const item={product_id:product,variant_id:null,location_id:site.locationId,adjustment:2,reason:'correction',notes:null};
   const command=JSON.stringify({adjustments:[item,item]});
   const invoke=`BEGIN;SET LOCAL ROLE app_tenant;SET LOCAL app.site_id='${site.siteId}';SET LOCAL app.actor_id='${actor}';SET LOCAL app.request_id='syn-shared-managed-batch';SELECT apply_inventory_adjustment_batch_v1('${site.siteId}','${actor}','${key}','${command}');COMMIT;`;
   const auditBefore=Number(psql(`SELECT count(*)FROM inventory_adjustments WHERE product_id='${product}'`));
   const first=JSON.parse(psql(invoke));assert.equal(first.replayed,false);assert.equal(first.response.results.length,2);
   assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${product}'`),'8');
   assert.equal(Number(psql(`SELECT count(*)FROM inventory_adjustments WHERE product_id='${product}'`))-auditBefore,2);
   assert.equal(psql(`SELECT count(*)FROM outbox_events WHERE aggregate_id='${product}'AND event_type='inventory.level.adjusted'`),'2');
   assert.equal(psql(`SELECT count(*)FROM inventory_adjustment_receipts WHERE store_id='${site.siteId}'`),'3');
   const world=()=>psql(`SELECT jsonb_build_object('levels',(SELECT jsonb_agg(to_jsonb(i)ORDER BY id)FROM inventory_levels i WHERE product_id='${product}'),'receipts',(SELECT jsonb_agg(to_jsonb(r)ORDER BY idempotency_key)FROM inventory_adjustment_receipts r WHERE store_id='${site.siteId}'),'events',(SELECT jsonb_agg(to_jsonb(e)ORDER BY id)FROM outbox_events e WHERE aggregate_id='${product}'))`);
   const saved=world(),retry=JSON.parse(psql(invoke));assert.equal(retry.replayed,true);assert.deepEqual(retry.response,first.response);assert.equal(world(),saved);
   assert.match(fixture.psqlExpectError(invoke.replace('ROLE app_tenant','ROLE service_role')),/INVENTORY_BATCH_FORBIDDEN/);assert.equal(world(),saved);
   for(const role of ['postgres','app_tenant','service_role'])for(const scope of ['',randomUUID()])for(const fn of ['set_inventory_level_available','adjust_inventory_level']){
    assert.match(fixture.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('app.site_id','${scope}',true);SELECT ${fn}('${product}',NULL,'${site.locationId}',9,'${actor}');COMMIT;`),/tenant|site/i);assert.equal(world(),saved);
   }
   assert.match(fixture.psqlExpectError(batchDown),/rollback437 refuses retained inventory batch acknowledgements or adjustment effects/);assert.equal(world(),saved);
  });
 } finally { await fixture.close(); }
});
