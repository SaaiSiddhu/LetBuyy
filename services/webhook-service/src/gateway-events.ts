import type { GatewayServiceBinding } from "./gateway-order-transitions";

export interface GatewayEventEnv {
    API_GATEWAY_SERVICE?: GatewayServiceBinding;
    INTERNAL_API_SECRET?: string;
}

export interface GatewayDomainEventInput {
    storeId?: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
    requestId?: string | null;
    actorId?: string | null;
}

export async function emitGatewayDomainEvent(
    env: GatewayEventEnv,
    input: GatewayDomainEventInput
): Promise<unknown> {
    if (!env.API_GATEWAY_SERVICE) {
        throw new Error("API_GATEWAY_SERVICE binding is required for gateway-owned event mutations");
    }

    if (!env.INTERNAL_API_SECRET) {
        throw new Error("INTERNAL_API_SECRET is required for gateway-owned event mutations");
    }

    const response = await env.API_GATEWAY_SERVICE.fetch("https://api-gateway/v1/internal/events/domain", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Internal-API-Secret": env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify(input),
    });

    const payload = await response.json().catch(async () => {
        const text = await response.text().catch(() => "");
        return text ? { error: text } : null;
    });

    if (!response.ok) {
        throw new Error(`API gateway event mutation failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    return payload;
}
