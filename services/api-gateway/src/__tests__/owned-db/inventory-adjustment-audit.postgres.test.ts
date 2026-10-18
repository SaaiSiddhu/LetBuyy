import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { Gateway, gatewayEnv, newBarrier, newIdentityKeys, signedIdentityHeaders, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
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
    gateway = new Gateway(gatewayEnv(owned, keys));
});

afterEach(async () => { await gateway.settle(); });

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

test('concurrent merchant variant adjustments remain additive, auditable, visible in history, and tenant-scoped', async () => {
    const barrier = newBarrier(2);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/adjust_inventory_level') await barrier.arrive();
        return forward();
    });
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
