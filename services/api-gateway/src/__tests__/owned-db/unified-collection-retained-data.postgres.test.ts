// Populated synthetic cutover, never a production export/backup or provider
// acceptance. The pre435 logical shape comes from the actual empty paired DOWN
// on the canonical owned template, not a claim of pristine historical slots.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLetbuyyInternalAppHeaders } from '@letbuyy/auth-core';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, mintSession, INTERNAL_SECRET, MERCHANT_SESSION_AUDIENCE } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';
import { withTenantTx } from '../../lib/tenant-transaction';
import { TENANT_TABLES } from '../../tenant/tenant-tables.registry';

const owned = requireOwnedDatabase();
const up = readFileSync('database/supabase/migrations/435_unified_collection_authority.sql', 'utf8');
const down = readFileSync('database/supabase/rollback/435_unified_collection_authority.rollback.sql', 'utf8');
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const a = newSyntheticTenant('retained435-a'), b = newSyntheticTenant('retained435-b');
const owner = randomUUID(), peer = randomUUID(), manual = randomUUID(), membershipKey = randomUUID();
const legacy = [randomUUID(), randomUUID(), randomUUID()];
let gateway: Gateway | undefined, proxy: OwnedPooledSqlProxy | undefined;
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });

interface RowDigest { table: string; rows: number; sha256: string }
function tables(): string[] {
    return JSON.parse(owned.psql(`SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')`));
}
function snapshotSql(names: string[]): string {
    const retained = legacy.map(q).join(',');
    const selects = names.map(name => {
        // The only permitted new entity rows are the explicitly reconciled
        // Smart copies. Existing manual conditions remain opaque and exact.
        const value = name === 'collections'
            ? "to_jsonb(t)-ARRAY['collection_type','match_type','slug','version']::text[]" : 'to_jsonb(t)';
        const where = name === 'collections' ? `WHERE id NOT IN(${retained})`
            : name === 'audit_activity_events' ? `WHERE NOT coalesce(resource_type='collection' AND resource_id IN(${retained}),false)`
            : name === 'migration_privilege_journal' ? "WHERE migration IS DISTINCT FROM '435'" : '';
        return `SELECT ${q(name)} AS table_name,count(*) AS row_count,
          encode(sha256(convert_to(coalesce(jsonb_agg(${value} ORDER BY (${value})::text),'[]'::jsonb)::text,'UTF8')),'hex') AS digest
          FROM public.${identifier(name)} t ${where}`;
    });
    return `SELECT jsonb_agg(jsonb_build_object('table',table_name,'rows',row_count,'sha256',digest)ORDER BY table_name)::text FROM(${selects.join(' UNION ALL ')})snapshot`;
}
const snapshot = (names: string[]): RowDigest[] => JSON.parse(owned.scriptLarge('SET jit=off;' + snapshotSql(names)));
const authority = () => owned.psql(`SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid)FROM pg_roles r),
    'memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor),'[]'::jsonb)FROM pg_auth_members m))::text`);
function row(rows: RowDigest[], name: string): RowDigest {
    const result = rows.find(value => value.table === name); assert.ok(result, name + ' exists in the actual catalog'); return result;
}

test('435 preserves a populated commerce/auth/book dataset and an original membership receipt across the real cutover', { timeout: 300000 }, async () => {
    owned.script(down); // Fresh template only; no retained metadata history exists.
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    const email = `syn-retained435-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users(id,email)VALUES('${owner}','${email}'),('${peer}','syn-retained435-${peer}@example.invalid');
      INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true),('${peer}','syn-retained435-${peer}@example.invalid',true);
      UPDATE sites SET custom_user_id='${owner}',business_profile='{"retained":{"nested":["தமிழ்",null,42]}}'::jsonb WHERE id='${a.siteId}';
      UPDATE sites SET custom_user_id='${peer}' WHERE id='${b.siteId}';`);
    const first = seedSyntheticOrder(owned.psql, a), second = seedSyntheticOrder(owned.psql, a);
    seedSyntheticOrder(owned.psql, b);
    const billing = randomUUID(), payment = randomUUID();
    // Real canonical ledger writer, with explicitly synthetic source evidence.
    // This creates book data for conservation, not verified PSP/bank activity.
    owned.script(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,provider_order_id,idempotency_key)
      VALUES('${payment}','${a.siteId}','${first.orderId}','razorpay','sandbox','requires_action',19900,'order_syn_retained_${payment}','syn-retained-${payment}');
      INSERT INTO billing_history(id,user_id,store_id,site_id,invoice_number,description,amount,currency,tax_amount,total_amount,payment_gateway,payment_id,payment_status)
      VALUES('${billing}','${owner}','${a.siteId}','${a.siteId}','SYN-RETAINED-${billing}','Synthetic retained ad credit',10000,'INR',0,10000,'razorpay','syn-retained-ad-order-${billing}','pending');
      SELECT public.finalize_ad_credit_purchase('${a.siteId}','${billing}','syn-retained-ad-order-${billing}','syn-retained-ad-payment-${billing}',NULL,'${owner}');
      INSERT INTO collections(id,store_id,title,is_active,conditions)VALUES('${manual}','${a.siteId}','Synthetic retained manual',true,'{"opaque":[null,"தமிழ்",{"kept":true}]}'::jsonb);
      INSERT INTO collection_products(collection_id,product_id,position)VALUES('${manual}','${first.productId}',0);
      INSERT INTO smart_collections(id,store_id,name,slug,description,conditions,match_type,version,created_at,deleted_at,created_by,updated_by)VALUES
      ('${legacy[0]}','${a.siteId}','Synthetic retained தமிழ்','synthetic-retained-unknown',NULL,'[{"field":"title","op":"contains","value":" Seed "}]','any',7,NULL,NULL,'${owner}','${owner}'),
      ('${legacy[1]}','${a.siteId}','Synthetic retained tombstone','synthetic-retained-deleted','Exact deleted draft','[]','all',3,'2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','${owner}',NULL),
      ('${legacy[2]}','${b.siteId}','Synthetic rival retained','synthetic-retained-rival','Separate store','[{"field":"price","op":"gt","value":"100"}]','all',2,'2026-01-02T00:00:00Z',NULL,'${peer}','${peer}');`);
    proxy = await startOwnedPooledSqlProxy(owned);
    const keys = await newIdentityKeys(), env = gatewayEnv(owned, keys, proxy.env());
    gateway = new Gateway(env);
    const token = await mintSession(keys, owner, { realm: 'merchant', tokenUse: 'merchant_session', audience: MERCHANT_SESSION_AUDIENCE });
    const headers = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret: INTERNAL_SECRET });
    const session = await gateway.request('/v1/auth/custom/sessions/create', { method: 'POST', headers: { ...headers.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: owner, token }) });
    assert.equal(session.status, 201, session.text);
    await gateway.settle();
    const replace = () => withTenantTx(env, { siteId: a.siteId, requestId: 'syn-retained-membership-' + membershipKey }, async tx => {
        await tx.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)', ['app.actor_id', owner, 'request.jwt.claim.sub', owner]);
        const result = await tx.unsafe(`SELECT public.apply_collection_membership_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb) AS result`,
            [a.siteId, manual, owner, revision, membershipKey, JSON.stringify([second.productId, first.productId])]);
        return result[0].result;
    });
    const revision = Number(owned.psql(`SELECT membership_version FROM collections WHERE id='${manual}'`));
    const receipt = await replace();
    assert.equal(owned.psql(`SELECT count(*) FROM collection_membership_receipts WHERE collection_id='${manual}'`), '1');
    const beforeTables = tables(), before = snapshot(beforeTables), roles = authority();
    const independentlyListed = JSON.parse(owned.psql(`SELECT jsonb_agg(table_name ORDER BY table_name)
      FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)) as string[];
    assert.deepEqual(beforeTables, independentlyListed, 'Independent catalog enumeration covers every public base/partition table.');
    for (const entry of TENANT_TABLES.filter(entry => entry.sourceFiles.some(file => parseInt(file, 10) <= 435))) {
        if (entry.table === 'collection_metadata_receipts') assert(!beforeTables.includes(entry.table), 'Only the empty paired435 footprint was retired.');
        else assert(beforeTables.includes(entry.table), entry.table + ': every registered tenant table must remain present.');
    }
    console.info('OWNED_COLLECTION_RETENTION_CATALOG ' + JSON.stringify({ publicTables: beforeTables.length,
        registeredTenantTables: TENANT_TABLES.length, independentCatalogsEqual: true }));
    const populated = ['sites', 'users', 'users_custom', 'sessions', 'products', 'inventory_locations', 'inventory_levels', 'orders', 'order_items',
        'payments', 'billing_history', 'ledger_transactions', 'ledger_entries', 'collections', 'collection_products', 'smart_collections',
        'collection_membership_receipts', 'audit_activity_events', 'outbox_events'];
    for (const name of populated) assert(row(before, name).rows > 0, name + ': a real populated positive control is required');
    assert.equal(owned.psql(`SELECT sum(CASE WHEN side='debit' THEN amount_minor ELSE -amount_minor END)FROM ledger_entries WHERE site_id='${a.siteId}'`), '0');
    assert.equal(owned.psql(`SELECT count(*)FROM audit_activity_events WHERE resource_type='collection'AND resource_id IN(${legacy.map(q).join(',')})`), '0');
    // Prove the independent whole-dataset digest can see an actual change and
    // that rollback really restores it; an empty/constant witness cannot pass.
    const mutation = owned.scriptLarge(`SET jit=off;BEGIN;UPDATE products SET name='Synthetic detectable retention mutation'WHERE id='${first.productId}';${snapshotSql(beforeTables)};ROLLBACK;`);
    const changed = JSON.parse(mutation.split('\n').find(line => line.startsWith('['))!) as RowDigest[];
    assert.notEqual(row(changed, 'products').sha256, row(before, 'products').sha256);
    assert.deepEqual(snapshot(beforeTables), before);

    owned.script(up);
    assert.deepEqual(tables().filter(name => !beforeTables.includes(name)), ['collection_metadata_receipts']);
    assert.deepEqual(beforeTables.filter(name => !tables().includes(name)), []);
    assert.deepEqual(snapshot(beforeTables), before, 'Every preexisting public row/field/count is exact; only explicit copied entities and their declared audit rows are excluded.');
    assert.equal(authority(), roles, 'No role or role membership changes.');
    assert.equal(owned.psql('SELECT count(*) FROM collection_metadata_receipts'), '0', 'Cutover never fabricates user command receipts.');
    const copies = JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('id',c.id,'same',
      c.store_id=s.store_id AND c.title=s.name AND c.slug=s.slug AND c.description IS NOT DISTINCT FROM s.description
      AND c.conditions=s.conditions AND c.match_type=s.match_type AND c.version=s.version
      AND c.created_at IS NOT DISTINCT FROM s.created_at AND c.deleted_at IS NOT DISTINCT FROM s.deleted_at
      AND c.created_by IS NOT DISTINCT FROM s.created_by AND c.updated_by IS NOT DISTINCT FROM s.updated_by
      AND c.updated_at IS NULL AND c.collection_type='smart' AND c.is_active=false)ORDER BY c.id)
      FROM smart_collections s JOIN collections c ON c.id=s.id WHERE s.id IN(${legacy.map(q).join(',')})`)) as { id: string; same: boolean }[];
    assert.equal(copies.length, legacy.length); assert(copies.every(value => value.same));
    const addedAudit = JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('id',resource_id,'action',action,'actor_type',actor_type,'before_empty',before_state IS NULL,'transition',metadata->>'transition')ORDER BY resource_id)
      FROM audit_activity_events WHERE resource_type='collection'AND resource_id IN(${legacy.map(q).join(',')})`)) as { id: string; action: string; actor_type: string; before_empty: boolean; transition: string }[];
    assert.deepEqual(addedAudit.map(value => value.id).sort(), [...legacy].sort());
    assert(addedAudit.every(value => value.action === 'collection.membership.revision' && value.actor_type === 'system' && value.before_empty && value.transition === 'INSERT'));
    assert.deepEqual(await replace(), receipt, 'A pre-cutover original key replays its exact original ordered receipt after435.');
    assert.deepEqual(snapshot(beforeTables), before, 'Original receipt replay has no new effect on retained rows.');
    console.info('OWNED_COLLECTION_RETAINED435 ' + JSON.stringify({ tables: beforeTables.length, populatedControls: populated,
        syntheticCanonicalBookBalanced: true, providerEvidence: false, copiedSmartRows: copies.length, declaredNewAuditRows: addedAudit.length,
        originalMembershipReceiptUnchanged: true, roleProfilesUnchanged: true, retainedRowVariance: 0, digests: before }));
});
