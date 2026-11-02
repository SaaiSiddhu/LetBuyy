// Real worker, authenticated owner, owned PostgreSQL/PostgREST. No hosted data.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const a = newSyntheticTenant('mobile-customers-a'), b = newSyntheticTenant('mobile-customers-b');
const c = newSyntheticTenant('mobile-customers-c');
const actor = crypto.randomUUID(), email = `syn-mobile-${actor}@example.invalid`;
let gateway: Gateway;

before(async () => {
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b); seedSyntheticTenant(owned.psql, c);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}' WHERE id IN ('${a.siteId}','${c.siteId}');
        INSERT INTO store_customers(store_id,email,full_name,status,total_orders,total_spent,accepts_marketing,tags,last_order_at) VALUES
        ('${a.siteId}','syn-threshold@example.invalid','Synthetic threshold','active',2,150.75,false,ARRAY['vip'],'2026-10-15T10:00:00Z'),
        ('${a.siteId}','syn-below@example.invalid','Synthetic below','active',2,150.74,false,ARRAY['vip'],'2026-10-15T10:00:00Z'),
        ('${a.siteId}','syn-disabled@example.invalid','Synthetic disabled','disabled',4,700,false,ARRAY['vip'],'2026-10-15T10:00:00Z'),
        ('${b.siteId}','syn-foreign@example.invalid','Synthetic foreign','active',2,150.75,false,ARRAY['vip'],'2026-10-15T10:00:00Z');`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
after(async () => { await gateway?.settle(); });

async function headers(siteId = a.siteId, key?: string) {
    return { ...await signedIdentityHeaders(actor, email, siteId), 'X-Store-ID': siteId, ...(key ? { 'X-Idempotency-Key': key } : {}) };
}

test('owner customer cursor pages and server search stay in the selected site', async () => {
    const first = await gateway.request(`/v1/customers?store_id=${a.siteId}&limit=1`, { headers: await headers() });
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json?.data.length, 1);
    const cursor = first.json?.meta.next_cursor;
    assert.ok(cursor);
    const second = await gateway.request(`/v1/customers?store_id=${a.siteId}&limit=1&cursor=${encodeURIComponent(cursor)}`, { headers: await headers() });
    assert.equal(second.status, 200, second.text);
    assert.notEqual(second.json?.data[0].email, first.json?.data[0].email);
    const searched = await gateway.request(`/v1/customers?store_id=${a.siteId}&search=threshold`, { headers: await headers() });
    assert.equal(searched.status, 200, searched.text);
    assert.deepEqual(searched.json?.data.map((row: { email: string }) => row.email), ['syn-threshold@example.invalid']);
    assert.equal(searched.json?.data[0].store_id, a.siteId);
    const denied = await gateway.request(`/v1/customers?store_id=${b.siteId}`, { headers: await headers(b.siteId) });
    assert.ok([403, 404].includes(denied.status), denied.text);
    assert.doesNotMatch(denied.text, /syn-foreign/);
});

test('preview, create, replay, edit and readback share rupee thresholds, consent, tags and dates', async () => {
    const rules = { status: 'active', accepts_marketing: false, tags_any: ['vip'], min_order_count: 2, min_total_spent: 150.75, last_order_after: '2026-10-01T00:00:00.000Z', last_order_before: '2026-10-30T23:59:59.999Z' };
    const preview = await gateway.request('/v1/customers/segments/preview', { method: 'POST', headers: await headers(a.siteId, 'synthetic-mobile-segment-preview'), body: JSON.stringify({ store_id: a.siteId, rules }) });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.json?.data.customer_count, 1);
    assert.equal(preview.json?.data.sample_customers[0].email, 'syn-threshold@example.invalid');
    const body = JSON.stringify({ store_id: a.siteId, name: 'Synthetic saved segment', description: 'Exact scope', rules });
    // Fresh signed request credentials, one logical command key.
    const first = await gateway.request('/v1/customers/segments', { method: 'POST', headers: await headers(a.siteId, 'synthetic-mobile-segment-create'), body });
    assert.equal(first.status, 201, first.text);
    const replay = await gateway.request('/v1/customers/segments', { method: 'POST', headers: await headers(a.siteId, 'synthetic-mobile-segment-create'), body });
    assert.equal(replay.status, 201, replay.text);
    assert.equal(replay.json?.data.id, first.json?.data.id);
    const id = first.json?.data.id as string;
    assert.equal(owned.psql(`SELECT count(*) FROM customer_segments WHERE store_id='${a.siteId}' AND name='Synthetic saved segment';`), '1');
    const changed = { ...rules, status: 'disabled', min_total_spent: 500 };
    const update = await gateway.request(`/v1/customers/segments/${id}`, { method: 'PATCH', headers: await headers(a.siteId, 'synthetic-mobile-segment-edit'), body: JSON.stringify({ name: 'Synthetic edited segment', description: null, rules: changed }) });
    assert.equal(update.status, 200, update.text);
    const list = await gateway.request(`/v1/customers/segments?store_id=${a.siteId}`, { headers: await headers() });
    assert.equal(list.status, 200, list.text);
    const saved = list.json?.data.find((row: { id: string }) => row.id === id);
    assert.equal(saved.name, 'Synthetic edited segment');
    assert.equal(saved.description, null);
    assert.deepEqual(saved.rules, changed);
    assert.equal(saved.customer_count, 1);
    const members = await gateway.request(`/v1/customers/segments/${id}/customers?store_id=${a.siteId}&page=1&limit=1`, { headers: await headers() });
    assert.equal(members.status, 200, members.text);
    assert.equal(members.json?.data[0].email, 'syn-disabled@example.invalid');
    const before = owned.psql(`SELECT to_jsonb(s)::text FROM customer_segments s WHERE id='${id}';`);
    const denied = await gateway.request(`/v1/customers/segments/${id}`, { method: 'PATCH', headers: await headers(b.siteId, 'synthetic-mobile-segment-foreign'), body: JSON.stringify({ name: 'Wrong site' }) });
    assert.ok([403, 404].includes(denied.status), denied.text);
    assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM customer_segments s WHERE id='${id}';`), before);
});

test('segment read failures remain unavailable and unsupported status is rejected', async () => {
    const invalid = await gateway.request('/v1/customers/segments/preview', { method: 'POST', headers: await headers(a.siteId, 'synthetic-mobile-segment-invalid'), body: JSON.stringify({ store_id: a.siteId, rules: { status: 'blocked' } }) });
    assert.equal(invalid.status, 400, invalid.text);
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'customer_segments' && call.method === 'GET'
        ? Response.json({ code: 'XX000', message: 'synthetic private query diagnostic' }, { status: 500 }) : forward());
    try {
        const response = await gateway.request(`/v1/customers/segments?store_id=${a.siteId}`, { headers: await headers() });
        assert.equal(response.status, 500, response.text);
        assert.doesNotMatch(response.text, /synthetic private query diagnostic|XX000/);
        assert.equal(response.json?.data, undefined);
    } finally { tap.restore(); }
});

test('one owner with two stores cannot edit another store segment through the selected store', async () => {
    const id = crypto.randomUUID();
    owned.psql(`INSERT INTO customer_segments(id,store_id,name,rules) VALUES('${id}','${c.siteId}','Synthetic other store','{"tags_any":[]}'::jsonb);`);
    const denied = await gateway.request(`/v1/customers/segments/${id}`, { method: 'PATCH', headers: await headers(a.siteId, 'synthetic-other-owned-denied'), body: JSON.stringify({ name: 'Wrong store edit' }) });
    assert.equal(denied.status, 404, denied.text);
    assert.equal(owned.psql(`SELECT name FROM customer_segments WHERE id='${id}';`), 'Synthetic other store');
    const allowed = await gateway.request(`/v1/customers/segments/${id}`, { method: 'PATCH', headers: await headers(c.siteId, 'synthetic-other-owned-allowed'), body: JSON.stringify({ name: 'Correct store edit' }) });
    assert.equal(allowed.status, 200, allowed.text);
    assert.equal(owned.psql(`SELECT name FROM customer_segments WHERE id='${id}';`), 'Correct store edit');
    const scoped = (siteId: string) => owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${siteId}',true);SELECT 'segment-count='||count(*) FROM customer_segments WHERE id='${id}';ROLLBACK;`);
    assert.match(scoped(c.siteId), /segment-count=1/, 'positive control: the selected tenant sees its real row');
    assert.match(scoped(a.siteId), /segment-count=0/, 'another owned store remains a different RLS tenant');
});
