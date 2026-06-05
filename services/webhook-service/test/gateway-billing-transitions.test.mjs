import assert from "node:assert/strict";
import test from "node:test";

import {
    activateGatewayStoreSubscription,
    recordGatewaySubscriptionInvoice,
    syncGatewayStoreSubscription,
} from "../src/gateway-billing-transitions.ts";

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

test("activateGatewayStoreSubscription posts subscription activation to the gateway", async () => {
    const { env, calls } = captureGateway();

    await activateGatewayStoreSubscription(env, {
        storeId: "store-1",
        planSlug: "starter",
        billingPeriod: "yearly",
        provider: "stripe",
        externalSubscriptionId: "sub-1",
        amountPaid: 120000,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "https://api-gateway/v1/internal/billing/subscriptions/activate");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["X-Internal-API-Secret"], "internal-secret");
    assert.deepEqual(calls[0].body, {
        storeId: "store-1",
        planSlug: "starter",
        billingPeriod: "yearly",
        provider: "stripe",
        providerOrderId: null,
        providerPaymentId: null,
        externalSubscriptionId: "sub-1",
        userId: null,
        amountPaid: 120000,
    });
});

test("syncGatewayStoreSubscription posts provider status to the gateway", async () => {
    const { env, calls } = captureGateway();

    await syncGatewayStoreSubscription(env, {
        externalSubscriptionId: "sub-1",
        status: "past_due",
        currentPeriodStart: "2026-01-01T00:00:00.000Z",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    });

    assert.equal(calls[0].input, "https://api-gateway/v1/internal/billing/subscriptions/sync");
    assert.deepEqual(calls[0].body, {
        externalSubscriptionId: "sub-1",
        status: "past_due",
        currentPeriodStart: "2026-01-01T00:00:00.000Z",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    });
});

test("recordGatewaySubscriptionInvoice posts invoice records to the gateway", async () => {
    const { env, calls } = captureGateway();

    await recordGatewaySubscriptionInvoice(env, {
        externalSubscriptionId: "sub-1",
        provider: "stripe",
        invoiceNumber: "INV-1",
        amount: 1000,
        currency: "INR",
        taxAmount: 180,
        totalAmount: 1180,
        paymentId: "pi-1",
    });

    assert.equal(calls[0].input, "https://api-gateway/v1/internal/billing/subscriptions/invoice");
    assert.deepEqual(calls[0].body, {
        externalSubscriptionId: "sub-1",
        provider: "stripe",
        invoiceNumber: "INV-1",
        description: null,
        amount: 1000,
        currency: "INR",
        taxAmount: 180,
        totalAmount: 1180,
        paymentId: "pi-1",
        paymentStatus: "paid",
        periodStart: null,
        periodEnd: null,
    });
});

test("gateway billing mutations fail closed without internal binding or secret", async () => {
    await assert.rejects(
        () => activateGatewayStoreSubscription({
            INTERNAL_API_SECRET: "internal-secret",
        }, {
            storeId: "store-1",
            planSlug: "starter",
            provider: "razorpay",
        }),
        /API_GATEWAY_SERVICE binding is required/
    );

    await assert.rejects(
        () => activateGatewayStoreSubscription({
            API_GATEWAY_SERVICE: captureGateway().env.API_GATEWAY_SERVICE,
        }, {
            storeId: "store-1",
            planSlug: "starter",
            provider: "razorpay",
        }),
        /INTERNAL_API_SECRET is required/
    );
});
