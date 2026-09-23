// F-FUL-1 (LB-FUL-001) — order fulfilment must work at the database, for orders with and without variants.
//
// public.create_order_fulfillment is defined once, in 000_baseline.sql, and was never redefined until
// migration 252. Both of its INSERT INTO fulfillment_order_lines statements — the explicit-lines branch
// (p_lines) and the all-lines branch — passed order_items.variant_id (TEXT) into
// fulfillment_order_lines.variant_id (UUID). Postgres rejects that INSERT when it plans it, whatever the
// row holds, so every call that reached either INSERT failed:
//     column "variant_id" is of type uuid but expression is of type text
// Found 2026-09-23 while proving F-PAY4-1; the fix takes migration 212's cast, NULLIF(variant_id, '')::uuid.
//
// Orders are created through the real create_checkout_order, so order_items holds exactly what checkout
// writes: NULL for a plain product, the variant's uuid as TEXT for a variant. Every RPC runs as the
// postgres superuser, the convention of every sibling suite: this proves the RPC's own PL/pgSQL, not RLS.
//
// The migration is located by name suffix, not number: F-PAY4-1 also claimed 252 on an unmerged branch, so
// whichever merges second renames its migration — and this suite keeps working through that rename.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_fulfillment_variant';
const SHARED_DATABASE = 'letbuyy_executable';
const skip = databaseName !== SHARED_DATABASE
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION_SUFFIX = '_fix_create_order_fulfillment_variant_type.sql';
const migrationName = readdirSync(join(repoRoot, 'database/supabase/migrations')).find((name) => name.endsWith(MIGRATION_SUFFIX));
const rollbackName = migrationName && readdirSync(join(repoRoot, 'database/supabase/rollback'))
    .find((name) => name === migrationName.replace(/\.sql$/, '.rollback.sql'));
const MIGRATION = migrationName && `database/supabase/migrations/${migrationName}`;
const ROLLBACK = rollbackName && `database/supabase/rollback/${rollbackName}`;
const FIX_PRESENT = Boolean(MIGRATION && ROLLBACK);

const TYPE_DEFECT = /column "variant_id" is of type uuid but expression is of type text/;
const SITE = '11111111-1111-4111-8111-1111111f0f01';
const LOCATION = '22222222-2222-4222-8222-2222222f0f01';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));
const json = (sql) => JSON.parse(psql(sql) || 'null');

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE); CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        try {
            psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE)}::uuid, 'Fulfilment Store', 'Fulfilment Store', 'store', 'fulfilment-store', true);
    INSERT INTO public.inventory_locations (id, store_id, name, is_default, status)
    VALUES (${sqlString(LOCATION)}::uuid, ${sqlString(SITE)}::uuid, 'Default', true, 'active');
    `);
}

let seq = 0;
const nextSeq = () => { seq += 1; return String(seq).padStart(12, '0'); };

function seedProduct({ price = 500, stock = 10 } = {}) {
    const product = `33333333-3333-4333-8333-${nextSeq()}`;
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(product)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Plain ${seq}', ${price}, true, 'active');
    INSERT INTO public.inventory_levels
      (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES (${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, ${sqlString(LOCATION)}::uuid, ${stock}, 0, ${stock}, 0, 0);
    `);
    return product;
}

// A product with one variant; stock lives at the variant's level, as checkout reserves it.
function seedVariant({ price = 650, stock = 10 } = {}) {
    const product = `33333333-3333-4333-8333-${nextSeq()}`;
    const variant = `44444444-4444-4444-8444-${nextSeq()}`;
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(product)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Tee ${seq}', 500, true, 'active');
    INSERT INTO public.product_variants (id, product_id, title, price)
    VALUES (${sqlString(variant)}::uuid, ${sqlString(product)}::uuid, 'Tee ${seq} / M', ${price});
    INSERT INTO public.inventory_levels
      (store_id, product_id, variant_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES (${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, ${sqlString(variant)}::uuid, ${sqlString(LOCATION)}::uuid, ${stock}, 0, ${stock}, 0, 0);
    `);
    return { product, variant };
}

// The real storefront checkout — order_items holds exactly what checkout writes.
function placeOrder({ items, method = 'cod' }) {
    const key = `ful-order-${nextSeq()}`;
    const payload = JSON.stringify(items.map(({ product, variant = null, quantity }) => ({ product_id: product, variant_id: variant, quantity })));
    return JSON.parse(psql(`
    SELECT public.create_checkout_order(
        p_store_id => ${sqlString(SITE)}::uuid,
        p_customer_name => 'Fulfilment Buyer',
        p_customer_email => 'fulfilment-buyer@example.invalid',
        p_customer_phone => '9999999999',
        p_shipping_address => '{}'::jsonb,
        p_items => ${sqlString(payload)}::jsonb,
        p_payment_method => ${sqlString(method)},
        p_shipping_method => 'standard',
        p_idempotency_key => ${sqlString(key)},
        p_request_id => ${sqlString(`req-${key}`)}
    )::text;`)).id;
}

// A paid online order, confirmed the way the storefront verify route confirms it.
function payOnline(orderId) {
    const tag = nextSeq();
    psql(`SELECT public.attach_order_payment_reference_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(`order_RZP_${tag}`)}, 'req-attach', ${sqlString(`attach:${tag}`)});`);
    psql(`SELECT public.confirm_order_payment_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(`pay_${tag}`)}, ${sqlString(`order_RZP_${tag}`)},
        ${sqlString(`razorpay:checkout:pay_${tag}`)}, 'req-confirm', ${sqlString(`razorpay-verify-pay_${tag}`)});`);
}

const fulfilSql = ({ order, lines = null, carrier = null, tracking = null, key }) => `
    SELECT public.create_order_fulfillment(
        ${sqlString(order)}::uuid,
        ${lines ? `${sqlString(JSON.stringify(lines))}::jsonb` : 'NULL'},
        NULL,
        ${carrier ? sqlString(carrier) : 'NULL'},
        ${tracking ? sqlString(tracking) : 'NULL'},
        NULL, NULL, 'req-fulfil',
        ${sqlString(key)}
    )::text;`;
const fulfil = (args) => JSON.parse(psql(fulfilSql(args)));

const fulfilmentLines = (order) => json(`
    SELECT COALESCE(json_agg(json_build_object(
        'order_item_id', l.order_item_id, 'variant_id', l.variant_id, 'variant_type', pg_typeof(l.variant_id)::text,
        'variant_title', v.title, 'quantity', l.quantity, 'status', l.status) ORDER BY l.created_at, l.id), '[]')::text
      FROM public.fulfillment_order_lines l
      LEFT JOIN public.product_variants v ON v.id = l.variant_id
     WHERE l.order_id = ${sqlString(order)}::uuid;`);
const orderItems = (order) => json(`
    SELECT json_agg(json_build_object('id', id, 'variant_id', variant_id, 'quantity', quantity,
        'fulfilled', COALESCE(fulfilled_quantity, 0), 'status', fulfillment_status) ORDER BY created_at, id)::text
      FROM public.order_items WHERE order_id = ${sqlString(order)}::uuid;`);
const orderState = (order) => json(`
    SELECT json_build_object('status', status, 'fulfillment_status', fulfillment_status,
        'tracking_number', tracking_number, 'carrier', carrier)::text
      FROM public.orders WHERE id = ${sqlString(order)}::uuid;`);
const fulfilmentOrderStatuses = (order) => psql(`
    SELECT string_agg(status, ',' ORDER BY created_at, id) FROM public.fulfillment_orders WHERE order_id = ${sqlString(order)}::uuid;`);
const reservationStatuses = (order) => psql(`
    SELECT string_agg(DISTINCT status, ',' ORDER BY status) FROM public.inventory_reservations
     WHERE order_id = ${sqlString(order)}::uuid AND deleted_at IS NULL;`);
const count = (sql) => Number(psql(sql));
const liveDefinition = () => psql(`SELECT pg_get_functiondef(
    'public.create_order_fulfillment(uuid,jsonb,uuid,text,text,text,uuid,text,text)'::regprocedure);`);

before(() => { if (!skip) bootstrapDatabase(); });
after(() => {
    if (skip) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* leave for inspection */ }
});

test('a paid order with no variant is fulfilled in full', { skip }, () => {
    const product = seedProduct({ stock: 5 });
    const order = placeOrder({ items: [{ product, quantity: 2 }], method: 'razorpay' });
    payOnline(order);
    assert.equal(orderState(order).status, 'confirmed', 'precondition: a confirmed, paid order');

    const result = fulfil({ order, key: `ful-${order}` });

    assert.equal(result.all_fulfilled, true);
    const lines = fulfilmentLines(order);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].variant_id, null, 'a plain product fulfils as a NULL variant, not an error');
    assert.equal(lines[0].quantity, 2);
    assert.equal(lines[0].status, 'packed');
    const [item] = orderItems(order);
    assert.equal(item.fulfilled, 2);
    assert.equal(item.status, 'fulfilled');
    assert.deepEqual(orderState(order), { status: 'processing', fulfillment_status: 'fulfilled', tracking_number: null, carrier: null });
    assert.equal(fulfilmentOrderStatuses(order), 'fulfilled');
    assert.equal(reservationStatuses(order), 'fulfilled', 'a fully fulfilled order closes its committed reservation');
    assert.equal(count(`SELECT count(*) FROM public.outbox_events
        WHERE aggregate_type = 'fulfillment_order' AND event_type = 'fulfillment.shipped' AND payload->>'order_id' = ${sqlString(order)};`), 1);
});

test('the COD order from the defect report ships, with its tracking recorded', { skip }, () => {
    const product = seedProduct({ stock: 3 });
    const order = placeOrder({ items: [{ product, quantity: 1 }], method: 'cod' });
    assert.equal(orderState(order).status, 'pending_cod', 'the exact shape LB-FUL-001 was measured on');

    const result = fulfil({ order, carrier: 'delhivery', tracking: 'AWB-F1-0001', key: `ful-${order}` });

    assert.equal(result.all_fulfilled, true);
    assert.ok(result.shipment_id, 'a shipment is created when a carrier or tracking number is given');
    assert.deepEqual(orderState(order), { status: 'shipped', fulfillment_status: 'fulfilled', tracking_number: 'AWB-F1-0001', carrier: 'delhivery' });
    assert.equal(fulfilmentLines(order)[0].status, 'shipped');
    assert.equal(count(`SELECT count(*) FROM public.shipments WHERE order_id = ${sqlString(order)}::uuid AND status = 'shipped';`), 1);
    assert.equal(count(`SELECT count(*) FROM public.shipment_events WHERE order_id = ${sqlString(order)}::uuid AND event_type = 'shipped';`), 1);
});

test('a variant line carries its variant id into the fulfilment, as a uuid that resolves', { skip }, () => {
    const { product, variant } = seedVariant({ stock: 5 });
    const order = placeOrder({ items: [{ product, variant, quantity: 2 }] });
    assert.equal(orderItems(order)[0].variant_id, variant, 'precondition: checkout stored the variant id (as text)');

    const result = fulfil({ order, key: `ful-${order}` });

    assert.equal(result.all_fulfilled, true);
    const [line] = fulfilmentLines(order);
    assert.equal(line.variant_id, variant);
    assert.equal(line.variant_type, 'uuid');
    assert.match(line.variant_title, /\/ M$/, 'the FK resolves: the fulfilment line points at the real variant');
    assert.equal(line.quantity, 2);
});

test('explicit lines fulfil part of an order, then the remainder fulfils the rest', { skip }, () => {
    // Both branches of the function, with a variant line and a plain line in the same order.
    const plain = seedProduct({ stock: 5 });
    const { product, variant } = seedVariant({ stock: 5 });
    const order = placeOrder({ items: [{ product: plain, quantity: 1 }, { product, variant, quantity: 3 }] });
    const variantItem = orderItems(order).find((item) => item.variant_id === variant);
    const plainItem = orderItems(order).find((item) => item.variant_id === null);

    const first = fulfil({ order, lines: [{ order_item_id: variantItem.id, quantity: 2 }], key: `ful-part-${order}` });

    assert.equal(first.all_fulfilled, false);
    assert.equal(fulfilmentOrderStatuses(order), 'partially_fulfilled');
    let items = orderItems(order);
    assert.deepEqual([items.find((i) => i.id === variantItem.id).fulfilled, items.find((i) => i.id === variantItem.id).status], [2, 'partial']);
    assert.deepEqual([items.find((i) => i.id === plainItem.id).fulfilled, items.find((i) => i.id === plainItem.id).status], [0, 'unfulfilled']);
    assert.equal(orderState(order).fulfillment_status, 'partial');
    assert.equal(reservationStatuses(order), 'committed', 'a partial fulfilment keeps the stock committed');
    assert.equal(fulfilmentLines(order)[0].variant_id, variant, 'the explicit-lines branch carries the variant too');

    const rest = fulfil({ order, key: `ful-rest-${order}` });

    assert.equal(rest.all_fulfilled, true);
    assert.equal(fulfilmentOrderStatuses(order), 'partially_fulfilled,fulfilled');
    const lines = fulfilmentLines(order);
    assert.equal(lines.length, 3);
    assert.deepEqual(
        lines.slice(1).map((l) => [l.order_item_id === variantItem.id ? 'variant' : 'plain', l.variant_id, l.quantity]).sort(),
        [['plain', null, 1], ['variant', variant, 1]],
        'the remainder is exactly what the first fulfilment left',
    );
    items = orderItems(order);
    assert.ok(items.every((i) => i.fulfilled === i.quantity && i.status === 'fulfilled'));
    assert.equal(orderState(order).fulfillment_status, 'fulfilled');
    assert.equal(reservationStatuses(order), 'fulfilled');
});

test('a replayed fulfilment with the same key does not fulfil twice', { skip }, () => {
    const { product, variant } = seedVariant({ stock: 5 });
    const order = placeOrder({ items: [{ product, variant, quantity: 1 }] });
    const key = `ful-replay-${order}`;

    const first = fulfil({ order, key });
    const again = fulfil({ order, key });

    assert.equal(again.idempotent_replay, true);
    assert.equal(again.fulfillment_order_id, first.fulfillment_order_id);
    assert.equal(fulfilmentLines(order).length, 1);
});

test('a fully fulfilled order has nothing left to fulfil', { skip }, () => {
    const product = seedProduct({ stock: 5 });
    const order = placeOrder({ items: [{ product, quantity: 1 }] });
    fulfil({ order, key: `ful-${order}` });

    assert.throws(() => fulfil({ order, key: `ful-again-${order}` }), /no fulfillable order lines remain/);
});

test('the guards that run before any line is written are unchanged', { skip }, () => {
    // These pass with or without the fix: they refuse before either INSERT is reached. They are here so
    // the fix is shown not to have loosened them.
    const product = seedProduct({ stock: 5 });
    const order = placeOrder({ items: [{ product, quantity: 2 }] });
    const [item] = orderItems(order);
    assert.throws(() => fulfil({ order, lines: [{ order_item_id: item.id, quantity: 3 }], key: `over-${order}` }), /invalid fulfillment quantity/);
    assert.throws(() => fulfil({ order, lines: [{ order_item_id: item.id, quantity: 0 }], key: `zero-${order}` }), /invalid fulfillment quantity/);
    assert.throws(() => psql(fulfilSql({ order, key: '   ' })), /idempotency_key is required/);

    // Fixture: the status gate is about the status column alone.
    psql(`UPDATE public.orders SET status = 'cancelled' WHERE id = ${sqlString(order)}::uuid;`);
    assert.throws(() => fulfil({ order, key: `cancelled-${order}` }), /cannot be fulfilled from status cancelled/);
    assert.equal(count(`SELECT count(*) FROM public.fulfillment_orders WHERE order_id = ${sqlString(order)}::uuid;`), 0,
        'a refused fulfilment leaves nothing behind');
});

test('CONTROL: with the fix rolled back both branches fail again; the live diff is exactly the two casts', {
    skip: skip || (FIX_PRESENT ? false : 'the create_order_fulfillment variant-type migration is not in this tree'),
}, () => {
    const fixed = liveDefinition();
    applySqlFile(ROLLBACK);
    let restored;
    try {
        restored = liveDefinition();
        const plain = seedProduct({ stock: 5 });
        const plainOrder = placeOrder({ items: [{ product: plain, quantity: 1 }] });
        assert.throws(() => fulfil({ order: plainOrder, key: `control-all-${plainOrder}` }), TYPE_DEFECT,
            'pre-fix: the all-lines branch fails on a plain product');

        const { product, variant } = seedVariant({ stock: 5 });
        const variantOrder = placeOrder({ items: [{ product, variant, quantity: 1 }] });
        const [item] = orderItems(variantOrder);
        assert.throws(() => fulfil({ order: variantOrder, lines: [{ order_item_id: item.id, quantity: 1 }], key: `control-lines-${variantOrder}` }),
            TYPE_DEFECT, 'pre-fix: the explicit-lines branch fails on a variant');
    } finally {
        applySqlFile(MIGRATION);
    }

    // The migration changes the live function in exactly two lines — the two variant_id values — and the
    // rollback restores it byte for byte.
    assert.equal(liveDefinition(), fixed, 're-applying the migration restores the fixed definition');
    const before = restored.split('\n');
    const afterLines = fixed.split('\n');
    assert.equal(afterLines.length, before.length, 'no line added or removed');
    const changed = before.flatMap((line, i) => (line === afterLines[i] ? [] : [[line.trim(), afterLines[i].trim()]]));
    assert.deepEqual(changed, [
        ['v_item.variant_id,', "NULLIF(v_item.variant_id, '')::uuid,"],
        ['v_item.variant_id,', "NULLIF(v_item.variant_id, '')::uuid,"],
    ]);

    // And with the fix back in force, the same kind of order fulfils.
    const product = seedProduct({ stock: 5 });
    const order = placeOrder({ items: [{ product, quantity: 1 }] });
    assert.equal(fulfil({ order, key: `control-after-${order}` }).all_fulfilled, true);
});
