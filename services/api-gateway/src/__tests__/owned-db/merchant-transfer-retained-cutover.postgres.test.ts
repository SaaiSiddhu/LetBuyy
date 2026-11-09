// Synthetic retained-state and committed-state recovery. No hosted data or
// provider effects. The pre436 shape is the actual empty paired DOWN of the
// owned template; this does not claim a pristine historical migration slot.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const up = readFileSync('database/supabase/migrations/436_canonical_transfer_reservations.sql', 'utf8');
const down = readFileSync('database/supabase/rollback/436_canonical_transfer_reservations.rollback.sql', 'utf8');
const body = (sql: string) => sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const tables = () => JSON.parse(owned.psql(`SELECT jsonb_agg(c.relname ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')`)) as string[];
const roles = () => owned.psql(`SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid)FROM pg_roles r),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor)FROM pg_auth_members m))`);
function digest(names: string[]) {
 const parts = names.map(name => `SELECT ${quote(name)} AS name,count(*) AS rows,
 encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text,'UTF8')),'hex') AS hash
 FROM public.${identifier(name)} t ${name === 'migration_privilege_journal' ? "WHERE migration IS DISTINCT FROM '436'" : ''}`);
 return owned.scriptLarge(`SET jit=off;SELECT jsonb_agg(to_jsonb(x) ORDER BY name) FROM(${parts.join(' UNION ALL ')})x`);
}
const logicalProfile = () => owned.psql(`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),p.proowner,p.proacl,obj_description(p.oid,'pg_proc')) ORDER BY p.proname,p.oid)
 FROM pg_proc p WHERE p.oid IN(SELECT object_oid FROM migration_privilege_journal WHERE migration='436' AND privilege='INVENTORY436 CURRENT FUNCTION')),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attgenerated,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attname)
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid)) ORDER BY x.conname)FROM pg_constraint x WHERE x.conrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.tgname)FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=c.oid)) ORDER BY c.relname)
 FROM pg_class c WHERE c.oid IN('inventory_levels'::regclass,'inventory_reservations'::regclass,'inventory_transfers'::regclass,'inventory_transfer_lines'::regclass)))`);

let gateway: Gateway | undefined, proxy: Awaited<ReturnType<typeof startOwnedPooledSqlProxy>> | undefined;
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });

test('older414 DOWN refuses an empty newer436 kernel without replacing its scope guards',()=>{
 const oldDown=readFileSync(new URL('../../../../../database/supabase/rollback/414_atomic_warehouse_commands.rollback.sql',import.meta.url),'utf8');
 assert.equal(owned.psql('SELECT count(*)FROM warehouse_command_receipts'),'0','Empty current-template positive control');
 const before=logicalProfile(),data=digest(tables()),authority=roles();
 assert.match(owned.psqlScriptExpectError(oldDown),/rollback414 refuses changed raw effect/);
 assert.equal(logicalProfile(),before);assert.equal(digest(tables()),data);assert.equal(roles(),authority);
});

test('436 empty DOWN/UP preserves rows, roles, canonical definitions and logical constraints', { timeout: 180000 }, () => {
 const names = tables(), rows = digest(names), authority = roles(), profile = logicalProfile();
 assert.equal(owned.psql('SELECT count(*) FROM inventory_levels'), '0', 'Positive empty-template precondition');
 owned.script(down);
 assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='436'"), '0');
 assert.equal(owned.psql("SELECT count(*)FROM information_schema.columns WHERE table_schema='public' AND(table_name='inventory_levels' AND column_name='free_quantity' OR table_name='inventory_transfer_lines' AND column_name='reservation_id')"), '0');
 for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) for (const table of ['inventory_levels', 'inventory_reservations', 'inventory_transfers', 'inventory_transfer_lines']) {
  assert.equal(owned.psql(`SELECT has_table_privilege('${role}','public.${table}','INSERT') AND has_table_privilege('${role}','public.${table}','UPDATE') AND has_table_privilege('${role}','public.${table}','DELETE') AND has_table_privilege('${role}','public.${table}','TRUNCATE')=${role !== 'app_tenant'}`), 't', 'Original raw grants restored exactly for '+role+'/'+table);
 }
 assert.deepEqual(tables(), names); assert.equal(digest(names), rows); assert.equal(roles(), authority);
 owned.script(up);
 assert.equal(logicalProfile(), profile); assert.equal(digest(names), rows); assert.equal(roles(), authority);
});

test('436 DOWN refuses changed function/table/grant/constraint/trigger/policy and journal profiles atomically', () => {
 const names = tables(), rows = digest(names), profile = logicalProfile(), authority = roles();
 const faults = [
  "COMMENT ON FUNCTION public.sync_inventory_catalog_cache_v1(uuid,uuid) IS 'Synthetic changed comment'",
  'ALTER FUNCTION public.sync_inventory_catalog_cache_v1(uuid,uuid) COST 101',
  'GRANT EXECUTE ON FUNCTION public.sync_inventory_catalog_cache_v1(uuid,uuid) TO authenticated',
  'ALTER FUNCTION public.sync_inventory_catalog_cache_v1(uuid,uuid) OWNER TO app_tenant',
  'ALTER FUNCTION public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text) COST 101',
  'GRANT EXECUTE ON FUNCTION public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text) TO app_tenant',
  'GRANT UPDATE ON inventory_levels TO authenticated',
  'GRANT UPDATE(available) ON inventory_levels TO authenticated',
  'ALTER TABLE inventory_levels ADD COLUMN synthetic_unreviewed text',
  'ALTER TABLE inventory_levels NO FORCE ROW LEVEL SECURITY',
  'ALTER TABLE inventory_levels DROP CONSTRAINT inventory_levels_canonical_hold436',
  'ALTER TABLE inventory_transfers DISABLE TRIGGER inventory_transfer_parent_binding436',
  'CREATE POLICY synthetic_unreviewed ON inventory_levels FOR SELECT TO authenticated USING(true)',
  "UPDATE migration_privilege_journal SET object_definition_hash='synthetic-unreviewed' WHERE migration='436' AND privilege='INVENTORY436 CURRENT FUNCTION'",
 ];
 for (const fault of faults) {
  const error = owned.psqlScriptExpectError('BEGIN;'+fault+';\n'+body(down)+'\nCOMMIT;');
  assert.match(error, /rollback436 refuses changed (function|table) profile/, fault);
  assert.equal(logicalProfile(), profile, fault+' left no profile effect');
  assert.equal(digest(names), rows, fault+' left no retained row effect');
  assert.equal(roles(), authority, fault+' left no role effect');
 }
});

test('436 UP refuses unreviewed original function and raw column grants', () => {
 owned.script(down);
 const names = tables(), rows = digest(names), authority = roles();
 for (const fault of [
  'ALTER FUNCTION public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text) COST 101',
  'ALTER FUNCTION public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text) COST 101',
  'GRANT UPDATE(available) ON inventory_levels TO authenticated',
  'GRANT UPDATE ON inventory_levels TO authenticated WITH GRANT OPTION',
 ]) {
  assert.match(owned.psqlScriptExpectError('BEGIN;'+fault+';\n'+body(up)+'\nCOMMIT;'), /migration436 refuses (changed original function|unreviewed inventory relation profile|unreviewed raw inventory grants)/);
  assert.equal(digest(names), rows); assert.equal(roles(), authority);
 }
 owned.script(up);
});

test('436 refuses actual prepared writers in both directions without changing rows or authority', () => {
 assert.equal(owned.psql("SELECT current_setting('max_prepared_transactions')"),'2');
 const site=newSyntheticTenant('transfer436-prepared');seedSyntheticTenant(owned.psql,site);
 for(const direction of ['rollback','migration']as const){
  if(direction==='migration')owned.script(down);
  const names=tables(),rows=digest(names),authority=roles(),gid='syn-436-'+randomUUID();
  owned.psql(`BEGIN;UPDATE sites SET name=name WHERE id='${site.siteId}';PREPARE TRANSACTION '${gid}'`);
  try{
   assert.equal(owned.psql(`SELECT count(*)FROM pg_prepared_xacts WHERE gid='${gid}'AND database=current_database()AND owner=current_user`),'1');
   assert.match(owned.psqlScriptExpectError(direction==='rollback'?down:up),new RegExp(direction+'436 refuses concurrent/prepared writes'));
  }finally{owned.psql(`ROLLBACK PREPARED '${gid}'`);}
  assert.equal(digest(names),rows);assert.equal(roles(),authority);
  if(direction==='migration')owned.script(up);
 }
});

test('436 reconciles real retained reserved/partial transfers and preserves original immutable receipts and unrelated commerce', { timeout: 240000 }, async () => {
 owned.script(down);
 const site = newSyntheticTenant('retained-transfer436'), actor = randomUUID(), destination = randomUUID(), email = `syn-retained-transfer-${actor}@example.invalid`;
 seedSyntheticTenant(owned.psql, site); seedSyntheticOrder(owned.psql, site);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);
 UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic retained destination','active');`);
 proxy = await startOwnedPooledSqlProxy(owned); gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
 const post = async (path: string, data: Record<string, unknown>, key: string = randomUUID()) => gateway!.request('/v1/inventory'+path, {
  method:'POST', headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({...data,idempotency_key:key}) });
 const retained: Array<{ product:string; id:string; line:string; key:string; reply:unknown; partial:boolean }> = [];
 for (const partial of [false,true]) {
  const product = randomUUID(), key = randomUUID();
  owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic retained transfer','syn-${product}',100,20,true,'active');
   WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT set_inventory_level_available('${product}',NULL,'${site.locationId}',20,NULL) FROM _fixture_inventory_scope436;`);
  const first = await post('/transfers',{store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:product,quantity:4}]},key);
  assert.equal(first.status,201,first.text); const id = first.json?.data.transfer.id, line = first.json?.data.lines[0].id;
  if (partial) {
   const ship = await post(`/transfers/${id}/ship`,{}); assert.equal(ship.status,200,ship.text);
   const receive = await post(`/transfers/${id}/receive`,{lines:[{transfer_line_id:line,quantity:1}]}); assert.equal(receive.status,200,receive.text);
  }
  retained.push({product,id,line,key,reply:first.json?.data,partial});
 }
 await gateway.settle();
 const names = tables(), authority = roles();
 const mutable = new Set(['inventory_levels','inventory_reservations','inventory_events','products','product_variants','inventory_transfer_lines']);
 const unchangedNames = names.filter(name=>!mutable.has(name)), unchanged = digest(unchangedNames);
 const oldReceipts = owned.psql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY id)FROM warehouse_command_receipts r WHERE site_id='${site.siteId}'`);
 const oldReservations = owned.psql('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),\'[]\'::jsonb)FROM inventory_reservations r');
 const oldEvents = owned.psql('SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),\'[]\'::jsonb)FROM inventory_events e');
 const lineRows = owned.psql(`SELECT jsonb_agg(to_jsonb(l) ORDER BY id)FROM inventory_transfer_lines l WHERE site_id='${site.siteId}'`);
 const before = digest(names);
 for (const fault of [
  `UPDATE inventory_levels SET reserved=reserved+1 WHERE product_id='${retained[0].product}'`,
  `INSERT INTO inventory_reservations(store_id,product_id,location_id,quantity,status,expires_at,idempotency_key) VALUES('${site.siteId}','${retained[0].product}','${site.locationId}',18,'active',now()+interval '20 minutes','syn-overlap-${randomUUID()}'); UPDATE inventory_levels SET reserved=22 WHERE product_id='${retained[0].product}'`,
  `UPDATE inventory_transfer_lines SET quantity_shipped=1 WHERE id='${retained[0].line}'`,
 ]) {
  assert.match(owned.psqlScriptExpectError('BEGIN;'+fault+';\n'+body(up)+'\nCOMMIT;'), /migration436 refuses (unexplained retained inventory variance|oversubscribed retained inventory|inconsistent retained transfers)|INSUFFICIENT_INVENTORY/);
  assert.equal(digest(names), before, 'Refused retained conversion must preserve every original row');
 }
 owned.script(up);
 assert.equal(roles(),authority); assert.equal(digest(unchangedNames),unchanged);
 assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY id)FROM warehouse_command_receipts r WHERE site_id='${site.siteId}'`),oldReceipts);
 assert.equal(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)FROM inventory_reservations r WHERE idempotency_key NOT LIKE 'warehouse.backfill436:%'"),oldReservations);
 assert.equal(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),'[]'::jsonb)FROM inventory_events e WHERE idempotency_key NOT LIKE 'inventory.reserve:warehouse.backfill436:%'"),oldEvents);
 const preservedLines = JSON.parse(owned.psql(`SELECT jsonb_agg(to_jsonb(l)-'reservation_id'-'metadata'||jsonb_build_object('metadata',l.metadata-'canonical_reservation436') ORDER BY id)FROM inventory_transfer_lines l WHERE site_id='${site.siteId}'`));
 assert.deepEqual(preservedLines,JSON.parse(lineRows),'Only the real reservation link and named retained-receipt marker may change an original line');
 for (const entry of retained) {
  const level = JSON.parse(owned.psql(`SELECT to_jsonb(i)FROM inventory_levels i WHERE product_id='${entry.product}' AND location_id='${site.locationId}'`));
  assert.equal(level.available,entry.partial?16:20); assert.equal(level.reserved,entry.partial?0:4);
  const reservation = JSON.parse(owned.psql(`SELECT to_jsonb(r)FROM inventory_reservations r JOIN inventory_transfer_lines l ON l.reservation_id=r.id WHERE l.id='${entry.line}'`));
  assert.equal(reservation.quantity,entry.partial?3:4); assert.equal(reservation.status,entry.partial?'committed':'active'); assert.equal(reservation.expires_at,'infinity');
  const replay = await post('/transfers',{store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:entry.product,quantity:4}]},entry.key);
  assert.equal(replay.status,201,replay.text); assert.deepEqual(replay.json?.data,entry.reply,'Original acknowledgement bytes do not become a new reservation acknowledgement');
 }
 const current = digest(tables()), profile = logicalProfile();
 assert.match(owned.psqlScriptExpectError(down),/rollback436 refuses retained inventory operations/);
 assert.equal(digest(tables()),current); assert.equal(logicalProfile(),profile); assert.equal(roles(),authority);
 console.info('OWNED_TRANSFER436_RETAINED '+JSON.stringify({publicTables:names.length,unaffectedTables:unchangedNames.length,originalReceipts:JSON.parse(oldReceipts).length,transfers:retained.length,rolesUnchanged:true,rollbackRefusedWithoutEffects:true}));
});


test('older414 DOWN refuses retained receipts without changing current scope guards or business data',()=>{
 const oldDown=readFileSync(new URL('../../../../../database/supabase/rollback/414_atomic_warehouse_commands.rollback.sql',import.meta.url),'utf8');
 const before=logicalProfile(),data=digest(tables()),authority=roles();
 assert.equal(owned.psql('SELECT count(*)>0 FROM warehouse_command_receipts'),'t','Actual retained receipts must be present');
 assert.match(owned.psqlScriptExpectError(oldDown),/rollback414 refuses retained warehouse command receipts/);
 assert.equal(logicalProfile(),before,'Older rollback cannot replace current caller-context guards or native fences');
 assert.equal(digest(tables()),data,'Refusal must retain all current business/audit data');
 assert.equal(roles(),authority);
});
