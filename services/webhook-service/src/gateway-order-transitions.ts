// Phase M5, DOC 03 row 11 "Payments": webhooks are inherently provider-
// specific -- there is no "COD webhook", so unlike orders.payment_method
// (which spans razorpay/cod at order-creation time), this type only ever
// needs the live capture provider. Narrowed from
// "razorpay" | "stripe" | "paypal" | "cashfree" after confirming every
// caller (confirmGatewayOrderPayment / recordGatewayOrderPaymentFailure /
// recordGatewayOrderPaymentEvent) is reached exclusively from
// services/webhook-service/src/index.ts's markOrderPaid/markOrderFailed/
// markOrderRefunded, all of which are called only from the surviving
// /razorpay webhook handler with a hardcoded "razorpay" literal -- Phase
// M1 W4 retired every other provider's webhook ingress.
export type GatewayPaymentProvider = "razorpay";

export interface GatewayServiceBinding {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

export interface GatewayOrderTransitionEnv {
    API_GATEWAY_SERVICE?: GatewayServiceBinding;
    INTERNAL_API_SECRET?: string;
}

type GatewayRequestBody = Record<string, unknown>;

async function gatewayOrderMutation(
    env: GatewayOrderTransitionEnv,
    path: string,
    body: GatewayRequestBody
): Promise<unknown> {
    if (!env.API_GATEWAY_SERVICE) {
        throw new Error("API_GATEWAY_SERVICE binding is required for gateway-owned order mutations");
    }

    if (!env.INTERNAL_API_SECRET) {
        throw new Error("INTERNAL_API_SECRET is required for gateway-owned order mutations");
    }

    const response = await env.API_GATEWAY_SERVICE.fetch(`https://api-gateway${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Internal-API-Secret": env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(async () => {
        const text = await response.text().catch(() => "");
        return text ? { error: text } : null;
    });

    if (!response.ok) {
        throw new Error(`API gateway order mutation failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    return payload;
}

export async function confirmGatewayOrderPayment(
    env: GatewayOrderTransitionEnv,
    input: {
        orderId: string;
        storeId: string;
        provider: GatewayPaymentProvider;
        paymentId: string;
        providerOrderId?: string | null;
        providerEventId: string;
        idempotencyKey?: string | null;
    }
): Promise<unknown> {
    return gatewayOrderMutation(env, "/v1/storefront/internal/payments/confirm", {
        orderId: input.orderId,
        storeId: input.storeId,
        provider: input.provider,
        paymentId: input.paymentId,
        providerOrderId: input.providerOrderId || null,
        providerEventId: input.providerEventId,
        idempotencyKey: input.idempotencyKey || null,
    });
}

export async function recordGatewayOrderPaymentFailure(
    env: GatewayOrderTransitionEnv,
    input: {
        orderId: string;
        storeId: string;
        provider: GatewayPaymentProvider;
        providerEventId: string;
        paymentStatus: "failed" | "refunded";
        orderStatus: "cancelled" | "refunded";
        reason?: string | null;
        releaseInventory?: boolean;
        idempotencyKey?: string | null;
    }
): Promise<unknown> {
    return gatewayOrderMutation(env, "/v1/storefront/internal/payments/failure", {
        orderId: input.orderId,
        storeId: input.storeId,
        provider: input.provider,
        providerEventId: input.providerEventId,
        paymentStatus: input.paymentStatus,
        orderStatus: input.orderStatus,
        reason: input.reason || null,
        releaseInventory: Boolean(input.releaseInventory),
        idempotencyKey: input.idempotencyKey || null,
    });
}

export async function recordGatewayOrderPaymentEvent(
    env: GatewayOrderTransitionEnv,
    input: {
        orderId: string;
        storeId: string;
        provider: GatewayPaymentProvider;
        providerEventId: string;
        eventType: string;
        idempotencyKey?: string | null;
    }
): Promise<unknown> {
    return gatewayOrderMutation(env, "/v1/storefront/internal/payments/event", {
        orderId: input.orderId,
        storeId: input.storeId,
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey || null,
    });
}
