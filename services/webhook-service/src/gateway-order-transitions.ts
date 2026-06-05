export type GatewayPaymentProvider = "razorpay" | "stripe" | "paypal" | "cashfree";

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
        provider: GatewayPaymentProvider;
        paymentId: string;
        providerOrderId?: string | null;
        providerEventId: string;
        idempotencyKey?: string | null;
    }
): Promise<unknown> {
    return gatewayOrderMutation(env, "/v1/storefront/internal/payments/confirm", {
        orderId: input.orderId,
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
        provider: GatewayPaymentProvider;
        providerEventId: string;
        eventType: string;
        idempotencyKey?: string | null;
    }
): Promise<unknown> {
    return gatewayOrderMutation(env, "/v1/storefront/internal/payments/event", {
        orderId: input.orderId,
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey || null,
    });
}
