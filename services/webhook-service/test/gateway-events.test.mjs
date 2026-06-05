import assert from "node:assert/strict";
import test from "node:test";

import { emitGatewayDomainEvent } from "../src/gateway-events.ts";

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

test("webhook-service emits domain events through the gateway owner", async () => {
    const { env, calls } = captureGateway();

    await emitGatewayDomainEvent(env, {
        storeId: "store-1",
        aggregateType: "order",
        aggregateId: "order-1",
        eventType: "payment.captured",
        payload: { provider: "razorpay", provider_event_id: "evt-1" },
        idempotencyKey: "payment-webhook:razorpay:evt-1:payment.captured",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "https://api-gateway/v1/internal/events/domain");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["X-Internal-API-Secret"], "internal-secret");
    assert.deepEqual(calls[0].body, {
        storeId: "store-1",
        aggregateType: "order",
        aggregateId: "order-1",
        eventType: "payment.captured",
        payload: { provider: "razorpay", provider_event_id: "evt-1" },
        idempotencyKey: "payment-webhook:razorpay:evt-1:payment.captured",
    });
});

test("webhook-service domain event emission fails closed without binding or secret", async () => {
    await assert.rejects(
        () => emitGatewayDomainEvent({
            INTERNAL_API_SECRET: "internal-secret",
        }, {
            aggregateType: "order",
            aggregateId: "order-1",
            eventType: "payment.captured",
            idempotencyKey: "idem-1",
        }),
        /API_GATEWAY_SERVICE binding is required/
    );

    await assert.rejects(
        () => emitGatewayDomainEvent({
            API_GATEWAY_SERVICE: captureGateway().env.API_GATEWAY_SERVICE,
        }, {
            aggregateType: "order",
            aggregateId: "order-1",
            eventType: "payment.captured",
            idempotencyKey: "idem-1",
        }),
        /INTERNAL_API_SECRET is required/
    );
});

test("webhook-service domain event emission surfaces gateway failures", async () => {
    const { env } = captureGateway(400, { error: { code: "DOMAIN_EVENT_EMIT_FAILED" } });

    await assert.rejects(
        () => emitGatewayDomainEvent(env, {
            aggregateType: "order",
            aggregateId: "order-1",
            eventType: "payment.captured",
            idempotencyKey: "idem-1",
        }),
        /API gateway event mutation failed: 400/
    );
});
