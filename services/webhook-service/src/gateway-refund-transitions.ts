import type { GatewayServiceBinding } from './gateway-order-transitions';
export { normalizeRazorpayRefundLifecycle } from '@letbuyy/infrastructure/razorpay-adapter';

export interface GatewayRefundTransitionEnv {
    API_GATEWAY_SERVICE?: GatewayServiceBinding;
    INTERNAL_API_SECRET?: string;
}

export type RazorpayRefundEventType = 'refund.created' | 'refund.processed' | 'refund.failed';
export type GatewayRefundStatus = 'created' | 'processed' | 'failed';

/**
 * Razorpay's refund.created entity can already say "processed" for standard refunds,
 * even though the event means only that the refund request was created. Keep the
 * provider event as the lifecycle authority so this event can never post a reversal.
 */

export async function reconcileGatewayPaymentRefund(
    env: GatewayRefundTransitionEnv,
    input: {
        providerPaymentId: string;
        providerRefundId: string;
        providerEventId: string;
        eventType: 'refund.created' | 'refund.processed' | 'refund.failed';
        status: 'created' | 'processed' | 'failed';
        amountMinor: number;
        currency: string;
    },
): Promise<Record<string, unknown>> {
    if (!env.API_GATEWAY_SERVICE) throw new Error('API_GATEWAY_SERVICE binding is required for payment refund reconciliation');
    if (!env.INTERNAL_API_SECRET) throw new Error('INTERNAL_API_SECRET is required for payment refund reconciliation');

    const response = await env.API_GATEWAY_SERVICE.fetch('https://api-gateway/v1/storefront/internal/payments/refund-event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-API-Secret': env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
            provider: 'razorpay',
            ...input,
        }),
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
        throw new Error(`API gateway payment refund reconciliation failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload || {};
}
