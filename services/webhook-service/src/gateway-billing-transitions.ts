import type { GatewayServiceBinding } from "./gateway-order-transitions";

export interface GatewayBillingTransitionEnv {
    API_GATEWAY_SERVICE?: GatewayServiceBinding;
    INTERNAL_API_SECRET?: string;
}

async function gatewayBillingMutation(
    env: GatewayBillingTransitionEnv,
    path: string,
    body: Record<string, unknown>
): Promise<unknown> {
    if (!env.API_GATEWAY_SERVICE) {
        throw new Error("API_GATEWAY_SERVICE binding is required for gateway-owned billing mutations");
    }

    if (!env.INTERNAL_API_SECRET) {
        throw new Error("INTERNAL_API_SECRET is required for gateway-owned billing mutations");
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
        throw new Error(`API gateway billing mutation failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    return payload;
}

export async function activateGatewayStoreSubscription(
    env: GatewayBillingTransitionEnv,
    input: {
        storeId: string;
        planSlug: string;
        billingPeriod?: "monthly" | "yearly" | null;
        provider: "razorpay" | "stripe";
        providerOrderId?: string | null;
        providerPaymentId?: string | null;
        externalSubscriptionId?: string | null;
        userId?: string | null;
        amountPaid?: number | null;
    }
): Promise<unknown> {
    return gatewayBillingMutation(env, "/v1/internal/billing/subscriptions/activate", {
        storeId: input.storeId,
        planSlug: input.planSlug,
        billingPeriod: input.billingPeriod || "monthly",
        provider: input.provider,
        providerOrderId: input.providerOrderId || null,
        providerPaymentId: input.providerPaymentId || null,
        externalSubscriptionId: input.externalSubscriptionId || null,
        userId: input.userId || null,
        amountPaid: input.amountPaid ?? null,
    });
}

export async function syncGatewayStoreSubscription(
    env: GatewayBillingTransitionEnv,
    input: {
        externalSubscriptionId: string;
        status: "active" | "cancelled" | "past_due" | "trialing";
        currentPeriodStart?: string | null;
        currentPeriodEnd?: string | null;
    }
): Promise<unknown> {
    return gatewayBillingMutation(env, "/v1/internal/billing/subscriptions/sync", {
        externalSubscriptionId: input.externalSubscriptionId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart || null,
        currentPeriodEnd: input.currentPeriodEnd || null,
    });
}

export async function recordGatewaySubscriptionInvoice(
    env: GatewayBillingTransitionEnv,
    input: {
        externalSubscriptionId: string;
        provider: "razorpay" | "stripe";
        invoiceNumber?: string | null;
        description?: string | null;
        amount: number;
        currency: string;
        taxAmount?: number | null;
        totalAmount: number;
        paymentId?: string | null;
        paymentStatus?: "paid" | "failed";
        periodStart?: string | null;
        periodEnd?: string | null;
    }
): Promise<unknown> {
    return gatewayBillingMutation(env, "/v1/internal/billing/subscriptions/invoice", {
        externalSubscriptionId: input.externalSubscriptionId,
        provider: input.provider,
        invoiceNumber: input.invoiceNumber || null,
        description: input.description || null,
        amount: input.amount,
        currency: input.currency,
        taxAmount: input.taxAmount || 0,
        totalAmount: input.totalAmount,
        paymentId: input.paymentId || null,
        paymentStatus: input.paymentStatus || "paid",
        periodStart: input.periodStart || null,
        periodEnd: input.periodEnd || null,
    });
}
