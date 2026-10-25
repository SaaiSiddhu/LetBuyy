// Real worker + owned PostgREST: mobile screen reads, actual schema and
// application tenant fencing. This is not a claim of service-role RLS proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';

const owned = requireOwnedDatabase();
const a = newSyntheticTenant('mobile-read-a');
const b = newSyntheticTenant('mobile-read-b');
const ownerA = randomUUID(), ownerB = randomUUID();
const emailA = `syn-${ownerA}@example.invalid`, emailB = `syn-${ownerB}@example.invalid`;
const zoneA = randomUUID(), zoneB = randomUUID(), rateA = randomUUID(), rateB = randomUUID();
let gateway: Gateway;
before(async () => {
    seedSyntheticTenant(owned.psql, a);
    seedSyntheticTenant(owned.psql, b);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES
      ('${ownerA}','${emailA}',true),('${ownerB}','${emailB}',true);
      UPDATE sites SET custom_user_id='${ownerA}' WHERE id='${a.siteId}';
      UPDATE sites SET custom_user_id='${ownerB}' WHERE id='${b.siteId}';
      INSERT INTO shipping_zones(id,store_id,site_id,name,countries) VALUES
        ('${zoneA}','${a.siteId}','${a.siteId}','Synthetic A',ARRAY['IN']),
        ('${zoneB}','${b.siteId}','${b.siteId}','Synthetic B',ARRAY['IN']);
      INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price) VALUES
        ('${rateA}','${zoneA}','${a.siteId}','Synthetic A rate','flat',50),
        ('${rateB}','${zoneB}','${b.siteId}','Synthetic B rate','flat',99);
      INSERT INTO ai_credits(store_id,plan_credits,bonus_credits,total_purchased,last_reset_at)
        VALUES('${a.siteId}',75,5,0,'2026-10-01T00:00:00Z');`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
const get = async (path: string, owner = ownerA, email = emailA) =>
    gateway.request(path, { headers: await signedIdentityHeaders(owner, email) });

test('shipping screen lists its real rates and denies a different store owner', async () => {
    const response = await get(`/v1/shipping-tax/shipping?store_id=${a.siteId}`);
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.json?.data.map((row: { id: string }) => row.id), [rateA]);
    assert.equal(response.json?.data[0].price, 50);
    const other = await get(`/v1/shipping-tax/shipping?store_id=${b.siteId}`, ownerB, emailB);
    assert.equal(other.status, 200, other.text);
    assert.deepEqual(other.json?.data.map((row: { id: string }) => row.id), [rateB]);
    assert.equal((await get(`/v1/shipping-tax/shipping?store_id=${b.siteId}`)).status, 403);
    assert.equal((await get('/v1/shipping-tax/shipping')).status, 400);
    assert.equal((await gateway.request(`/v1/shipping-tax/shipping?store_id=${a.siteId}`)).status, 401);
});

test('AI Studio reads actual credit columns and keeps another store private', async () => {
    const response = await get(`/v1/ai/credits?store_id=${a.siteId}`);
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.data.plan_credits, 75);
    assert.equal(response.json?.data.bonus_credits, 5);
    assert.equal(response.json?.data.balance, 80);
    assert.match(response.json?.data.last_reset_at, /^2026-10-01/);
    assert.equal((await get(`/v1/ai/credits?store_id=${a.siteId}`, ownerB, emailB)).status, 403);
    assert.equal((await get('/v1/ai/credits')).status, 400);
});


test('shipping settings create, update and delete through the scoped worker; forged selections fail', async () => {
    const mutate = async (path: string, method: string, body?: Record<string, unknown>, storeId = a.siteId) =>
        gateway.request(path, { method, headers: {
            ...await signedIdentityHeaders(ownerA, emailA),
            'X-Store-ID': storeId, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
        }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const zone = await mutate('/v1/shipping-tax/shipping/zones', 'POST', {
        store_id: a.siteId, name: 'Synthetic device zone', countries: ['IN'],
    });
    assert.equal(zone.status, 201, zone.text);
    assert.equal(zone.json?.data.site_id, a.siteId);
    const rate = await mutate('/v1/shipping-tax/shipping', 'POST', {
        zone_id: zone.json?.data.id, name: 'Synthetic device rate', type: 'flat', price: 49,
    });
    assert.equal(rate.status, 201, rate.text);
    assert.equal(rate.json?.data.site_id, a.siteId);
    const rateId = rate.json?.data.id;
    const changed = await mutate(`/v1/shipping-tax/shipping/${rateId}`, 'PATCH', { price: 59 });
    assert.equal(changed.status, 200, changed.text);
    assert.equal(changed.json?.data.price, 59);
    const denied = await mutate('/v1/shipping-tax/shipping', 'POST', {
        zone_id: zoneB, name: 'Must not be created', type: 'flat', price: 1,
    });
    assert.equal(denied.status, 403, denied.text);
    assert.equal((await mutate(`/v1/shipping-tax/shipping/${rateB}`, 'PATCH', { price: 1 })).status, 403);
    assert.equal((await mutate(`/v1/shipping-tax/shipping/${rateB}`, 'DELETE')).status, 403);
    assert.equal((await mutate(`/v1/shipping-tax/shipping/${rateId}`, 'PATCH', { price: 1 }, b.siteId)).status, 403);
    assert.equal((await mutate(`/v1/shipping-tax/shipping/${rateId}`, 'PATCH', { price: 1 }, 'invalid')).status, 400);
    const removed = await mutate(`/v1/shipping-tax/shipping/${rateId}`, 'DELETE');
    assert.equal(removed.status, 200, removed.text);
    const zoneChanged = await mutate(`/v1/shipping-tax/shipping/zones/${zone.json?.data.id}`, 'PATCH', { name: 'Synthetic changed zone' });
    assert.equal(zoneChanged.status, 200, zoneChanged.text);
    assert.equal((await mutate(`/v1/shipping-tax/shipping/zones/${zone.json?.data.id}`, 'DELETE')).status, 200);
    assert.equal(owned.psql(`SELECT price FROM shipping_rates WHERE id='${rateB}'`), '99.00');
});
