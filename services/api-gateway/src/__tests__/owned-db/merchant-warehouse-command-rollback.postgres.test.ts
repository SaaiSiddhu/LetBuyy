import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const up=readFileSync(new URL('../../../../../database/supabase/migrations/415_atomic_warehouse_commands.sql',import.meta.url),'utf8');
const down=readFileSync(new URL('../../../../../database/supabase/rollback/415_atomic_warehouse_commands.rollback.sql',import.meta.url),'utf8');
const names=['create_purchase_order_with_lines','receive_purchase_order','create_inventory_transfer_with_lines','ship_inventory_transfer','receive_inventory_transfer','receive_purchase_order_line','receive_inventory_transfer_line'];
function effects(){return owned.psql("SELECT jsonb_agg(jsonb_build_object('id',oid,'owner',proowner,'acl',proacl::text,'definition',pg_get_functiondef(oid))ORDER BY proname)::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN("+names.map(n=>"'"+n+"'").join(',')+");");}
function present(){return owned.psql("SELECT to_regclass('public.warehouse_command_receipts')IS NOT NULL AND to_regprocedure('public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)')IS NOT NULL;");}
test('empty warehouse rollback and reapply restore exact raw effect definitions owners and ACL fences',()=>{
 assert.equal(present(),'t');assert.equal(owned.psql('SELECT count(*) FROM warehouse_command_receipts;'),'0');
 const before=effects();assert.equal(JSON.parse(before).length,7);
 const metadata=owned.psql("SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl::text)ORDER BY c.oid)::text FROM pg_class c WHERE c.oid IN('public.inventory_locations'::regclass,'public.suppliers'::regclass);");
 const restored=JSON.parse(owned.psql("SELECT coalesce(jsonb_agg(jsonb_build_array(object_signature,grantee)),'[]')::text FROM migration_privilege_journal WHERE migration='415' AND privilege='WAREHOUSE METADATA INSERT' AND action='revoked';")) as Array<[string,string]>;
 assert.ok(restored.length>0,'positive control: original metadata grants were captured');
 assert.equal(owned.psql("SELECT has_function_privilege('app_tenant','public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE');"),'t');
 assert.equal(owned.psql("SELECT has_function_privilege('app_tenant','public.create_purchase_order_with_lines(uuid,uuid,uuid,jsonb,timestamptz,text,uuid,text,text)','EXECUTE');"),'f');
 owned.script(down);assert.equal(present(),'f');
 assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='415';"),'0');
 assert.equal(owned.psql("SELECT has_function_privilege('app_tenant','public.create_purchase_order_with_lines(uuid,uuid,uuid,jsonb,timestamptz,text,uuid,text,text)','EXECUTE');"),'t','actual original named grant is restored on empty DOWN');
 for(const [signature,role] of restored)assert.equal(owned.psql("SELECT has_table_privilege('"+role+"','"+signature+"','INSERT');"),'t','only captured metadata INSERT grants restored');
 owned.script(up);assert.equal(present(),'t');assert.equal(effects(),before);
 assert.equal(owned.psql("SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl::text)ORDER BY c.oid)::text FROM pg_class c WHERE c.oid IN('public.inventory_locations'::regclass,'public.suppliers'::regclass);"),metadata);
});
test('rollback refuses changed entry-function identity/configuration without altering that drift or raw fences',()=>{
 const signature='public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)',before=effects();
 owned.psql("ALTER FUNCTION "+signature+" SET work_mem='8MB';");
 const drift=owned.psql("SELECT pg_get_functiondef('"+signature+"'::regprocedure);");
 try {
  assert.match(owned.psqlScriptExpectError(down),/rollback414 refuses changed function body\/owner\/ACL\/provenance/);
  assert.equal(owned.psql("SELECT pg_get_functiondef('"+signature+"'::regprocedure);"),drift);
  assert.equal(effects(),before);assert.equal(present(),'t');
 } finally {owned.psql("ALTER FUNCTION "+signature+" RESET work_mem;");}
});
test('an actual prepared writer prevents warehouse DOWN and preserves the complete function fence',()=>{
 const site=newSyntheticTenant('wms414-rollback');seedSyntheticTenant(owned.psql,site);
 const key='syn-wms414-'+randomUUID(),before=effects();
 owned.psql("BEGIN;UPDATE sites SET name=name WHERE id='"+site.siteId+"';PREPARE TRANSACTION '"+key+"';");
 try {
  assert.equal(owned.psql("SELECT count(*)FROM pg_prepared_xacts WHERE gid='"+key+"';"),'1');
  assert.match(owned.psqlScriptExpectError(down),/rollback414 refuses concurrent\/prepared writes/);
  assert.equal(effects(),before);assert.equal(present(),'t');
 } finally {owned.psql("ROLLBACK PREPARED '"+key+"';");}
});


for(const table of ['inventory_locations','suppliers'])test('metadata rollback refuses '+table+' INSERT or shape drift without restoring bypasses',()=>{
 const before=effects();
 owned.psql('GRANT INSERT ON public.'+table+' TO app_tenant;');
 try {assert.match(owned.psqlScriptExpectError(down),/metadata/);assert.equal(present(),'t');assert.equal(effects(),before);}
 finally {owned.psql('REVOKE INSERT ON public.'+table+' FROM app_tenant;');}
 owned.psql('ALTER TABLE public.'+table+" SET (fillfactor=90);");
 try {assert.match(owned.psqlScriptExpectError(down),/metadata/);assert.equal(present(),'t');assert.equal(effects(),before);}
 finally {owned.psql('ALTER TABLE public.'+table+' RESET (fillfactor);');}
});
