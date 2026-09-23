// F-BIL1-1 (LB-BIL-001) — one captured subscription payment activates one subscription.
//
// Two routes activate a merchant subscription for the same Razorpay payment, seconds apart:
//   - POST /payments/subscription/verify, when the merchant's browser returns from checkout;
//   - POST /internal/billing/subscriptions/activate, which webhook-service calls on payment.captured,
//     because billing checkout notes carry store_id and plan_slug and no order matches.
// Both call SubscriptionExecutionAdapter.activateMerchantSubscription. Every call used to cancel the
// store's active subscription, insert a new one with a fresh period and record another invoice, so
// one payment became two subscriptions (the first cancelled) and two invoices. And because nothing
// remembered the payment, submitting the same verify request a month later started a new period
// for nothing.
//
// The routes run for real (Hono routing, validation, the signature check, the provider capture
// check, the tenant query guard) against a fake PostgREST on globalThis.fetch, the harness shape
// late-capture-route-outcomes.test.ts uses. The fake enforces the one constraint this depends on,
// subscriptions_site_id_idempotency_key_idx from migration 152. That real Postgres enforces it the
// same way under concurrency is proven in tests/executable/subscription-payment-idempotency-postgres.test.mjs.

import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test, { afterEach, mock } from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import paymentsRouter from '../routes/payments';
import internalBillingRouter from '../routes/internal-billing';

const POSTGREST_ORIGIN = 'https://single-activation.fake-postgrest.test';
const RAZORPAY_ORIGIN = 'https://api.razorpay.com';
const STORE = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const SECOND_STORE = 'aaaaaaaa-0000-4000-8000-0000000000b2';
const OWNER = 'cccccccc-0000-4000-8000-0000000000c1';
const PLAN_ID = 'dddddddd-0000-4000-8000-0000000000d1';
const KEY_SECRET = 'rzp-test-secret-for-route-tests-only';
const INTERNAL_SECRET = 'internal-secret-for-route-tests-only';
const PRICE_MINOR = 99900;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;
type Json = Record<string, any>;
type Condition = { column: string; op: string; value: string };

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        RAZORPAY_KEY_ID: 'rzp_route_test_key',
        RAZORPAY_KEY_SECRET: KEY_SECRET,
        INTERNAL_API_SECRET: INTERNAL_SECRET,
    } as unknown as Env;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// PostgREST filters as these routes write them: col=op.value and or=(col.op.value,...).
function parseCondition(column: string, expression: string): Condition {
    const dot = expression.indexOf('.');
    return { column, op: expression.slice(0, dot), value: expression.slice(dot + 1) };
}

function holds(row: Row, { column, op, value }: Condition): boolean {
    const actual = row[column];
    const present = actual !== null && actual !== undefined;
    if (op === 'eq') return present && String(actual) === value;
    if (op === 'neq') return present && String(actual) !== value; // SQL: NULL <> x is not true
    if (op === 'is') return value === 'null' ? !present : String(actual) === value;
    if (op === 'in') return present && value.replace(/^\(|\)$/g, '').split(',').includes(String(actual));
    throw new Error(`fake PostgREST: unsupported operator ${op} on ${column}`);
}

function rowFilter(params: URLSearchParams): (row: Row) => boolean {
    const all: Condition[] = [];
    let any: Condition[] | null = null;
    for (const [key, expression] of params) {
        if (['select', 'limit', 'order', 'on_conflict', 'columns', 'offset'].includes(key)) continue;
        if (key === 'or') {
            any = expression.replace(/^\(|\)$/g, '').split(',').map((part) => {
                const [column, ...rest] = part.split('.');
                return parseCondition(column, rest.join('.'));
            });
            continue;
        }
        all.push(parseCondition(key, expression));
    }
    return (row) => all.every((c) => holds(row, c)) && (!any || any.some((c) => holds(row, c)));
}

function ordered(rows: Row[], order: string | null): Row[] {
    if (!order) return rows;
    const [column, direction] = order.split('.');
    const sign = direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const left = String(a[column] ?? '');
        const right = String(b[column] ?? '');
        if (left !== right) return left < right ? -sign : sign;
        return (Number(a._seq) - Number(b._seq)) * sign;
    });
}

// A stateful fake PostgREST holding exactly the tables these routes touch, plus Razorpay's payment API.
function installFake(options: { subscriptions?: Row[]; alignPaymentLookups?: number } = {}) {
    const originalFetch = globalThis.fetch;
    let seq = 0;
    const tables: Record<string, Row[]> = {
        users_custom: [{ id: OWNER, email: 'owner@example.test', full_name: 'Store Owner' }],
        sites: [STORE, SECOND_STORE].map((id) => ({
            id, user_id: OWNER, custom_user_id: OWNER, site_type: 'store', trial_status: 'active', deleted_at: null,
            price_lock_enabled: false, locked_launch_price: null, locked_growth_price: null,
        })),
        plans: [{
            id: PLAN_ID, slug: 'growth', site_type: 'store', is_active: true, name: 'Growth', status: 'available',
            price_monthly_inr: PRICE_MINOR, price_yearly_inr: PRICE_MINOR, promo_price_inr: 0, promo_months: 0,
            founding_price_inr: 0, products_limit: 500,
        }],
        subscriptions: (options.subscriptions ?? []).map((row) => ({ _seq: ++seq, deleted_at: null, idempotency_key: null, ...row })),
        billing_history: [],
    };
    const allocations = new Map<string, Json>();
    const calls = { allocations: [] as Json[] };

    // Hold the first N reads of "has this payment activated a subscription?" until all N have
    // arrived, so concurrent activations see the same state before either writes.
    let lookups = 0;
    let releaseLookups: () => void = () => {};
    const lookupsAligned = new Promise<void>((resolve) => { releaseLookups = resolve; });
    if (options.alignPaymentLookups) setTimeout(() => releaseLookups(), 1000).unref();

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        const method = (init?.method || 'GET').toUpperCase();
        const headers = new Headers(init?.headers);
        const now = new Date().toISOString();

        if (url.origin === RAZORPAY_ORIGIN) {
            const paymentId = decodeURIComponent(url.pathname.split('/').pop() || '');
            return jsonResponse({ id: paymentId, entity: 'payment', status: 'captured', amount: PRICE_MINOR, currency: 'INR', order_id: `order_${paymentId}` });
        }
        if (url.origin !== POSTGREST_ORIGIN) return jsonResponse({ message: `unexpected origin ${url.origin}` }, 500);

        const path = url.pathname.replace('/rest/v1/', '');
        const body = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : undefined;

        if (path === 'rpc/allocate_founding_merchant') {
            calls.allocations.push(body);
            const siteId = String(body.p_site_id);
            const existing = allocations.get(siteId);
            if (existing) return jsonResponse({ ...existing, replayed: true });
            const allocation = { allocated: true, founding_number: allocations.size + 7, allocation_source: 'PUBLIC', plan_slug: 'growth', locked_monthly_price: PRICE_MINOR };
            allocations.set(siteId, allocation);
            return jsonResponse(allocation);
        }

        const rows = tables[path];
        if (!rows) return jsonResponse({ code: 'UNEXPECTED', message: `unexpected ${method} ${path}` }, 500);
        const wantsObject = (headers.get('Accept') || '').includes('vnd.pgrst.object+json');
        const representation = (headers.get('Prefer') || '').includes('return=representation');
        const answer = (result: Row[], status = 200) => {
            if (!wantsObject) return jsonResponse(result, status);
            if (result.length === 1) return jsonResponse(result[0], status);
            return jsonResponse({ code: 'PGRST116', details: `The result contains ${result.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
        };

        if (method === 'GET') {
            const limit = Number(url.searchParams.get('limit') || rows.length);
            const result = ordered(rows.filter(rowFilter(url.searchParams)), url.searchParams.get('order')).slice(0, limit).map((row) => ({ ...row }));
            if (path === 'subscriptions' && url.searchParams.has('razorpay_payment_id') && options.alignPaymentLookups) {
                lookups += 1;
                if (lookups <= options.alignPaymentLookups) {
                    if (lookups === options.alignPaymentLookups) releaseLookups();
                    await lookupsAligned;
                }
            }
            return answer(result);
        }
        if (method === 'POST') {
            const inserted = (Array.isArray(body) ? body : [body]).map((row: Row): Row => ({
                id: randomUUID(), created_at: now, updated_at: now, deleted_at: null, ...row, _seq: ++seq,
            }));
            if (path === 'subscriptions') {
                // subscriptions_site_id_idempotency_key_idx (migration 152).
                for (const row of inserted) {
                    const clash = row.idempotency_key != null && rows.some((other) => other.deleted_at == null
                        && other.site_id === row.site_id && other.idempotency_key === row.idempotency_key);
                    if (clash) {
                        return jsonResponse({
                            code: '23505',
                            details: `Key (site_id, idempotency_key)=(${row.site_id}, ${row.idempotency_key}) already exists.`,
                            hint: null,
                            message: 'duplicate key value violates unique constraint "subscriptions_site_id_idempotency_key_idx"',
                        }, 409);
                    }
                }
            }
            rows.push(...inserted);
            return representation ? answer(inserted.map((row) => ({ ...row })), 201) : new Response(null, { status: 201 });
        }
        if (method === 'PATCH') {
            const matched = rows.filter(rowFilter(url.searchParams));
            for (const row of matched) Object.assign(row, body, { updated_at: now });
            return representation ? answer(matched.map((row) => ({ ...row }))) : new Response(null, { status: 204 });
        }
        return jsonResponse({ code: 'UNEXPECTED', message: `unexpected ${method} ${path}` }, 500);
    }) as typeof globalThis.fetch;

    const subscriptionsFor = (paymentId: string) => tables.subscriptions.filter((row) => row.razorpay_payment_id === paymentId);
    const invoicesFor = (paymentId: string) => tables.billing_history.filter((row) => row.payment_id === paymentId);
    return { tables, calls, subscriptionsFor, invoicesFor, restore: () => { globalThis.fetch = originalFetch; } };
}

let fake: ReturnType<typeof installFake> | null = null;
afterEach(() => {
    fake?.restore();
    fake = null;
    mock.timers.reset();
});

function app() {
    const root = new Hono<{ Bindings: Env }>();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env();
        // A merchant session that is not pinned to one store, as after sign-in on the dashboard.
        c.set('auth' as never, { user: { id: OWNER, email: 'owner@example.test' } } as never);
        await next();
    });
    root.route('/payments', paymentsRouter);
    root.route('/internal/billing', internalBillingRouter);
    return root;
}

const signature = (orderId: string, paymentId: string) => createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

async function verify(paymentId: string, storeId = STORE) {
    const orderId = `order_${paymentId}`;
    const res = await app().request('/payments/subscription/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            store_id: storeId,
            plan_slug: 'growth',
            billing_period: 'monthly',
            site_type: 'store',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature(orderId, paymentId),
        }),
    });
    const parsed = await res.json() as Json;
    return { status: res.status, subscription: parsed.data?.subscription as Json | undefined, body: parsed };
}

// What webhook-service's activateGatewayStoreSubscription posts for a captured subscription payment.
async function webhookActivation(paymentId: string, storeId = STORE) {
    const res = await app().request('/internal/billing/subscriptions/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify({
            storeId,
            planSlug: 'growth',
            billingPeriod: 'monthly',
            provider: 'razorpay',
            providerOrderId: `order_${paymentId}`,
            providerPaymentId: paymentId,
            externalSubscriptionId: null,
            userId: OWNER,
            amountPaid: PRICE_MINOR,
        }),
    });
    const parsed = await res.json() as Json;
    return { status: res.status, subscription: parsed.data?.subscription as Json | undefined, body: parsed };
}

function assertActivatedOnce(paymentId: string, responses: Array<{ status: number; subscription?: Json }>) {
    const current = fake!;
    const rows = current.subscriptionsFor(paymentId);
    const invoices = current.invoicesFor(paymentId).length;
    assert.equal(rows.length, 1,
        `one payment must activate one subscription; found ${rows.length} (${rows.map((r) => r.status).join(', ')}) and ${invoices} invoice(s)`);
    assert.equal(rows[0].status, 'active', 'the one subscription the payment activated must be the live one');
    assert.equal(invoices, 1, 'one payment must be invoiced once');
    for (const response of responses) {
        assert.ok(response.status >= 200 && response.status < 300, `every caller is answered successfully (got ${response.status})`);
        assert.equal(response.subscription?.id, rows[0].id, 'every caller is told about the same subscription');
    }
}

test('LB-BIL-001: verify, then the webhook — one payment activates one subscription and is invoiced once', async () => {
    fake = installFake();
    const first = await verify('pay_VERIFY_FIRST');
    const second = await webhookActivation('pay_VERIFY_FIRST');
    assertActivatedOnce('pay_VERIFY_FIRST', [first, second]);
});

test('LB-BIL-001: the webhook, then verify — the same, and the webhook\'s subscription is not cancelled', async () => {
    fake = installFake();
    const first = await webhookActivation('pay_WEBHOOK_FIRST');
    const second = await verify('pay_WEBHOOK_FIRST');
    assertActivatedOnce('pay_WEBHOOK_FIRST', [first, second]);
});

test('LB-BIL-001: verify and the webhook at the same moment — the database admits one of them', async () => {
    // Both reach "has this payment activated anything?" before either writes, so only the unique
    // index can split them. The loser must answer with the winner's subscription, not an error.
    fake = installFake({ alignPaymentLookups: 2 });
    const [fromVerify, fromWebhook] = await Promise.all([verify('pay_RACE'), webhookActivation('pay_RACE')]);
    assertActivatedOnce('pay_RACE', [fromVerify, fromWebhook]);
});

test('a verify request replayed thirty days later starts no new period (it used to renew for free)', async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 1) });
    fake = installFake();
    const original = await verify('pay_REPLAYED');
    assert.equal(original.status, 201);

    mock.timers.setTime(Date.UTC(2026, 8, 1) + 30 * DAY_MS);
    const replay = await verify('pay_REPLAYED');
    assertActivatedOnce('pay_REPLAYED', [original, replay]);
    assert.equal(replay.subscription?.current_period_end, original.subscription?.current_period_end,
        'a payment that was already applied must not buy a second period');
});

test('a payment activated before this fix, whose row carries no key, is not activated again', async () => {
    // Rows written before the fix hold razorpay_payment_id but a NULL idempotency_key, so the unique
    // index cannot see them. Only the lookup by payment stops a replay of such a payment.
    fake = installFake({
        subscriptions: [{
            id: randomUUID(), store_id: STORE, site_id: STORE, user_id: OWNER, plan: 'growth', status: 'active',
            billing_period: 'monthly', razorpay_payment_id: 'pay_BEFORE_THE_FIX', amount_paid: PRICE_MINOR,
            current_period_end: '2026-10-01T00:00:00.000Z', created_at: '2026-09-01T00:00:00.000Z',
        }],
    });
    fake.tables.billing_history.push({ id: randomUUID(), payment_id: 'pay_BEFORE_THE_FIX', store_id: STORE });
    const replay = await verify('pay_BEFORE_THE_FIX');
    assertActivatedOnce('pay_BEFORE_THE_FIX', [replay]);
    assert.equal(replay.subscription?.current_period_end, '2026-10-01T00:00:00.000Z');
});

test('a new payment for the same store still replaces the active subscription', async () => {
    fake = installFake({
        subscriptions: [{
            id: randomUUID(), store_id: STORE, site_id: STORE, user_id: OWNER, plan: 'business', status: 'active',
            billing_period: 'monthly', razorpay_payment_id: 'pay_PREVIOUS', created_at: '2026-08-01T00:00:00.000Z',
        }],
    });
    const renewal = await verify('pay_NEXT_PERIOD');
    assert.equal(renewal.status, 201);
    assert.equal(fake.subscriptionsFor('pay_PREVIOUS')[0].status, 'cancelled', 'the previous subscription is retired');
    assertActivatedOnce('pay_NEXT_PERIOD', [renewal]);
});

test('the founding welcome still fires from verify when the webhook activated first', async () => {
    // The route sends the welcome email when its activation reports founding.allocated. With the
    // webhook first, verify used to reach allocate_founding_merchant through a second activation, and
    // the RPC's per-store replay answered allocated. Removing the second activation must keep that.
    fake = installFake();
    await webhookActivation('pay_FOUNDER');
    const fromVerify = await verify('pay_FOUNDER');
    assert.equal(fromVerify.subscription?.founding?.allocated, true);
    assertActivatedOnce('pay_FOUNDER', [fromVerify]);
});

test.todo('LB-BIL-002 (open): one payment cannot also activate a second store the same merchant owns', async () => {
    // The verify route checks the signature, the captured amount and the order binding, but never that
    // the Razorpay order was created for this store. Scoping the duplicate check to the store is what
    // the tenant guard allows; a cross-store check needs a deliberate decision (see the phase row).
    fake = installFake();
    await verify('pay_TWO_STORES', STORE);
    const secondStore = await verify('pay_TWO_STORES', SECOND_STORE);
    assert.notEqual(secondStore.status, 201);
    assert.equal(fake.subscriptionsFor('pay_TWO_STORES').length, 1);
});
