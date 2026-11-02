// F-PAY4-1 — the gateway half of migration 252.
//
// 252 makes confirm_order_payment_with_ledger report what it decided about a provider capture
// (capture_outcome + fulfillable). The database stops a late capture from becoming a fulfillable order;
// these tests pin that the three routes reporting a capture never ANNOUNCE one as paid — no order.paid
// event, no order confirmation — and answer the buyer honestly instead.
//
// The routes run for real (Hono routing, validation, the idempotency adapter, the replay guard, the
// Razorpay signature check) against a fake PostgREST installed on globalThis.fetch, the harness shape
// storefront-product-detail.test.ts uses. What the fake returns for the RPC is the RPC's contract, which
// tests/executable/late-capture-after-release-postgres.test.mjs proves against real Postgres.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { PaymentExecutionAdapter, readCaptureResult } from '../execution/payment-execution.adapter';
import { getSupabaseAdminFromEnv } from '../lib/supabase';
import { FIXED_PUBLIC_ERROR_MESSAGES } from '../lib/public-errors';
import { toInrMinorUnits } from '@letbuyy/payments';
import { registerStorefrontCheckoutPaymentRoutes } from '../routes/storefront/checkout-payment-routes';
import { registerStorefrontInternalPaymentRoutes } from '../routes/storefront/internal-payment-routes';
import { encryptPaymentSecret } from '../lib/store-payment-config';

const POSTGREST_ORIGIN = 'https://late-capture.fake-postgrest.test';
const STORE = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const ORDER = 'bbbbbbbb-0000-4000-8000-0000000000b1';
const KEY_SECRET = 'rzp-test-secret-for-route-tests-only';
const SHARED_SECRET = 'different-shared-secret-must-not-verify';
const STORE_KEY_ID = 'rzp_test_XXXXXXXXXXXX';
const STORE_CREDENTIAL_ID = 'cccccccc-0000-4000-8000-0000000000c1';
const ENCRYPTION_KEY = 'owned-route-test-encryption-key-2026';
const INTERNAL_SECRET = 'internal-secret-for-route-tests-only';
const STORE_PAYMENT_SETTINGS = encryptPaymentSecret(KEY_SECRET, ENCRYPTION_KEY,
    { siteId: STORE, keyId: STORE_KEY_ID, environment: 'sandbox' }).then(ciphertext => ({
    mode: 'ownAccount', razorpay: {
        key_id: STORE_KEY_ID, key_secret_ciphertext: ciphertext, verified: true, test_mode: true,
    },
}));
const PINNED_STORE_CREDENTIAL = encryptPaymentSecret(KEY_SECRET, ENCRYPTION_KEY,
    { siteId: STORE, keyId: STORE_KEY_ID, environment: 'sandbox', credentialId: STORE_CREDENTIAL_ID });

type Json = Record<string, unknown>;
type Captured = { method: string; path: string; body: unknown };

function env(providerPayment: Json = {}): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        RAZORPAY_KEY_ID: 'rzp_test_YYYYYYYYYYYY',
        RAZORPAY_KEY_SECRET: SHARED_SECRET,
        PAYMENT_CONFIG_ENCRYPTION_KEY: ENCRYPTION_KEY,
        HOSTED_RAZORPAY_TEST_ADAPTER: { fetchPayment: async () => ({
            id: 'pay_route', order_id: 'order_RZP_route', amount: 50000,
            currency: 'INR', status: 'captured', captured: true, ...providerPayment,
        }) },
        INTERNAL_API_SECRET: INTERNAL_SECRET,
    } as unknown as Env;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// A fake PostgREST that serves exactly what these routes read and records every write.
function installFakePostgrest(fixture: { order?: Json; rpcResult?: Json; onlinePaymentEnabled?: boolean;
    providerOrderAmount?: number; providerOrderCurrency?: string; pinnedMerchantAccount?: boolean }) {
    const originalFetch = globalThis.fetch;
    const requests: Captured[] = [];
    const razorpayRequests: Captured[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        if (url.origin === 'https://api.razorpay.com') {
            assert.equal(init?.headers && new Headers(init.headers).get('Authorization'),
                `Basic ${Buffer.from(`${STORE_KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
                'the provider request must use this store’s saved account');
            razorpayRequests.push({ method: init?.method || 'GET', path: url.pathname, body: init?.body });
            if (url.pathname === '/v1/orders') return jsonResponse({ id: 'order_RZP_route',
                amount: fixture.providerOrderAmount ?? 50000, currency: fixture.providerOrderCurrency ?? 'INR' });
            throw new Error(`unexpected provider request ${url.pathname}`);
        }
        assert.equal(url.origin, POSTGREST_ORIGIN, 'the route must only talk to the fake PostgREST');
        const method = (init?.method || 'GET').toUpperCase();
        const path = url.pathname.replace('/rest/v1/', '');
        const body = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : undefined;
        requests.push({ method, path, body });

        if (path === 'orders' && method === 'GET') {
            if (url.searchParams.get('select') === 'id') return jsonResponse({ id: ORDER });
            return fixture.order ? jsonResponse(fixture.order) : jsonResponse({ code: 'PGRST116', message: 'no rows' }, 406);
        }
        if (path === 'payments' && method === 'GET') {
            return jsonResponse([]); // legacy callback fixture has no merchant-bound canonical payment
        }
        if (path === 'checkout_sessions' && method === 'GET') {
            return jsonResponse([]); // legacy callback fixture has no pinned merchant checkout credential
        }
        if (path === 'sites' && method === 'GET') {
            return jsonResponse({ id: STORE, online_payment_enabled: fixture.onlinePaymentEnabled !== false,
                payment_settings: fixture.pinnedMerchantAccount ? { mode: 'ownAccount', razorpay: {
                    credential_id: STORE_CREDENTIAL_ID, key_id: STORE_KEY_ID, verified: true, test_mode: true,
                } } : await STORE_PAYMENT_SETTINGS });
        }
        if (path === 'payment_credentials' && method === 'GET' && fixture.pinnedMerchantAccount) {
            assert.equal(url.searchParams.get('id'), `eq.${STORE_CREDENTIAL_ID}`);
            assert.equal(url.searchParams.get('site_id'), `eq.${STORE}`);
            assert.equal(url.searchParams.get('selected_for_checkout'), 'eq.true');
            return jsonResponse({ id: STORE_CREDENTIAL_ID, site_id: STORE, provider: 'razorpay', mode: 'sandbox',
                status: 'active', provider_key_id: STORE_KEY_ID, last_verified_at: new Date().toISOString(),
                encrypted_credentials: { key_secret_ciphertext: await PINNED_STORE_CREDENTIAL } });
        }
        if (path === 'idempotency_keys' && method === 'POST') {
            return jsonResponse({ id: 'idem-claim-1', request_hash: 'h', status: 'processing', response_body: null, status_code: null, locked_until: null }, 201);
        }
        if (path === 'idempotency_keys' && method === 'PATCH') {
            return jsonResponse([]);
        }
        if (path === 'payment_transactions' && method === 'GET') {
            return jsonResponse([]); // the replay guard: this payment id is recorded against no other order
        }
        if (path === 'rpc/confirm_order_payment_with_ledger' && method === 'POST') {
            return jsonResponse(fixture.rpcResult ?? {});
        }
        if (path === 'rpc/attach_order_payment_reference_with_ledger' && method === 'POST') {
            return jsonResponse({ id: ORDER, payment_id: 'order_RZP_route' });
        }
        return jsonResponse({ code: 'UNEXPECTED', message: `unexpected ${method} ${path}` }, 500);
    }) as typeof globalThis.fetch;

    return {
        requests,
        razorpayRequests,
        rpcCalls: () => requests.filter((r) => r.path === 'rpc/confirm_order_payment_with_ledger'),
        idempotencyCompletion: () => requests.find((r) => r.path === 'idempotency_keys' && r.method === 'PATCH'
            && (r.body as Json | undefined)?.status === 'completed')?.body as Json | undefined,
        restore: () => { globalThis.fetch = originalFetch; },
    };
}

type PaidEventCall = { orderId: string; idempotencyKey: string };

function withEnv(app: Hono<{ Bindings: Env }>, providerPayment?: Json) {
    app.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = env(providerPayment);
        await next();
    });
}

function storefrontApp(paidEvents: PaidEventCall[], providerPayment?: Json) {
    const app = new Hono<{ Bindings: Env }>();
    withEnv(app, providerPayment);
    registerStorefrontCheckoutPaymentRoutes(app, {
        loadPublishedStore: async () => ({ id: STORE, subdomain: 'late-capture' }) as never,
        getRequestId: () => 'req-route-test',
        emitStorefrontOrderPaidEvent: async (_db, input) => {
            paidEvents.push({ orderId: input.orderId, idempotencyKey: input.idempotencyKey });
        },
    });
    return app;
}

function internalApp(paidEvents: PaidEventCall[]) {
    const app = new Hono<{ Bindings: Env }>();
    withEnv(app);
    registerStorefrontInternalPaymentRoutes(app as never, {
        getRequestId: () => 'req-route-test',
        emitStorefrontOrderPaidEvent: async (_db: unknown, input: { orderId: string; idempotencyKey?: string | null }) => {
            paidEvents.push({ orderId: input.orderId, idempotencyKey: String(input.idempotencyKey) });
        },
    } as never);
    return app;
}

const signature = (providerOrderId: string, paymentId: string) =>
    createHmac('sha256', KEY_SECRET).update(`${providerOrderId}|${paymentId}`).digest('hex');

function verify(app: Hono<{ Bindings: Env }>, overrides: Partial<Record<string, string>> = {}) {
    const providerOrderId = overrides.razorpay_order_id ?? 'order_RZP_route';
    const paymentId = overrides.razorpay_payment_id ?? 'pay_route';
    return app.request('/late-capture/payments/razorpay/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            orderId: ORDER,
            razorpay_order_id: providerOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature(providerOrderId, paymentId),
            idempotencyKey: `razorpay-verify-${paymentId}`,
        }),
    });
}

function webhookConfirm(app: Hono<{ Bindings: Env }>) {
    return app.request('/internal/payments/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Internal-API-Secret': INTERNAL_SECRET },
        body: JSON.stringify({
            orderId: ORDER,
            storeId: STORE,
            provider: 'razorpay',
            paymentId: 'pay_route',
            providerOrderId: 'order_RZP_route',
            providerEventId: 'evt_route',
            idempotencyKey: 'payment-webhook:razorpay:evt_route:paid',
        }),
    });
}

const PENDING_ORDER: Json = {
    id: ORDER, store_id: STORE, total: 500, currency: 'INR',
    payment_id: 'order_RZP_route', payment_status: 'pending', status: 'pending',
};
const CONFIRMED: Json = { id: ORDER, store_id: STORE, status: 'confirmed', payment_status: 'paid', capture_outcome: 'confirmed', fulfillable: true };
const UNFULFILLABLE: Json = {
    id: ORDER, store_id: STORE, status: 'cancelled', payment_status: 'paid',
    capture_outcome: 'captured_unfulfillable', fulfillable: false, unfulfillable_reason: 'reservation_released',
};

// ─── readCaptureResult ───────────────────────────────────────────────────────

test('readCaptureResult reports each decision 252 can make, and reads a pre-252 result as the confirm it was', () => {
    assert.deepEqual(readCaptureResult(CONFIRMED), { outcome: 'confirmed', fulfillable: true, reason: null });
    assert.deepEqual(readCaptureResult(UNFULFILLABLE), { outcome: 'captured_unfulfillable', fulfillable: false, reason: 'reservation_released' });
    assert.deepEqual(readCaptureResult({ capture_outcome: 'duplicate', fulfillable: true }), { outcome: 'duplicate', fulfillable: true, reason: null });
    assert.deepEqual(readCaptureResult({ capture_outcome: 'duplicate', fulfillable: false, unfulfillable_reason: 'order_cancelled' }),
        { outcome: 'duplicate', fulfillable: false, reason: 'order_cancelled' });
    // A database without 252 returns the bare order row; its wrapper confirmed whatever it did not raise on.
    assert.deepEqual(readCaptureResult({ id: ORDER, status: 'confirmed' }), { outcome: 'confirmed', fulfillable: true, reason: null });
    // Only an explicit true is fulfillable once the outcome is present.
    assert.equal(readCaptureResult({ capture_outcome: 'confirmed', fulfillable: 'true' }).fulfillable, false);
});

// ─── storefront verify (the buyer's browser callback) ────────────────────────

test('verify: an unfulfillable capture answers the buyer 409 with the fixed message and announces nothing', async (t) => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER, rpcResult: UNFULFILLABLE });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await verify(storefrontApp(paidEvents));
    const payload = await response.json() as { success: boolean; error: { code: string; message: string } };

    assert.equal(response.status, 409);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, 'PAYMENT_CAPTURED_ORDER_UNFULFILLABLE');
    assert.equal(payload.error.message, FIXED_PUBLIC_ERROR_MESSAGES.PAYMENT_CAPTURED_ORDER_UNFULFILLABLE);
    assert.equal(postgrest.rpcCalls().length, 1, 'the capture still reached the ledger RPC, which recorded it');
    assert.deepEqual(paidEvents, [], 'no order.paid — the buyer must not get an order confirmation');
    const completion = postgrest.idempotencyCompletion();
    assert.equal(completion?.status_code, 409, 'a retried callback replays the same honest answer');
});

test('verify: a confirmed capture announces order.paid once, keyed on the provider payment', async (t) => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER, rpcResult: CONFIRMED });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await verify(storefrontApp(paidEvents));

    assert.equal(response.status, 200);
    assert.deepEqual(paidEvents, [{ orderId: ORDER, idempotencyKey: 'razorpay:pay_route' }],
        'the same key the webhook path uses, so the pair produces one event');
});

test('unversioned fallback keys cannot start a new direct payment', async (t) => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER });
    t.after(() => postgrest.restore());
    const response = await storefrontApp([]).request('/late-capture/payments/razorpay/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: ORDER, idempotencyKey: 'razorpay-order-own-account' }),
    });
    assert.equal(response.status, 410);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'HOSTED_CHECKOUT_REQUIRED');
    assert.equal(postgrest.razorpayRequests.length, 0);
    assert.equal(postgrest.requests.filter(request => request.path === 'orders' || request.path.startsWith('rpc/')).length, 0);
});

test('a saved merchant account cannot start an unpinned direct storefront payment', async t => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER, pinnedMerchantAccount: true });
    t.after(() => postgrest.restore());
    const response = await storefrontApp([]).request('/late-capture/payments/razorpay/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: ORDER, idempotencyKey: 'retired-direct-merchant-start' }),
    });
    assert.equal(response.status, 410);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'HOSTED_CHECKOUT_REQUIRED');
    assert.equal(postgrest.razorpayRequests.length, 0, 'no provider order can be opened');
    assert.equal(postgrest.requests.filter(request => request.path === 'orders' || request.path.startsWith('rpc/')).length, 0,
        'no order or payment reference is touched');
});

test('verify: disabled merchant payment setup refuses a signed capture before ledger writes', async (t) => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER, rpcResult: CONFIRMED, onlinePaymentEnabled: false });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await verify(storefrontApp(paidEvents));
    assert.equal(response.status, 503);
    assert.equal(postgrest.rpcCalls().length, 0);
    assert.deepEqual(paidEvents, []);
});

test('verify: shared platform signature cannot confirm a merchant-owned payment', async (t) => {
    const postgrest = installFakePostgrest({ order: PENDING_ORDER, rpcResult: CONFIRMED });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];
    const providerOrderId = 'order_RZP_route';
    const paymentId = 'pay_route';
    const sharedSignature = createHmac('sha256', SHARED_SECRET).update(`${providerOrderId}|${paymentId}`).digest('hex');

    const response = await storefrontApp(paidEvents).request('/late-capture/payments/razorpay/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: ORDER, razorpay_order_id: providerOrderId,
            razorpay_payment_id: paymentId, razorpay_signature: sharedSignature,
            idempotencyKey: 'razorpay-verify-shared-signature' }),
    });
    assert.equal(response.status, 400);
    assert.equal(postgrest.rpcCalls().length, 0);
    assert.deepEqual(paidEvents, []);
});

for (const scenario of [
    { name: 'uncaptured', payment: { status: 'authorized', captured: false }, status: 409 },
    { name: 'wrong amount', payment: { amount: 100 }, status: 409 },
    { name: 'wrong provider order', payment: { order_id: 'order_other' }, status: 409 },
    { name: 'wrong currency', payment: { currency: 'USD' }, status: 409 },
    { name: 'provider outage', payment: { error: { code: 'UNAVAILABLE' } }, status: 503 },
]) {
    test(`verify: ${scenario.name} provider payment never posts ledger or paid event`, async (t) => {
        const postgrest = installFakePostgrest({ order: PENDING_ORDER, rpcResult: CONFIRMED });
        t.after(() => postgrest.restore());
        const paidEvents: PaidEventCall[] = [];

        const response = await verify(storefrontApp(paidEvents, scenario.payment));
        assert.equal(response.status, scenario.status);
        assert.equal(postgrest.rpcCalls().length, 0);
        assert.deepEqual(paidEvents, []);
    });
}

test('verify: when the webhook confirmed first, the buyer\'s callback succeeds instead of erroring after payment', async (t) => {
    // confirm_order_payment writes the PAYMENT id into orders.payment_id, so this is the row the buyer's
    // callback finds when the webhook won the race. Before F-PAY4-1 this answered 409 "already paid".
    const postgrest = installFakePostgrest({
        order: { ...PENDING_ORDER, payment_id: 'pay_route', payment_status: 'paid', status: 'confirmed' },
        rpcResult: { ...CONFIRMED, capture_outcome: 'duplicate', fulfillable: true },
    });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await verify(storefrontApp(paidEvents));
    const payload = await response.json() as { success: boolean; data: { verified: boolean } };

    assert.equal(response.status, 200);
    assert.equal(payload.data.verified, true);
    assert.deepEqual(paidEvents, [{ orderId: ORDER, idempotencyKey: 'razorpay:pay_route' }], 'deduplicated by key, not suppressed');
});

test('verify: an order bound to a different provider order is still refused before any provider or ledger call', async (t) => {
    const postgrest = installFakePostgrest({ order: { ...PENDING_ORDER, payment_id: 'order_RZP_someone_else' }, rpcResult: CONFIRMED });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await verify(storefrontApp(paidEvents));
    const payload = await response.json() as { error: { code: string } };

    assert.equal(response.status, 409);
    assert.equal(payload.error.code, 'PAYMENT_REFERENCE_MISMATCH');
    assert.equal(postgrest.rpcCalls().length, 0, 'relaxing the payable refusals did not relax the binding');
    assert.deepEqual(paidEvents, []);
});

// ─── internal confirm (webhook-service markOrderPaid) ────────────────────────

test('webhook confirm: an unfulfillable capture is acknowledged 200 — so the event is processed, not retried — and never announced', async (t) => {
    const postgrest = installFakePostgrest({ rpcResult: UNFULFILLABLE });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await webhookConfirm(internalApp(paidEvents));
    const payload = await response.json() as { data: { capture_outcome: string; fulfillable: boolean; unfulfillable_reason: string } };

    assert.equal(response.status, 200);
    assert.equal(payload.data.capture_outcome, 'captured_unfulfillable');
    assert.equal(payload.data.fulfillable, false);
    assert.equal(payload.data.unfulfillable_reason, 'reservation_released');
    assert.deepEqual(paidEvents, []);
});

test('webhook confirm: a confirmed capture announces order.paid with the same per-payment key the verify path uses', async (t) => {
    const postgrest = installFakePostgrest({ rpcResult: CONFIRMED });
    t.after(() => postgrest.restore());
    const paidEvents: PaidEventCall[] = [];

    const response = await webhookConfirm(internalApp(paidEvents));

    assert.equal(response.status, 200);
    assert.deepEqual(paidEvents, [{ orderId: ORDER, idempotencyKey: 'razorpay:pay_route' }]);
});

// ─── every capture-reporting route, including the merchant one ───────────────

test('every route that confirms a capture reads the outcome and refuses to announce an unfulfillable one', () => {
    // The merchant verify in payments.ts has no behavioural harness here (it resolves a merchant session
    // first), so the ordering is pinned in source for all three routes: confirm → read the outcome →
    // the unfulfillable early exit → only then the order.paid announcement.
    const routes = [
        { file: '../routes/storefront/checkout-payment-routes.ts', announce: 'await emitStorefrontOrderPaidEvent(db' },
        { file: '../routes/storefront/internal-payment-routes.ts', announce: 'await deps.emitStorefrontOrderPaidEvent(db' },
        { file: '../routes/payments.ts', announce: 'await emitOrderPaidEvent(c.env, db' },
    ];
    for (const route of routes) {
        const source = readFileSync(new URL(route.file, import.meta.url), 'utf8');
        const confirm = source.indexOf('.confirmPayment(');
        const read = source.indexOf('readCaptureResult(', confirm);
        const exit = source.indexOf('if (!capture.fulfillable)', read);
        const announce = source.indexOf(route.announce, confirm);
        assert.ok(confirm !== -1, `${route.file}: confirms a capture`);
        assert.ok(read > confirm, `${route.file}: reads the capture outcome after confirming`);
        assert.ok(exit > read, `${route.file}: exits early for an unfulfillable capture`);
        assert.ok(announce > exit, `${route.file}: announces order.paid only after that exit`);
        assert.equal(source.split('.confirmPayment(').length - 1, 1, `${route.file}: one confirm site, so the ordering covers it`);
    }
});

// ─── starting a payment ──────────────────────────────────────────────────────

test('no new payment may start against a released reservation', async (t) => {
    const postgrest = installFakePostgrest({ order: { ...PENDING_ORDER, inventory_released_at: '2026-09-23T10:00:00.000Z' } });
    t.after(() => postgrest.restore());

    await assert.rejects(
        new PaymentExecutionAdapter(getSupabaseAdminFromEnv(env())).loadStorefrontPayableOrder(ORDER, STORE),
        (error: { statusCode?: number; code?: string; message?: string }) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, 'ORDER_RESERVATION_EXPIRED');
            assert.equal(error.message, FIXED_PUBLIC_ERROR_MESSAGES.ORDER_RESERVATION_EXPIRED);
            return true;
        },
    );

    // The same order before the sweep is payable: the refusal is the release, nothing else.
    postgrest.restore();
    const unreleased = installFakePostgrest({ order: PENDING_ORDER });
    t.after(() => unreleased.restore());
    const payable = await new PaymentExecutionAdapter(getSupabaseAdminFromEnv(env())).loadStorefrontPayableOrder(ORDER, STORE);
    assert.equal(payable.id, ORDER);
});

test('the existing order readers preserve exact decimal totals, including paise above signed-int32 range', async () => {
    for (const [total,paise] of [['0.01',1],['0.29',29],['6.59',659],['21474836.48',2147483648],['99999999.99',9999999999]] as const) {
        const postgrest = installFakePostgrest({order:{...PENDING_ORDER,total}});
        try {
            const adapter = new PaymentExecutionAdapter(getSupabaseAdminFromEnv(env()));
            for (const row of [await adapter.loadStorefrontPayableOrder(ORDER,STORE),await adapter.loadStorefrontOrderForCapture(ORDER,STORE)]) {
                assert.equal(row.total,total,'do not coerce the stored decimal before canonical parsing');
                assert.equal(toInrMinorUnits(row.total),paise,'provider paise remains exact and is never int32-truncated');
            }
            assert.equal(postgrest.requests.filter(request=>request.method!=='GET').length,0,'amount reads do not post money');
        } finally { postgrest.restore(); }
    }
});

test('malformed or fractional-paise order totals cannot be rounded into a new payment', async () => {
    for (const total of ['0','-1','1.001','1e2','Infinity','999999999.99','not-money',0.30000000000000004]) {
        const postgrest = installFakePostgrest({order:{...PENDING_ORDER,total}});
        try {
            const adapter = new PaymentExecutionAdapter(getSupabaseAdminFromEnv(env()));
            await assert.rejects(adapter.loadStorefrontPayableOrder(ORDER,STORE),/exact payable total|payable total/);
            assert.equal(postgrest.requests.filter(request=>request.method!=='GET').length,0,'invalid source totals have no money effect');
        } finally { postgrest.restore(); }
    }
});
