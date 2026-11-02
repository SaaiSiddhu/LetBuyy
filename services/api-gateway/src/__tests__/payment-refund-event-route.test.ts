import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { registerStorefrontInternalPaymentRoutes } from '../routes/storefront/internal-payment-routes';

const SECRET = 'refund-event-internal-secret-for-tests-only';
const PAYMENT = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const ATTEMPT = 'bbbbbbbb-0000-4000-8000-0000000000b1';
const STORE = 'cccccccc-0000-4000-8000-0000000000c1';
const ORDER = 'dddddddd-0000-4000-8000-0000000000d1';
const ORIGIN = 'https://refund-event.fake-postgrest.test';

type RequestRecord = { method: string; path: string; body?: Record<string, unknown> };
let restoreFetch: (() => void) | undefined;

afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
        (c as unknown as { env: Env }).env = {
            ENVIRONMENT: 'test',
            SUPABASE_URL: ORIGIN,
            SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
            INTERNAL_API_SECRET: SECRET,
        } as unknown as Env;
        await next();
    });
    registerStorefrontInternalPaymentRoutes(app as never, {
        getRequestId: () => 'refund-event-route-test',
        emitStorefrontOrderPaidEvent: async () => undefined,
    } as never);
    return app;
}

function installPostgrest(options: { missingAttempt?: boolean } = {}) {
    const original = globalThis.fetch;
    const calls: RequestRecord[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, ORIGIN);
        const method = (init?.method || 'GET').toUpperCase();
        const path = url.pathname.replace('/rest/v1/', '');
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
        calls.push({ method, path, body });
        if (path === 'rpc/resolve_payment_for_refund_provider_event') {
            return json({ id: PAYMENT, site_id: STORE, order_id: ORDER, provider: 'razorpay', provider_payment_id: 'pay_test_1' });
        }
        if (path === 'payments') {
            assert.equal(url.searchParams.get('id'), `eq.${PAYMENT}`);
            assert.equal(url.searchParams.get('site_id'), `eq.${STORE}`);
            assert.equal(url.searchParams.get('provider'), 'eq.razorpay');
            assert.equal(url.searchParams.get('deleted_at'), 'is.null');
            return json({ credential_id: null });
        }
        if (path === 'payment_attempts') {
            if (!options.missingAttempt) return url.searchParams.has('metadata') ? json({ id: ATTEMPT }) : json([]);
            return url.searchParams.has('metadata') ? json(null) : json([]);
        }
        if (path === 'rpc/reconcile_payment_refund_attempt') return json({ outcome: 'pending', replayed: false, attempt_id: ATTEMPT });
        return json({ message: `unexpected ${method} ${path}` }, 500);
    }) as typeof fetch;
    restoreFetch = () => { globalThis.fetch = original; };
    return calls;
}

const validBody = {
    provider: 'razorpay',
    providerPaymentId: 'pay_test_1',
    providerRefundId: 'rfnd_test_1',
    providerEventId: 'refund.created:rfnd_test_1',
    eventType: 'refund.created',
    status: 'created',
    amountMinor: 5000,
    currency: 'INR',
};

function request(body: Record<string, unknown>, secret: string | null = SECRET) {
    return makeApp().request('/internal/payments/refund-event', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(secret ? { 'X-Internal-API-Secret': secret } : {}),
        },
        body: JSON.stringify(body),
    });
}

test('refund reconciliation endpoint requires the internal secret', async () => {
    const response = await request(validBody, null);
    assert.equal(response.status, 403);
});

test('refund reconciliation validates provider lifecycle consistency before database access', async () => {
    const calls = installPostgrest();
    const response = await request({ ...validBody, eventType: 'refund.processed', status: 'created' });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
});

test('valid provider refund reaches the reserved attempt and the canonical atomic reconciliation RPC', async () => {
    const calls = installPostgrest();
    const response = await request(validBody);
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: { matched: boolean; result: { outcome: string } } };
    assert.equal(payload.data.matched, true);
    assert.equal(payload.data.result.outcome, 'pending');
    const resolver = calls.find((call) => call.path === 'rpc/resolve_payment_for_refund_provider_event');
    assert.deepEqual(resolver?.body, { p_provider: 'razorpay', p_provider_payment_id: 'pay_test_1' });
    assert.ok(calls.find((call) => call.path === 'payments'), 'legacy internal callback proves the payment has no merchant credential binding');
    const rpc = calls.find((call) => call.path === 'rpc/reconcile_payment_refund_attempt');
    assert.deepEqual(rpc?.body, {
        p_payment_id: PAYMENT,
        p_attempt_id: ATTEMPT,
        p_provider_refund_id: 'rfnd_test_1',
        p_provider_event_id: 'refund.created:rfnd_test_1',
        p_event_type: 'refund.created',
        p_status: 'created',
        p_amount_minor: 5000,
        p_currency: 'INR',
        p_request_id: 'refund-event-route-test',
    });
    assert.ok(calls.find((call) => call.path === 'payment_attempts'));
});

test('a matched payment with no unique reserved attempt remains retryable and never falls through to legacy refund handling', async () => {
    const calls = installPostgrest({ missingAttempt: true });
    const response = await request(validBody);
    assert.equal(response.status, 409);
    const payload = await response.json() as { error: { code: string } };
    assert.equal(payload.error.code, 'REFUND_ATTEMPT_UNRESOLVED');
    assert.equal(calls.some((call) => call.path === 'rpc/reconcile_payment_refund_attempt'), false);
});
