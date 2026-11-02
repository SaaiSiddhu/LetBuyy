import assert from "node:assert/strict";
import test from "node:test";

import {
    confirmGatewayOrderPayment,
    recordGatewayOrderPaymentEvent,
    recordGatewayOrderPaymentFailure,
} from "../src/gateway-order-transitions.ts";

function captureGateway(status = 200, payload = { success: true }) {
    const calls = [];
    const env = {
        INTERNAL_API_SECRET: "internal-secret",
        API_GATEWAY_SERVICE: {
            async fetch(input, init) {
                calls.push({
                    input,
                    init,
                    body: JSON.parse(String(init?.body || "{}")),
                });
                return Response.json(payload, { status });
            },
        },
    };

    return { env, calls };
}

test("confirmGatewayOrderPayment posts signed confirmation to the gateway", async () => {
    const { env, calls } = captureGateway();

    await confirmGatewayOrderPayment(env, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "razorpay",
        paymentId: "pay-1",
        providerOrderId: "rzp-order-1",
        providerEventId: "evt-1",
        idempotencyKey: "idem-1",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "https://api-gateway/v1/storefront/internal/payments/confirm");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["X-Internal-API-Secret"], "internal-secret");
    assert.deepEqual(calls[0].body, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "razorpay",
        paymentId: "pay-1",
        providerOrderId: "rzp-order-1",
        providerEventId: "evt-1",
        idempotencyKey: "idem-1",
    });
});

test("recordGatewayOrderPaymentFailure posts refund release intent to the gateway", async () => {
    const { env, calls } = captureGateway();

    await recordGatewayOrderPaymentFailure(env, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "paypal",
        providerEventId: "evt-refund",
        paymentStatus: "refunded",
        orderStatus: "refunded",
        reason: "refund_created",
        releaseInventory: true,
    });

    assert.equal(calls[0].input, "https://api-gateway/v1/storefront/internal/payments/failure");
    assert.deepEqual(calls[0].body, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "paypal",
        providerEventId: "evt-refund",
        paymentStatus: "refunded",
        orderStatus: "refunded",
        reason: "refund_created",
        releaseInventory: true,
        idempotencyKey: null,
    });
});

test("recordGatewayOrderPaymentEvent posts provider event markers to the gateway", async () => {
    const { env, calls } = captureGateway();

    await recordGatewayOrderPaymentEvent(env, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "cashfree",
        providerEventId: "evt-partial-refund",
        eventType: "refund.partial",
    });

    assert.equal(calls[0].input, "https://api-gateway/v1/storefront/internal/payments/event");
    assert.deepEqual(calls[0].body, {
        orderId: "order-1",
        storeId: "store-1",
        provider: "cashfree",
        providerEventId: "evt-partial-refund",
        eventType: "refund.partial",
        idempotencyKey: null,
    });
});

test("gateway order mutations fail closed without internal binding or secret", async () => {
    await assert.rejects(
        () => confirmGatewayOrderPayment({
            INTERNAL_API_SECRET: "internal-secret",
        }, {
            orderId: "order-1",
            provider: "stripe",
            paymentId: "pay-1",
            providerEventId: "evt-1",
        }),
        /API_GATEWAY_SERVICE binding is required/
    );

    await assert.rejects(
        () => confirmGatewayOrderPayment({
            API_GATEWAY_SERVICE: captureGateway().env.API_GATEWAY_SERVICE,
        }, {
            orderId: "order-1",
            provider: "stripe",
            paymentId: "pay-1",
            providerEventId: "evt-1",
        }),
        /INTERNAL_API_SECRET is required/
    );
});

test("gateway order mutations surface gateway failures", async () => {
    const { env } = captureGateway(409, { error: { code: "CONFLICT" } });

    await assert.rejects(
        () => confirmGatewayOrderPayment(env, {
            orderId: "order-1",
            provider: "stripe",
            paymentId: "pay-1",
            providerEventId: "evt-1",
        }),
        /API gateway order mutation failed: 409/
    );
});
