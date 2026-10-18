// Real production worker/middleware and owned PostgREST/PG. Signed internal
// identity is an API control, not normal browser login or a blanket RLS claim.
// The actual first failure is logged; later assertions are never inferred reached.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test, {after, afterEach, before} from 'node:test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, restJson, type RestTap} from './gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant} from './synthetic-tenant';
const owned = requireOwnedDatabase(), {psql} = owned;
const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const sqlJson = (s: string) => JSON.parse(psql(s));
let gateway: Gateway, proxy: OwnedPooledSqlProxy | undefined, observer: RestTap | undefined;
const restCalls: {method: string; resource: string}[] = [];
before(async () => {
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
    observer = tapRest(owned.restUrl, async (call, forward) => { restCalls.push({method: call.method, resource: call.resource});
        const response=await forward();
        if(!response.ok){const detail=await response.clone().json().catch(()=>({}));console.info('SYNTHETIC_COLLECTION_SQL',JSON.stringify({resource:call.resource,code:(detail as Record<string,unknown>).code,message:(detail as Record<string,unknown>).message}));}
        return response; });
});
afterEach(async () => { await gateway?.settle(); });
after(async () => { await gateway?.settle(); observer?.restore(); await closePooledSqlClients(); await proxy?.stop(); });
function world(tag: string, count = 4) {
    const a = newSyntheticTenant(tag + '-a'), b = newSyntheticTenant(tag + '-b');
    seedSyntheticTenant(psql, a); seedSyntheticTenant(psql, b);
    const owner = crypto.randomUUID(), other = crypto.randomUUID(), staff = crypto.randomUUID();
    const email = (id: string) => 'syn-membership-' + id + '@example.invalid';
    for (const id of [owner, other, staff]) psql('INSERT INTO users_custom(id,email,email_verified) VALUES(' + [q(id), q(email(id)), 'true'].join(',') + ');');
    psql('UPDATE sites SET custom_user_id=' + q(owner) + ' WHERE id=' + q(a.siteId) + ';UPDATE sites SET custom_user_id=' + q(other) + ' WHERE id=' + q(b.siteId) + ';' +
        'INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES(' + [q(staff),q(email(staff)),q(a.siteId),"'editor'","'active'",'true',q(JSON.stringify({granted:['products:read','products:write']}))].join(',') + ');');
    const products = Array.from({length: count}, () => crypto.randomUUID()), foreign = crypto.randomUUID();
    for (const [id, site] of [...products.map(id => [id, a.siteId]), [foreign, b.siteId]]) {
        psql('INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) VALUES(' + [q(id),q(site),q(site),q('Synthetic membership product ' + id),q('syn-cm-' + id),'10','4','true',"'active'"].join(',') + ');');
    }
    const collection = crypto.randomUUID(), foreignCollection = crypto.randomUUID(), deletedCollection = crypto.randomUUID();
    for (const [id, site, deleted] of [[collection,a.siteId,false],[foreignCollection,b.siteId,false],[deletedCollection,a.siteId,true]] as const) {
        psql('INSERT INTO collections(id,store_id,title,is_active,deleted_at) VALUES(' + [q(id),q(site),q('Synthetic manual ' + id),'true',deleted?'now()':'NULL'].join(',') + ');');
    }
    psql('INSERT INTO collection_products(collection_id,product_id,position) VALUES(' + [q(collection),q(products[0]),'0'].join(',') + '),(' + [q(collection),q(products[1]),'1'].join(',') + ');');
    return {a,b,owner,other,staff,email,products,foreign,collection,foreignCollection,deletedCollection};
}
type World = ReturnType<typeof world>;
async function request(w: World, method: 'GET'|'PUT', options: {actor?: string; selectedStore?: string; boundStore?: string; id?: string; body?: unknown} = {}) {
    const actor=options.actor??w.owner, store=options.selectedStore??w.a.siteId, id=options.id??w.collection, start=restCalls.length;
    const body=options.body, headers=await signedIdentityHeaders(actor,w.email(actor),options.boundStore);
    if(body && typeof body==='object' && 'idempotency_key' in body) headers['X-Idempotency-Key']=String((body as {idempotency_key: unknown}).idempotency_key);
    const response=await gateway.request('/v1/products/collections/'+id+'/products?store_id='+store,{method,headers,...(method==='PUT'?{body:JSON.stringify(body)}:{})});
    await gateway.settle();
    console.info('OWNED_COLLECTION_MEMBERSHIP_HOP '+JSON.stringify({method,status:response.status,code:response.json?.error?.code??null,restResources:restCalls.slice(start),scope:'direct signed API control; no middleware bypass; SQL command effects only asserted after reached response'}));
    return response;
}
function readData(response: Awaited<ReturnType<typeof request>>, w: World) {
    assert.equal(response.status,200,response.text);const data=response.json?.data;
    assert.equal(data?.collection_id,w.collection);assert.equal(data?.store_id,w.a.siteId);
    assert.ok(Number.isInteger(data?.membership_version)&&data.membership_version>0,'Current positive membership revision');
    assert.ok(Array.isArray(data.product_ids));assert.ok(Array.isArray(data.unavailable_product_ids));
    const represented=[...data.products.map((row:{id:string})=>row.id),...data.unavailable_product_ids];assert.equal(new Set(represented).size,represented.length);assert.deepEqual([...represented].sort(),[...data.product_ids].sort());return data as {collection_id:string;store_id:string;membership_version:number;product_ids:string[];products:{id:string}[];unavailable_product_ids:string[]};
}
const command=(version:number,ids:string[],key=crypto.randomUUID())=>({expected_version:version,product_ids:ids,idempotency_key:key});
function snapshot(w:World) {
    const sites=[q(w.a.siteId),q(w.b.siteId)].join(','), collections='SELECT id FROM collections WHERE store_id IN('+sites+')';
    const predicates:Record<string,string>={collections:'store_id IN('+sites+')',collection_products:'collection_id IN('+collections+')',products:'store_id IN('+sites+')',
        inventory_levels:'store_id IN('+sites+')',inventory_adjustments:'product_id IN(SELECT id FROM products WHERE store_id IN('+sites+'))',
        outbox_events:'store_id IN('+sites+') OR site_id IN('+sites+')',audit_activity_events:'store_id IN('+sites+')',idempotency_keys:'site_id IN('+sites+')'};
    for(const table of ['collection_membership_receipts','product_edit_receipts','inventory_adjustment_receipts'])if(psql("SELECT to_regclass('public."+table+"')IS NOT NULL;")==='t')predicates[table]='store_id IN('+sites+')';
    return Object.fromEntries(Object.entries(predicates).map(([table,predicate])=>[table,sqlJson("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),'[]'::jsonb)FROM public."+table+' t WHERE '+predicate+';')]));
}
function junction(w:World){return sqlJson('SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY position,product_id),\'[]\'::jsonb)FROM collection_products t WHERE collection_id='+q(w.collection)+';') as {id:string;product_id:string;position:number}[];}
function effects(w:World){return {
    audit:Number(psql("SELECT count(*)FROM audit_activity_events WHERE action='collection.membership.updated'AND resource_id="+q(w.collection)+';')),
    outbox:Number(psql("SELECT count(*)FROM outbox_events WHERE event_type='collection.membership.updated'AND aggregate_id="+q(w.collection)+';')),
    receipts:Number(psql('SELECT count(*)FROM collection_membership_receipts WHERE collection_id='+q(w.collection)+';')),
};}

function outsideState361() {
    // Explicit typed roots, followed only through PG INTERNAL dependencies.
    // The only excluded existing-table attribute is this attempt's recorded
    // own column ordinal; pre-existing dropped slots remain in conservation.
    const names=['guard_collection_membership_receipt_v1','guard_collection_membership_junction_v1','bump_collection_membership_junction_v1','prepare_collection_membership_revision_v1','record_collection_membership_revision_v1','protect_collection_membership_audit_v1','assert_collection_membership_owner_v1','collection_membership_snapshot_v1','apply_collection_membership_v1'];
    const roots="SELECT 'pg_proc'::regclass::oid classid,oid objid,0 objsubid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN("+names.map(q).join(',')+") UNION SELECT 'pg_class'::regclass::oid,'collection_membership_receipts'::regclass::oid,0 UNION SELECT 'pg_class'::regclass::oid,'collections'::regclass::oid,attnum FROM pg_attribute WHERE attrelid='collections'::regclass AND attname='membership_version'AND NOT attisdropped UNION SELECT 'pg_trigger'::regclass::oid,oid,0 FROM pg_trigger WHERE tgname IN('collections_membership_prepare','collections_membership_history','collection_products_membership_guard','collection_products_membership_revision','collection_products_membership_no_truncate','collection_membership_receipts_immutable','collection_membership_receipts_no_truncate','audit_collection_membership_immutable','audit_collection_membership_no_truncate') UNION SELECT 'pg_constraint'::regclass::oid,oid,0 FROM pg_constraint WHERE conrelid='collection_membership_receipts'::regclass OR(conrelid='collections'::regclass AND conname='collections_membership_version_check') UNION SELECT 'pg_class'::regclass::oid,indexrelid,0 FROM pg_index WHERE indrelid='collection_membership_receipts'::regclass OR indrelid=(SELECT reltoastrelid FROM pg_class WHERE oid='collection_membership_receipts'::regclass) UNION SELECT 'pg_attrdef'::regclass::oid,oid,0 FROM pg_attrdef WHERE adrelid='collection_membership_receipts'::regclass OR(adrelid='collections'::regclass AND adnum=(SELECT attnum FROM pg_attribute WHERE attrelid='collections'::regclass AND attname='membership_version'AND NOT attisdropped))";
    const objects=sqlJson('WITH RECURSIVE own AS('+roots+" UNION SELECT d.classid,d.objid,d.objsubid FROM pg_depend d JOIN own o ON d.refclassid=o.classid AND d.refobjid=o.objid AND (o.objsubid=0 OR d.refobjsubid=o.objsubid)WHERE d.deptype='i')SELECT jsonb_agg(jsonb_build_array(classid,objid,objsubid)ORDER BY classid,objid,objsubid)FROM own;") as [number,number,number][];
    const ordinal=Number(psql("SELECT attnum FROM pg_attribute WHERE attrelid='collections'::regclass AND attname='membership_version'AND NOT attisdropped;"));
    const junction=Number(psql("SELECT 'collection_products'::regclass::oid;")),parent=Number(psql("SELECT 'collections'::regclass::oid;"));
    const journalAcl=psql("SELECT coalesce(jsonb_agg(jsonb_build_array(grantee,'postgres',privilege,false)ORDER BY grantee,privilege),'[]'::jsonb)::text FROM migration_privilege_journal WHERE migration='361'AND action='revoked'AND object_signature='public.collection_products';");
    const journalAclRoles=sqlJson("SELECT coalesce(jsonb_agg(DISTINCT r.oid),'[]'::jsonb) FROM pg_roles r WHERE r.rolname='service_role' OR r.rolname IN(SELECT grantee FROM migration_privilege_journal WHERE migration='361' AND action='revoked' AND object_signature='public.collection_products');") as number[];
    const objectTest=(classExpression:string,id:string,sub='0')=>'('+objects.map(([c,o,s])=>'('+classExpression+'='+c+' AND '+id+'='+o+(s===0?'':' AND '+sub+'='+s)+')').join(' OR ')+')';
    const catalogSql=state361Catalogs.filter(([name])=>name!=='pg_prepared_xacts').map(([table,predicate])=>{
        let filter='('+predicate+')',projection='to_jsonb(t)';
        if(['pg_proc','pg_class','pg_type','pg_constraint','pg_trigger','pg_attrdef'].includes(table))filter+=' AND NOT '+objectTest(q(table)+'::regclass::oid','t.oid');
        if(table==='pg_index')filter+=' AND NOT '+objectTest("'pg_class'::regclass::oid",'t.indexrelid');
        if(table==='pg_attribute')filter+=' AND NOT '+objectTest("'pg_class'::regclass::oid",'t.attrelid','t.attnum');
        if(table==='pg_depend')filter+=' AND NOT '+objectTest('t.classid','t.objid','t.objsubid')+' AND NOT '+objectTest('t.refclassid','t.refobjid','t.refobjsubid');
        if(table==='pg_shdepend') {
            filter+=' AND NOT '+objectTest('t.classid','t.objid','t.objsubid');
            // ACL restoration owns exactly these journaled junction/grantee
            // edges. Other role/dependency rows remain in full conservation.
            filter+=" AND NOT(t.classid='pg_class'::regclass AND t.objid="+junction+" AND t.objsubid=0 AND t.deptype='a' AND t.refclassid='pg_authid'::regclass AND t.refobjid=ANY(ARRAY["+journalAclRoles.join(',')+"]::oid[]))";
        }
        if(table==='pg_description'||table==='pg_seclabel')filter+=' AND NOT '+objectTest('t.classoid','t.objoid','t.objsubid');
        if(table==='pg_class'){
            // Canonicalize ACL semantics (ACL array order/default NULL is not
            // privilege state). Normalize only the declared own clock CHECK,
            // nine triggers and the exact journaled prior junction grants.
            const grantRows="SELECT pg_get_userbyid(a.grantee) grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type privilege,a.is_grantable grantable FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a";
            const acl="(SELECT coalesce(jsonb_agg(jsonb_build_array(a.grantee,a.grantor,a.privilege,a.grantable)ORDER BY a.grantee,a.privilege),'[]'::jsonb)FROM ("+grantRows+")a"+(" WHERE t.oid<>"+junction+" OR a.grantee='postgres'")+")";
            projection="(to_jsonb(t)-ARRAY['relpages','reltuples','relallvisible','relfrozenxid','relminmxid']-'relacl'-'relchecks'-'relhastriggers')||jsonb_build_object('relacl',CASE WHEN t.oid="+junction+' THEN '+acl+"||"+q(journalAcl)+"::jsonb ELSE "+acl+" END,'relchecks',(SELECT count(*)FROM pg_constraint k WHERE k.conrelid=t.oid AND k.contype='c'AND NOT "+objectTest("'pg_constraint'::regclass::oid",'k.oid')+"),'relhastriggers',EXISTS(SELECT 1 FROM pg_trigger g WHERE g.tgrelid=t.oid AND NOT "+objectTest("'pg_trigger'::regclass::oid",'g.oid')+'))';
        }
        return [table,'SELECT coalesce(jsonb_agg('+projection+' ORDER BY ('+projection+")::text),'[]'::jsonb)FROM pg_catalog."+table+' t WHERE '+filter];
    });
    const tables=sqlJson("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)ORDER BY n.nspname,c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p')AND c.relpersistence='p'AND n.nspname !~ '^pg_'AND n.nspname<>'information_schema'AND c.oid<>'collection_membership_receipts'::regclass;")as[string,string][];
    const data=tables.map(([schema,table])=>[schema+'.'+table,"SELECT coalesce(jsonb_agg("+(table==='collections'?"to_jsonb(t)-'membership_version'":'to_jsonb(t)')+"ORDER BY to_jsonb(t)::text),'[]'::jsonb)FROM \""+schema.replaceAll('"','""')+'"."'+table.replaceAll('"','""')+'" t'+(table==='migration_privilege_journal'?" WHERE migration<>'361'":'')]);
    // Read every closed field independently: one large normalized catalog
    // expression for all relations can exhaust the fixture's bounded memory.
    const sql=[...data,...catalogSql].map(([key,value])=>'SELECT '+q(key)+"||':'||encode(sha256(convert_to(("+value+")::text,'UTF8')),'hex');").join('\n');
    // Reuse this exact closed exclusion set after retirement, so deleted OIDs
    // cannot cause the test to discover and forgive a larger footprint.
    return {sql,raw:largeOwnedScript(sql),ordinal,parent,junction,objects};
}

// Proposed additional real PG16 controls. No candidate SQL has been applied.
// Raw JSON text remains text through Node; bigint fields never round-trip through
// JSON.parse/Number. Normative retirement expectations come from literal361 SQL.
const forward361 = readFileSync(new URL('../../../../../database/supabase/migrations/361_collection_membership.sql', import.meta.url), 'utf8');
const rollback361 = readFileSync(new URL('../../../../../database/supabase/rollback/361_collection_membership.rollback.sql', import.meta.url), 'utf8');
const rollbackBody361 = rollback361.replace(/^([\s\S]*?)\bBEGIN;/, '$1').replace(/COMMIT;\s*$/, '');
function largeOwnedScript(sql:string) {
    // The support module owns every process and reuses the verified fixture;
    // raw JSON remains text with a fixed64MiB output ceiling.
    return owned.scriptLarge(sql);
}

const userRelations361 = "SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE(n.nspname !~ '^pg_'AND n.nspname<>'information_schema')OR c.oid IN(SELECT p.reltoastrelid FROM pg_class p JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE pn.nspname !~ '^pg_'AND pn.nspname<>'information_schema')OR c.oid IN(SELECT i.indexrelid FROM pg_index i WHERE i.indrelid IN(SELECT p.reltoastrelid FROM pg_class p JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE pn.nspname !~ '^pg_'AND pn.nspname<>'information_schema'))";
const state361Catalogs = [
    ['pg_namespace',"(nspname !~ '^pg_' AND nspname<>'information_schema')OR nspname='pg_toast'"],
    ['pg_class','oid IN('+userRelations361+')'],
    ['pg_attribute','attrelid IN('+userRelations361+')'],
    ['pg_attrdef','adrelid IN('+userRelations361+')'],
    ['pg_constraint',"connamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')"],
    ['pg_index','indrelid IN('+userRelations361+')'],
    ['pg_proc',"pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')"],
    ['pg_type',"typnamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')OR typrelid IN("+userRelations361+')OR oid IN(SELECT typarray FROM pg_type WHERE typrelid IN('+userRelations361+'))'],
    ['pg_trigger','true'],['pg_policy','true'],['pg_rewrite','true'],['pg_depend','true'],['pg_shdepend','true'],
    ['pg_inherits','true'],['pg_description','true'],['pg_seclabel','true'],['pg_default_acl','true'],['pg_event_trigger','true'],
    ['pg_roles','true'],['pg_auth_members','true'],['pg_prepared_xacts',"database=current_database()"],
] as const;
function rawStateSql361() {
    const tables=sqlJson("SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname)ORDER BY n.nspname,c.relname),'[]'::jsonb)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p')AND c.relpersistence='p'AND n.nspname !~ '^pg_'AND n.nspname<>'information_schema';") as [string,string][];
    const ident=(s:string)=>'"'+s.replaceAll('"','""')+'"';
    const fields=[...tables.map(([schema,table])=>[schema+'.'+table,'SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),\'[]\'::jsonb)FROM '+ident(schema)+'.'+ident(table)+' t']),
        ...state361Catalogs.map(([table,predicate])=>{
            // Autovacuum updates physical estimates/visibility horizons without
            // any logical schema or authority change. Keep every other field.
            const row=table==='pg_class'?"to_jsonb(t)-ARRAY['relpages','reltuples','relallvisible','relfrozenxid','relminmxid']":'to_jsonb(t)';
            return ['catalog.'+table,"SELECT coalesce(jsonb_agg(("+row+")ORDER BY ("+row+")::text),'[]'::jsonb)FROM pg_catalog."+table+' t WHERE '+predicate];
        })];
    // Fingerprint every complete ordered relation/catalog field before the outer
    // object. This preserves all row bytes and numeric precision while avoiding
    // copying the entire schema/data into one unbounded JSONB allocation.
    return "SELECT jsonb_object_agg(k,v ORDER BY k)::text FROM ("+fields.map(([key,sql])=>'SELECT '+q(key)+" AS k,encode(sha256(convert_to(("+sql+")::text,'UTF8')),'hex')AS v").join(' UNION ALL ')+')s';
}
// An authenticated HTTP replay legitimately appends one anti-replay claim and
// ordinary request telemetry. Compare every remaining row and catalog field;
// canonical collection audit, outbox and durable command receipts stay included.
function assertHttpReplayState361(actual:string,expected:string) {
    const a=JSON.parse(actual),b=JSON.parse(expected);
    for(const table of ['internal_auth_replay_claims','worker_request_logs','runtime_telemetry_metrics','worker_request_logs_partitioned','runtime_telemetry_metrics_partitioned','worker_request_logs_partitioned_default','runtime_telemetry_metrics_partitioned_default']) { delete a['public.'+table];delete b['public.'+table]; }
    assertWholeState361(JSON.stringify(a),JSON.stringify(b),'HTTP replay conserves canonical state');
}
function rawState361(){return largeOwnedScript(rawStateSql361()+';');}
function assertWholeState361(actual:string,expected:string,message='Entire owned state must remain unchanged') {
    if(actual===expected)return;
    const a=JSON.parse(actual) as Record<string,string>,b=JSON.parse(expected) as Record<string,string>;
    assert.fail(message+': '+JSON.stringify([...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k])));
}

function refusedRetirement361(label:string,mutation='') {
    const state=rawStateSql361();
    // The real candidate body executes inside an exception subtransaction. A
    // refusal rolls back only its attempted DDL; the deliberately drifted state
    // remains for exact before/after comparison, then outer ROLLBACK removes it.
    const result=largeOwnedScript('BEGIN;'+mutation+';SELECT '+q('BEFORE:')+'||('+state+');DO $control$ DECLARE reason text; BEGIN BEGIN EXECUTE '+q(rollbackBody361)+";RAISE EXCEPTION 'SYN361_UNEXPECTED_RETIREMENT_SUCCESS';EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;IF reason='SYN361_UNEXPECTED_RETIREMENT_SUCCESS' THEN RAISE;END IF;IF reason NOT LIKE 'COLLECTION_MEMBERSHIP361_%' AND reason NOT LIKE '%lock%' THEN RAISE EXCEPTION 'SYN361_UNEXPECTED_RETIREMENT_ERROR:%',reason;END IF;RAISE NOTICE 'SYN361_EXPECTED_REFUSAL:%',reason;END;END $control$;SELECT "+q('AFTER:')+'||('+state+');ROLLBACK;');
    const lines=result.split('\n'),before=lines.find(x=>x.startsWith('BEFORE:'))?.slice(7),after=lines.find(x=>x.startsWith('AFTER:'))?.slice(6);
    assert.ok(before&&after,label+' must record raw before/after conservation');assert.equal(after,before,label+' changed state while refusing');
    console.info('OWNED361_RETIREMENT_REFUSAL '+JSON.stringify({label,completeFieldSha256Compared:true,bytes:before.length,sourceBodyExecuted:true}));
}
function roleScript361(w:World,sql:string,options:{role?:string;site?:string;actor?:string;request?:string;commit?:boolean}={}) {
    const role=options.role??'app_tenant';assert.ok(['app_tenant','service_role','anon','authenticated'].includes(role));
    return 'BEGIN;SET LOCAL ROLE '+role+';SET LOCAL app.site_id='+q(options.site??w.a.siteId)+';SET LOCAL app.actor_id='+q(options.actor??w.owner)+';SET LOCAL app.request_id='+q(options.request??'syn-cm361-'+crypto.randomUUID())+';'+sql+';'+(options.commit?'COMMIT;':'ROLLBACK;');
}
function canonicalSql361(w:World,body:ReturnType<typeof command>,actor=w.owner,site=w.a.siteId,id=w.collection) {
    return 'SELECT jsonb_build_object(\'current_role\',current_setting(\'role\'),\'current_user\',current_user,\'data\',public.apply_collection_membership_v1('+[q(site),q(id),q(actor),String(body.expected_version),q(body.idempotency_key),q(JSON.stringify(body.product_ids))+'::jsonb'].join(',')+'))::text';
}

test('361 empty-only retirement first proves source/schema/ACL/dependency/role refusals and restores only its footprint',async()=>{
    // This case deliberately runs before world() can append intrinsic history.
    assert.equal(psql("SELECT count(*)FROM collection_membership_receipts;"),'0');
    assert.equal(psql("SELECT count(*)FROM audit_activity_events WHERE action IN('collection.membership.revision','collection.membership.updated');"),'0');
    const commandSignature='public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)';
    const helperSignature='public.assert_collection_membership_owner_v1(uuid,uuid)';
    const functionDefinition=psql('SELECT pg_get_functiondef('+q(commandSignature)+'::regprocedure);');
    const sourceDrift=functionDefinition.replace('AS $function$','AS $function$\n-- synthetic source drift');
    assert.notEqual(sourceDrift,functionDefinition,'PG16 function source delimiter is explicit');
    const mutations:[string,string][]=[
        ['receipt extra column','ALTER TABLE collection_membership_receipts ADD COLUMN syn_extra text'],
        ['receipt column default','ALTER TABLE collection_membership_receipts ALTER COLUMN expected_version SET DEFAULT 1'],
        ['receipt nullability','ALTER TABLE collection_membership_receipts ALTER COLUMN actor_id DROP NOT NULL'],
        ['receipt check replacement',"ALTER TABLE collection_membership_receipts DROP CONSTRAINT collection_membership_receipts_version;ALTER TABLE collection_membership_receipts ADD CONSTRAINT collection_membership_receipts_version CHECK(expected_version>=0)"],
        ['receipt extra constraint','ALTER TABLE collection_membership_receipts ADD CONSTRAINT syn361_extra CHECK(true)'],
        ['receipt extra index','CREATE INDEX syn361_extra_index ON collection_membership_receipts(actor_id)'],
        ['receipt index uniqueness','DROP INDEX collection_membership_receipts_target;CREATE UNIQUE INDEX collection_membership_receipts_target ON collection_membership_receipts(store_id,collection_id,created_at)'],
        ['receipt RLS disabled','ALTER TABLE collection_membership_receipts DISABLE ROW LEVEL SECURITY'],
        ['receipt RLS unforced','ALTER TABLE collection_membership_receipts NO FORCE ROW LEVEL SECURITY'],
        ['receipt extra policy','CREATE POLICY syn361_extra ON collection_membership_receipts USING(true)'],
        ['receipt raw ACL widened','GRANT SELECT ON collection_membership_receipts TO anon'],
        ['receipt column ACL widened','GRANT SELECT(actor_id) ON collection_membership_receipts TO authenticated'],
        ['receipt TOAST options altered','ALTER TABLE collection_membership_receipts SET (toast.autovacuum_enabled=false)'],
        ['receipt index storage options altered','ALTER INDEX collection_membership_receipts_target SET (fillfactor=70)'],
        ['receipt storage altered','ALTER TABLE collection_membership_receipts ALTER COLUMN response SET STORAGE EXTERNAL'],
        ['receipt owner altered','ALTER TABLE collection_membership_receipts OWNER TO service_role'],
        ['collection clock default','ALTER TABLE collections ALTER COLUMN membership_version SET DEFAULT 2'],
        ['collection clock CHECK','ALTER TABLE collections DROP CONSTRAINT collections_membership_version_check;ALTER TABLE collections ADD CONSTRAINT collections_membership_version_check CHECK(membership_version>=0)'],
        ['collection clock extra AUTO CHECK dependency','ALTER TABLE collections ADD CONSTRAINT syn361_extra_clock CHECK(membership_version<100000)'],
        ['collection clock extra dependency','CREATE VIEW public.syn361_dependency AS SELECT membership_version FROM collections'],
        ['receipt external view dependency','CREATE VIEW public.syn361_dependency AS SELECT actor_id FROM collection_membership_receipts'],
        ['private helper dependency','CREATE TABLE public.syn361_dependency(marker regprocedure DEFAULT '+q(helperSignature)+'::regprocedure)'],
        ['private helper overload',"CREATE FUNCTION public.assert_collection_membership_owner_v1(text)RETURNS integer LANGUAGE sql AS 'SELECT 1'"],
        ['unknown source caller',"CREATE FUNCTION public.syn361_caller()RETURNS text LANGUAGE plpgsql AS $$BEGIN RETURN 'apply_collection_membership_v1';END$$"],
        ['canonical source body',sourceDrift],
        ['canonical execute widened','GRANT EXECUTE ON FUNCTION '+commandSignature+' TO anon'],
        ['private helper execute widened','GRANT EXECUTE ON FUNCTION '+helperSignature+' TO service_role'],
        ['canonical function volatility','ALTER FUNCTION '+commandSignature+' STABLE'],
        ['canonical function search_path','ALTER FUNCTION '+commandSignature+' SET search_path=public'],
        ['canonical function cost','ALTER FUNCTION '+commandSignature+' COST 7'],
        ['canonical function owner','ALTER FUNCTION '+commandSignature+' OWNER TO service_role'],
        ['canonical disabled trigger','ALTER TABLE collections DISABLE TRIGGER collections_membership_prepare'],
        ['canonical replica trigger','ALTER TABLE collections ENABLE REPLICA TRIGGER collections_membership_history'],
        ['extra trigger',"CREATE TRIGGER syn361_extra BEFORE DELETE ON collections FOR EACH ROW EXECUTE FUNCTION public.prepare_collection_membership_revision_v1()"],
        ['junction raw ACL widened','GRANT INSERT ON collection_products TO service_role'],
        ['authority role inheritance','ALTER ROLE app_tenant NOINHERIT'],
        ['authority role bypass','ALTER ROLE app_tenant BYPASSRLS'],
        ['authority unexpected membership','GRANT app_tenant TO authenticated'],
        ['authority membership option drift','GRANT app_tenant TO service_role WITH ADMIN OPTION'],
        ['own function comment','COMMENT ON FUNCTION '+helperSignature+" IS 'syn361 drift'"],
        ['own receipt comment',"COMMENT ON TABLE collection_membership_receipts IS 'syn361 drift'"],
        ['own provenance drift',"UPDATE migration_privilege_journal SET object_definition_hash='syn361'WHERE migration='361'AND privilege='361 RECEIPT'"],
    ];
    for(const [label,mutation]of mutations){const before=rawState361();refusedRetirement361(label,mutation);assertWholeState361(rawState361(),before,label+' mutation leaked from outer rollback');}
    const outside=outsideState361();
    const expectedPriorAcl=psql("SELECT coalesce(jsonb_agg(jsonb_build_array(grantee,'postgres',privilege_type,false)ORDER BY grantee,privilege_type),'[]'::jsonb)::text FROM(SELECT 'postgres'::text grantee,unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])privilege_type UNION ALL SELECT grantee,privilege FROM migration_privilege_journal WHERE migration='361'AND action='revoked'AND object_signature='public.collection_products')s;");
    const beforeData=largeOwnedScript("SELECT coalesce(jsonb_agg(to_jsonb(t)-'membership_version'ORDER BY id),'[]'::jsonb)::text FROM collections t;"),oldJunctionAcl=psql("SELECT coalesce(jsonb_agg(jsonb_build_array(x.grantee,x.grantor,x.privilege_type,x.is_grantable)ORDER BY x.grantee,x.grantor,x.privilege_type),'[]'::jsonb)::text FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x WHERE c.oid='collection_products'::regclass;");
    const retiredOrdinal=psql("SELECT attnum FROM pg_attribute WHERE attrelid='collections'::regclass AND attname='membership_version'AND NOT attisdropped;");
    // A successful retirement is the actual complete SQL file, with no removed
    // guard or borrowed final-runtime schema baseline.
    owned.script(rollback361);
    assert.equal(psql("SELECT to_regclass('collection_membership_receipts')IS NULL;"),'t');
    assert.equal(psql("SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('guard_collection_membership_receipt_v1','guard_collection_membership_junction_v1','bump_collection_membership_junction_v1','prepare_collection_membership_revision_v1','record_collection_membership_revision_v1','protect_collection_membership_audit_v1','assert_collection_membership_owner_v1','collection_membership_snapshot_v1','apply_collection_membership_v1');"),'0');
    assert.equal(psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='361';"),'0');
    assert.equal(psql("SELECT attisdropped FROM pg_attribute WHERE attrelid='collections'::regclass AND attnum="+retiredOrdinal+';'),'t','Only the recorded own physical column slot is retired');
    assert.equal(largeOwnedScript("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]'::jsonb)::text FROM collections t;"),beforeData);
    // Source profile after361 intentionally narrows junction to backendSELECT.
    // Restored legacy grants are recorded in the journal, not a widened guess.
    const restored=psql("SELECT coalesce(jsonb_agg(jsonb_build_array(x.grantee,x.grantor,x.privilege_type,x.is_grantable)ORDER BY x.grantee,x.grantor,x.privilege_type),'[]'::jsonb)::text FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x WHERE c.oid='collection_products'::regclass;");
    const restoredNames=psql("SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),pg_get_userbyid(x.grantor),x.privilege_type,x.is_grantable)ORDER BY pg_get_userbyid(x.grantee),x.privilege_type),'[]'::jsonb)::text FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x WHERE c.oid='collection_products'::regclass;");
    assert.equal(restoredNames,expectedPriorAcl,'Retirement restores exactly the known journaled prior ACL, without widening');
    assert.equal(largeOwnedScript(outside.sql),outside.raw,'Every outside persistent application row/catalog/ACL/dependency/role remains exact; only own recorded column slot excluded');
    owned.script(forward361); // Resume the exact finite original journey.
    assert.equal(psql("SELECT count(*)FROM pg_attribute WHERE attrelid='collections'::regclass AND attname='membership_version'AND NOT attisdropped;"),'1');
});

test('361 real prepared transactions and a real concurrent writer refuse retirement without silent skips',async()=>{
    assert.ok(Number(psql('SHOW max_prepared_transactions;'))>=2,'Coordinator must explicitly enable >=2 prepared slots for this owned fixture; zero is an unmet branch, never a skip');
    const gids=['syn_cm361_'+owned.runId+'_a','syn_cm361_'+owned.runId+'_b'];let prepared:string[]=[];
    try{
        for(const [index,gid]of gids.entries()){owned.script('BEGIN;SELECT pg_advisory_xact_lock('+String(361001+index)+');PREPARE TRANSACTION '+q(gid)+';');prepared.push(gid);}
        assert.equal(Number(psql('SELECT count(*)FROM pg_prepared_xacts WHERE database=current_database()AND gid IN('+gids.map(q).join(',')+');')),2);
        const before=rawState361();assert.equal(owned.exec(rollback361),null,'The actual whole retirement file refuses real prepared state');assertWholeState361(rawState361(),before);
    }finally{for(const gid of prepared)owned.script('ROLLBACK PREPARED '+q(gid)+';');}
    const name='syn_cm361_writer_'+owned.runId;const writer=owned.psqlAsync('BEGIN;SET LOCAL application_name='+q(name)+';LOCK TABLE collections IN ROW EXCLUSIVE MODE;SELECT txid_current();SELECT pg_sleep(4);COMMIT;');
    let witnessed=false;
    try{
        const deadline=Date.now()+2500;while(Date.now()<deadline){if(psql('SELECT count(*)FROM pg_stat_activity WHERE application_name='+q(name)+"AND backend_xid IS NOT NULL AND wait_event='PgSleep';")==='1'){witnessed=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
        assert.ok(witnessed,'An observed real writer barrier is mandatory');const before=rawState361();assert.equal(owned.exec(rollback361),null);assertWholeState361(rawState361(),before);
    }finally{await writer;}
    console.info('OWNED361_QUIESCENCE '+JSON.stringify({preparedTransactions:2,writerBarrier:witnessed,syntheticPositiveSubstitution:false}));
});

test('361 retains zero-receipt direct-write history, tombstones and later receipts; refusal preserves replay and resume',async()=>{
    const w=world('cm-sql-history');assert.deepEqual(effects(w),{audit:0,outbox:0,receipts:0});
    const initial=readData(await request(w,'GET'),w);
    psql('INSERT INTO collection_products(collection_id,product_id,position)VALUES('+[q(w.collection),q(w.products[2]),'2'].join(',')+');DELETE FROM collection_products WHERE collection_id='+q(w.collection)+'AND product_id='+q(w.products[2])+';');
    const current=readData(await request(w,'GET'),w);assert.deepEqual(current.product_ids,initial.product_ids);assert.ok(current.membership_version>initial.membership_version);
    assert.equal(psql('SELECT count(*)FROM collection_membership_receipts WHERE collection_id='+q(w.collection)+';'),'0');
    const history=Number(psql("SELECT count(*)FROM audit_activity_events WHERE action='collection.membership.revision'AND resource_id="+q(w.collection)+';'));assert.ok(history>0);
    const before=rawState361();assert.equal(owned.exec(rollback361),null);assertWholeState361(rawState361(),before);
    const body=command(current.membership_version,[w.products[2]]),first=readData(await request(w,'PUT',{body}),w),retained=rawState361();
    assert.equal(owned.exec(rollback361),null);assertWholeState361(rawState361(),retained);assert.deepEqual(readData(await request(w,'PUT',{body}),w),first);assertHttpReplayState361(rawState361(),retained);
    const resumed=readData(await request(w,'PUT',{body:command(first.membership_version,[w.products[3]])}),w);assert.deepEqual(resumed.product_ids,[w.products[3]]);
    const tombstone=crypto.randomUUID();psql('INSERT INTO collections(id,store_id,title)VALUES('+[q(tombstone),q(w.a.siteId),q('Synthetic tombstone')].join(',')+');DELETE FROM collections WHERE id='+q(tombstone)+';');
    assert.equal(psql('SELECT count(*)FROM collections WHERE id='+q(tombstone)+';'),'0');
    assert.equal(psql("SELECT count(*)FROM audit_activity_events WHERE action='collection.membership.revision'AND resource_id="+q(tombstone)+';'),'2','Insert and hard-delete tombstone history persists after its parent is gone');
    const tombstoneState=rawState361();assert.equal(owned.exec(rollback361),null);assertWholeState361(rawState361(),tombstoneState);
    assert.match(owned.psqlExpectError('INSERT INTO collections(id,store_id,title)VALUES('+[q(tombstone),q(w.a.siteId),q('Synthetic forbidden ID reuse')].join(',')+');'),/COLLECTION_MEMBERSHIP_/);assertWholeState361(rawState361(),tombstoneState);
    const immutableControls:[string,RegExp][]=[
        ["UPDATE audit_activity_events SET metadata='{}'WHERE action='collection.membership.revision'AND resource_id="+q(w.collection),/COLLECTION_MEMBERSHIP_AUDIT_RETAINED/],
        ["DELETE FROM audit_activity_events WHERE action='collection.membership.revision'AND resource_id="+q(w.collection),/COLLECTION_MEMBERSHIP_AUDIT_RETAINED/],
        ['UPDATE collection_membership_receipts SET response=response WHERE idempotency_key='+q(body.idempotency_key),/^ERROR:\s+collection membership receipts are immutable/m],
        ['DELETE FROM collection_membership_receipts WHERE idempotency_key='+q(body.idempotency_key),/^ERROR:\s+collection membership receipts are immutable/m],
    ];
    for(const [sql,reason] of immutableControls){
        assert.match(owned.psqlExpectError(sql),reason);assertWholeState361(rawState361(),tombstoneState);
    }
    assert.deepEqual(readData(await request(w,'PUT',{body}),w),first);assert.deepEqual(readData(await request(w,'GET'),w),resumed);
});

test('current owner reads complete ordered membership with positive revision and no effects',async()=>{
    const w=world('cm-read'),before=snapshot(w),data=readData(await request(w,'GET'),w);
    assert.deepEqual(data.product_ids,w.products.slice(0,2));assert.deepEqual(data.products.map(p=>p.id).sort(),w.products.slice(0,2).sort());assert.deepEqual(snapshot(w),before);
});
test('owner-only authority precedes private reads and foreign/missing/deleted IDs are hidden within verified scope',async()=>{
    const w=world('cm-authority'),before=snapshot(w);
    for(const actor of [w.staff,w.other]){const r=await request(w,'GET',{actor});assert.equal(r.status,403,r.text);assert.equal(r.json?.data,undefined);}
    for(const id of [w.foreignCollection,w.deletedCollection,crypto.randomUUID()]){const r=await request(w,'GET',{id});assert.equal(r.status,404,r.text);assert.equal(r.json?.data,undefined);}
    const mismatch=await request(w,'GET',{boundStore:w.b.siteId});assert.equal(mismatch.status,403,mismatch.text);
    const otherStore=await request(w,'GET',{selectedStore:w.b.siteId,id:w.foreignCollection});assert.equal(otherStore.status,403,otherStore.text);assert.deepEqual(snapshot(w),before);
});
test('read faults are sanitized errors and restored retry retains the original membership',async()=>{
    const w=world('cm-fault-read');readData(await request(w,'GET'),w);const before=snapshot(w);
    for(const resource of ['collections','collection_products','products']){
        let hits=0;const tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.method==='GET'&&call.resource===resource){hits++;return restJson(503,{code:'XX000',message:'syn_private_membership_fault',details:'synthetic-private-details'});}return forward();});
        try{const r=await request(w,'GET');assert.equal(r.status,500,r.text);assert.equal(hits,1);assert.equal(r.json?.data,undefined);assert.doesNotMatch(r.text,/syn_private_membership_fault|synthetic-private-details/);assert.deepEqual(snapshot(w),before);}
        finally{tap.restore();}
        assert.deepEqual(readData(await request(w,'GET'),w).product_ids,w.products.slice(0,2));
    }
});
test('one atomic replacement preserves retained junction IDs/order and commits one audit/outbox/receipt',async()=>{
    const w=world('cm-write'),loaded=readData(await request(w,'GET'),w),old=junction(w),ids=[w.products[1],w.products[2],w.products[0]];
    const result=readData(await request(w,'PUT',{body:command(loaded.membership_version,ids)}),w);
    assert.deepEqual(result.product_ids,ids);assert.ok(result.membership_version>loaded.membership_version);
    assert.deepEqual(junction(w).map(row=>row.product_id),ids);for(const row of old)assert.equal(junction(w).find(x=>x.product_id===row.product_id)?.id,row.id);
    assert.deepEqual(effects(w),{audit:1,outbox:1,receipts:1});assert.deepEqual(readData(await request(w,'GET'),w).product_ids,ids);
});
test('missing/malformed/duplicate/foreign/deleted IDs and over500 commands fail as a whole',async()=>{
    const w=world('cm-invalid'),loaded=readData(await request(w,'GET'),w);psql('UPDATE products SET deleted_at=now()WHERE id='+q(w.products[3])+';');const before=snapshot(w);
    const inputs:unknown[]=[{expected_version:loaded.membership_version,idempotency_key:crypto.randomUUID()},command(loaded.membership_version,['not-a-uuid']),command(loaded.membership_version,[w.products[0],w.products[0]]),command(loaded.membership_version,[w.foreign]),command(loaded.membership_version,[w.products[3]]),command(loaded.membership_version,Array.from({length:501},()=>crypto.randomUUID()))];
    for(const body of inputs){const r=await request(w,'PUT',{body});assert.ok([400,422].includes(r.status),r.text);assert.deepEqual(snapshot(w),before);}
});
test('intentional empty membership and exactly500 members are supported without truncation',async()=>{
    const w=world('cm-cap',500);let data=readData(await request(w,'GET'),w);
    data=readData(await request(w,'PUT',{body:command(data.membership_version,w.products)}),w);assert.deepEqual(data.product_ids,w.products);assert.equal(junction(w).length,500);
    data=readData(await request(w,'PUT',{body:command(data.membership_version,[])}),w);assert.deepEqual(data.product_ids,[]);assert.equal(junction(w).length,0);assert.deepEqual(effects(w),{audit:2,outbox:2,receipts:2});
});
test('stale and simultaneous writers cannot overwrite a newer membership',async()=>{
    const w=world('cm-race'),loaded=readData(await request(w,'GET'),w),first=command(loaded.membership_version,[w.products[2]]),second=command(loaded.membership_version,[w.products[3]]);
    // Both commands carry exactly the same loaded revision; no lucky timing is
    // needed for the CAS invariant. SQL locks must serialize their final writes.
    const responses=await Promise.all([request(w,'PUT',{body:first}),request(w,'PUT',{body:second})]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
    const winner=responses[0].status===200?first:second,loser=winner===first?second:first,before=snapshot(w);
    assert.deepEqual(readData(await request(w,'GET'),w).product_ids,winner.product_ids);const stale=await request(w,'PUT',{body:loser});assert.equal(stale.status,409,stale.text);assert.deepEqual(snapshot(w),before);assert.deepEqual(effects(w),{audit:1,outbox:1,receipts:1});
});
test('exact old receipt replay does not overwrite a later edit; changed key payload conflicts',async()=>{
    const w=world('cm-replay'),loaded=readData(await request(w,'GET'),w),body=command(loaded.membership_version,[w.products[2]]);
    const first=readData(await request(w,'PUT',{body}),w),later=readData(await request(w,'PUT',{body:command(first.membership_version,[w.products[3]])}),w),before=snapshot(w);
    assert.deepEqual(readData(await request(w,'PUT',{body}),w),first);assert.deepEqual(readData(await request(w,'GET'),w),later);assert.deepEqual(snapshot(w),before);
    const conflict=await request(w,'PUT',{body:{...body,product_ids:[w.products[0]]}});assert.equal(conflict.status,409,conflict.text);assert.deepEqual(snapshot(w),before);assert.deepEqual(effects(w),{audit:2,outbox:2,receipts:2});
});
test('current live authority is rechecked before read and committed receipt replay',async()=>{
    const w=world('cm-revoke'),loaded=readData(await request(w,'GET'),w),body=command(loaded.membership_version,[w.products[2]]);readData(await request(w,'PUT',{body}),w);
    psql('UPDATE sites SET custom_user_id='+q(w.other)+'WHERE id='+q(w.a.siteId)+';');
    try{const before=snapshot(w);for(const method of ['GET','PUT']as const){const r=await request(w,method,{body});assert.equal(r.status,403,r.text);assert.equal(r.json?.data,undefined);assert.deepEqual(snapshot(w),before);}}
    finally{psql('UPDATE sites SET custom_user_id='+q(w.owner)+'WHERE id='+q(w.a.siteId)+';');}
    assert.equal((await request(w,'PUT',{body})).status,200);
});
test('junction insert, audit, outbox and receipt faults roll back every mandatory effect',async()=>{
    const w=world('cm-write-fault'),loaded=readData(await request(w,'GET'),w);
    for(const table of ['collection_products','audit_activity_events','outbox_events','collection_membership_receipts']){
        const name='syn_cm_'+crypto.randomUUID().replaceAll('-',''),field=table==='audit_activity_events'?'resource_id':table==='outbox_events'?'aggregate_id':'collection_id',before=snapshot(w);
        // Named negative-only trigger on this disposable fixture's own subject.
        psql('CREATE FUNCTION public.'+name+"()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF to_jsonb(NEW)->>"+q(field)+'='+q(w.collection)+" THEN RAISE EXCEPTION 'syn_private_membership_write_fault'; END IF; RETURN NEW; END$$;CREATE TRIGGER "+name+' BEFORE INSERT ON public.'+table+' FOR EACH ROW EXECUTE FUNCTION public.'+name+'();');
        try{const r=await request(w,'PUT',{body:command(loaded.membership_version,[w.products[2]])});assert.equal(r.status,500,r.text);assert.doesNotMatch(r.text,/syn_private_membership_write_fault/);assert.deepEqual(snapshot(w),before);}
        finally{psql('DROP TRIGGER '+name+' ON public.'+table+';DROP FUNCTION public.'+name+'();');}
    }
    assert.deepEqual(readData(await request(w,'GET'),w).product_ids,w.products.slice(0,2));
});
test('junction changes outside the command advance revision including a change restored to the old set',async()=>{
    const w=world('cm-external'),loaded=readData(await request(w,'GET'),w);
    psql('INSERT INTO collection_products(collection_id,product_id,position)VALUES('+[q(w.collection),q(w.products[2]),'2'].join(',')+');DELETE FROM collection_products WHERE collection_id='+q(w.collection)+'AND product_id='+q(w.products[2])+';');
    const fresh=readData(await request(w,'GET'),w);assert.deepEqual(fresh.product_ids,loaded.product_ids);assert.ok(fresh.membership_version>loaded.membership_version);
    const before=snapshot(w),r=await request(w,'PUT',{body:command(loaded.membership_version,[w.products[3]])});assert.equal(r.status,409,r.text);assert.deepEqual(snapshot(w),before);
});
test('staff, changed actor and bound-store requests cannot replay an owner receipt',async()=>{
    const w=world('cm-replay-scope'),loaded=readData(await request(w,'GET'),w),body=command(loaded.membership_version,[w.products[2]]);readData(await request(w,'PUT',{body}),w);const before=snapshot(w);
    for(const options of [{actor:w.staff},{actor:w.other},{boundStore:w.b.siteId},{selectedStore:w.b.siteId}]){const r=await request(w,'PUT',{...options,body});assert.equal(r.status,403,r.text);assert.equal(r.json?.data,undefined);assert.deepEqual(snapshot(w),before);}
});

// Additional AFTER source controls. The original12 cases/assertions and actual
// BEFORE bytes are retained in fixture-review-2/before-confirmed unchanged.
test('a real competing command or ABA across bracketed REST reads returns a coherent-read conflict',async()=>{
    for(const aba of [false,true]){
        const w=world(aba?'cm-read-aba':'cm-read-cut'),initial=readData(await request(w,'GET'),w);
        let armed=true,cuts=0,afterWriter:ReturnType<typeof snapshot>|undefined;
        const tap=tapRest(owned.restUrl,async(call,forward)=>{
            const response=await forward();
            if(armed&&call.method==='GET'&&call.resource==='collections'){
                armed=false;cuts++;
                const changed=readData(await request(w,'PUT',{body:command(initial.membership_version,[w.products[2]])}),w);
                if(aba)readData(await request(w,'PUT',{body:command(changed.membership_version,initial.product_ids)}),w);
                afterWriter=snapshot(w);
            }
            return response;
        });
        try{const r=await request(w,'GET');assert.equal(cuts,1);assert.equal(r.status,409,r.text);assert.equal(r.json?.error?.code,'COLLECTION_MEMBERSHIP_READ_CONFLICT');assert.equal(r.json?.data,undefined);assert.deepEqual(snapshot(w),afterWriter);}
        finally{tap.restore();}
        assert.deepEqual(readData(await request(w,'GET'),w).product_ids,aba?initial.product_ids:[w.products[2]]);
    }
});

test('parent disappearance between real product and confirmation reads is an explicit conflict, not a partial snapshot',async()=>{
    const w=world('cm-read-gone');readData(await request(w,'GET'),w);let armed=true,cuts=0,afterTransition:ReturnType<typeof snapshot>|undefined;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        const response=await forward();
        if(armed&&call.method==='GET'&&call.resource==='products'){
            armed=false;cuts++;
            // Named trusted maintenance transition in this disposable fixture.
            // This does not substitute for a normal browser mutation proof.
            psql('UPDATE collections SET deleted_at=now()WHERE id='+q(w.collection)+';');afterTransition=snapshot(w);
        }
        return response;
    });
    try{const r=await request(w,'GET');assert.equal(cuts,1);assert.equal(r.status,409,r.text);assert.equal(r.json?.error?.code,'COLLECTION_MEMBERSHIP_READ_CONFLICT');assert.equal(r.json?.data,undefined);assert.deepEqual(snapshot(w),afterTransition);}
    finally{tap.restore();}
    const missing=await request(w,'GET');assert.equal(missing.status,404,missing.text);assert.equal(missing.json?.data,undefined);
});

test('an unavailable assigned product remains explicit and cannot be silently omitted from replacement',async()=>{
    const w=world('cm-unavailable');psql('UPDATE products SET deleted_at=now()WHERE id='+q(w.products[0])+';');
    const before=snapshot(w),data=readData(await request(w,'GET'),w);
    assert.deepEqual(data.product_ids,w.products.slice(0,2));assert.deepEqual(data.unavailable_product_ids,[w.products[0]]);assert.deepEqual(data.products.map(p=>p.id),[w.products[1]]);assert.deepEqual(snapshot(w),before);
    const invalid=await request(w,'PUT',{body:command(data.membership_version,data.product_ids)});assert.ok([400,422].includes(invalid.status),invalid.text);assert.deepEqual(snapshot(w),before);
    const removed=readData(await request(w,'PUT',{body:command(data.membership_version,[w.products[1]])}),w);assert.deepEqual(removed.product_ids,[w.products[1]]);assert.deepEqual(removed.unavailable_product_ids,[]);
});


test('361 ordinary raw roles are denied while the same app_tenant role can execute its bound owner command',async()=>{
    const w=world('cm-sql-role'),loaded=readData(await request(w,'GET'),w),body=command(loaded.membership_version,[w.products[2]]);
    const forbidden=[
        'SELECT * FROM collection_membership_receipts',
        'INSERT INTO collection_membership_receipts(idempotency_key,operation,store_id,collection_id,actor_id,expected_version,product_ids,response)VALUES('+[q(crypto.randomUUID()),q('collection.membership.v1'),q(w.a.siteId),q(w.collection),q(w.owner),'1',"'[]'::jsonb","'{}'::jsonb"].join(',')+')',
        'INSERT INTO audit_activity_events(store_id,actor_type,action,resource_type,resource_id)VALUES('+[q(w.a.siteId),q('system'),q('collection.membership.revision'),q('collection'),q(w.collection)].join(',')+')',
        'UPDATE collection_membership_receipts SET response=response',
        'DELETE FROM collection_membership_receipts',
        'TRUNCATE collection_membership_receipts',
        'INSERT INTO collection_products(collection_id,product_id,position)VALUES('+[q(w.collection),q(w.products[3]),'9'].join(',')+')',
        'UPDATE collection_products SET position=8 WHERE collection_id='+q(w.collection),
        'DELETE FROM collection_products WHERE collection_id='+q(w.collection),
        'TRUNCATE collection_products',
        'SELECT public.assert_collection_membership_owner_v1('+q(w.a.siteId)+','+q(w.owner)+')',
    ];
    for(const role of ['app_tenant','anon','authenticated','service_role'])for(const sql of forbidden){
        const before=rawState361(),error=owned.psqlExpectError(roleScript361(w,sql,{role}));assert.match(error,/permission denied|COLLECTION_MEMBERSHIP_/i,role+':'+sql);assertWholeState361(rawState361(),before);
    }
    const success=largeOwnedScript(roleScript361(w,canonicalSql361(w,body),{commit:true}));
    const response=JSON.parse(success.split('\n').find(x=>x.startsWith('{'))!);
    assert.equal(response.current_role,'app_tenant');assert.equal(response.current_user,'app_tenant');assert.deepEqual(response.data.product_ids,body.product_ids);
    assert.deepEqual(effects(w),{audit:1,outbox:1,receipts:1});
    const before=rawState361();assert.equal(largeOwnedScript(roleScript361(w,canonicalSql361(w,body))),success,'Same ordinary role exact replay returns its original response');assertWholeState361(rawState361(),before);
    const invalid:[string,string,Parameters<typeof roleScript361>[2]][]=[
        ['service_role inherits execute but is not the literal canonical role',canonicalSql361(w,body),{role:'service_role'}],
        ['store GUC mismatch',canonicalSql361(w,body),{site:w.b.siteId}],
        ['actor GUC mismatch',canonicalSql361(w,body),{actor:w.other}],
        ['empty request binding',canonicalSql361(w,body),{request:''}],
        ['staff cannot use owner command',canonicalSql361(w,body,w.staff),{actor:w.staff}],
        ['foreign target remains hidden',canonicalSql361(w,{...body,idempotency_key:crypto.randomUUID()},w.owner,w.a.siteId,w.foreignCollection),{}],
        ['foreign product fails whole command',canonicalSql361(w,command(response.data.membership_version,[w.foreign])),{}],
        ['same key different payload refuses',canonicalSql361(w,{...body,product_ids:[w.products[3]]}),{}],
    ];
    for(const [label,sql,options]of invalid){const state=rawState361();assert.match(owned.psqlExpectError(roleScript361(w,sql,options)),/COLLECTION_MEMBERSHIP_/i,label);assertWholeState361(rawState361(),state,label);}
    psql('UPDATE sites SET custom_user_id='+q(w.other)+' WHERE id='+q(w.a.siteId)+';');
    try{const state=rawState361();assert.match(owned.psqlExpectError(roleScript361(w,canonicalSql361(w,body))),/COLLECTION_MEMBERSHIP_FORBIDDEN/);assertWholeState361(rawState361(),state);}
    finally{psql('UPDATE sites SET custom_user_id='+q(w.owner)+' WHERE id='+q(w.a.siteId)+';');}
    const again=largeOwnedScript(roleScript361(w,canonicalSql361(w,body)));assert.equal(again,success);assert.deepEqual(effects(w),{audit:1,outbox:1,receipts:1});
    const fresh=readData(await request(w,'GET'),w);assert.equal((await request(w,'PUT',{body:command(fresh.membership_version,[w.products[3]])})).status,200);
});
