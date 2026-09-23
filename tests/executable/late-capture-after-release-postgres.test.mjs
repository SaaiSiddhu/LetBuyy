// F-PAY4-1 — a provider capture must never turn an order whose stock was released into a normal,
// fulfillable order (LB-PAY-004, 2026-09-19 unified-commerce audit), and every captured payment must
// reach the ledger exactly once.
//
// THE DEFECT, AS READ AT 1e6cc4c3
// create_checkout_order reserves AND commits stock at order creation on the razorpay rail, before the
// buyer has paid. expire_unpaid_committed_reservations (211) releases that stock once the grace period
// passes, through release_order_inventory (246) — which stamps orders.inventory_released_at and marks
// the reservations 'released' but never changes orders.status. confirm_order_payment (000_baseline,
// never redefined) refuses only status IN ('cancelled','refunded'). So a capture that lands after the
// sweep reads a 'pending' order, passes the guard, and sets it 'confirmed' + 'paid' — a normal,
// fulfillable order whose unit may already belong to someone else.
//
// Two siblings of the same defect are measured here too:
//   * Razorpay allows a second attempt on the same provider order. When the first attempt's
//     payment.failed cancels the order (record_order_payment_failure, which also releases stock), the
//     second attempt's capture makes confirm_order_payment raise 'order is not payable': the buyer's
//     money is taken and nothing records it.
//   * The buyer's verify callback and the payment.captured webhook confirm ONE payment under two
//     different idempotency keys, and ledger_transactions dedupes only on
//     (site_id, source_type, source_id, idempotency_key) — so the wrapper posted it twice.
//
// Reproduced against 000..251 (F-PAY4-1, 2026-09-23): the LB-PAY-004, retry-capture, verify+webhook
// and in-flight-sweep tests below all FAIL there; they pass once 252 is applied. The CONTROL test
// re-runs the defect inside this suite by applying 252's rollback, then restores 252.
//
// Every call runs as the postgres superuser, the convention of every sibling suite: this proves the
// RPCs' own PL/pgSQL logic, not RLS. The RPCs under test are service-role paths (webhook, verify,
// scheduled sweeper), so no tenant GUC is set around them — exactly as production calls them.
//
// DESTRUCTIVE (recreates its database and replays every migration). Refuses the shared container.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_late_capture';

if (!containerName || containerName === 'letbuyy-executable-pg') {
    throw new Error(
        'late-capture-after-release-postgres.test.mjs is destructive (recreates its database and replays every ' +
        'migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER naming a dedicated throwaway ' +
        'container — use scripts/governance/run-executable-suites.mjs --filter late-capture.',
    );
}
if (databaseName === 'letbuyy_executable') {
    throw new Error("refusing to recreate the shared database 'letbuyy_executable'; name a private one");
}

const MIGRATION = 'database/supabase/migrations/252_late_capture_after_reservation_release.sql';
const ROLLBACK = 'database/supabase/rollback/252_late_capture_after_reservation_release.rollback.sql';
const FIX_PRESENT = existsSync(join(repoRoot, MIGRATION)) && existsSync(join(repoRoot, ROLLBACK));

const SITE = '11111111-1111-4111-8111-1111111152a1';
const LOCATION = '22222222-2222-4222-8222-2222222252a2';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

function psqlAsync(sql) {
    return new Promise((resolve, reject) => {
        const child = spawn('docker', [
            'exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(stderr.trim() || `psql exited with ${code}`));
        });
        child.stdin.end(sql);
    });
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));
const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

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
    VALUES (${sqlString(SITE)}::uuid, 'Late Capture Store', 'Late Capture Store', 'store', 'late-capture-store', true);
    INSERT INTO public.inventory_locations (id, store_id, name, is_default, status)
    VALUES (${sqlString(LOCATION)}::uuid, ${sqlString(SITE)}::uuid, 'Default', true, 'active');
    `);
}

let seq = 0;
const nextId = (prefix) => {
    seq += 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
};

// One product per scenario, so scenarios never share stock. `stock` is the whole shelf.
function seedProduct({ stock, price = 500 }) {
    seq += 1;
    const product = `33333333-3333-4333-8333-${String(seq).padStart(12, '0')}`;
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(product)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Item ${seq}', ${price}, true, 'active');
    INSERT INTO public.inventory_levels
      (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES (${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, ${sqlString(LOCATION)}::uuid, ${stock}, 0, ${stock}, 0, 0);
    `);
    return product;
}

// The real storefront checkout on the razorpay rail: reserve + commit at creation, exactly as the
// gateway's POST /storefront/:subdomain/orders does it.
function placeRazorpayOrder({ product, quantity = 1, key }) {
    const items = JSON.stringify([{ product_id: product, variant_id: null, quantity }]);
    const json = psql(`
    SELECT public.create_checkout_order(
        p_store_id => ${sqlString(SITE)}::uuid,
        p_customer_name => 'Late Buyer',
        p_customer_email => 'late-buyer@example.invalid',
        p_customer_phone => '9999999999',
        p_shipping_address => '{}'::jsonb,
        p_items => ${sqlString(items)}::jsonb,
        p_payment_method => 'razorpay',
        p_shipping_method => 'standard',
        p_idempotency_key => ${sqlString(key)},
        p_request_id => ${sqlString(`req-${key}`)}
    )::text;`);
    return JSON.parse(json).id;
}

// POST /storefront/:subdomain/payments/razorpay/order binds the order to the provider order first.
function attachProviderOrder(orderId, providerOrderId) {
    psql(`SELECT public.attach_order_payment_reference_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(providerOrderId)}, 'req-attach', ${sqlString(`attach:${orderId}`)});`);
}

// Age the commit past the sweeper's 60-second floor, then run the production sweep (queue-workers
// calls exactly this RPC on its cron, as the service role, with no tenant GUC).
function ageCommit(orderId, seconds = 600) {
    psql(`UPDATE public.inventory_reservations
             SET committed_at = now() - make_interval(secs => ${seconds})
           WHERE order_id = ${sqlString(orderId)}::uuid;`);
}
const sweepSql = `SELECT public.expire_unpaid_committed_reservations(100, 60, 'sweep');`;
const sweep = () => Number(psql(sweepSql));

// The exact argument shapes the two production callers send (checkout-payment-routes.ts verify, and
// internal-payment-routes.ts confirm on behalf of webhook-service's markOrderPaid).
function confirmSql({ orderId, paymentId, providerOrderId, via, eventId }) {
    const providerEventId = via === 'verify' ? `razorpay:checkout:${paymentId}` : eventId;
    const key = via === 'verify'
        ? `razorpay-verify-${paymentId}`
        : `payment-webhook:razorpay:${eventId}:paid`;
    return `SELECT public.confirm_order_payment_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(paymentId)}, ${sqlString(providerOrderId)},
        ${sqlString(providerEventId)}, ${sqlString(`req-${via}-${paymentId}`)}, ${sqlString(key)})::text;`;
}
const confirm = (args) => JSON.parse(psql(confirmSql(args)));

// webhook-service markOrderFailed → record_order_payment_failure_with_ledger, stock released.
function failPayment(orderId, eventId) {
    psql(`SELECT public.record_order_payment_failure_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(eventId)}, 'failed', 'cancelled', 'card_declined', true,
        'req-fail', ${sqlString(`payment-webhook:razorpay:${eventId}:failed`)});`);
}

// webhook-service markOrderRefunded → the provider's refund.created reconciles the ledger.
function reconcileProviderRefund(orderId, eventId) {
    psql(`SELECT public.record_order_payment_failure_with_ledger(
        ${sqlString(orderId)}::uuid, 'razorpay', ${sqlString(eventId)}, 'refunded', 'refunded', 'refund_created', false,
        'req-refund', ${sqlString(`payment-webhook:razorpay:${eventId}:refunded`)});`);
}

function orderState(orderId) {
    const row = psql(`SELECT json_build_object(
        'status', status, 'payment_status', payment_status, 'refund_status', refund_status,
        'fulfillment_state', fulfillment_state, 'released', inventory_released_at IS NOT NULL,
        'payment_id', payment_id)::text
      FROM public.orders WHERE id = ${sqlString(orderId)}::uuid;`);
    return JSON.parse(row);
}
const reservationStatuses = (orderId) => psql(
    `SELECT string_agg(DISTINCT status, ',' ORDER BY status) FROM public.inventory_reservations
      WHERE order_id = ${sqlString(orderId)}::uuid AND deleted_at IS NULL;`);
const available = (product) => Number(psql(
    `SELECT available FROM public.inventory_levels WHERE product_id = ${sqlString(product)}::uuid;`));
const captureCount = (paymentId) => Number(psql(
    `SELECT count(*) FROM public.ledger_transactions
      WHERE site_id = ${sqlString(SITE)}::uuid AND source_type = 'payment_capture'
        AND source_id = ${sqlString(`razorpay:${paymentId}`)};`));
// Net merchant_payable (credits minus debits, paise) across every ledger posting that names the order.
const merchantPayableNet = (orderId) => Number(psql(
    `SELECT COALESCE(SUM(CASE e.side WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0)
       FROM public.ledger_entries e
       JOIN public.ledger_transactions t ON t.id = e.transaction_id
       JOIN public.ledger_accounts a ON a.id = e.account_id
      WHERE t.site_id = ${sqlString(SITE)}::uuid AND a.account_code = 'merchant_payable'
        AND t.metadata->>'order_id' = ${sqlString(orderId)};`));
const refundOwed = (orderId) => psql(
    `SELECT COALESCE(string_agg(action || ':' || status, ',' ORDER BY created_at), '')
       FROM public.compensation_actions
      WHERE site_id = ${sqlString(SITE)}::uuid AND aggregate_type = 'order'
        AND aggregate_id = ${sqlString(orderId)}::uuid AND deleted_at IS NULL;`);
const refundOwedCount = (orderId) => Number(psql(
    `SELECT count(*) FROM public.compensation_actions
      WHERE site_id = ${sqlString(SITE)}::uuid AND aggregate_id = ${sqlString(orderId)}::uuid
        AND action = 'refund_captured_payment' AND deleted_at IS NULL;`));
const outboxCount = (orderId, eventType) => Number(psql(
    `SELECT count(*) FROM public.outbox_events
      WHERE aggregate_type = 'order' AND aggregate_id = ${sqlString(orderId)} AND event_type = ${sqlString(eventType)};`));
const fulfilSql = (orderId, key) => `SELECT public.create_order_fulfillment(
    ${sqlString(orderId)}::uuid, NULL, NULL, 'self', NULL, NULL, NULL, 'req-fulfil', ${sqlString(key)})::text;`;

function assertNotFulfillable(orderId) {
    assert.throws(() => psql(fulfilSql(orderId, `fulfil:${orderId}`)), /cannot be fulfilled/,
        'an order whose paid capture arrived after its stock was released must be refused by fulfilment');
}

// An order that took a real capture but can no longer be fulfilled: the money is recorded once, the
// order is out of the fulfilment path, and a refund is owed on the record.
function assertUnfulfillableCapture({ orderId, paymentId }) {
    const state = orderState(orderId);
    assert.equal(state.status, 'cancelled', 'the order must leave the fulfilment path');
    assert.equal(state.payment_status, 'paid', 'the provider captured the money — say so');
    assert.equal(state.refund_status, 'pending', 'a refund is owed and must be recorded as owed');
    assert.equal(state.fulfillment_state, 'cancelled');
    assert.equal(captureCount(paymentId), 1, 'the capture is posted to the ledger exactly once');
    assert.match(refundOwed(orderId), /refund_captured_payment:pending/, 'the refund obligation is queued');
    assertNotFulfillable(orderId);
}

before(() => { bootstrapDatabase(); });
after(() => {
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* leave for inspection */ }
});

test('normal payment inside the reservation window confirms the order and keeps its stock', () => {
    const product = seedProduct({ stock: 3 });
    const orderId = placeRazorpayOrder({ product, key: nextId('normal') });
    attachProviderOrder(orderId, 'order_RZP_normal');
    assert.equal(available(product), 2, 'checkout commits the unit at creation');

    const result = confirm({ orderId, paymentId: 'pay_normal', providerOrderId: 'order_RZP_normal', via: 'verify' });
    assert.equal(result.capture_outcome, 'confirmed', 'the gateway reads this to decide whether to announce order.paid');
    assert.equal(result.fulfillable, true);

    const state = orderState(orderId);
    assert.equal(state.status, 'confirmed');
    assert.equal(state.payment_status, 'paid');
    assert.equal(state.released, false);
    assert.equal(reservationStatuses(orderId), 'committed');
    assert.equal(available(product), 2, 'the paid order keeps its unit');
    assert.equal(captureCount('pay_normal'), 1);
    assert.equal(merchantPayableNet(orderId), 50000);
    assert.equal(refundOwed(orderId), '', 'nothing is owed on a normal capture');
    assert.equal(outboxCount(orderId, 'order.cancelled'), 0);
});

test('a delayed payment that lands before the grace period expires is still confirmed normally', () => {
    const product = seedProduct({ stock: 2 });
    const orderId = placeRazorpayOrder({ product, key: nextId('delayed') });
    attachProviderOrder(orderId, 'order_RZP_delayed');
    ageCommit(orderId, 30); // inside the sweeper's 60-second floor: not yet eligible

    assert.equal(sweep(), 0, 'the sweep must not release stock that is still inside its grace period');
    const result = confirm({ orderId, paymentId: 'pay_delayed', providerOrderId: 'order_RZP_delayed', via: 'webhook', eventId: 'evt_delayed' });
    assert.equal(result.capture_outcome, 'confirmed');

    const state = orderState(orderId);
    assert.equal(state.status, 'confirmed', 'a legitimate delayed webhook keeps working');
    assert.equal(state.payment_status, 'paid');
    assert.equal(reservationStatuses(orderId), 'committed');
    assert.equal(available(product), 1);
    assert.equal(sweep(), 0, 'a paid order is never swept afterwards');
    assert.equal(reservationStatuses(orderId), 'committed');
});

test('LB-PAY-004: a capture after the sweep released the stock must not produce a fulfillable order', () => {
    const product = seedProduct({ stock: 1 });
    const lateOrder = placeRazorpayOrder({ product, key: nextId('late') });
    attachProviderOrder(lateOrder, 'order_RZP_late');
    assert.equal(available(product), 0, 'the last unit is committed to the first buyer');

    ageCommit(lateOrder);
    assert.equal(sweep(), 1, 'the unpaid order is released by the production sweep');
    assert.equal(available(product), 1, 'the unit is back on the shelf');

    // The harm: a second buyer legitimately takes the unit that came back.
    const secondOrder = placeRazorpayOrder({ product, key: nextId('second') });
    attachProviderOrder(secondOrder, 'order_RZP_second');
    confirm({ orderId: secondOrder, paymentId: 'pay_second', providerOrderId: 'order_RZP_second', via: 'verify' });
    assert.equal(orderState(secondOrder).status, 'confirmed');
    assert.equal(available(product), 0);

    // Then the first buyer's capture arrives — slow UPI, a webhook retried hours later.
    const result = confirm({ orderId: lateOrder, paymentId: 'pay_late', providerOrderId: 'order_RZP_late', via: 'webhook', eventId: 'evt_late' });

    assertUnfulfillableCapture({ orderId: lateOrder, paymentId: 'pay_late' });
    assert.equal(result.capture_outcome, 'captured_unfulfillable');
    assert.equal(result.fulfillable, false, 'the gateway must not announce order.paid for this capture');
    assert.equal(result.unfulfillable_reason, 'reservation_released');
    assert.equal(reservationStatuses(lateOrder), 'released', 'the late capture does not silently re-take stock');
    assert.equal(available(product), 0, 'the second buyer keeps the unit; nothing is oversold');
    assert.equal(orderState(secondOrder).status, 'confirmed');
    assert.equal(outboxCount(lateOrder, 'order.cancelled'), 1, 'the customer is told, in the same transaction');
    assert.equal(outboxCount(lateOrder, 'order.paid'), 0, 'and is never told the order was paid for');

    // The buyer's browser callback for the same late payment arrives too, then a webhook redelivery.
    const again = confirm({ orderId: lateOrder, paymentId: 'pay_late', providerOrderId: 'order_RZP_late', via: 'verify' });
    confirm({ orderId: lateOrder, paymentId: 'pay_late', providerOrderId: 'order_RZP_late', via: 'webhook', eventId: 'evt_late' });
    assert.equal(again.capture_outcome, 'duplicate');
    assert.equal(again.fulfillable, false, 'a re-notification of an unfulfillable capture is still unfulfillable');
    assert.equal(again.unfulfillable_reason, 'reservation_released', 'and it still says why');
    assert.equal(captureCount('pay_late'), 1, 'still one capture');
    assert.equal(refundOwedCount(lateOrder), 1, 'still one refund owed');
    assert.equal(outboxCount(lateOrder, 'order.cancelled'), 1, 'still one cancellation notice');
    assert.equal(merchantPayableNet(lateOrder), 50000, 'booked once, as a normal capture, until the refund reverses it');
});

test('a second attempt captured after payment.failed cancelled the order is recorded, not refused', () => {
    const product = seedProduct({ stock: 2 });
    const orderId = placeRazorpayOrder({ product, key: nextId('retry') });
    attachProviderOrder(orderId, 'order_RZP_retry');
    failPayment(orderId, 'evt_retry_failed');
    assert.equal(orderState(orderId).status, 'cancelled');
    assert.equal(available(product), 2, 'payment.failed released the unit');

    // Attempt two on the same provider order succeeds and is captured. Refusing it leaves the buyer's
    // money taken with no record anywhere but a 'failed' webhook row.
    const result = confirm({ orderId, paymentId: 'pay_retry_2', providerOrderId: 'order_RZP_retry', via: 'webhook', eventId: 'evt_retry_captured' });

    assertUnfulfillableCapture({ orderId, paymentId: 'pay_retry_2' });
    assert.equal(result.unfulfillable_reason, 'order_cancelled');
    assert.equal(available(product), 2, 'no stock is taken for a cancelled order');
});

test('a capture bound to a different provider order is refused and records nothing, even on a released order', () => {
    const product = seedProduct({ stock: 1 });
    const orderId = placeRazorpayOrder({ product, key: nextId('bind') });
    attachProviderOrder(orderId, 'order_RZP_bind');
    ageCommit(orderId);
    assert.equal(sweep(), 1);

    // The unfulfillable branch must not become a way to attach someone else's payment to this order.
    assert.throws(
        () => confirm({ orderId, paymentId: 'pay_bind_other', providerOrderId: 'order_RZP_someone_else', via: 'webhook', eventId: 'evt_bind' }),
        /payment reference mismatch/,
    );
    assert.equal(captureCount('pay_bind_other'), 0);
    assert.equal(refundOwedCount(orderId), 0);
    assert.equal(orderState(orderId).status, 'pending', 'nothing about the order changed');
});

test('a different payment for an order another payment already paid is refused explicitly', () => {
    const product = seedProduct({ stock: 2 });
    const orderId = placeRazorpayOrder({ product, key: nextId('twice') });
    attachProviderOrder(orderId, 'order_RZP_twice');
    confirm({ orderId, paymentId: 'pay_twice_1', providerOrderId: 'order_RZP_twice', via: 'verify' });

    // With the provider order id the binding check refuses it (the stored reference is now the first
    // payment); without one, 252's explicit refusal does — the old wrapper overwrote the first payment's row.
    assert.throws(
        () => confirm({ orderId, paymentId: 'pay_twice_2', providerOrderId: 'order_RZP_twice', via: 'webhook', eventId: 'evt_twice' }),
        /payment reference mismatch/,
    );
    assert.throws(
        () => psql(`SELECT public.confirm_order_payment_with_ledger(
            ${sqlString(orderId)}::uuid, 'razorpay', 'pay_twice_3', NULL, 'evt_twice_3', 'req-twice-3', 'k-twice-3');`),
        /already paid by a different payment/,
    );
    assert.equal(captureCount('pay_twice_1'), 1);
    assert.equal(captureCount('pay_twice_3'), 0);
    assert.equal(orderState(orderId).payment_id, 'pay_twice_1', 'the first payment is still the one on record');
    assert.equal(psql(`SELECT provider_payment_id FROM public.payment_transactions WHERE order_id = ${sqlString(orderId)}::uuid;`), 'pay_twice_1',
        'the first payment\'s row was not overwritten');
});

test('the verify callback and the webhook confirming one payment post exactly one capture', () => {
    const product = seedProduct({ stock: 2 });
    const orderId = placeRazorpayOrder({ product, key: nextId('pair') });
    attachProviderOrder(orderId, 'order_RZP_pair');

    // The ordinary production sequence: the browser callback first, the webhook seconds later.
    confirm({ orderId, paymentId: 'pay_pair', providerOrderId: 'order_RZP_pair', via: 'verify' });
    const second = confirm({ orderId, paymentId: 'pay_pair', providerOrderId: 'order_RZP_pair', via: 'webhook', eventId: 'evt_pair' });
    // And a webhook redelivery on top.
    confirm({ orderId, paymentId: 'pay_pair', providerOrderId: 'order_RZP_pair', via: 'webhook', eventId: 'evt_pair' });

    assert.equal(captureCount('pay_pair'), 1, 'one provider payment is one ledger capture, whichever path reports it');
    assert.equal(merchantPayableNet(orderId), 50000, 'merchant_payable is credited once, not per notification');
    assert.equal(second.capture_outcome, 'duplicate');
    assert.equal(second.fulfillable, true, 'the order is paid and fulfillable — the second path reports success, not an error');
    const state = orderState(orderId);
    assert.equal(state.status, 'confirmed');
    assert.equal(state.payment_status, 'paid');
    assert.equal(refundOwed(orderId), '', 'a duplicate notification is not a second payment');
});

test('the verify callback and the webhook racing on one payment still post exactly one capture', async () => {
    const product = seedProduct({ stock: 2 });
    const orderId = placeRazorpayOrder({ product, key: nextId('pair-race') });
    attachProviderOrder(orderId, 'order_RZP_pair_race');

    const attempts = await Promise.allSettled([
        psqlAsync(confirmSql({ orderId, paymentId: 'pay_pair_race', providerOrderId: 'order_RZP_pair_race', via: 'verify' })),
        psqlAsync(confirmSql({ orderId, paymentId: 'pay_pair_race', providerOrderId: 'order_RZP_pair_race', via: 'webhook', eventId: 'evt_pair_race' })),
        psqlAsync(confirmSql({ orderId, paymentId: 'pay_pair_race', providerOrderId: 'order_RZP_pair_race', via: 'webhook', eventId: 'evt_pair_race' })),
    ]);
    assert.deepEqual(attempts.map((a) => a.status), ['fulfilled', 'fulfilled', 'fulfilled'],
        `every notification of a real capture must succeed: ${attempts.map((a) => a.reason?.message).filter(Boolean).join(' | ')}`);
    assert.equal(captureCount('pay_pair_race'), 1);
    assert.equal(merchantPayableNet(orderId), 50000);
    const outcomes = attempts.map((a) => JSON.parse(a.value).capture_outcome).sort();
    assert.deepEqual(outcomes, ['confirmed', 'duplicate', 'duplicate'], 'exactly one of the three confirms the order');
    assert.equal(orderState(orderId).status, 'confirmed');
});

test('a capture that waits behind an in-flight sweep sees the release and does not confirm the order', async () => {
    // Deterministic interleaving: the sweep holds the order row (stock already released, not yet
    // committed) when the capture arrives; the capture blocks on the row lock until the sweep commits.
    for (let i = 0; i < 3; i += 1) {
        const product = seedProduct({ stock: 1 });
        const orderId = placeRazorpayOrder({ product, key: nextId('sweep-first') });
        const paymentId = `pay_sweep_first_${i}`;
        attachProviderOrder(orderId, `order_RZP_sweep_first_${i}`);
        ageCommit(orderId);

        const sweepInFlight = psqlAsync(`BEGIN; ${sweepSql} SELECT pg_sleep(0.8); COMMIT;`);
        await delay(250);
        const capture = psqlAsync(confirmSql({ orderId, paymentId, providerOrderId: `order_RZP_sweep_first_${i}`, via: 'webhook', eventId: `evt_sweep_first_${i}` }));
        const [swept, captured] = await Promise.allSettled([sweepInFlight, capture]);

        assert.equal(swept.status, 'fulfilled', `run ${i}: ${swept.reason?.message}`);
        assert.equal(swept.value.split('\n')[0], '1', `run ${i}: the sweep released the order before the capture could lock it`);
        assert.equal(captured.status, 'fulfilled', `run ${i}: a real capture is never refused: ${captured.reason?.message}`);
        // Behaviour first, so a regression names the defect rather than the contract field.
        assertUnfulfillableCapture({ orderId, paymentId });
        assert.equal(available(product), 1, `run ${i}: the released unit stays on the shelf`);
        assert.equal(JSON.parse(captured.value).capture_outcome, 'captured_unfulfillable', `run ${i}`);
    }
});

test('a sweep that arrives while a capture is in flight skips the order and never releases paid stock', async () => {
    // The opposite interleaving: the capture holds the order row; 211's FOR UPDATE SKIP LOCKED skips
    // it, and once the capture commits the order is paid and out of the sweep's reach for good.
    for (let i = 0; i < 3; i += 1) {
        const product = seedProduct({ stock: 1 });
        const orderId = placeRazorpayOrder({ product, key: nextId('capture-first') });
        const paymentId = `pay_capture_first_${i}`;
        attachProviderOrder(orderId, `order_RZP_capture_first_${i}`);
        ageCommit(orderId);

        const captureInFlight = psqlAsync(`BEGIN; ${confirmSql({ orderId, paymentId, providerOrderId: `order_RZP_capture_first_${i}`, via: 'webhook', eventId: `evt_capture_first_${i}` })} SELECT pg_sleep(0.8); COMMIT;`);
        await delay(250);
        const swept = await psqlAsync(sweepSql);
        const captured = await captureInFlight;

        assert.equal(swept, '0', `run ${i}: the in-flight capture's row lock makes the sweep skip this order`);
        const state = orderState(orderId);
        assert.equal(state.status, 'confirmed', `run ${i}`);
        assert.equal(state.released, false, `run ${i}`);
        assert.equal(reservationStatuses(orderId), 'committed', `run ${i}`);
        assert.equal(available(product), 0, `run ${i}: the paid order keeps its unit`);
        assert.equal(sweep(), 0, `run ${i}: a later sweep never touches a paid order`);
        assert.equal(captureCount(paymentId), 1, `run ${i}`);
        assert.equal(JSON.parse(captured.split('\n')[0]).capture_outcome, 'confirmed', `run ${i}`);
    }
});

test('recovery: the provider refund reconciles a late capture to zero and restocks nothing twice', () => {
    const product = seedProduct({ stock: 1 });
    const orderId = placeRazorpayOrder({ product, key: nextId('recover') });
    attachProviderOrder(orderId, 'order_RZP_recover');
    ageCommit(orderId);
    assert.equal(sweep(), 1);
    confirm({ orderId, paymentId: 'pay_recover', providerOrderId: 'order_RZP_recover', via: 'webhook', eventId: 'evt_recover' });
    assert.equal(merchantPayableNet(orderId), 50000, 'the captured money is on the ledger until it is returned');
    assert.equal(available(product), 1);

    // The refund is executed at the provider; its refund.created webhook runs the existing
    // reconciliation (webhook-service markOrderRefunded requires payment_status 'paid', which 252 sets).
    reconcileProviderRefund(orderId, 'evt_recover_refund');

    const state = orderState(orderId);
    assert.equal(state.payment_status, 'refunded');
    assert.equal(state.status, 'refunded');
    assert.equal(merchantPayableNet(orderId), 0, 'capture and refund net to zero — nothing is left owed to or by the merchant');
    assert.equal(available(product), 1, 'the refund does not restock a unit the sweep already returned');
});

test('CONTROL: with 252 rolled back the late capture confirms a released order again', { skip: FIX_PRESENT ? false : 'migration 252 is not in this tree' }, () => {
    // Without this, "the order ends up cancelled" could be true for a reason unrelated to 252. The
    // defect must be shown present before it is shown absent.
    applySqlFile(ROLLBACK);
    try {
        const product = seedProduct({ stock: 1 });
        const orderId = placeRazorpayOrder({ product, key: nextId('control') });
        attachProviderOrder(orderId, 'order_RZP_control');
        ageCommit(orderId);
        assert.equal(sweep(), 1);
        confirm({ orderId, paymentId: 'pay_control', providerOrderId: 'order_RZP_control', via: 'webhook', eventId: 'evt_control' });
        const state = orderState(orderId);
        assert.equal(state.status, 'confirmed', 'pre-252: the released order is confirmed — the defect');
        assert.equal(state.released, true);
        assert.equal(reservationStatuses(orderId), 'released');
        // create_order_fulfillment's only status gate refuses cancelled/refunded, so 'confirmed' passes
        // it. The call itself cannot be used as proof here: that RPC fails on EVERY order with a
        // separate, pre-existing uuid/text defect (order_items.variant_id text into
        // fulfillment_order_lines.variant_id uuid, 000_baseline:2353 line 152) — registered, not fixed here.
        assert.throws(() => psql(fulfilSql(orderId, `fulfil:${orderId}`)), (error) => {
            assert.doesNotMatch(error.message, /cannot be fulfilled/, 'pre-252: the status gate lets the late-captured order through');
            return true;
        });

        // And the double posting returns with it.
        confirm({ orderId, paymentId: 'pay_control', providerOrderId: 'order_RZP_control', via: 'verify' });
        assert.equal(captureCount('pay_control'), 2, 'pre-252: a second notification posts the capture again');
    } finally {
        applySqlFile(MIGRATION);
    }
    const after = seedProduct({ stock: 1 });
    const orderId = placeRazorpayOrder({ product: after, key: nextId('control-after') });
    attachProviderOrder(orderId, 'order_RZP_control_after');
    ageCommit(orderId);
    assert.equal(sweep(), 1);
    confirm({ orderId, paymentId: 'pay_control_after', providerOrderId: 'order_RZP_control_after', via: 'webhook', eventId: 'evt_control_after' });
    assertUnfulfillableCapture({ orderId, paymentId: 'pay_control_after' });
});
