import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
