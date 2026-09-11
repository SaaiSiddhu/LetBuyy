// F-WIRETYPE-2 — the internal payment failure route must enforce the unions it declares.
//
// These routes take their body as `await c.req.json() as InternalPayment<X>Body` — a CAST, not a
// parse. The declared `paymentStatus?: 'failed' | 'refunded'` and `orderStatus?: 'cancelled' |
// 'refunded'` are therefore what TypeScript believes downstream and NOT what arrives; the handler's
// original presence check (`!body.paymentStatus`) admitted any non-empty string.
//
// WHY THIS WAS NOT A WRONG CHARGE, AND WHY IT STILL MATTERED
// `record_order_payment_failure_with_ledger` never trusts either value. It writes
// `payment_transactions.status = CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE
// 'failed' END`, and `p_order_status` reaches only the idempotency argument tuple and the event
// payload — it transitions nothing, and the RPC does not update `orders` at all. So an out-of-union
// value could not inject a status; it was SILENTLY COERCED to 'failed'. On the money path a silent
// coercion hides a caller's bug instead of surfacing it, and that is what these tests pin.
//
// WHAT THE ASSERTIONS ACTUALLY CHECK
// A status code alone would be a weak test — a 400 returned AFTER a database write would pass it.
// The environment here carries the internal secret and nothing else, so any handler that gets as far
// as `getSupabaseAdmin` fails on missing Supabase configuration. A rejected body must therefore come
// back 400 with a VALIDATION code, while an ACCEPTED body must NOT: the contrast is what proves the
// guard runs before the database, rather than the request simply failing for some other reason.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { registerStorefrontInternalPaymentRoutes } from '../routes/storefront/internal-payment-routes';

const SECRET = 'internal-secret-for-tests-only';
const ORDER = 'aaaaaaaa-0000-4000-8000-00000000000a';

function app() {
    const root = new Hono();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = { INTERNAL_API_SECRET: SECRET };
        await next();
    });
    // Deps are only reached after the guards; stubbing them keeps a pass from depending on them.
    registerStorefrontInternalPaymentRoutes(root as never, {
        getRequestId: () => 'req-test',
        emitStorefrontOrderPaidEvent: async () => undefined,
    } as never);
    return root;
}

function failure(body: Record<string, unknown>, secret: string | null = SECRET) {
    return app().request('/internal/payments/failure', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(secret ? { 'X-Internal-API-Secret': secret } : {}),
        },
        body: JSON.stringify(body),
    });
}

const VALID = {
    orderId: ORDER,
    provider: 'razorpay',
    providerEventId: 'evt_1',
    paymentStatus: 'failed',
    orderStatus: 'cancelled',
};

test('the internal secret still gates the route — these tests are not testing an open endpoint', async () => {
    const response = await failure(VALID, null);
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'FORBIDDEN');
});

test('an out-of-union paymentStatus is refused, not coerced', async () => {
    // 'captured' is the value that would be most misleading if it were silently written as 'failed'.
    for (const paymentStatus of ['captured', 'paid', 'FAILED', 'failed ', 'succeeded', '0']) {
        const response = await failure({ ...VALID, paymentStatus });
        assert.equal(response.status, 400, `paymentStatus=${JSON.stringify(paymentStatus)} must be refused`);
        const payload = await response.json() as { error: { code: string; message: string } };
        assert.equal(payload.error.code, 'VALIDATION');
        assert.match(payload.error.message, /paymentStatus \(failed \| refunded\)/);
    }
});

test('an out-of-union orderStatus is refused, not coerced', async () => {
    for (const orderStatus of ['delivered', 'shipped', 'confirmed', 'Cancelled', 'true']) {
        const response = await failure({ ...VALID, orderStatus });
        assert.equal(response.status, 400, `orderStatus=${JSON.stringify(orderStatus)} must be refused`);
        assert.match(
            (await response.json() as { error: { message: string } }).error.message,
            /orderStatus \(cancelled \| refunded\)/,
        );
    }
});

test('a missing field is still refused, so the guards did not replace the presence check', async () => {
    for (const field of ['orderId', 'provider', 'providerEventId', 'paymentStatus', 'orderStatus']) {
        const body: Record<string, unknown> = { ...VALID };
        delete body[field];
        assert.equal((await failure(body)).status, 400, `a missing ${field} must still be refused`);
    }
});

test('both real callers\' payloads are ACCEPTED — the guard runs before the database, and lets them past', async () => {
    // webhook-service/src/index.ts:382-383 and :437-438 are the only call sites in the repository.
    // Neither may start 400ing: this change must be invisible to correct callers.
    for (const pair of [
        { paymentStatus: 'failed', orderStatus: 'cancelled' },
        { paymentStatus: 'refunded', orderStatus: 'refunded' },
    ]) {
        const response = await failure({ ...VALID, ...pair });
        // 500, specifically. This environment has the internal secret and NO Supabase configuration,
        // so reaching `getSupabaseAdmin` fails with "supabaseUrl is required". That failure IS the
        // evidence: the request got past both guards and into the database layer. A 400 here would
        // mean the guards had started rejecting what webhook-service actually sends.
        assert.equal(
            response.status,
            500,
            `${JSON.stringify(pair)} is what webhook-service sends and must reach the database layer`,
        );
    }
});

test('the provider guard is unchanged and still rejects a non-canonical rail', async () => {
    for (const provider of ['stripe', 'paypal', 'cashfree', 'cod']) {
        assert.equal((await failure({ ...VALID, provider })).status, 400, `${provider} is not a live capture rail`);
    }
});
