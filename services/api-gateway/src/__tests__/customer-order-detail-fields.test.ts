// F-ORDERDETAIL-1 (CAP-C51) — every field the customer order-detail drop reads must be SELECTed.
//
// mapOrderDetailDrop coerces each field with a fallback (`Number(row.subtotal) || 0`,
// `typeof row.payment_method === 'string' ? … : 'cod'`), so a column missing from the endpoint's
// SELECT does not throw — it renders a plausible wrong value. That is why this shipped and stayed:
// every customer's order detail showed a zero subtotal, no discount, no shipping cost, an always-COD
// payment method and an always-pending payment status, for every order, with nothing failing.
//
// So this test does not assert a snapshot of today's column list. It DERIVES the reads from
// customer-drop.ts and requires each one to appear in the SELECT — if someone adds a read tomorrow
// without adding the column, this fails and names it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dropSource = readFileSync(
    new URL('../../../../apps/customer_web/src/lib/customer-drop.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(
    new URL('../routes/storefront/customer-engagement-routes.ts', import.meta.url), 'utf8');

// Reads that are deliberately NOT columns on `orders`, with the reason. Anything else must be selected.
const NON_COLUMN_READS = new Set([
    'number',   // fallback alias in `row.order_number ?? row.number` — order_number is the real column
]);

// `items` is a column ONLY on the non-relational branch. When ORDER_ITEMS_RELATIONAL_READS is on the
// rows come from hydrateStorefrontOrderItems via the order_items relation instead, which is also why
// that branch carries store_id (the hydration guard needs it). So it is checked per branch below
// rather than required of both — stated here because silently exempting it would hide the next real
// divergence.
const RELATIONAL_HYDRATED_READS = new Set(['items']);

function mapOrderDetailDropBody(): string {
    const start = dropSource.indexOf('function mapOrderDetailDrop(');
    assert.ok(start > -1, 'mapOrderDetailDrop must exist — this guard is anchored on it');
    const end = dropSource.indexOf('\n}', start);
    return dropSource.slice(start, end);
}

function customerOrdersSelects(): string[] {
    const start = routeSource.indexOf("router.get('/customer/orders'");
    assert.ok(start > -1, "the /customer/orders handler must exist");
    const end = routeSource.indexOf('\n    });', start);
    const handler = routeSource.slice(start, end);
    const selects = [...handler.matchAll(/'([a-z_0-9, ]+)'/g)]
        .map((m) => m[1])
        .filter((s) => s.includes('order_number'));
    assert.ok(selects.length >= 2, 'both the relational and non-relational SELECT branches must be found');
    return selects;
}

const fieldsRead = [...new Set([...mapOrderDetailDropBody().matchAll(/\brow\.([a-z_0-9]+)/g)].map((m) => m[1]))]
    .filter((f) => !NON_COLUMN_READS.has(f))
    .sort();

test('the drop reads a non-trivial set of fields — the guard is not vacuous', () => {
    assert.ok(fieldsRead.length >= 12, `expected a substantial read set, found ${fieldsRead.length}: ${fieldsRead}`);
    for (const expected of ['subtotal', 'discount', 'shipping_cost', 'payment_method', 'payment_status']) {
        assert.ok(fieldsRead.includes(expected), `${expected} should be among the drop's reads`);
    }
});

test('every field mapOrderDetailDrop reads is present in BOTH SELECT branches', () => {
    const selects = customerOrdersSelects();
    const missing: string[] = [];
    for (const select of selects) {
        const columns = new Set(select.split(',').map((c) => c.trim()));
        const relationalBranch = columns.has('store_id');
        for (const field of fieldsRead) {
            if (relationalBranch && RELATIONAL_HYDRATED_READS.has(field)) continue;
            if (!columns.has(field)) missing.push(`${field} (missing from: ${select.slice(0, 60)}…)`);
        }
    }
    assert.deepEqual(
        missing,
        [],
        'a read with no matching column does not throw — it renders a fallback, which is how CAP-C51 ' +
        'shipped a zero subtotal and an always-COD payment method to every customer',
    );
});

test('the two SELECT branches agree on the customer-visible fields', () => {
    // They differ legitimately: the relational branch carries store_id for the item-hydration guard,
    // the other carries `items`. Everything the drop reads must be in both.
    const [a, b] = customerOrdersSelects().map((s) => new Set(s.split(',').map((c) => c.trim())));
    const shared = fieldsRead.filter((f) => !RELATIONAL_HYDRATED_READS.has(f));
    const onlyInA = shared.filter((f) => a.has(f) && !b.has(f));
    const onlyInB = shared.filter((f) => b.has(f) && !a.has(f));
    assert.deepEqual({ onlyInA, onlyInB }, { onlyInA: [], onlyInB: [] });

    // And the exception is real, not a way out: `items` must still be a column on the branch that
    // does not hydrate from the relation.
    const nonRelational = a.has('store_id') ? b : a;
    assert.ok(nonRelational.has('items'), 'the non-relational branch must still select items');
});
