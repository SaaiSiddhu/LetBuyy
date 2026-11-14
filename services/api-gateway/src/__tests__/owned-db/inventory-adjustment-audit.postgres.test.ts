import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getPooledSql, closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { APPLY_INVENTORY_ADJUSTMENT_SQL } from '../../execution/inventory-adjustment.adapter';
import test, { after, afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newBarrier, newIdentityKeys, signedIdentityHeaders, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

// The merchant inventory editor and Inventory History are connected through the
// canonical Gateway routes. This suite exercises their stock mutation and audit
// read against the runner-owned Postgres/PostgREST, with a signed merchant owner.
// The service-role worker path proves application authorization and SQL behavior;
// it is not an RLS proof.

const owned = requireOwnedDatabase();
const { psql } = owned;
const tenant = newSyntheticTenant('inv-audit');
const ownerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const ownerEmail = `syn-inv-owner-${ownerId.slice(0, 8)}@example.invalid`;
const outsiderEmail = `syn-inv-outsider-${outsiderId.slice(0, 8)}@example.invalid`;
const productId = crypto.randomUUID();
const variantId = crypto.randomUUID();
let keys: IdentityKeys;
let gateway: Gateway;
let proxy: OwnedPooledSqlProxy;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, tenant);
    psql(`
      INSERT INTO users_custom (id,email,email_verified) VALUES
        ('${ownerId}','${ownerEmail}',true),
        ('${outsiderId}','${outsiderEmail}',true);
      UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${tenant.siteId}';
      INSERT INTO products (id,store_id,name,price,sku,is_active,stock,created_at,updated_at)
      VALUES ('${productId}','${tenant.siteId}','Synthetic adjustable product',129.00,'SYN-INV-${productId}',true,4,now(),now());
      INSERT INTO product_variants (id,product_id,title,price,sku,inventory_qty,created_at,updated_at)
      VALUES ('${variantId}','${productId}','Synthetic size M',129.00,'SYN-INV-V-${variantId}',4,now(),now());
      INSERT INTO inventory_levels (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${tenant.siteId}','${productId}','${variantId}','${tenant.locationId}',4,0,0,4,0,4,now(),now());
    `);
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, keys, proxy.env()));
});

afterEach(async () => { await gateway.settle(); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

async function adjust(actorId: string, email: string, adjustment: number, idempotencyKey: string, requestId: string) {
    return gateway.request('/v1/inventory/adjust', {
        method: 'POST',
        headers: {
            ...(await signedIdentityHeaders(actorId, email)),
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Store-ID': tenant.siteId,
            'X-Request-ID': requestId,
        },
        body: JSON.stringify({
            product_id: productId,
            variant_id: variantId,
            location_id: tenant.locationId,
            adjustment,
            reason: 'correction',
            notes: `Synthetic inventory count ${idempotencyKey}`,
        }),
    });
}


const stockMigration=readFileSync(new URL('../../../../../database/supabase/migrations/356_inventory_adjustment_receipts.sql',import.meta.url),'utf8');
const stockRollback=readFileSync(new URL('../../../../../database/supabase/rollback/356_inventory_adjustment_receipts.rollback.sql',import.meta.url),'utf8');
function observeAdjustmentQueries(onQuery:()=>Promise<void>){
    const pool=getPooledSql(gateway.env,{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;
    const original=pool.begin;
    (pool as any).begin=(callback:any)=>(original as any).call(pool,(tx:any)=>callback(new Proxy(tx,{
        get(target,key){if(key==='unsafe')return async(query:string,parameters:unknown[])=>{
            if(query===APPLY_INVENTORY_ADJUSTMENT_SQL)await onQuery();
            return target.unsafe(query,parameters);
        };return Reflect.get(target,key,target);},
    })));
    return{restore(){pool.begin=original;}};
}
const stockQuote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const stockCommand=(p:ReturnType<typeof recoveryProduct>)=>({...recoveryBody(p),variant_id:p.variantId,location_id:tenant.locationId});
function stockRoleCall(p:ReturnType<typeof recoveryProduct>,key:string,command:object=stockCommand(p),role='app_tenant',actor=ownerId,store=tenant.siteId,contextActor=actor,contextStore=store){return `BEGIN;SET LOCAL ROLE ${role};SELECT set_config('app.site_id',${stockQuote(contextStore)},true),set_config('app.actor_id',${stockQuote(contextActor)},true);SELECT public.apply_inventory_adjustment_v1('${store}','${actor}',${stockQuote(key)},${stockQuote(JSON.stringify(command))}::jsonb);COMMIT;`;}
const stockWorld=(p:ReturnType<typeof recoveryProduct>)=>({...recoverySnapshot(p),receipts:JSON.parse(psql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.idempotency_key),'[]') FROM inventory_adjustment_receipts r WHERE product_id='${p.id}';`))});
const stockOwnerDefinitions=()=>psql(`SELECT string_agg(oid::text||'|'||oid::regprocedure::text||'|'||md5(pg_get_functiondef(oid))||'|'||coalesce(proacl::text,''),'~' ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('adjust_inventory_level','set_inventory_level_available','reserve_inventory','commit_inventory_reservation','release_inventory_reservation','release_order_inventory_with_ledger','assert_product_edit_actor_v1');`);
async function eventually(predicate:()=>boolean){for(let i=0;i<150;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('Expected owned database coordination state');}


const stock356BeforeTables = [
    'inventory_adjustment_receipts','migration_privilege_journal','idempotency_keys','users_custom','sites','employees','inventory_locations',
    'products','product_variants','product_options','inventory_levels',
    'inventory_reservations','inventory_adjustments','inventory_events',
    'product_price_observations','channel_listings','channel_listing_moderation_events',
    'outbox_events','audit_activity_events','product_edit_receipts',
    'fulfillment_order_lines','inventory_transfer_lines','inventory_transfer_receipts',
    'purchase_order_lines','purchase_order_receipts','restock_events','return_lines','order_items',
] as const;
const stock356BeforeFunctions = [
    'apply_product_edit_v1','read_product_for_edit_v1','product_edit_snapshot_v1',
    'assert_product_edit_actor_v1','bump_product_edit_revision_v1','guard_product_edit_receipt_v1',
    'increment_version','set_inventory_level_available',
    'apply_inventory_adjustment_v1','guard_inventory_adjustment_receipt_v1',
    'adjust_inventory_level','reserve_inventory','commit_inventory_reservation','release_inventory_reservation','release_order_inventory_with_ledger',
];
const stock356BeforeRelations = `SELECT c.oid FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN(${stock356BeforeTables.map(stockQuote).join(',')})`;
const stock356BeforeProcedures = `SELECT p.oid FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN(${stock356BeforeFunctions.map(stockQuote).join(',')})`;
const stock356BeforeObjects = `SELECT 'pg_catalog.pg_class'::regclass::oid AS classid,oid AS objid FROM pg_catalog.pg_class WHERE oid IN(${stock356BeforeRelations}) OR oid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid IN(${stock356BeforeRelations}))
    UNION SELECT 'pg_catalog.pg_proc'::regclass::oid,oid FROM pg_catalog.pg_proc WHERE oid IN(${stock356BeforeProcedures})
    UNION SELECT 'pg_catalog.pg_trigger'::regclass::oid,oid FROM pg_catalog.pg_trigger WHERE tgrelid IN(${stock356BeforeRelations})
    UNION SELECT 'pg_catalog.pg_constraint'::regclass::oid,oid FROM pg_catalog.pg_constraint WHERE conrelid IN(${stock356BeforeRelations})
    UNION SELECT 'pg_catalog.pg_policy'::regclass::oid,oid FROM pg_catalog.pg_policy WHERE polrelid IN(${stock356BeforeRelations})
    UNION SELECT 'pg_catalog.pg_attrdef'::regclass::oid,oid FROM pg_catalog.pg_attrdef WHERE adrelid IN(${stock356BeforeRelations})
    UNION SELECT 'pg_catalog.pg_rewrite'::regclass::oid,oid FROM pg_catalog.pg_rewrite WHERE ev_class IN(${stock356BeforeRelations})
    UNION SELECT 'pg_catalog.pg_type'::regclass::oid,oid FROM pg_catalog.pg_type WHERE typrelid IN(${stock356BeforeRelations}) OR typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN(${stock356BeforeRelations}))`;
function stock356BeforeDataSql(includeReceipts = true) {
    return `SELECT jsonb_build_object(${stock356BeforeTables.filter(name=>includeReceipts||name!=='product_edit_receipts').flatMap(name=>[
        stockQuote(name),`(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.${name} t)`,
    ]).join(',')})`;
}
function stock356BeforeProfileSql() {
    return `SELECT jsonb_build_object(
        'procedures',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('definition',pg_catalog.pg_get_functiondef(p.oid)) ORDER BY p.oid),'[]') FROM pg_catalog.pg_proc p WHERE p.oid IN(${stock356BeforeProcedures})),
        'relations',(SELECT coalesce(jsonb_agg(jsonb_build_object('oid',r.oid,'name',r.relname,'namespace',r.relnamespace,'kind',r.relkind,'owner',r.relowner,'acl',r.relacl,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'persistence',r.relpersistence,'replica_identity',r.relreplident,'options',r.reloptions) ORDER BY r.oid),'[]') FROM pg_catalog.pg_class r WHERE r.oid IN(${stock356BeforeRelations})),
        'attributes',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.attrelid,t.attnum),'[]') FROM pg_catalog.pg_attribute t WHERE t.attrelid IN(${stock356BeforeRelations}) AND t.attnum>0),
        'defaults',(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_catalog.pg_get_expr(t.adbin,t.adrelid)) ORDER BY t.adrelid,t.adnum),'[]') FROM pg_catalog.pg_attrdef t WHERE t.adrelid IN(${stock356BeforeRelations})),
        'constraints',(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_catalog.pg_get_constraintdef(t.oid,true)) ORDER BY t.oid),'[]') FROM pg_catalog.pg_constraint t WHERE t.conrelid IN(${stock356BeforeRelations})),
        'indexes',(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_catalog.pg_get_indexdef(t.indexrelid)) ORDER BY t.indexrelid),'[]') FROM pg_catalog.pg_index t WHERE t.indrelid IN(${stock356BeforeRelations})),
        'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_catalog.pg_get_triggerdef(t.oid,true)) ORDER BY t.oid),'[]') FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN(${stock356BeforeRelations})),
        'policies',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]') FROM pg_catalog.pg_policy t WHERE t.polrelid IN(${stock356BeforeRelations})),
        'comments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.classoid,t.objoid,t.objsubid),'[]') FROM pg_catalog.pg_description t WHERE (t.classoid,t.objoid) IN(${stock356BeforeObjects})),
        'security_labels',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM pg_catalog.pg_seclabel t WHERE (t.classoid,t.objoid) IN(${stock356BeforeObjects})),
        'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM pg_catalog.pg_depend t WHERE (t.classid,t.objid) IN(${stock356BeforeObjects}) OR (t.refclassid,t.refobjid) IN(${stock356BeforeObjects})),
        'row_array_types',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]') FROM pg_catalog.pg_type t WHERE t.typrelid IN(${stock356BeforeRelations}) OR t.typelem IN(SELECT reltype FROM pg_catalog.pg_class WHERE oid IN(${stock356BeforeRelations}))),
        'shared_dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM pg_catalog.pg_shdepend t WHERE t.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database()) AND (t.classid,t.objid) IN(${stock356BeforeObjects})),
        'roles',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',r.rolname,'super',r.rolsuper,'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'login',r.rolcanlogin,'replication',r.rolreplication,'bypass_rls',r.rolbypassrls) ORDER BY r.rolname),'[]') FROM pg_catalog.pg_roles r WHERE r.rolname IN(current_user,'app_tenant','anon','authenticated','service_role')),
        'role_memberships',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM pg_catalog.pg_auth_members t WHERE t.member IN(SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN(current_user,'app_tenant','anon','authenticated','service_role')))
    )`;
}
// The full logical profile exceeds execFileSync's default stdout buffer. Keep
// exactly the same SQL/JSON contents; transport bounded hex chunks so psql's
// trim() cannot discard whitespace at a chunk boundary. No field is omitted.
function stock356BeforeReadRawJson(query:string){
    const chunkCharacters=65536,characters=Number(psql(`SELECT length((${query})::text)`));
    assert.ok(Number.isSafeInteger(characters)&&characters>0&&characters<=20000000,'snapshot must fit explicit complete-content bound; never truncate/skip fields');
    const chunks:Buffer[]=[];
    for(let offset=1;offset<=characters;offset+=chunkCharacters){
        const hex=psql(`SELECT pg_catalog.encode(pg_catalog.convert_to(substr((${query})::text,${offset},${chunkCharacters}),'UTF8'),'hex')`);
        assert.match(hex,/^(?:[0-9a-f]{2})+$/);chunks.push(Buffer.from(hex,'hex'));
    }
    return Buffer.concat(chunks).toString('utf8');
}
function stock356BeforeSnapshot(){return {data:stock356BeforeReadRawJson(stock356BeforeDataSql()),profile:stock356BeforeReadRawJson(stock356BeforeProfileSql())};}
function stock356BeforeDo(body: string) {
    const delimiter='$n9_stock356Before_'+crypto.randomUUID().replaceAll('-','')+'$';
    assert.ok(!body.includes(delimiter));return `DO ${delimiter} BEGIN ${body} END; ${delimiter};`;
}

// N9 proposal-only BEFORE controls. Production356 SQL remains frozen and unmodified.
// A passing witness confirms the original rollback's omission; it is not safe356 proof.
const stock356BeforeAudit: string[]=[];
const stock356BeforeKnownCatalog: unknown[]=[];
after(()=>console.info('OWNED_STOCK356_BEFORE_AUDIT '+JSON.stringify({scope:'original356 rollback BEFORE witnesses and controls; not safe356 proof',completed:stock356BeforeAudit,known_catalog:stock356BeforeKnownCatalog})));
const stock356BeforePinnedSources={
    forward346:{path:'migrations/346_product_atomic_edits.sql',sha:'55bdd8c65d793afed96eec42720e08073ebe7d10402c0b365abeb2ccb481c7c5'},
    rollback346:{path:'rollback/346_product_atomic_edits.rollback.sql',sha:'9a3018c3d83d992a08504178bd342aadab49faf262ca98d4b231985db0d2695c'},
    forward356:{path:'migrations/356_inventory_adjustment_receipts.sql',sha:'93963990d0aa88851fa71851c6cf02ee598be467896ee20b2d3101bf036409d7'},
    rollback356:{path:'rollback/356_inventory_adjustment_receipts.rollback.sql',sha:'ea3611b65a5683c1fcbf4a0291a72718c2b77b314e690e1c7cf2d9bdae4939fd'},
} as const;
function stock356BeforeBody(kind:keyof typeof stock356BeforePinnedSources){
    const pin=stock356BeforePinnedSources[kind],text=readFileSync(new URL('../../../../../database/supabase/'+pin.path,import.meta.url),'utf8');
    assert.equal(stock356BeforeHash(text),pin.sha,'exact root-reviewed SQL pair required for BEFORE');
    const begin=text.match(/^BEGIN;\s*$/m),commit=text.lastIndexOf('COMMIT;');assert.ok(begin&&begin.index!==undefined&&commit>begin.index);assert.match(text.slice(commit),/^COMMIT;\s*$/);
    return text.slice(begin.index+begin[0].length,commit);
}
function stock356BeforeHash(value:string){return createHash('sha256').update(value).digest('hex');}
function stock356BeforeSame(before:ReturnType<typeof stock356BeforeSnapshot>,message:string){
    const after=stock356BeforeSnapshot();
    assert.equal(stock356BeforeHash(after.data),stock356BeforeHash(before.data),message+' (complete raw data JSON)');
    assert.equal(stock356BeforeHash(after.profile),stock356BeforeHash(before.profile),message+' (complete raw catalog JSON)');
}
function stock356BeforeAssert(expression:string,message:string){return `IF (${expression}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION ${stockQuote(message)}; END IF;`;}
const stock356BeforeStableTables=stock356BeforeTables.filter(name=>!['product_edit_receipts','inventory_adjustment_receipts','migration_privilege_journal'].includes(name));
const stock356BeforeStableDataSql=`SELECT jsonb_build_object(${stock356BeforeStableTables.flatMap(name=>[stockQuote(name),`(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.${name} t)`]).join(',')})`;
const stock356BeforeDefinitionsSql=`SELECT coalesce(jsonb_object_agg(n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')',(to_jsonb(p)-'oid')||jsonb_build_object('definition',pg_catalog.pg_get_functiondef(p.oid))),'{}'::jsonb) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.oid IN(${stock356BeforeProcedures})`;

test('BEFORE control: real356 dependency refuses346, then genuine empty356 to346 retirement and346 to356 reapply restore complete outside state',()=>{
    assert.equal(psql('SELECT count(*) FROM public.inventory_adjustment_receipts;'),'0','fresh receipt family required, never delete/truncate evidence');
    assert.equal(psql('SELECT count(*) FROM public.product_edit_receipts;'),'0','distinct fresh empty346 control required');
    const profile=JSON.parse(psql("SELECT jsonb_build_object('role',current_user,'super',rolsuper,'bypass_rls',rolbypassrls,'row_security',current_setting('row_security')) FROM pg_catalog.pg_roles WHERE rolname=current_user"));
    stock356BeforeAudit.push('maintenance-profile:'+JSON.stringify(profile));
    const before=stock356BeforeSnapshot();
    for(const kind of ['forward346','rollback346','forward356','rollback356'] as const)stock356BeforeBody(kind);
    const receiptClasses=stock356BeforeReadRawJson(`SELECT jsonb_build_object('server_version_num',current_setting('server_version_num'),'classes',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.oid),'[]') FROM pg_catalog.pg_class r WHERE r.oid='public.inventory_adjustment_receipts'::regclass OR r.oid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid='public.inventory_adjustment_receipts'::regclass) OR r.oid=(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass) OR r.oid IN(SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid=(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass))),'languages',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.oid),'[]') FROM pg_catalog.pg_language l WHERE l.oid IN(SELECT prolang FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('apply_inventory_adjustment_v1','guard_inventory_adjustment_receipt_v1'))))`);
    stock356BeforeKnownCatalog.push({scope:'fresh known installation metadata only, before any synthetic drift; no business rows or expected-state promotion',run_id:owned.runId,database:owned.database,catalog_raw:before.profile,receipt_classes_raw:receiptClasses,journal356_raw:stock356BeforeReadRawJson("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.migration_privilege_journal t WHERE t.migration='356'")});
    const dependencyError=owned.psqlScriptExpectError('BEGIN;'+stock356BeforeBody('rollback346'));
    assert.match(dependencyError,/rollback346 refuses unknown function\/receipt\/trigger\/role\/profile or dependency state/,'installed real356 default edge must reach the intended346 profile refusal');
    stock356BeforeSame(before,'real356-to346 refusal preserves every captured row/profile');
    const temp='n9_stock356_before_'+crypto.randomUUID().replaceAll('-','');
    const sentinel='N9_356_BEFORE_EMPTY_REVERSE_REAPPLY_ABORT';
    const journalOthers=`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.migration_privilege_journal t WHERE t.migration NOT IN('346','356')`;
    const expectedJournal=`SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb) FROM pg_temp.${temp},jsonb_array_elements(data->'migration_privilege_journal') value WHERE value->>'migration' NOT IN('346','356')`;
    const stableExpected=`(SELECT data-ARRAY['product_edit_receipts','inventory_adjustment_receipts','migration_privilege_journal']::text[] FROM pg_temp.${temp})`;
    // Only inside successful retire/recreate may fresh journal OIDs/timestamps differ.
    // Every other own-profile field, and every foreign journal row, stays exact.
    const ownJournal=`SELECT coalesce(jsonb_agg(to_jsonb(t)-ARRAY['object_oid','recorded_at']::text[] ORDER BY (to_jsonb(t)-ARRAY['object_oid','recorded_at']::text[])::text),'[]'::jsonb) FROM public.migration_privilege_journal t WHERE t.migration IN('346','356')`;
    const expectedOwnJournal=`SELECT coalesce(jsonb_agg(value-ARRAY['object_oid','recorded_at']::text[] ORDER BY (value-ARRAY['object_oid','recorded_at']::text[])::text),'[]'::jsonb) FROM pg_temp.${temp},jsonb_array_elements(data->'migration_privilege_journal') value WHERE value->>'migration' IN('346','356')`;
    const error=owned.psqlScriptExpectError(`BEGIN;
        CREATE TEMP TABLE ${temp} ON COMMIT DROP AS SELECT (${stock356BeforeDataSql()}) AS data,(${stock356BeforeDefinitionsSql}) AS definitions;
        ${stock356BeforeBody('rollback356')}
        ${stock356BeforeDo(stock356BeforeAssert("to_regclass('public.inventory_adjustment_receipts') IS NULL AND to_regprocedure('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)') IS NULL",'N9_356_EMPTY_NOT_RETIRED'))}
        ${stock356BeforeBody('rollback346')}
        ${stock356BeforeDo(stock356BeforeAssert("to_regclass('public.product_edit_receipts') IS NULL AND to_regprocedure('public.assert_product_edit_actor_v1(uuid,uuid,text)') IS NULL",'N9_346_EMPTY_NOT_RETIRED')+
            stock356BeforeAssert(`(${stock356BeforeStableDataSql}) IS NOT DISTINCT FROM ${stableExpected}`,'N9_EMPTY_REVERSE_DATA_CHANGED')+
            stock356BeforeAssert(`(${journalOthers}) IS NOT DISTINCT FROM (${expectedJournal})`,'N9_EMPTY_REVERSE_OTHER_JOURNAL_CHANGED'))}
        ${stock356BeforeBody('forward346')}
        ${stock356BeforeBody('forward356')}
        ${stock356BeforeDo(stock356BeforeAssert(`(${stock356BeforeStableDataSql}) IS NOT DISTINCT FROM ${stableExpected}`,'N9_REAPPLY_BUSINESS_DATA_CHANGED')+
            stock356BeforeAssert(`(${stock356BeforeDefinitionsSql}) IS NOT DISTINCT FROM (SELECT definitions FROM pg_temp.${temp})`,'N9_REAPPLY_CANONICAL_FUNCTION_PROFILE_CHANGED')+
            stock356BeforeAssert(`(${journalOthers}) IS NOT DISTINCT FROM (${expectedJournal})`,'N9_REAPPLY_FOREIGN_JOURNAL_CHANGED')+
            stock356BeforeAssert(`(${ownJournal}) IS NOT DISTINCT FROM (${expectedOwnJournal})`,'N9_REAPPLY_OWN_JOURNAL_PROFILE_CHANGED')+
            stock356BeforeAssert(`(SELECT count(*) FROM public.migration_privilege_journal WHERE migration='346')=(SELECT count(*) FROM pg_temp.${temp},jsonb_array_elements(data->'migration_privilege_journal') value WHERE value->>'migration'='346')`,'N9_REAPPLY_346_JOURNAL_COUNT_CHANGED')+
            stock356BeforeAssert("(SELECT count(*) FROM public.product_edit_receipts)=0 AND (SELECT count(*) FROM public.inventory_adjustment_receipts)=0 AND (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='356')=3",'N9_REAPPLY_RECEIPTS_OR_JOURNAL_PROFILE_CHANGED')+
            stock356BeforeAssert("EXISTS(SELECT 1 FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_attrdef a ON d.classid='pg_catalog.pg_attrdef'::regclass AND d.objid=a.oid WHERE a.adrelid='public.inventory_adjustment_receipts'::regclass AND d.refclassid='pg_catalog.pg_proc'::regclass AND d.refobjid='public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure)",'N9_REAPPLY_REAL356_DEPENDENCY_MISSING')+
            `RAISE EXCEPTION ${stockQuote(sentinel)};`)}
    `);
    assert.match(error,new RegExp('^ERROR: *'+sentinel+'$','m'),'only exact terminal sentinel proves all reverse/reapply checks executed');
    stock356BeforeSame(before,'all28 full-row tables including complete journal and full logical profiles restored outside aborted reverse/reapply');
    assert.equal(psql(`SELECT to_regclass('pg_temp.${temp}') IS NULL`),'t');
    stock356BeforeAudit.push('real356-default-dependency/refusal/fulloutside');
    stock356BeforeAudit.push('genuine-empty356-346/reapply346-356/terminal-abort/fulloutside');
});

test('BEFORE defect witness: original356 retires unreviewed provenance and column storage inside aborted transactions',()=>{
    assert.equal(psql('SELECT count(*) FROM public.inventory_adjustment_receipts;'),'0','no evidence clearing to make a witness pass');
    assert.equal(psql("SELECT attstorage FROM pg_catalog.pg_attribute WHERE attrelid='public.inventory_adjustment_receipts'::regclass AND attname='command'"),'x','fresh jsonb storage must be known before changing it');
    for(const kind of ['table-comment','function-comment','column-storage'] as const){
        const before=stock356BeforeSnapshot(),marker='Synthetic unknown356 metadata '+crypto.randomUUID();
        const ddl=kind==='table-comment'?`COMMENT ON TABLE public.inventory_adjustment_receipts IS ${stockQuote(marker)};`:
            kind==='function-comment'?`COMMENT ON FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) IS ${stockQuote(marker)};`:
                'ALTER TABLE public.inventory_adjustment_receipts ALTER COLUMN command SET STORAGE EXTERNAL;';
        const setup=kind==='table-comment'?`pg_catalog.obj_description('public.inventory_adjustment_receipts'::regclass::oid,'pg_class')=${stockQuote(marker)}`:
            kind==='function-comment'?`pg_catalog.obj_description('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)'::regprocedure::oid,'pg_proc')=${stockQuote(marker)}`:
                "(SELECT attstorage='e' FROM pg_catalog.pg_attribute WHERE attrelid='public.inventory_adjustment_receipts'::regclass AND attname='command')";
        const sentinel='N9_356_BEFORE_UNKNOWN_'+kind.replaceAll('-','_').toUpperCase()+'_RETIRED_ABORT';
        const error=owned.psqlScriptExpectError(`BEGIN; ${ddl}
            ${stock356BeforeDo(stock356BeforeAssert(setup,'N9_UNKNOWN_METADATA_SETUP_NOT_VISIBLE'))}
            ${stock356BeforeBody('rollback356')}
            ${stock356BeforeDo(stock356BeforeAssert("to_regclass('public.inventory_adjustment_receipts') IS NULL AND to_regprocedure('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)') IS NULL",'N9_BEFORE_UNKNOWN_METADATA_NOT_RETIRED')+`RAISE EXCEPTION ${stockQuote(sentinel)};`)}
        `);
        assert.match(error,new RegExp('^ERROR: *'+sentinel+'$','m'),'setup errors and guard refusal do not prove this BEFORE witness');
        stock356BeforeSame(before,'unknown metadata witness must conserve every outside row/profile after forced abort');
        stock356BeforeAudit.push('BEFORE-defect:unreviewed-'+kind+'-retired/aborted/fulloutside');
    }
});

test('empty356 rollback verifies family/body/owner/ACL/provenance/shape and refuses concurrent writers before a clean reapply and command race',async()=>{
    const original=stockOwnerDefinitions();assert.equal(psql('SELECT count(*) FROM inventory_adjustment_receipts;'),'0');
    assert.equal(psql(`SELECT EXISTS(SELECT 1 FROM pg_depend d JOIN pg_attrdef a ON d.classid='pg_attrdef'::regclass AND d.objid=a.oid WHERE a.adrelid='public.inventory_adjustment_receipts'::regclass AND d.refclassid='pg_proc'::regclass AND d.refobjid='public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure);`),'t');
    assert.match(owned.psqlExpectError('BEGIN;DROP FUNCTION public.assert_product_edit_actor_v1(uuid,uuid,text) RESTRICT;ROLLBACK;'),/depend|cannot drop/);
    for(const tamper of [
        `CREATE FUNCTION public.apply_inventory_adjustment_v1(integer) RETURNS integer LANGUAGE sql AS 'SELECT $1';`,
        `ALTER FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) RENAME TO synthetic_renamed_stock;`,
        `CREATE OR REPLACE FUNCTION public.guard_inventory_adjustment_receipt_v1() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $body$ BEGIN RETURN NEW; END $body$;`,
        `ALTER FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) OWNER TO service_role;`,
        `GRANT EXECUTE ON FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) TO anon;`,
        `UPDATE migration_privilege_journal SET object_definition_hash='tampered' WHERE migration='356' AND object_signature='public.inventory_adjustment_receipts';`,
        `ALTER TABLE inventory_adjustment_receipts ADD COLUMN synthetic_extra text;`,
        `ALTER TABLE inventory_adjustment_receipts DISABLE TRIGGER inventory_adjustment_receipts_immutable;`,
        `GRANT SELECT ON inventory_adjustment_receipts TO authenticated;`,
    ]){
        const error=owned.psqlExpectError('BEGIN;'+tamper+stockRollback);assert.match(error,/rollback356 refuses/);assert.equal(stockOwnerDefinitions(),original);assert.equal(psql('SELECT count(*) FROM inventory_adjustment_receipts;'),'0');
    }
    const foreign=owned.psqlAsync(`BEGIN;UPDATE products SET stock=stock WHERE id='${productId}';SELECT pg_sleep(2) /* syn-stock-uncommitted */;ROLLBACK;`);
    await eventually(()=>Number(psql(`SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state='active' AND query LIKE '%syn-stock-uncommitted%';`))>0);
    try{assert.match(owned.psqlExpectError(stockRollback),/rollback356 refuses concurrent/);}finally{await foreign;}
    owned.script(stockRollback);assert.equal(psql(`SELECT to_regclass('public.inventory_adjustment_receipts') IS NULL AND to_regprocedure('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)') IS NULL;`),'t');assert.equal(stockOwnerDefinitions(),original);
    owned.script(stockMigration);assert.equal(stockOwnerDefinitions(),original);
    const p=recoveryProduct(),before=recoverySnapshot(p),key='syn-stock-rollback-race-'+crypto.randomUUID();
    const paused=stockRollback.replace('LOCK TABLE public.inventory_adjustment_receipts IN ACCESS EXCLUSIVE MODE;','SELECT pg_sleep(0.5) /* syn-stock-rollback-race */;LOCK TABLE public.inventory_adjustment_receipts IN ACCESS EXCLUSIVE MODE;');
    const rollback=owned.psqlAsync(paused).then(()=>({ok:true}),()=>({ok:false}));
    await eventually(()=>Number(psql(`SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state='active' AND query LIKE '%syn-stock-rollback-race%';`))>0);
    const [rolled,write]=await Promise.all([rollback,recoveryAdjust(p,key)]);
    if(rolled.ok){assert.notEqual(write.status,200);assert.deepEqual(recoverySnapshot(p),before);owned.script(stockMigration);}
    else{assert.equal(psql(`SELECT to_regclass('public.inventory_adjustment_receipts') IS NOT NULL;`),'t');if(write.status===200){assert.equal(Number(psql(`SELECT count(*) FROM inventory_adjustment_receipts WHERE idempotency_key='${key}';`)),1);}else assert.deepEqual(recoverySnapshot(p),before);}
    assert.equal(stockOwnerDefinitions(),original);
});

test('concurrent merchant variant adjustments remain additive, auditable, visible in history, and tenant-scoped', async () => {
    const barrier = newBarrier(2);
    const tap = observeAdjustmentQueries(() => barrier.arrive());
    let outcomes;
    const keyA = `syn-inv-a-${crypto.randomUUID()}`;
    const keyB = `syn-inv-b-${crypto.randomUUID()}`;
    try {
        outcomes = await Promise.all([
            adjust(ownerId, ownerEmail, 2, keyA, `syn-inv-req-a-${crypto.randomUUID()}`),
            adjust(ownerId, ownerEmail, 3, keyB, `syn-inv-req-b-${crypto.randomUUID()}`),
        ]);
    } finally {
        tap.restore();
    }

    assert.deepEqual(outcomes.map((result) => result.status), [200, 200], outcomes.map((result) => result.text).join('\n'));
    assert.equal(barrier.arrived, 2, 'both merchant writes must reach the canonical adjustment RPC before either proceeds');
    assert.equal(psql(`SELECT available||'|'||reserved||'|'||committed_quantity FROM inventory_levels WHERE product_id='${productId}' AND variant_id='${variantId}';`), '9|0|0');
    assert.equal(psql(`SELECT inventory_qty FROM product_variants WHERE id='${variantId}';`), '9');
    assert.equal(psql(`SELECT count(*)||'|'||sum(quantity_change)||'|'||min(reason)||'|'||count(DISTINCT created_by) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}';`), `2|5|adjustment|1`);
    assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}' AND created_by='${ownerId}' AND note LIKE 'Synthetic inventory count syn-inv-%';`), '2');
    assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}' AND aggregate_id='${productId}' AND event_type='inventory.level.adjusted';`), '2');

    const replay = await adjust(ownerId, ownerEmail, 2, keyA, `syn-inv-replay-${crypto.randomUUID()}`);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.headers.get('X-Idempotent-Replay'), 'true');
    assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${productId}' AND variant_id='${variantId}';`), '9');
    assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}';`), '2');
    assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}' AND aggregate_id='${productId}' AND event_type='inventory.level.adjusted';`), '2');

    const belowZero = await adjust(ownerId, ownerEmail, -10, `syn-inv-underflow-${crypto.randomUUID()}`, `syn-inv-underflow-req-${crypto.randomUUID()}`);
    assert.equal(belowZero.status, 400, belowZero.text);
    assert.equal(belowZero.json?.error?.code, 'INVENTORY_ADJUSTMENT_FAILED');
    assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${productId}' AND variant_id='${variantId}';`), '9');
    assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}';`), '2', 'a rejected below-zero change must not append a misleading audit row');
    assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}' AND aggregate_id='${productId}' AND event_type='inventory.level.adjusted';`), '2');

    const history = await gateway.request(`/v1/inventory/history?product_id=${productId}&page=1&limit=20`, {
        headers: await signedIdentityHeaders(ownerId, ownerEmail),
    });
    assert.equal(history.status, 200, history.text);
    assert.equal(history.json?.success, true);
    assert.equal(history.json?.meta?.total, 2);
    assert.equal(history.json?.data?.length, 2);
    assert.ok(history.json?.data?.every((row: Record<string, unknown>) => row.product_id === productId && row.variant_id === variantId && row.created_by === ownerId && row.reason === 'adjustment'));

    const denied = await adjust(outsiderId, outsiderEmail, 1, `syn-inv-outsider-${crypto.randomUUID()}`, `syn-inv-outsider-req-${crypto.randomUUID()}`);
    assert.equal(denied.status, 404, denied.text);
    assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${productId}' AND variant_id='${variantId}';`), '9');
    assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}';`), '2');
    const outsiderHistory = await gateway.request(`/v1/inventory/history?product_id=${productId}&page=1&limit=20`, {
        headers: await signedIdentityHeaders(outsiderId, outsiderEmail),
    });
    assert.equal(outsiderHistory.status, 200, outsiderHistory.text);
    assert.deepEqual(outsiderHistory.json?.data, [], 'an unrelated merchant cannot read another tenant\'s inventory audit');
});

// N3.3 bounded staff adjustment recovery controls. Existing owner/concurrency/
// ledger/history test above remains byte-identical. No mocked positive authority.
function recoveryProduct() {
    const id=crypto.randomUUID(),v=crypto.randomUUID();
    psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) VALUES('${id}','${tenant.siteId}','${tenant.siteId}','Synthetic recovery stock','syn-stock-${id}',100,4,true,'active');
        INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty) VALUES('${v}','${id}','M','SYN-${v}',100,0);
        SELECT set_inventory_level_available('${id}','${v}','${tenant.locationId}',4,'${ownerId}');`);
    return {id,variantId:v};
}
function recoveryStaff(){const id=crypto.randomUUID(),email=`syn-stock-staff-${id}@example.invalid`;psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${id}','${email}',true);INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES('${id}','${email}','${tenant.siteId}','editor','active',true,'{"granted":["products:read","products:write"]}');`);return{id,email};}
const recoveryBody=(p:ReturnType<typeof recoveryProduct>)=>({product_id:p.id,variant_id:p.variantId,location_id:tenant.locationId,adjustment:2,reason:'correction',notes:'Synthetic immutable recovery command'});
async function recoveryAdjust(p:ReturnType<typeof recoveryProduct>,key:string,actorId=ownerId,email=ownerEmail){return gateway.request('/v1/inventory/adjust',{method:'POST',headers:{...await signedIdentityHeaders(actorId,email,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':key},body:JSON.stringify(recoveryBody(p))});}
function recoverySnapshot(p:ReturnType<typeof recoveryProduct>){return JSON.parse(psql(`SELECT jsonb_build_object('levels',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM inventory_levels t WHERE product_id='${p.id}'),'variant',(SELECT to_jsonb(t) FROM product_variants t WHERE id='${p.variantId}'),'product',(SELECT to_jsonb(t) FROM products t WHERE id='${p.id}'),'adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM inventory_adjustments t WHERE product_id='${p.id}'),'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM outbox_events t WHERE aggregate_id='${p.id}'))::text;`));}

test('a current products-write staff member can read the selected stock level and adjust it once',async()=>{
    const p=recoveryProduct(),staff=recoveryStaff();
    const levels=await gateway.request(`/v1/inventory/levels?store_id=${tenant.siteId}&product_id=${p.id}`,{headers:{...await signedIdentityHeaders(staff.id,staff.email,tenant.siteId),'X-Store-ID':tenant.siteId}});
    assert.equal(levels.status,200,levels.text);assert.equal(levels.json?.data?.length,1);assert.equal(levels.json?.data?.[0].available,4);
    const key=`syn-stock-staff-${crypto.randomUUID()}`,first=await recoveryAdjust(p,key,staff.id,staff.email);assert.equal(first.status,200,first.text);
    const committed=recoverySnapshot(p);assert.equal(committed.levels[0].available,6);assert.equal(committed.adjustments.filter((row:any)=>row.created_by===staff.id).length,1);
    const retry=await recoveryAdjust(p,key,staff.id,staff.email);assert.equal(retry.status,200,retry.text);assert.deepEqual(recoverySnapshot(p),committed);
});

test('a completed stock command cannot replay its receipt under another normally authorized staff actor',async()=>{
    const p=recoveryProduct(),staff=recoveryStaff(),key=`syn-stock-actor-${crypto.randomUUID()}`;
    const first=await recoveryAdjust(p,key);assert.equal(first.status,200,first.text);const committed=recoverySnapshot(p);
    const denied=await recoveryAdjust(p,key,staff.id,staff.email);assert.ok([403,404,409].includes(denied.status),`Actor-bound command must refuse; actual ${denied.status}: ${denied.text}`);
    assert.deepEqual(recoverySnapshot(p),committed);
});

test('a completed stock command rechecks current owner authority before replaying a receipt',async()=>{
    const p=recoveryProduct(),key=`syn-stock-revoked-${crypto.randomUUID()}`;assert.equal((await recoveryAdjust(p,key)).status,200);const committed=recoverySnapshot(p);
    psql(`UPDATE sites SET custom_user_id='${outsiderId}' WHERE id='${tenant.siteId}';`);
    try{const denied=await recoveryAdjust(p,key);assert.ok([403,404].includes(denied.status),`Revoked owner must be refused before receipt replay; actual ${denied.status}: ${denied.text}`);assert.deepEqual(recoverySnapshot(p),committed);}
    finally{psql(`UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${tenant.siteId}';`);}
});

test('the guarded tenant SQL entry rejects wrong roles/GUCs and malformed commands without stock or receipt effects',()=>{
 const p=recoveryProduct(),before=stockWorld(p),command=stockCommand(p);
 for(const role of ['anon','authenticated','service_role']){assert.match(owned.psqlExpectError(stockRoleCall(p,'syn-stock-role-'+crypto.randomUUID(),command,role)),/permission denied|INVENTORY_ADJUST_FORBIDDEN/);assert.deepEqual(stockWorld(p),before);}
 for(const [actor,store]of [[outsiderId,tenant.siteId],[ownerId,crypto.randomUUID()]]){assert.match(owned.psqlExpectError(stockRoleCall(p,'syn-stock-guc-'+crypto.randomUUID(),command,'app_tenant',ownerId,tenant.siteId,actor,store)),/FORBIDDEN/);assert.deepEqual(stockWorld(p),before);}
 for(const body of [{...command,adjustment:'2'},{...command,adjustment:1.5},{...command,adjustment:100000},{...command,reason:'unknown'},{...command,notes:7},{...command,actor_id:outsiderId},{...command,product_id:'not-uuid'}]){
  assert.ok(owned.psqlExpectError(stockRoleCall(p,'syn-stock-invalid-'+crypto.randomUUID(),body)));assert.deepEqual(stockWorld(p),before);
 }
 const key='syn-stock-positive-'+crypto.randomUUID();psql(stockRoleCall(p,key));const committed=stockWorld(p);assert.equal(committed.levels[0].available,6);assert.equal(committed.receipts.length,1);psql(stockRoleCall(p,key));assert.deepEqual(stockWorld(p),committed);
 for(const role of ['anon','authenticated','service_role','app_tenant'])for(const op of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(psql(`SELECT has_table_privilege('${role}','public.inventory_adjustment_receipts','${op}');`),'f');
 assert.match(owned.psqlExpectError('UPDATE inventory_adjustment_receipts SET operation=operation;'),/immutable/);assert.match(owned.psqlExpectError('DELETE FROM inventory_adjustment_receipts;'),/immutable/);
});

test('a logical stock key binds its entire command while old actor-unbound HTTP keys fail closed and keep their evidence',async()=>{
 const p=recoveryProduct(),key='syn-stock-bound-'+crypto.randomUUID();assert.equal((await recoveryAdjust(p,key)).status,200);const committed=stockWorld(p);
 for(const change of [{adjustment:3},{reason:'damaged'},{notes:'Different intent'},{variant_id:null},{location_id:crypto.randomUUID()},{product_id:crypto.randomUUID()}]){
  const denied=await gateway.request('/v1/inventory/adjust',{method:'POST',headers:{...await signedIdentityHeaders(ownerId,ownerEmail,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':key},body:JSON.stringify({...recoveryBody(p),...change})});assert.equal(denied.status,409,denied.text);assert.equal(denied.json?.error?.code,'INVENTORY_ADJUST_KEY_CONFLICT');assert.deepEqual(stockWorld(p),committed);
 }
 for(const status of ['completed','processing','failed']){
  const legacy='syn-stock-legacy-'+crypto.randomUUID();psql(`INSERT INTO idempotency_keys(site_id,key,scope,request_hash,status,status_code,response_body,locked_until,expires_at,deleted_at) VALUES('${tenant.siteId}','${legacy}','http:POST:/inventory/adjust','unbound-before356','${status}',200,'{"unbound":"synthetic old receipt"}',now()-interval '1day',now()-interval '1day',now());`);
  const old=psql(`SELECT to_jsonb(k)::text FROM idempotency_keys k WHERE key='${legacy}';`);const denied=await recoveryAdjust(p,legacy);assert.equal(denied.status,409,denied.text);assert.equal(denied.json?.error?.code,'INVENTORY_ADJUST_LEGACY_KEY');assert.deepEqual(stockWorld(p),committed);assert.equal(psql(`SELECT to_jsonb(k)::text FROM idempotency_keys k WHERE key='${legacy}';`),old);
 }
 const other=await gateway.request('/v1/inventory/bulk-adjust',{method:'POST',headers:{...await signedIdentityHeaders(ownerId,ownerEmail,tenant.siteId),'X-Store-ID':tenant.siteId},body:'{}'});assert.equal(other.status,400);assert.equal(other.json?.error?.code,'IDEMPOTENCY_KEY_REQUIRED');
});

test('staff write revocation denies fresh effects and exact receipt replay while its separate read grant still works',async()=>{
 const p=recoveryProduct(),staff=recoveryStaff(),key='syn-stock-staff-revoke-'+crypto.randomUUID();assert.equal((await recoveryAdjust(p,key,staff.id,staff.email)).status,200);const committed=stockWorld(p);
 psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE user_id='${staff.id}' AND store_id='${tenant.siteId}';`);
 for(const attempt of [key,'syn-stock-denied-'+crypto.randomUUID()]){const denied=await recoveryAdjust(p,attempt,staff.id,staff.email);assert.equal(denied.status,403,denied.text);assert.deepEqual(stockWorld(p),committed);}
 const read=await gateway.request(`/v1/inventory/levels?store_id=${tenant.siteId}&product_id=${p.id}`,{headers:{...await signedIdentityHeaders(staff.id,staff.email,tenant.siteId),'X-Store-ID':tenant.siteId}});assert.equal(read.status,200,read.text);assert.equal(read.json?.data?.[0].available,6);
});

test('foreign product, variant, location and selected-store bindings never enter the existing stock writer',async()=>{
 const p=recoveryProduct(),other=newSyntheticTenant('stock-other');seedSyntheticTenant(psql,other);const foreignProduct=crypto.randomUUID(),foreignVariant=crypto.randomUUID();
 psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) VALUES('${foreignProduct}','${other.siteId}','${other.siteId}','Synthetic foreign stock','syn-${foreignProduct}',100,8,true,'active');INSERT INTO product_variants(id,product_id,title,price,inventory_qty) VALUES('${foreignVariant}','${foreignProduct}','M',100,8);`);
 const before=stockWorld(p),foreign=psql(`SELECT to_jsonb(v)::text FROM product_variants v WHERE id='${foreignVariant}';`);
 for(const changes of [{product_id:foreignProduct},{variant_id:foreignVariant},{location_id:other.locationId}]){
  const denied=await gateway.request('/v1/inventory/adjust',{method:'POST',headers:{...await signedIdentityHeaders(ownerId,ownerEmail,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':'syn-stock-foreign-'+crypto.randomUUID()},body:JSON.stringify({...recoveryBody(p),...changes})});assert.equal(denied.status,404,denied.text);assert.deepEqual(stockWorld(p),before);assert.equal(psql(`SELECT to_jsonb(v)::text FROM product_variants v WHERE id='${foreignVariant}';`),foreign);
 }
 const mismatch=await gateway.request('/v1/inventory/adjust',{method:'POST',headers:{...await signedIdentityHeaders(ownerId,ownerEmail,tenant.siteId),'X-Store-ID':other.siteId,'X-Idempotency-Key':'syn-stock-context-'+crypto.randomUUID()},body:JSON.stringify(recoveryBody(p))});assert.ok([403,404].includes(mismatch.status));assert.deepEqual(stockWorld(p),before);
});

test('mandatory adjustment audit, outbox or receipt failure rolls back stock and the same command can retry exactly once',async()=>{
 for(const failure of ['audit','outbox','receipt']){
  const p=recoveryProduct(),key='syn-stock-fault-'+crypto.randomUUID(),before=stockWorld(p),table=failure==='audit'?'inventory_adjustments':failure==='outbox'?'outbox_events':'inventory_adjustment_receipts';
  const condition=failure==='outbox'?`NEW.aggregate_id='${p.id}' AND NEW.event_type='inventory.level.adjusted'`:`NEW.product_id='${p.id}'::uuid`;
  psql(`CREATE FUNCTION public.synthetic_stock_failure() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Synthetic mandatory stock ${failure} failure';END IF;RETURN NEW;END $fault$;CREATE TRIGGER synthetic_stock_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION public.synthetic_stock_failure();`);
  try{const failed=await recoveryAdjust(p,key);assert.equal(failed.status,500,failed.text);}finally{psql(`DROP TRIGGER synthetic_stock_failure ON ${table};DROP FUNCTION public.synthetic_stock_failure();`);}
  assert.deepEqual(stockWorld(p),before,`${failure} failure leaves no stock/cache/audit/outbox/receipt effect`);assert.equal((await recoveryAdjust(p,key)).status,200);const committed=stockWorld(p);assert.equal(committed.levels[0].available,6);assert.equal(committed.receipts.length,1);assert.equal((await recoveryAdjust(p,key)).status,200);assert.deepEqual(stockWorld(p),committed);
 }
});

test('simultaneous identical commands use one receipt and one additive stock/audit/outbox effect',async()=>{
 const p=recoveryProduct(),key='syn-stock-race-'+crypto.randomUUID(),barrier=newBarrier(2),tap=observeAdjustmentQueries(()=>barrier.arrive());let replies;
 try{replies=await Promise.all([recoveryAdjust(p,key),recoveryAdjust(p,key)]);}finally{tap.restore();}
 assert.equal(barrier.arrived,2);assert.deepEqual(replies.map(r=>r.status),[200,200],replies.map(r=>r.text).join('\n'));assert.deepEqual(replies[0].json,replies[1].json);
 assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${p.id}' AND variant_id='${p.variantId}';`),'6');assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${p.id}' AND quantity_change=2;`),'1');assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${p.id}' AND event_type='inventory.level.adjusted';`),'1');assert.equal(psql(`SELECT count(*) FROM inventory_adjustment_receipts WHERE product_id='${p.id}';`),'1');
});

test('an unavailable tenant SQL connection never falls back to a non-atomic admin REST mutation',async()=>{
 const p=recoveryProduct(),before=stockWorld(p),unavailable=new Gateway(gatewayEnv(owned,keys));
 try{const denied=await unavailable.request('/v1/inventory/adjust',{method:'POST',headers:{...await signedIdentityHeaders(ownerId,ownerEmail,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':'syn-stock-no-pool-'+crypto.randomUUID()},body:JSON.stringify(recoveryBody(p))});assert.equal(denied.status,503,denied.text);assert.deepEqual(stockWorld(p),before);}finally{await unavailable.settle();}
});

test('nonempty356 rollback refuses without erasing a stock command or changing the canonical writer family',()=>{
 const before=psql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY idempotency_key)::text FROM inventory_adjustment_receipts r;`),definitions=stockOwnerDefinitions();assert.notEqual(before,'');
 assert.match(owned.psqlExpectError(stockRollback),/rollback356 refuses retained inventory adjustment receipts/);assert.equal(psql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY idempotency_key)::text FROM inventory_adjustment_receipts r;`),before);assert.equal(stockOwnerDefinitions(),definitions);
});

test('BEFORE retention control: original356 refuses a real retained command with full outside conservation and exact replay',async()=>{
    const p=recoveryProduct(),key='syn-n9-stock356-retention-'+crypto.randomUUID();
    const first=await recoveryAdjust(p,key);assert.equal(first.status,200);
    const before=stock356BeforeSnapshot();
    const error=owned.psqlScriptExpectError(stockRollback);
    assert.match(error,/rollback356 refuses retained inventory adjustment receipts/,'only actual retained-row refusal establishes this positive control');
    stock356BeforeSame(before,'retained refusal must preserve all captured rows/full journal/schema/function/ACL/dependencies');
    const replay=await recoveryAdjust(p,key);assert.equal(replay.status,200);assert.equal(replay.headers.get('X-Idempotent-Replay'),'true');assert.deepEqual(replay.json?.data,first.json?.data);
    stock356BeforeSame(before,'exact Gateway retry after refusal has no new stock/history/audit/outbox/receipt/profile effect');
    stock356BeforeAudit.push('retained-command/refusal/fulloutside/exact-replay');
});
