import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('cod-collection');
const ownerId = randomUUID();
const ownerEmail = `cod-collection-${randomUUID()}@example.invalid`;
const orderIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const migration = readFileSync(new URL('../../../../../database/supabase/migrations/299_cod_collection_atomicity.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/299_cod_collection_atomicity.rollback.sql', import.meta.url), 'utf8');
let gateway: Gateway;

function q(value: string) { return `'${value.replaceAll("'", "''")}'`; }

before(async () => {
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`
      INSERT INTO public.users_custom (id, email, full_name)
      VALUES ('${ownerId}'::uuid, ${q(ownerEmail)}, 'Synthetic COD Collection Merchant');
      UPDATE public.sites SET custom_user_id='${ownerId}'::uuid WHERE id='${tenant.siteId}'::uuid;
      INSERT INTO public.orders
        (id, store_id, site_id, order_number, customer_email, customer_name, shipping_address, items,
         subtotal, total, status, payment_status, payment_method, currency)
      VALUES ${orderIds.map((id) => `('${id}'::uuid, '${tenant.siteId}'::uuid, '${tenant.siteId}'::uuid,
        ${q(`SYN-COD-COLLECT-${id}`)}, ${q(ownerEmail)}, 'Synthetic COD Buyer', '{}'::jsonb,
        '[]'::jsonb, 199.00, 199.00, 'confirmed', 'pending', 'cod', 'INR')`).join(',')};
    `);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});

afterEach(async () => gateway?.settle());

async function collect(orderId: string, key: string, amount?: number, notes?: string) {
    return gateway.request('/v1/cod/reconciliation', {
        method: 'POST',
        headers: { ...await signedIdentityHeaders(ownerId, ownerEmail, tenant.siteId), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            store_id: tenant.siteId,
            order_id: orderId,
            idempotency_key: key,
            ...(amount === undefined ? {} : { collected_amount_minor: amount }),
            ...(notes === undefined ? {} : { notes }),
        }),
    });
}

test('COD collection is atomic, tenant-bound, and rejects changed same-key requests', async () => {
    const key = `cod-collect-${randomUUID()}`;
    const first = await collect(orderIds[0], key, 18000, 'Synthetic partial collection');
    assert.equal(first.status, 200, first.text);
    const entryId = String(first.json?.data?.entry?.id || '');
    assert.match(entryId, /^[0-9a-f-]{36}$/i);
    assert.equal(first.json?.data?.entry?.status, 'collected');
    assert.equal(first.json?.data?.entry?.expected_amount_minor, 19900);
    assert.equal(first.json?.data?.entry?.collected_amount_minor, 18000);

    const replay = await collect(orderIds[0], key, 18000, 'Synthetic partial collection');
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.entry?.id, entryId);
    assert.equal(replay.json?.data?.entry?.collected_amount_minor, 18000);

    const changedAmount = await collect(orderIds[0], key, 17000, 'Synthetic partial collection');
    assert.equal(changedAmount.status, 409, changedAmount.text);
    const changedNotes = await collect(orderIds[0], key, 18000, 'Changed notes');
    assert.equal(changedNotes.status, 409, changedNotes.text);
    const changedOrder = await collect(orderIds[1], key, 18000, 'Synthetic partial collection');
    assert.equal(changedOrder.status, 409, changedOrder.text);

    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid AND collection_idempotency_key=${q(key)};`), '1');
    assert.equal(owned.psql(`SELECT collected_amount_minor_bigint::text FROM public.cod_reconciliation_entries WHERE id='${entryId}'::uuid;`), '18000');
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid AND order_id='${orderIds[1]}'::uuid;`), '0');

    const foreign = await gateway.request('/v1/cod/reconciliation', {
        method: 'POST',
        headers: await signedIdentityHeaders(randomUUID(), `outsider-${randomUUID()}@example.invalid`, tenant.siteId),
        body: JSON.stringify({ store_id: tenant.siteId, order_id: orderIds[2], idempotency_key: `foreign-${randomUUID()}` }),
    });
    assert.equal(foreign.status, 403, foreign.text);
});

test('concurrent collection keys serialize per order and exact same-key retries converge', async () => {
    const differentKeys = [`cod-race-a-${randomUUID()}`, `cod-race-b-${randomUUID()}`];
    const race = await Promise.all([
        collect(orderIds[2], differentKeys[0], 17000),
        collect(orderIds[2], differentKeys[1], 18000),
    ]);
    assert.deepEqual(race.map((response) => response.status).sort(), [200, 409]);
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid AND order_id='${orderIds[2]}'::uuid;`), '1');

    const sameKey = `cod-same-key-${randomUUID()}`;
    const sameKeyRace = await Promise.all([
        collect(orderIds[3], sameKey, 19000),
        collect(orderIds[3], sameKey, 19000),
    ]);
    assert.deepEqual(sameKeyRace.map((response) => response.status).sort(), [200, 409]);
    const sameKeyRetry = await collect(orderIds[3], sameKey, 19000);
    assert.equal(sameKeyRetry.status, 200, sameKeyRetry.text);
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid AND collection_idempotency_key=${q(sameKey)};`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid;`), '3');
});

test('collection RPC is service-role-only and migration rollback/reapply retains all collection evidence', () => {
    const signature = 'public.collect_cod_order_with_lock(uuid,uuid,bigint,text,text,uuid)';
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}', '${signature}', 'EXECUTE');`), 'f');
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.collect_cod_order_with_lock('${tenant.siteId}', '${orderIds[0]}', 18000, NULL, 'acl-denied', NULL);`), /permission denied for function collect_cod_order_with_lock/);
    }
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${signature}', 'EXECUTE');`), 't');
    const entryCount = owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid;`);
    owned.psql(rollback);
    assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`), 't');
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid;`), entryCount);
    owned.psql(migration);
    assert.equal(owned.psql(`SELECT has_function_privilege('service_role', '${signature}', 'EXECUTE');`), 't');
    assert.equal(owned.psql(`SELECT count(*) FROM public.cod_reconciliation_entries WHERE site_id='${tenant.siteId}'::uuid;`), entryCount);
});
