// Owner-approved source/local convergence. Real roles, constraints and SQL;
// independent legacy evaluator is a conformance oracle, not a second live writer.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type CollectionMetadataReceipt, type CollectionMetadata } from '@letbuyy/shared-types';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { withTenantTx } from '../../lib/tenant-transaction';
import { evaluateCondition, type SmartCondition, type EvalProduct } from '../../lib/smart-collection-eval';
import { gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const migration = (dir: string, name: string) => readFileSync(new URL(`../../../../../database/supabase/${dir}/${name}`, import.meta.url), 'utf8');
const up = migration('migrations', '435_unified_collection_authority.sql');
const down = migration('rollback', '435_unified_collection_authority.rollback.sql');
const q = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
const j = (value: unknown) => q(JSON.stringify(value)) + '::jsonb';
const tenant = newSyntheticTenant('unified-collections'), foreign = newSyntheticTenant('unified-foreign');
const actor = randomUUID(), outsider = randomUUID(), legacyId = randomUUID();
let proxy: OwnedPooledSqlProxy;
let env: ReturnType<typeof gatewayEnv>;
let legacyBefore: string;

function existingProfiles() {
    return owned.psql("SELECT jsonb_agg(jsonb_build_array(proname,pg_get_functiondef(oid),proowner,proacl::text)ORDER BY proname)::text FROM pg_proc WHERE oid IN('public.browse_storefront_products_v1(uuid,jsonb,uuid[])'::regprocedure,'public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure,'public.guard_collection_membership_junction_v1()'::regprocedure)");
}
before(async () => {
    const expected = existingProfiles();
    for (let cycle = 0; cycle < 2; cycle++) {
        owned.script(down);
        assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='435'"), '0');
        assert.equal(owned.psql("SELECT count(*)FROM information_schema.columns WHERE table_schema='public'AND table_name='collections'AND column_name='collection_type'"), '0');
        owned.script(up);
        assert.equal(existingProfiles(), expected, 'Paired empty retirement/reapply preserves every replaced function identity, body, owner and ACL.');
    }
    for (const drift of [
        'GRANT EXECUTE ON FUNCTION public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)TO authenticated;',
        'ALTER TABLE public.collection_metadata_receipts ADD COLUMN synthetic_drift text;',
        'GRANT INSERT ON public.collections TO service_role;',
        'ALTER TABLE public.audit_activity_events DISABLE TRIGGER audit_collection_metadata_immutable;',
    ]) {
        assert.match(owned.psqlScriptExpectError('BEGIN;' + drift + down), /rollback435 refuses changed/);
        assert.equal(existingProfiles(), expected);
    }
    owned.script(down);
    seedSyntheticTenant(owned.psql, tenant); seedSyntheticTenant(owned.psql, foreign);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-unified-${actor}@example.invalid',true),('${outsider}','syn-unified-${outsider}@example.invalid',true);
        UPDATE sites SET custom_user_id='${actor}'WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${outsider}'WHERE id='${foreign.siteId}';
        INSERT INTO smart_collections(id,store_id,name,slug,description,conditions,match_type,version,created_at,created_by,updated_by)
        VALUES('${legacyId}','${tenant.siteId}','Synthetic retained தமிழ்','synthetic-retained','Exact retained description',
        '[{"field":"title","op":"contains","value":" cotton "}]','any',3,NULL,'${actor}','${actor}');`);
    legacyBefore = owned.psql(`SELECT to_jsonb(s)::text FROM smart_collections s WHERE id='${legacyId}'`);
    owned.script(up);
    proxy = await startOwnedPooledSqlProxy(owned);
    env = gatewayEnv(owned, await newIdentityKeys(), proxy.env());
});
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

async function call(sql: string, params: (string | number | null)[], selected = tenant.siteId, who = actor) {
    return withTenantTx(env, { siteId: selected, requestId: randomUUID() }, async tx => {
        await tx.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)', ['app.actor_id', who, 'request.jwt.claim.sub', who]);
        const rows = await tx.unsafe(sql, params); return rows[0]?.result;
    });
}
async function command(operation: 'create' | 'update' | 'delete', payload: Record<string, unknown>, target: string | null = null, version: number | null = null, key = randomUUID()) {
    return call('SELECT public.apply_collection_metadata_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::integer,$6::uuid,$7::text::jsonb)AS result',
        [tenant.siteId, actor, operation, target, version, key, JSON.stringify(payload)]) as Promise<CollectionMetadataReceipt>;
}
const read = (id: string) => call('SELECT public.read_collection_metadata_v1($1::uuid,$2::uuid,$3::uuid)AS result', [tenant.siteId, actor, id]) as Promise<CollectionMetadata>;
const state = () => owned.psql(`SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(to_jsonb(c)ORDER BY id)FROM collections c WHERE store_id='${tenant.siteId}'),
 'receipts',(SELECT jsonb_agg(to_jsonb(r)ORDER BY id)FROM collection_metadata_receipts r WHERE store_id='${tenant.siteId}'),
 'audit',(SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM audit_activity_events a WHERE store_id='${tenant.siteId}'),
 'outbox',(SELECT jsonb_agg(to_jsonb(o)ORDER BY id)FROM outbox_events o WHERE store_id='${tenant.siteId}'))::text`);

test('retained smart identity, slug, rules, revision, unknown creation time and source bytes are preserved without publication', async () => {
    const value = await read(legacyId);
    assert.equal(value.id, legacyId); assert.equal(value.collection_type, 'smart');
    assert.equal(value.title, 'Synthetic retained தமிழ்'); assert.equal(value.slug, 'synthetic-retained');
    assert.equal(value.description, 'Exact retained description'); assert.equal(value.created_at, null);
    assert.equal(value.updated_at, null); assert.equal(value.version, 3); assert.equal(value.match_type, 'any');
    assert.equal(value.is_active, false);
    assert.deepEqual(value.conditions, [{ field: 'title', op: 'contains', value: ' cotton ' }]);
    assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM smart_collections s WHERE id='${legacyId}'`), legacyBefore);
    assert.match(owned.psqlScriptExpectError(`UPDATE smart_collections SET name='Forbidden legacy write'WHERE id='${legacyId}'`), /LEGACY_SMART_COLLECTIONS_READ_ONLY/);
});

test('one database evaluator preserves all existing field/operator semantics against an independent oracle', () => {
    const products: EvalProduct[] = [
        { id: randomUUID(), name: ' Synthetic Cotton ', product_type: '42', vendor: 'Synthetic VENDOR', tags: [' Sale ', '', 'தமிழ்'], price: '100.00', stock: 5 },
        { id: randomUUID(), name: '\u00a0தமிழ்\u00a0', product_type: null, vendor: '', tags: [], price: 0, stock: 0 },
        { id: randomUUID(), name: 'İSTANBUL ΣΟΣ ΟΣ ΟΣΑ', product_type: 'İ', vendor: 'ΟΣ', tags: ['İ', 'ΟΣ'], price: 'Infinity', stock: 0 },
    ];
    const fields: SmartCondition['field'][] = ['title', 'product_type', 'vendor', 'tag', 'price', 'inventory_quantity'];
    const ops: SmartCondition['op'][] = ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'gt', 'lt'];
    const values = ['cotton', 'SALE', '', '0', '-0', '5', '0x10', '1e3', 'bad-number', '\u00a0தமிழ்\u00a0', 'i\u0307', 'istanbul', 'οσ', 'ος', 'Infinity', '1e999'];
    const cases = products.flatMap(product => fields.flatMap(field => ops.flatMap(op => values.map(value => ({ product, condition: { field, op, value } })))));
    const actual = JSON.parse(owned.script(`SELECT jsonb_agg(public.collection_rule_matches_v1(v->'product',v->'condition')ORDER BY n)FROM jsonb_array_elements(${j(cases)})WITH ORDINALITY e(v,n)`));
    const mismatches = cases.flatMap((c, index) => actual[index] === evaluateCondition(c.product, c.condition) ? [] : [{ ...c, sql: actual[index], expected: evaluateCondition(c.product, c.condition) }]);
    assert.deepEqual(mismatches, [], 'No silently changed rule meaning is accepted by the SQL cutover.');
});

test('metadata change, original-key acknowledgement, audit and outbox commit once with exact identity', async () => {
    const key = randomUUID(), fields = { title: 'Synthetic smart metadata', slug: 'synthetic-smart-metadata', collection_type: 'smart', conditions: [{ field: 'title', op: 'contains', value: 'cotton' }], match_type: 'all' };
    const created = await command('create', fields, null, null, key);
    assert.equal(typeof created.id, 'string'); assert.equal(created.version, 1); assert.equal(created.idempotency_key, key);
    assert.equal(created.actor_id, actor); assert.deepEqual(created.request, fields); assert.equal(created.is_active, false);
    const before = state(), repeated = await command('create', fields, null, null, key);
    assert.deepEqual(repeated, created); assert.equal(state(), before);
    assert.equal(owned.psql(`SELECT count(*)FROM audit_activity_events WHERE resource_type='collection_metadata'AND resource_id='${created.id}'`), '1');
    assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE event_type='collection.metadata.updated'AND aggregate_id='${created.id}'`), '1');
    await assert.rejects(command('create', { ...fields, title: 'Synthetic rebound' }, null, null, key), /COLLECTION_METADATA_KEY_CONFLICT/);
    assert.equal(state(), before);
    const updated = await command('update', { description: 'Synthetic newer details' }, created.id, 1);
    assert.equal(updated.version, 2);
    assert.deepEqual(await command('create', fields, null, null, key), created, 'Exact recovery returns its original receipt after a newer edit.');
});

test('an update with only immutable collection type cannot create a revision, receipt or event', async () => {
    const created = await command('create', { collection_type: 'manual', title: 'Synthetic no-op guard' });
    const before = state();
    await assert.rejects(command('update', { collection_type: 'manual' }, created.id, 1), /COLLECTION_METADATA_INVALID/);
    assert.equal(state(), before);
});

test('concurrent same-version metadata edits admit one real effect and retain the newer document', async () => {
    const created = await command('create', { title: 'Synthetic concurrent manual', collection_type: 'manual' });
    const results = await Promise.allSettled([
        command('update', { title: 'Synthetic editor A' }, created.id, 1),
        command('update', { title: 'Synthetic editor B' }, created.id, 1),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const refused = results.find(r => r.status === 'rejected'); assert(refused?.status === 'rejected');
    assert.match(String(refused.reason), /COLLECTION_METADATA_VERSION_CONFLICT/);
    assert.equal((await read(created.id)).version, 2);
    assert.equal(owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${created.id}'`), '2');
});

test('populated owner positive controls precede forged store, actor, raw-role and revocation refusals', async () => {
    const positive = await read(legacyId); assert.equal(positive.store_id, tenant.siteId);
    const before = state();
    await assert.rejects(call('SELECT public.read_collection_metadata_v1($1::uuid,$2::uuid,$3::uuid)AS result', [foreign.siteId, actor, legacyId]), /COLLECTION_METADATA_FORBIDDEN/);
    await assert.rejects(call('SELECT public.read_collection_metadata_v1($1::uuid,$2::uuid,$3::uuid)AS result', [tenant.siteId, outsider, legacyId]), /COLLECTION_METADATA_FORBIDDEN/);
    for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) {
        assert.equal(owned.psql(`SELECT has_table_privilege('${role}','collection_metadata_receipts','SELECT')`), 'f');
        assert.equal(owned.psql(`SELECT has_table_privilege('${role}','collections','INSERT')`), 'f');
    }
    owned.psql(`UPDATE sites SET custom_user_id=NULL WHERE id='${tenant.siteId}'`);
    try { await assert.rejects(read(legacyId), /COLLECTION_METADATA_FORBIDDEN/); }
    finally { owned.psql(`UPDATE sites SET custom_user_id='${actor}'WHERE id='${tenant.siteId}'`); }
    assert.equal(state(), before);
});

test('a mandatory audit fault rolls back metadata, receipt and outbox; the original request then succeeds once', async () => {
    const before = state(), key = randomUUID(), payload = { title: 'Synthetic atomic failure', collection_type: 'manual' };
    owned.psql(`CREATE FUNCTION public.synthetic_collection_audit_fault()RETURNS trigger LANGUAGE plpgsql AS $f$BEGIN
        IF NEW.resource_type='collection_metadata'THEN RAISE EXCEPTION 'SYN_COLLECTION_AUDIT_FAULT';END IF;RETURN NEW;END$f$;
        CREATE TRIGGER synthetic_collection_audit_fault BEFORE INSERT ON audit_activity_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_collection_audit_fault();`);
    try { await assert.rejects(command('create', payload, null, null, key), /SYN_COLLECTION_AUDIT_FAULT/); assert.equal(state(), before); }
    finally { owned.psql('DROP TRIGGER synthetic_collection_audit_fault ON audit_activity_events;DROP FUNCTION public.synthetic_collection_audit_fault();'); }
    const saved = await command('create', payload, null, null, key), committed = state();
    assert.deepEqual(await command('create', payload, null, null, key), saved); assert.equal(state(), committed);
});

test('actual public discovery computes smart membership before counts/page selection beyond1000 and refuses manual membership edits', async () => {
    const created = await command('create', { title: 'Synthetic public smart', slug: 'synthetic-public-smart', collection_type: 'smart', is_active: true,
        conditions: [{ field: 'title', op: 'starts_with', value: 'Synthetic matching cotton' }], match_type: 'all' });
    owned.psql(`INSERT INTO products(store_id,name,price,stock,is_active)SELECT '${tenant.siteId}','Synthetic matching cotton '||n,10,5,true FROM generate_series(1,1005)n;
        INSERT INTO products(store_id,name,price,stock,is_active)VALUES('${tenant.siteId}','Synthetic matching cotton hidden',10,5,false),('${foreign.siteId}','Synthetic matching cotton foreign',10,5,true);`);
    const browse = (page: number) => JSON.parse(owned.psql(`SELECT public.browse_storefront_products_v1('${tenant.siteId}',${j({ page, limit: 20, collection_id: created.id })},NULL)`));
    const first = browse(1), last = browse(51), empty = browse(52);
    assert.equal(first.count, 1005); assert.equal(first.data.length, 20);
    assert.equal(last.count, 1005); assert.equal(last.data.length, 5);
    assert.equal(empty.count, 1005); assert.deepEqual(empty.data, []);
    assert.ok(last.data.every((p: Record<string, unknown>) => p.store_id === tenant.siteId));
    await assert.rejects(call('SELECT public.apply_collection_membership_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb)AS result', [tenant.siteId, created.id, actor, 1, randomUUID(), '[]']), /COLLECTION_MEMBERSHIP_MANUAL_ONLY/);
    const preview = await call('SELECT public.preview_collection_rules_v1($1::uuid,$2::uuid,$3::uuid)AS result', [tenant.siteId, actor, created.id]) as Record<string, unknown>;
    assert.equal(preview.catalog_count, 1005); assert.equal(preview.evaluated_of, 500); assert.equal(preview.count_is_exact, false);
});

test('collection kind is checked before deletion and the original delete acknowledgement survives its soft-deleted target', async () => {
    const manual = await command('create', { title: 'Synthetic protected manual', collection_type: 'manual' });
    const before = state();
    await assert.rejects(command('delete', { collection_type: 'smart' }, manual.id, 1), /COLLECTION_METADATA_KIND_IMMUTABLE/);
    assert.equal(state(), before, 'A smart-namespace request must not delete a manual collection before refusing.');
    const key = randomUUID(), deleted = await command('delete', { collection_type: 'manual' }, manual.id, 1, key);
    assert.equal(deleted.is_active, false); assert.equal(typeof deleted.deleted_at, 'string'); assert.equal(deleted.version, 2);
    const committed = state();
    assert.deepEqual(await command('delete', { collection_type: 'manual' }, manual.id, 1, key), deleted);
    assert.equal(state(), committed, 'Original deletion receipt is recovered without a live-record GET or a new effect.');
});

test('private receipts and mandatory audit history are immutable and retained cutover refuses destructive DOWN', async () => {
    const before = state(), profiles = existingProfiles();
    assert.match(owned.psqlScriptExpectError(`UPDATE collection_metadata_receipts SET response='{}'::jsonb`), /COLLECTION_RECEIPTS_RETAINED/);
    assert.match(owned.psqlScriptExpectError(`DELETE FROM audit_activity_events WHERE resource_type='collection_metadata'`), /COLLECTION_METADATA_AUDIT_RETAINED/);
    assert.match(owned.psqlScriptExpectError(down), /rollback435 refuses retained collection metadata history/);
    assert.equal(existingProfiles(), profiles); assert.equal(state(), before);
});
