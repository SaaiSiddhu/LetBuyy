import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
// Actual owned Gateway/PostgREST/database controls. Synthetic signed identities
// qualify API behavior only; normal browser and native journeys are separate.
import assert from 'node:assert/strict';
import test, { before, after, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { withTenantTx } from '../../lib/tenant-transaction';

const owned = requireOwnedDatabase();
let ordinal = 0;
let proxy: OwnedPooledSqlProxy;
before(async () => { proxy = await startOwnedPooledSqlProxy(owned); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });
async function fixture(t: TestContext) {
    const site = newSyntheticTenant('smart-' + ++ordinal), actor = randomUUID(), collection = randomUUID();
    const email = `syn-smart-${actor}@example.invalid`;
    seedSyntheticTenant(owned.psql, site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
        INSERT INTO collections(id,store_id,title,slug,conditions,match_type,collection_type,is_active)VALUES('${collection}','${site.siteId}','Synthetic smart positive','syn-positive','[]','all','smart',false);`);
    const env = gatewayEnv(owned, await newIdentityKeys(), proxy.env());
    const gateway = new Gateway(env); t.after(() => gateway.settle());
    const headers = () => signedIdentityHeaders(actor, email, site.siteId);
    const list = async (query: Record<string, string> = {}) => gateway.request('/v1/smart-collections?' + new URLSearchParams({ store_id: site.siteId, ...query }), { headers: await headers() });
    const mutate = async (method: string, path: string, body: unknown) => gateway.request('/v1/smart-collections' + path, {
        method, headers: { ...await headers(), 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify(body),
    });
    return { site, actor, collection, gateway, env, headers, list, mutate };
}

test('smart collection pages are exact beyond1000 and empty later pages keep their population count', async t => {
    const f = await fixture(t), positive = await f.list(); assert.equal(positive.status, 200, positive.text);
    assert.equal(positive.json?.data[0].id, f.collection);
    owned.psql(`INSERT INTO collections(store_id,title,slug,conditions,created_at,collection_type,is_active)
        SELECT '${f.site.siteId}','Synthetic smart '||n,'syn-page-'||n,'[]','2026-11-01T00:00:00Z','smart',false FROM generate_series(1,1004)n;`);
    const page = await f.list({ page: '11', limit: '100' }); assert.equal(page.status, 200, page.text);
    assert.equal(page.json?.data.length, 5); assert.equal(page.json?.meta.total, 1005);
    assert.equal(page.json?.meta.total_is_exact, true); assert.equal(page.json?.meta.has_next, false);
    const empty = await f.list({ page: '12', limit: '100' }); assert.equal(empty.status, 200, empty.text);
    assert.deepEqual(empty.json?.data, []); assert.equal(empty.json?.meta.total, 1005);
    assert.equal(new Headers(page.headers).get('Cache-Control'), 'private, no-store');
});
test('smart collection query and rule inputs are validated before reads or writes', async t => {
    const f = await fixture(t); assert.equal((await f.list()).status, 200);
    for (const query of [{ page: '0' }, { limit: '101' }, { store_id: 'invalid-site' }] as Array<Record<string, string>>) {
        assert.equal((await f.list(query)).status, 400);
    }
    const before = owned.psql(`SELECT count(*)FROM collections WHERE store_id='${f.site.siteId}'`);
    const invalid = await f.mutate('POST', '', { store_id: f.site.siteId, name: 'Synthetic malformed rule', slug: 'syn-malformed', conditions: [{ field: '__proto__', op: 'execute', value: { private: true } }], match_type: 'all' });
    assert.equal(invalid.status, 400, invalid.text);
    assert.equal(owned.psql(`SELECT count(*)FROM collections WHERE store_id='${f.site.siteId}'`), before);
});
test('smart collection edits compare the observed version and preserve a newer rule document', async t => {
    const f = await fixture(t); const first = await f.mutate('PATCH', '/' + f.collection, { version: 1, name: 'Synthetic reviewed smart name' });
    assert.equal(first.status, 200, first.text); assert.equal(first.json?.data.version, 2);
    const stale = await f.mutate('PATCH', '/' + f.collection, { version: 1, name: 'Synthetic stale smart name' });
    assert.equal(stale.status, 409, stale.text);
    assert.equal(owned.psql(`SELECT title FROM collections WHERE id='${f.collection}'`), 'Synthetic reviewed smart name');
});
test('smart collection database failure is sanitized unavailable, not a raw error or empty success', async t => {
    const f = await fixture(t); assert.equal((await f.list()).status, 200);
    const signature = 'public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text)';
    owned.psql(`ALTER FUNCTION ${signature} RENAME TO synthetic_held_collection_page;`);
    try {
        const result = await f.list(); assert.equal(result.status, 503, result.text);
        assert.equal(result.json?.data, undefined); assert.doesNotMatch(result.text, /read_collection_metadata|42883|PostgreSQL|does not exist/);
    } finally { owned.psql('ALTER FUNCTION public.synthetic_held_collection_page(uuid,uuid,text,integer,integer,text)RENAME TO read_collection_metadata_page_v1'); }

});
test('a malformed smart collection projection cannot become current private rows', async t => {
    const f = await fixture(t); assert.equal((await f.list()).status, 200);
    const signature = 'public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text)';
    const original = owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure)`);
    const foreign = { success: true, data: [{ id: randomUUID(), store_id: randomUUID(), title: 'SYN_FOREIGN_SMART_PRIVATE' }], meta: {} };
    const body = 'BEGIN RETURN ' + "'" + JSON.stringify(foreign) + "'::jsonb; END;";
    assert.match(original, /AS \$function\$/);
    owned.script(original.replace(/AS \$function\$[\s\S]*?\$function\$/, 'AS $synthetic$' + body + '$synthetic$'));
    try {
        const result = await f.list(); assert.equal(result.status, 503, result.text);
        assert.equal(result.json?.data, undefined); assert.doesNotMatch(result.text, /SYN_FOREIGN_SMART_PRIVATE/);
    } finally { owned.script(original); }

});
test('bounded smart preview discloses its partial evaluation instead of claiming an exact zero match', async t => {
    const f = await fixture(t);
    const idPrefix = randomUUID().slice(0, 24);
    owned.psql(`UPDATE collections SET conditions='[{"field":"title","op":"contains","value":"last-match"}]'WHERE id='${f.collection}';
        INSERT INTO products(id,store_id,name,slug,price,stock,is_active,status)
        SELECT ('${idPrefix}'||lpad(n::text,12,'0'))::uuid,'${f.site.siteId}',CASE WHEN n=501 THEN 'Synthetic last-match'ELSE 'Synthetic sample '||n END,'syn-preview-'||n,1,1,true,'active'FROM generate_series(1,501)n;`);
    const result = await f.gateway.request('/v1/smart-collections/' + f.collection + '/preview?store_id=' + f.site.siteId, { headers: await f.headers() });
    assert.equal(result.status, 200, result.text); assert.equal(result.json?.data.evaluated_of, 500);
    assert.equal(result.json?.data.count, 0); assert.equal(result.json?.data.count_is_exact, false); assert.equal(result.json?.data.catalog_count, 501);
});
test('populated positive smart read does not grant access after owner revocation', async t => {
    const f = await fixture(t), positive = await f.list(); assert.equal(positive.status, 200); assert.equal(positive.json?.data[0].id, f.collection);
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${f.site.siteId}'`);
    const denied = await f.list(); assert.equal(denied.status, 403); assert.equal(denied.json?.data, undefined);
});

test('manual metadata uses the same receipt authority, preserves membership and recovers original outcomes after later edits/deletion', async t => {
    const f = await fixture(t), key = randomUUID();
    const send = async (method: string, path: string, body: Record<string, unknown>) => f.gateway.request('/v1/products/collections' + path, {
        method, headers: { ...await f.headers(), 'X-Store-ID': f.site.siteId, 'X-Idempotency-Key': String(body.idempotency_key) }, body: JSON.stringify(body),
    });
    const body = { store_id: f.site.siteId, idempotency_key: key, collection_type: 'manual', title: 'Synthetic command collection', description: null };
    const created = await send('POST', '', body); assert.equal(created.status, 201, created.text);
    const id = created.json?.data.id; assert.equal(created.json?.data.version, 1); assert.equal(created.json?.data.is_active, true);
    const repeated = await send('POST', '', body); assert.deepEqual(repeated.json?.data, created.json?.data);
    const list = await f.gateway.request('/v1/products/collections?store_id=' + f.site.siteId, { headers: await f.headers() });
    assert.equal(list.status, 200, list.text); assert.equal(list.json?.meta.total, 1); assert.equal(list.json?.data[0].id, id);
    assert.equal(list.json?.data[0].product_count, 0, 'A populated manual positive control is separate from the seeded smart parent.');
    const membership = await f.gateway.request(`/v1/products/collections/${id}/products?store_id=${f.site.siteId}`, { headers: await f.headers() });
    assert.equal(membership.status, 200, membership.text); assert.equal(membership.json?.data.membership_version, 1);
    const update = { store_id: f.site.siteId, idempotency_key: randomUUID(), collection_type: 'manual', version: 1, description: 'Synthetic newer manual details' };
    const updated = await send('PATCH', '/' + id, update); assert.equal(updated.status, 200, updated.text); assert.equal(updated.json?.data.version, 2);
    assert.deepEqual((await send('POST', '', body)).json?.data, created.json?.data);
    const stale = await send('PATCH', '/' + id, { ...update, idempotency_key: randomUUID(), title: 'Synthetic stale overwrite' });
    assert.equal(stale.status, 409, stale.text); assert.equal(stale.json?.error.code, 'COLLECTION_VERSION_CONFLICT');
    const remove = { store_id: f.site.siteId, idempotency_key: randomUUID(), collection_type: 'manual', version: 2 };
    const removed = await send('DELETE', '/' + id, remove); assert.equal(removed.status, 200, removed.text);
    assert.deepEqual((await send('PATCH', '/' + id, update)).json?.data, updated.json?.data);
    assert.deepEqual((await send('DELETE', '/' + id, remove)).json?.data, removed.json?.data);
    const current = await f.gateway.request(`/v1/products/collections/${id}?store_id=${f.site.siteId}`, { headers: await f.headers() });
    assert.equal(current.status, 404, current.text);
    assert.equal(owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${id}'`), '3');
    assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE event_type='collection.metadata.updated'AND aggregate_id='${id}'`), '3');
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${f.site.siteId}'`);
    const revoked = await send('POST', '', body); assert.equal(revoked.status, 403, revoked.text); assert.equal(revoked.json?.data, undefined);
});
test('metadata namespaces, selected stores and original keys are checked before effects', async t => {
    const f = await fixture(t), key = randomUUID();
    const send = async (path: string, body: Record<string, unknown>) => f.gateway.request('/v1/products/collections' + path, {
        method: path ? 'DELETE' : 'POST', headers: { ...await f.headers(), 'X-Store-ID': f.site.siteId, 'X-Idempotency-Key': key }, body: JSON.stringify(body),
    });
    const before = owned.psql(`SELECT to_jsonb(c)::text FROM collections c WHERE id='${f.collection}'`);
    const wrongKind = await send('/' + f.collection, { store_id: f.site.siteId, collection_type: 'manual', idempotency_key: key, version: 1 });
    assert.equal(wrongKind.status, 400, wrongKind.text);
    assert.equal(owned.psql(`SELECT to_jsonb(c)::text FROM collections c WHERE id='${f.collection}'`), before);
    const wrongStore = await send('', { store_id: randomUUID(), collection_type: 'manual', idempotency_key: key, title: 'Synthetic wrong store' });
    assert.equal(wrongStore.status, 403, wrongStore.text);
    const missing = await send('', { store_id: f.site.siteId, title: 'Synthetic old client no receipt' });
    assert.equal(missing.status, 400, missing.text);
    const body = { store_id: f.site.siteId, collection_type: 'manual', idempotency_key: key, title: 'Synthetic key binding' };
    const created = await send('', body); assert.equal(created.status, 201, created.text);
    const rebound = await send('', { ...body, title: 'Synthetic rebound' }); assert.equal(rebound.status, 409, rebound.text);
    assert.equal(rebound.json?.error.code, 'COLLECTION_KEY_CONFLICT');
});

for (const kind of ['manual', 'smart'] as const) {
    test(`${kind}: a deleted target gives a definite canonical rejection while committed original acknowledgements remain replayable`, async t => {
        const f = await fixture(t), prefix = kind === 'manual' ? '/v1/products/collections' : '/v1/smart-collections';
        const target = kind === 'smart' ? f.collection : randomUUID();
        if (kind === 'manual') owned.psql(`INSERT INTO collections(id,store_id,title,collection_type)VALUES('${target}','${f.site.siteId}','Synthetic removed manual','manual')`);
        const request = async (method: string, body: Record<string, unknown>, key: string) => f.gateway.request(prefix + '/' + target, {
            method, headers: { ...await f.headers(), 'X-Store-ID': f.site.siteId, 'X-Idempotency-Key': key }, body: JSON.stringify(body),
        });
        const originalKey = randomUUID(), deleteKey = randomUUID();
        const body = kind === 'manual'
            ? { store_id: f.site.siteId, collection_type: 'manual', idempotency_key: originalKey, version: 1, description: 'Synthetic committed details' }
            : { version: 1, description: 'Synthetic committed details' };
        const committed = await request('PATCH', body, originalKey); assert.equal(committed.status, 200, committed.text);
        const removed = await request('DELETE', kind === 'manual'
            ? { store_id: f.site.siteId, collection_type: 'manual', idempotency_key: deleteKey, version: 2 } : { version: 2 }, deleteKey);
        assert.equal(removed.status, 200, removed.text);
        const state = () => owned.psql(`SELECT jsonb_build_object('receipts',(SELECT jsonb_agg(to_jsonb(r)ORDER BY idempotency_key)FROM collection_metadata_receipts r WHERE collection_id='${target}'),
            'outbox',(SELECT count(*)FROM outbox_events WHERE event_type='collection.metadata.updated'AND aggregate_id='${target}'),
            'audit',(SELECT count(*)FROM audit_activity_events WHERE resource_type='collection_metadata'AND resource_id='${target}'))::text`);
        const retained = state();
        assert.deepEqual((await request('PATCH', body, originalKey)).json?.data, committed.json?.data);
        const absentKey = randomUUID(), absentBody = kind === 'manual' ? { ...body, idempotency_key: absentKey } : body;
        for (let n = 0; n < 2; n++) {
            const missing = await request('PATCH', absentBody, absentKey);
            assert.equal(missing.status, 404, missing.text); assert.equal(missing.json?.error.code, 'COLLECTION_NOT_FOUND');
            assert.equal(missing.json?.data, undefined);
        }
        assert.equal(state(), retained, 'Rechecking the rejected original request creates no receipt/audit/outbox effect.');
        owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${f.site.siteId}'`);
        const revoked = await request('PATCH', absentBody, absentKey); assert.equal(revoked.status, 403, revoked.text);
        assert.notEqual(revoked.json?.error.code, 'COLLECTION_NOT_FOUND', 'Missing-target recovery cannot reveal the result after authority is withdrawn.');
    });
}

test('current staff grants govern both collection kinds; downgrade and removal revoke original receipt replay at API and SQL boundaries', async t => {
    const f = await fixture(t), staff = randomUUID(), email = `syn-collection-staff-${staff}@example.invalid`;
    Object.assign(f.gateway.env, { MERCHANT_STAFF_RBAC_MODE: 'dryrun' }); // Newly opened paths must enforce regardless.
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${staff}','${email}',true)`);
    const provisioned = await f.gateway.request('/v1/employees', { method: 'POST',
        headers: { ...await f.headers(), 'X-Idempotency-Key': randomUUID() },
        body: JSON.stringify({ store_id: f.site.siteId, email, role: 'manager', permissions: { granted: ['products:read', 'products:write'] } }),
    });
    assert.equal(provisioned.status, 201, provisioned.text);
    // Internal identity assertions are one-use. Each transport attempt gets a
    // fresh assertion for the same stable subject, never a replayed auth JTI.
    const staffHeaders = () => signedIdentityHeaders(staff, email, f.site.siteId);
    const requests: { prefix: string; id: string; key: string; body: Record<string, unknown>; payload: Record<string, unknown> }[] = [];
    for (const kind of ['manual', 'smart'] as const) {
        const id = kind === 'smart' ? f.collection : randomUUID();
        if (kind === 'manual') owned.psql(`INSERT INTO collections(id,store_id,title,collection_type)VALUES('${id}','${f.site.siteId}','Synthetic staff manual','manual')`);
        const prefix = kind === 'manual' ? '/v1/products/collections' : '/v1/smart-collections', key = randomUUID();
        const body = kind === 'manual'
            ? { store_id: f.site.siteId, idempotency_key: key, collection_type: kind, version: 1, description: 'Synthetic staff details' }
            : { version: 1, description: 'Synthetic staff details' };
        const send = async () => f.gateway.request(prefix + '/' + id, { method: 'PATCH', headers: { ...await staffHeaders(), 'X-Idempotency-Key': key }, body: JSON.stringify(body) });
        const read = await f.gateway.request(prefix + '/' + id + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });assert.equal(read.status, 200, read.text);
        const updated = await send();assert.equal(updated.status, 200, updated.text);assert.equal(updated.json?.data.version, 2);
        requests.push({ prefix, id, key, body, payload: { collection_type: kind, description: 'Synthetic staff details' } });
        const page = await f.gateway.request(prefix + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });assert.equal(page.status, 200, page.text);
        assert.equal(page.json?.data[0].id, id, 'A permitted staff member reaches the normal populated collection list.');
    }
    const count = () => owned.psql(`SELECT jsonb_build_object('receipts',(SELECT count(*)FROM collection_metadata_receipts WHERE store_id='${f.site.siteId}'),
        'audits',(SELECT count(*)FROM audit_activity_events WHERE store_id='${f.site.siteId}'AND resource_type='collection_metadata'),
        'outbox',(SELECT count(*)FROM outbox_events WHERE site_id='${f.site.siteId}'AND event_type='collection.metadata.updated'))::text`);
    const before = count();assert.equal(JSON.parse(before).receipts, 2);
    const downgraded = await f.gateway.request('/v1/employees/' + provisioned.json?.data.id, { method: 'PATCH',
        headers: { ...await f.headers(), 'X-Idempotency-Key': randomUUID() },
        body: JSON.stringify({ role: 'viewer', expected_updated_at: provisioned.json?.data.updated_at }),
    });assert.equal(downgraded.status, 200, downgraded.text);
    for (const request of requests) {
        const read = await f.gateway.request(request.prefix + '/' + request.id + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });assert.equal(read.status, 200, read.text);
        const replay = await f.gateway.request(request.prefix + '/' + request.id, { method: 'PATCH', headers: { ...await staffHeaders(), 'X-Idempotency-Key': request.key }, body: JSON.stringify(request.body) });
        assert.equal(replay.status, 403, replay.text);assert.equal(replay.json?.data, undefined);
        const page = await f.gateway.request(request.prefix + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });assert.equal(page.status, 200, page.text);
        await assert.rejects(withTenantTx(f.env, { siteId: f.site.siteId, requestId: 'synthetic-withdrawn-collection-' + request.key }, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)', ['app.actor_id', staff, 'request.jwt.claim.sub', staff]);
            return sql.unsafe('SELECT public.apply_collection_metadata_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::integer,$6::uuid,$7::text::jsonb)',
                [f.site.siteId, staff, 'update', request.id, 1, request.key, JSON.stringify(request.payload)]);
        }), /FORBIDDEN|permission denied/i, 'The transaction must refuse withdrawn grants before returning an existing receipt.');
    }
    const removed = await f.gateway.request('/v1/employees/' + provisioned.json?.data.id, { method: 'DELETE',
        headers: { ...await f.headers(), 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify({ expected_updated_at: downgraded.json?.data.updated_at }),
    });assert.equal(removed.status, 200, removed.text);
    for (const request of requests) {
        const denied = await f.gateway.request(request.prefix + '/' + request.id + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });
        assert.equal(denied.status, 403, denied.text);assert.equal(denied.json?.data, undefined);assert.doesNotMatch(denied.text, /Synthetic staff details/);
        const page = await f.gateway.request(request.prefix + '?store_id=' + f.site.siteId, { headers: await staffHeaders() });assert.equal(page.status, 403, page.text);assert.equal(page.json?.data, undefined);
    }
    assert.equal(count(), before, 'Withdrawn access creates no collection receipt, audit or outbox effect.');
});
