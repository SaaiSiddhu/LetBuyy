// Full current-schema counterpart to the exact 435/436 birth/cutover cohorts.
// Real Gateway, PostgreSQL and PostgREST; synthetic identity assertions only.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders} from './gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder} from './synthetic-tenant';
import {TENANT_TABLES} from '../../tenant/tenant-tables.registry';

const owned = requireOwnedDatabase();
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const tables = (): string[] => JSON.parse(owned.psql("SELECT jsonb_agg(relname ORDER BY relname)FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')"));
function digest(): string {
    return owned.scriptLarge('SELECT jsonb_agg(to_jsonb(s)ORDER BY name)FROM(' + tables().map(name =>
        `SELECT ${quote(name)}name,count(*)rows,md5(coalesce(string_agg(h,','ORDER BY h),''))hash FROM
         (SELECT md5(to_jsonb(t)::text)h FROM public."${name.replaceAll('"','""')}"t)r`).join(' UNION ALL ') + ')s');
}
const roles = () => owned.psql("SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r)ORDER BY oid)FROM pg_roles r),'memberships',(SELECT jsonb_agg(to_jsonb(m)ORDER BY roleid,member,grantor)FROM pg_auth_members m))");
function currentInventory(): void {
    const names = tables();
    for (const entry of TENANT_TABLES) assert(names.includes(entry.table), entry.table + ': complete current tenant inventory');
    assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='440'"), '2');
    assert(names.includes('kyc_india_legal_holds'), 'later KYC tables must be present');
}
async function fixture(t: {after(fn: () => Promise<void>): void}, tag: string) {
    currentInventory();
    const site = newSyntheticTenant(tag), foreign = newSyntheticTenant(tag + '-peer');
    const actor = randomUUID(), email = `syn-current-recovery-${actor}@example.invalid`;
    seedSyntheticTenant(owned.psql, site); seedSyntheticTenant(owned.psql, foreign);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);
      UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';`);
    const order = seedSyntheticOrder(owned.psql, site);
    const proxy = await startOwnedPooledSqlProxy(owned), gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
    t.after(async () => { await gateway.settle(); await closePooledSqlClients(); await proxy.stop(); });
    const request = async (path: string, method: string, body: Record<string, unknown>, key = randomUUID(), selected = site.siteId) =>
        gateway.request(path, {method, headers: {...await signedIdentityHeaders(actor,email,site.siteId),
            'X-Store-ID': selected, 'X-Idempotency-Key': key, 'X-LetBuyy-Warehouse-Protocol': '2'},
            body: JSON.stringify({...body,idempotency_key:key})});
    return {site, foreign, actor, email, order, gateway, request};
}

test('current collection saves and original receipts survive later edits; unsafe historical reverse preserves every table and authority', {timeout:180000}, async t => {
    const f = await fixture(t, 'current-col');
    const fields = {store_id:f.site.siteId,collection_type:'manual',title:'Synthetic retained current collection'};
    const key = randomUUID(), created = await f.request('/v1/products/collections','POST',fields,key);
    assert.equal(created.status,201,created.text);
    const id = created.json?.data.id;
    assert.match(id,/^[a-f0-9-]{36}$/);
    const updated = await f.request(`/v1/products/collections/${id}`,'PATCH',
        {store_id:f.site.siteId,collection_type:'manual',version:created.json?.data.version,description:'Synthetic later edit'});
    assert.equal(updated.status,200,updated.text);
    const replay = await f.request('/v1/products/collections','POST',fields,key);
    assert.equal(replay.status,201,replay.text); assert.deepEqual(replay.json?.data,created.json?.data);
    const denied = await f.request(`/v1/products/collections/${id}`,'PATCH',
        {store_id:f.foreign.siteId,collection_type:'manual',version:updated.json?.data.version,title:'Forbidden rebound'},randomUUID(),f.foreign.siteId);
    assert.equal(denied.status,403,denied.text);
    await f.gateway.settle();
    const rows = digest(), authority = roles();
    for (const name of ['435_unified_collection_authority','438_product_variant_retirement']) {
        assert.match(owned.psqlScriptExpectError(readFileSync(`database/supabase/rollback/${name}.rollback.sql`,'utf8')),
            /rollback435 refuses (changed|retained)|rollback438 refuses (catalog drift|retained)/);
        assert.equal(digest(),rows,'Historical refusal preserves every current public table row/count/hash');
        assert.equal(roles(),authority); currentInventory();
    }
});

test('current reserved and partially received transfers retain original route receipts and all data after historical recovery refuses', {timeout:180000}, async t => {
    const f = await fixture(t, 'current-stock'), destination = randomUUID();
    owned.psql(`INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${f.site.siteId}','Synthetic destination','active');`);
    const body = {store_id:f.site.siteId,source_location_id:f.site.locationId,destination_location_id:destination,
        lines:[{product_id:f.order.productId,quantity:4}]};
    const key = randomUUID(), first = await f.request('/v1/inventory/transfers','POST',body,key);
    assert.equal(first.status,201,first.text);
    const id = first.json?.data.transfer.id, line = first.json?.data.lines[0].id;
    const ship = await f.request(`/v1/inventory/transfers/${id}/ship`,'POST',{});
    assert.equal(ship.status,200,ship.text);
    const receive = await f.request(`/v1/inventory/transfers/${id}/receive`,'POST',{lines:[{transfer_line_id:line,quantity:1}]});
    assert.equal(receive.status,200,receive.text);
    const replay = await f.request('/v1/inventory/transfers','POST',body,key);
    assert.equal(replay.status,201,replay.text); assert.deepEqual(replay.json?.data,first.json?.data);
    await f.gateway.settle();
    const rows = digest(), authority = roles();
    for (const name of ['415_atomic_warehouse_commands','436_canonical_transfer_reservations']) {
        assert.match(owned.psqlScriptExpectError(readFileSync(`database/supabase/rollback/${name}.rollback.sql`,'utf8')),
            /rollback414 refuses retained warehouse command receipts|rollback436 refuses (retained inventory operations|changed function profile)/);
        assert.equal(digest(),rows,'Current transfer receipts, reservations, commerce and audit rows are unchanged');
        assert.equal(roles(),authority); currentInventory();
    }
});

test('current variant retirement keeps its original acknowledgement and live readback while the older catalog-bound reverse refuses atomically', {timeout:180000}, async t => {
    const f = await fixture(t, 'current-variant');
    const created = await f.gateway.request('/v1/products',{method:'POST',
        headers:{...await signedIdentityHeaders(f.actor,f.email,f.site.siteId),'X-Store-ID':f.site.siteId,'X-Idempotency-Key':randomUUID()},
        body:JSON.stringify({store_id:f.site.siteId,name:'Synthetic current variants',price:125,stock:0,images:[],
            product_options:[{name:'Size',position:0,values:['M','L']}],
            variants:[{title:'M',options:{Size:'M'},stock:0},{title:'L',options:{Size:'L'},stock:0}]})});
    assert.equal(created.status,201,created.text);
    const product = created.json?.data, retired = product.variants[0].id, key = randomUUID();
    const fields = {version:product.version,name:'Synthetic current retirement',variants:[{id:product.variants[1].id,title:'L'}]};
    const result = await f.request(`/v1/products/${product.id}`,'PATCH',fields,key);
    assert.equal(result.status,200,result.text);
    assert.equal(owned.psql(`SELECT deleted_at IS NOT NULL FROM product_variants WHERE id='${retired}'`),'t');
    const replay = await f.request(`/v1/products/${product.id}`,'PATCH',fields,key);
    assert.equal(replay.status,200,replay.text);assert.deepEqual(replay.json?.data,result.json?.data);
    const fresh = await f.gateway.request(`/v1/products/${product.id}`,{headers:{...await signedIdentityHeaders(f.actor,f.email,f.site.siteId),'X-Store-ID':f.site.siteId}});
    assert.equal(fresh.status,200,fresh.text);
    assert(!fresh.json?.data.variants.some((variant:{id:string})=>variant.id===retired));
    await f.gateway.settle();
    const rows = digest(), authority = roles();
    assert.match(owned.psqlScriptExpectError(readFileSync('database/supabase/rollback/438_product_variant_retirement.rollback.sql','utf8')),
        /rollback438 refuses catalog drift/);
    assert.equal(digest(),rows);assert.equal(roles(),authority);currentInventory();
});
