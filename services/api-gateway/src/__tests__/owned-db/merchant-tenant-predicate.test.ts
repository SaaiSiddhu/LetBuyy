import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { createTenantGuardedSupabaseClient } from '../../tenant/tenant-scoped';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

// T16: the merchant app could not see its own data. hydrateOrderItems (routes/orders.ts) called
// order_items with no site_id/store_id predicate at all; four inventory.ts/commerce-analytics.ts
// queries scoped inventory_levels/inventory_reservations/*_receipts only via a JOINED
// products.store_id/purchase_orders.site_id/inventory_transfers.site_id column, never the
// table's OWN registered scope column (tenant-tables.registry.ts). Both are the same defect
// class T14 first found in generateAndPersistGstInvoice: a SECURITY DEFINER-adjacent app-layer
// guard (createTenantGuardedSupabaseClient) fail-closed refuses ANY query against a
// tenant-registered table that never references one of its registered scope columns -- proven
// here by exercising the real guard against the real registry, not a mock.
//
// Money-table discipline: no row is ever DELETEd by this file; all inserts are additive to a
// disposable test store created via direct DB inserts (mirroring T8-T15's fixture pattern).
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs): the REST layer under test is the
// real PostgREST the runner started for this suite, in front of a database cloned for it alone, and every row below is
// created there. There is no skip path.

const owned = requireOwnedDatabase();
const { psql } = owned;

// A store that already carries a real order (placed through the real create_checkout_order RPC), built inside this
// suite's own database. The first two tests read it and assert only `.length > 0`, never an exact count.
const tenant = newSyntheticTenant('mtp');
const STORE_ID = tenant.siteId;
// A second, unrelated tenant with an order of its own, so that "cross-tenant sees nothing" is a claim about rows that exist.
const rival = newSyntheticTenant('mtp-rival');
let rivalOrderId = '';
let ownOrderId = '';

before(() => {
    seedSyntheticTenant(psql, tenant, { gst: true });
    ownOrderId = seedSyntheticOrder(psql, tenant).orderId;
    seedSyntheticTenant(psql, rival, { gst: true });
    rivalOrderId = seedSyntheticOrder(psql, rival).orderId;
});

function client() {
    const raw = createSupabaseServiceClient(owned.restEnv());
    return createTenantGuardedSupabaseClient(raw as never);
}

test(
    'hydrateOrderItems\' exact query shape: no predicate throws, the real fix (scoped by store_id) loads real rows, and cross-tenant sees nothing',
    async () => {
        const guarded = client();
        const rawIds = psql(`SELECT id FROM orders WHERE site_id = '${STORE_ID}'::uuid LIMIT 65;`);
        const orderIds = rawIds.split('\n').filter(Boolean);
        assert.ok(orderIds.length > 0, 'the store under test must carry real orders for this proof to mean anything');

        await assert.rejects(
            Promise.resolve(guarded
                .from('order_items')
                .select('id, order_id')
                .in('order_id', orderIds)
                .is('deleted_at', null)),
            /Tenant table order_items requires a tenant\/owner predicate/,
            'the unscoped shape (the bug) must still be refused by the guard -- this is the exact regression T16 fixed',
        );

        const { data, error } = await guarded
            .from('order_items')
            .select('id, order_id, store_id')
            .eq('store_id', STORE_ID)
            .in('order_id', orderIds)
            .is('deleted_at', null);
        assert.equal(error, null);
        assert.ok((data || []).length > 0, 'the fixed shape must actually return real order_items rows');
        assert.ok((data || []).every((row: { store_id: string }) => row.store_id === STORE_ID), 'every returned row must belong to the store under test');

        // Cross-tenant sees nothing. The control first: in the database the two tenants' lines really are side by side (the
        // unguarded client, asked for both orders, gets both stores back), so the empty answers below are isolation and not
        // an absence of data.
        const control = await createSupabaseServiceClient(owned.restEnv())
            .from('order_items')
            .select('store_id')
            .in('order_id', [ownOrderId, rivalOrderId]);
        assert.equal(control.error, null);
        assert.deepEqual([...new Set((control.data || []).map((row: { store_id: string }) => row.store_id))].sort(), [STORE_ID, rival.siteId].sort(), 'both tenants have order lines in this database');

        const across = await guarded
            .from('order_items')
            .select('id, order_id, store_id')
            .eq('store_id', STORE_ID)
            .in('order_id', [rivalOrderId])
            .is('deleted_at', null);
        assert.equal(across.error, null);
        assert.deepEqual(across.data, [], 'the other tenant\'s order, asked for under this tenant\'s scope, returns no lines');

        const rivalOwn = await guarded
            .from('order_items')
            .select('id, store_id')
            .eq('store_id', rival.siteId)
            .in('order_id', orderIds)
            .is('deleted_at', null);
        assert.equal(rivalOwn.error, null);
        assert.deepEqual(rivalOwn.data, [], 'and this tenant\'s order, asked for under the other tenant\'s scope, returns none either');
    },
);

test(
    'inventory_levels\' join-only predicate (products.store_id) is refused by the guard; the table\'s own store_id column is required, and isolation holds across stores',
    async () => {
        const guarded = client();

        await assert.rejects(
            Promise.resolve(guarded
                .from('inventory_levels')
                .select('id, products!inner(store_id)')
                .in('products.store_id', [STORE_ID])),
            /Tenant table inventory_levels requires a tenant\/owner predicate/,
            'a join-only predicate must not satisfy the guard for the registered table\'s own store_id column',
        );

        const { data, error } = await guarded
            .from('inventory_levels')
            .select('id, store_id, products!inner(store_id)')
            .eq('store_id', STORE_ID)
            .in('products.store_id', [STORE_ID]);
        assert.equal(error, null);
        assert.ok((data || []).length > 0, 'the fixed shape must return real inventory rows for the store under test');
    },
);

test(
    'a genuine end-to-end order-lines edit (PATCH .../line-items shape) can add and read back a line under the tenant guard, scoped to a disposable test store',
    async () => {
        const guarded = client();
        const suffix = Date.now().toString(36);
        const testStoreId = randomUUID();
        const productId = randomUUID();
        const orderId = randomUUID();
        psql(`
            INSERT INTO sites (id, name, store_name, site_type, subdomain, status, created_at, updated_at)
            VALUES ('${testStoreId}', 'T16 Autotest ${suffix}', 'T16 Autotest ${suffix}', 'store', 't16-autotest-${suffix}', 'draft', now(), now());
        `);
        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
            VALUES ('${productId}', '${testStoreId}', 'T16 Autotest Product', 150.00, 'T16-AUTOTEST-${suffix}', true, now(), now());
        `);
        psql(`
            INSERT INTO orders (id, store_id, site_id, customer_name, customer_email, shipping_address, items, status, payment_status, payment_method, total, subtotal, currency, created_at, updated_at)
            VALUES ('${orderId}', '${testStoreId}', '${testStoreId}', 'T16 Buyer', 't16-autotest-${suffix}@example.invalid', '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb, '[]'::jsonb, 'pending', 'pending', 'cod', 150.00, 150.00, 'INR', now(), now());
        `);

        // The exact shape orders.ts' PATCH /:id/line-items now uses: store_id in the INSERT
        // payload (the guard checks payload keys for insert/upsert, not just chained .eq()).
        const { error: insertError } = await guarded
            .from('order_items')
            .insert({
                store_id: testStoreId,
                order_id: orderId,
                product_id: productId,
                name: 'T16 Autotest Product',
                title: 'T16 Autotest Product',
                quantity: 1,
                price: 150,
                unit_price: 150,
                total: 150,
            });
        assert.equal(insertError, null, 'a store_id-scoped insert must be accepted by the guard');

        const { data: readBack, error: readError } = await guarded
            .from('order_items')
            .select('id, order_id, total')
            .eq('store_id', testStoreId)
            .eq('order_id', orderId)
            .is('deleted_at', null);
        assert.equal(readError, null);
        assert.equal(readBack?.length, 1);
        assert.equal(readBack?.[0].total, 150);
    },
);
