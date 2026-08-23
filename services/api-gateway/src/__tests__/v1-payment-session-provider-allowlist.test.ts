/**
 * Phase M1 — a live gap found while authoring the payment-rail allowlist
 * validator: `POST /v1/payments/sessions` ("V1 provider-agnostic
 * merchant-owned payment session") still accepted `provider: "cashfree"`
 * at runtime via `CreatePaymentSessionSchema` / `V1PaymentProviderSchema`,
 * even after the named W1/W2 storefront and gateway routes were retired.
 * This was not one of the originally-named routes; it is a distinct,
 * directly customer-authenticated endpoint that happened to still admit a
 * retired rail. DOC 03 row 11 ("Payments"): Razorpay + COD are the only
 * live money-in rails.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import paymentsRouter from '../routes/payments';
import { CreatePaymentSessionSchema } from '../schemas/payment.schema';

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: 'https://postgrest.v1-payment-session-provider-allowlist.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    } as unknown as Env;
}

function gatewayApp(): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/payments', paymentsRouter);
    return app;
}

const VALID_BODY_SHAPE = {
    order_id: '11111111-1111-4111-8111-111111111111',
    idempotency_key: 'v1-session-allowlist-test',
};

test('CreatePaymentSessionSchema (backing POST /v1/payments/sessions) rejects every retired rail', () => {
    for (const retired of ['stripe', 'paypal', 'cashfree', 'adyen', 'square', 'braintree']) {
        const result = CreatePaymentSessionSchema.safeParse({ ...VALID_BODY_SHAPE, provider: retired });
        assert.equal(result.success, false, `provider: '${retired}' must be rejected`);
    }
});

test('CreatePaymentSessionSchema still admits every canonical rail', () => {
    for (const canonical of ['razorpay', 'upi', 'cod']) {
        const result = CreatePaymentSessionSchema.safeParse({ ...VALID_BODY_SHAPE, provider: canonical });
        assert.equal(result.success, true, `provider: '${canonical}' must still be accepted`);
    }
    // provider defaults to 'razorpay' when omitted.
    assert.equal(CreatePaymentSessionSchema.safeParse(VALID_BODY_SHAPE).success, true);
});

test('POST /v1/payments/sessions rejects provider: "cashfree" with a schema-validation 400 on the real mounted route', async () => {
    const response = await gatewayApp().request(
        '/payments/sessions',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...VALID_BODY_SHAPE, provider: 'cashfree' }),
        },
        env(),
    );

    assert.equal(response.status, 400, 'a retired rail must be rejected before the handler ever reaches auth/DB logic');
    const body = await response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
});

test('POST /v1/payments/sessions still routes a canonical rail past schema validation (fails later, not on provider)', async () => {
    // No auth/Supabase fixture is installed, so this cannot reach 200 here;
    // the proof is that it does NOT fail with the schema-validation 400 that
    // an unrecognized/retired provider produces -- i.e. 'razorpay' passed
    // CreatePaymentSessionSchema and the request proceeded into handler logic
    // (which then fails on missing auth/DB -- a 500, not a 400).
    const response = await gatewayApp().request(
        '/payments/sessions',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...VALID_BODY_SHAPE, provider: 'razorpay' }),
        },
        env(),
    );

    assert.notEqual(response.status, 400, 'razorpay must not be rejected by CreatePaymentSessionSchema');
});
