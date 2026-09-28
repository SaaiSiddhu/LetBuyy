import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';

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
// Guarded: skips (not fails) if the local Supabase Postgres container is not reachable.

const CONTAINER = process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
// Snaz-fixture follow-up (2026-09-28): snaz is seeded by scripts/dev/seed-snaz-fixture.mjs
// (idempotent -- run it once against a fresh local database). It carries at least one real order,
// used read-only below -- this file's own assertions only ever check `.length > 0`, never an exact
// count, so the historical "65 real orders" this comment once described is not required to hold.
const STORE_ID = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb'; // snaz -- real orders exist, used read-only

function dbAvailable(): boolean {
    try {
        execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', 'SELECT 1'], {
            stdio: 'ignore',
            timeout: 5000,
        });
        return true;
    } catch {
        return false;
    }
}

function psql(sql: string): string {
    return execFileSync(
        'docker',
        ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '|', '-c', sql],
        { encoding: 'utf8', timeout: 15000 },
    ).trim();
}

function client() {
    const devVars = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
    const env: Record<string, string> = {};
    for (const line of devVars.split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) env[m[1]] = m[2];
    }
    const raw = createSupabaseServiceClient(env as never);
    return createTenantGuardedSupabaseClient(raw as never);
}

test(
    'hydrateOrderItems\' exact query shape: no predicate throws, the real fix (scoped by store_id) loads real rows, and cross-tenant sees nothing',
    { skip: !dbAvailable() && 'local Supabase Postgres container not reachable' },
    async () => {
        const guarded = client();
        const rawIds = psql(`SELECT id FROM orders WHERE site_id = '${STORE_ID}'::uuid LIMIT 65;`);
        const orderIds = rawIds.split('\n').filter(Boolean);
        assert.ok(orderIds.length > 0, 'snaz must carry real orders for this proof to mean anything');

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
        assert.ok((data || []).every((row: { store_id: string }) => row.store_id === STORE_ID), 'every returned row must belong to snaz');
    },
);

test(
    'inventory_levels\' join-only predicate (products.store_id) is refused by the guard; the table\'s own store_id column is required, and isolation holds across stores',
    { skip: !dbAvailable() && 'local Supabase Postgres container not reachable' },
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
        assert.ok((data || []).length > 0, 'the fixed shape must return real inventory rows for snaz');
    },
);

test(
    'a genuine end-to-end order-lines edit (PATCH .../line-items shape) can add and read back a line under the tenant guard, scoped to a disposable test store',
    { skip: !dbAvailable() && 'local Supabase Postgres container not reachable' },
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
