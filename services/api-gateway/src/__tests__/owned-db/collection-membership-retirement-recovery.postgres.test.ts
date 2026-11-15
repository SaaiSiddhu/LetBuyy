// Current435 API/SQL regression. Original361 historical migration/provenance
// stays intact; no hosted database, normal UI or real-provider claim.
import assert from 'node:assert/strict';
import test, { before, after, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { withTenantTx } from '../../lib/tenant-transaction';

const owned = requireOwnedDatabase();
let proxy: OwnedPooledSqlProxy;
let ordinal = 0;
before(async () => { proxy = await startOwnedPooledSqlProxy(owned); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });
async function fixture(t: TestContext) {
    const site = newSyntheticTenant('member-retire-' + ++ordinal), actor = randomUUID(), other = randomUUID(), collection = randomUUID();
    const products = [randomUUID(), randomUUID()], email = (id: string) => `syn-retirement-${id}@example.invalid`;
    seedSyntheticTenant(owned.psql, site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email(actor)}',true),('${other}','${email(other)}',true);
      UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
      INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES
      ('${products[0]}','${site.siteId}','${site.siteId}','Synthetic retained first','syn-retained-${products[0]}',100,3,true,'active'),
      ('${products[1]}','${site.siteId}','${site.siteId}','Synthetic retained second','syn-retained-${products[1]}',200,4,true,'active');
      INSERT INTO collections(id,store_id,title,collection_type)VALUES('${collection}','${site.siteId}','Synthetic retiring manual','manual');
      INSERT INTO collection_products(collection_id,product_id,position)VALUES('${collection}','${products[0]}',0),('${collection}','${products[1]}',1);`);
    const env = gatewayEnv(owned, await newIdentityKeys(), proxy.env()), gateway = new Gateway(env);t.after(() => gateway.settle());
    const path = `/v1/products/collections/${collection}`, key = randomUUID();
    const initial = await gateway.request(path + '/products?store_id=' + site.siteId, { headers: await signedIdentityHeaders(actor, email(actor), site.siteId) });
    assert.equal(initial.status, 200, initial.text);assert.deepEqual(initial.json?.data.product_ids, products);
    const body = { expected_version: initial.json?.data.membership_version as number, product_ids: [...products].reverse(), idempotency_key: key };
    const send = async (payload = body, who = actor, selected = site.siteId) => gateway.request(path + '/products?store_id=' + selected, {
        method: 'PUT', headers: { ...await signedIdentityHeaders(who, email(who)), 'X-Idempotency-Key': payload.idempotency_key }, body: JSON.stringify(payload),
    });
    const remove = async () => {
        const current = await gateway.request(path + '?store_id=' + site.siteId, { headers: await signedIdentityHeaders(actor, email(actor), site.siteId) });assert.equal(current.status, 200, current.text);
        const idempotency_key = randomUUID();
        const result = await gateway.request(path, { method: 'DELETE', headers: { ...await signedIdentityHeaders(actor, email(actor), site.siteId), 'X-Idempotency-Key': idempotency_key },
            body: JSON.stringify({ collection_type: 'manual', store_id: site.siteId, version: current.json?.data.version, idempotency_key }) });
        assert.equal(result.status, 200, result.text);assert(result.json?.data.deleted_at);
    };
    const state = () => owned.psql(`SELECT jsonb_build_object(
      'parent',(SELECT to_jsonb(c)FROM collections c WHERE id='${collection}'),
      'junction',(SELECT jsonb_agg(to_jsonb(c)ORDER BY id)FROM collection_products c WHERE collection_id='${collection}'),
      'receipts',(SELECT jsonb_agg(to_jsonb(c)ORDER BY idempotency_key)FROM collection_membership_receipts c WHERE collection_id='${collection}'),
      'audit',(SELECT jsonb_agg(to_jsonb(c)ORDER BY id)FROM audit_activity_events c WHERE resource_id='${collection}'),
      'outbox',(SELECT jsonb_agg(to_jsonb(c)ORDER BY id)FROM outbox_events c WHERE aggregate_id='${collection}'))::text`);
    const sqlReplay = () => withTenantTx(env, { siteId: site.siteId, requestId: randomUUID() }, async sql => {
        await sql.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)', ['app.actor_id', actor, 'request.jwt.claim.sub', actor]);
        const result = await sql.unsafe('SELECT public.apply_collection_membership_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb)AS result',
            [site.siteId, collection, actor, body.expected_version, key, JSON.stringify(body.product_ids)]);
        return result[0].result;
    });
    return { site, actor, other, collection, body, send, remove, state, sqlReplay };
}
test('a committed manual membership receipt survives a later canonical metadata deletion without another effect', async t => {
    const f = await fixture(t), committed = await f.send();assert.equal(committed.status, 200, committed.text);
    assert.deepEqual(await f.sqlReplay(), committed.json?.data, 'Live parent positive replay precedes retirement.');
    await f.remove();const retained = f.state();
    const recovered = await f.send();assert.equal(recovered.status, 200, recovered.text);
    assert.deepEqual(recovered.json?.data, committed.json?.data);assert.deepEqual(await f.sqlReplay(), committed.json?.data);
    assert.equal(f.state(), retained, 'Replay preserves exact parent, junction, receipt, audit and outbox rows.');
    const rebound = await f.send({ ...f.body, product_ids: [...f.body.product_ids].reverse() });assert.equal(rebound.status, 409, rebound.text);
    const other = await f.send(f.body, f.other);assert.equal(other.status, 403, other.text);assert.equal(other.json?.data, undefined);
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${f.site.siteId}'`);
    const revoked = await f.send();assert.equal(revoked.status, 403, revoked.text);assert.equal(revoked.json?.data, undefined);
});
test('a never-committed original selection for a removed collection is a definite no-effect rejection', async t => {
    const f = await fixture(t);await f.remove();const retained = f.state();
    for (let n = 0; n < 2; n++) {
        const rejected = await f.send();assert.equal(rejected.status, 404, rejected.text);
        assert.equal(rejected.json?.error.code, 'COLLECTION_MEMBERSHIP_NOT_FOUND');assert.equal(rejected.json?.data, undefined);
    }
    assert.equal(f.state(), retained);
    // An older HTTP acknowledgement is not proof of no effect. Keep that
    // legacy key uncertain even after its collection has been retired.
    owned.psql(`INSERT INTO idempotency_keys(site_id,key,scope,request_hash,status,response_body,status_code,expires_at)
      VALUES('${f.site.siteId}','${f.body.idempotency_key}','http:PUT:/products/collections/${f.collection}/products','synthetic-prior-http-digest','completed','{}'::jsonb,200,now()+interval '1 day')`);
    const legacy = await f.send();assert.equal(legacy.status, 409, legacy.text);
    assert.equal(legacy.json?.error.code, 'COLLECTION_MEMBERSHIP_LEGACY_KEY');assert.equal(legacy.json?.data, undefined);
});
