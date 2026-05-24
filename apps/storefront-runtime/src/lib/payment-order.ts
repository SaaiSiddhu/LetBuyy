import 'server-only';
import { internalWorkerFetch, readWorkerJson } from './worker-client';

export interface StorefrontPayableOrder {
    id: string;
    store_id: string;
    total: number;
    items?: unknown;
    customer_email?: string | null;
    payment_id?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    status?: string | null;
    inventory_reserved_at?: string | null;
}

export async function loadStorefrontPayableOrder(
    orderId: string,
    storeId?: string
): Promise<StorefrontPayableOrder> {
    const query = storeId ? `?store_id=${encodeURIComponent(storeId)}` : '';
    const response = await internalWorkerFetch(`/storefront/internal/orders/${encodeURIComponent(orderId)}/payable${query}`);
    const payload = await readWorkerJson(response);
    const order = payload?.data?.order as StorefrontPayableOrder | undefined;

    if (!order) throw new Error('Order not found');
    return { ...order, total: Number(order.total) };
}

export async function attachPaymentReference(params: {
    orderId: string;
    provider: 'razorpay' | 'stripe' | 'paypal';
    paymentReference: string;
    idempotencyKey: string;
}): Promise<void> {
    const response = await internalWorkerFetch('/storefront/internal/payments/reference', {
        method: 'POST',
        body: JSON.stringify({
            orderId: params.orderId,
            provider: params.provider,
            paymentReference: params.paymentReference,
            idempotencyKey: params.idempotencyKey,
        }),
    });
    await readWorkerJson(response);
}

export async function markOrderPaid(params: {
    orderId: string;
    provider: 'razorpay' | 'stripe' | 'paypal';
    paymentId: string;
    idempotencyKey: string;
}): Promise<void> {
    const response = await internalWorkerFetch('/storefront/internal/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
            orderId: params.orderId,
            provider: params.provider,
            paymentId: params.paymentId,
            providerEventId: `${params.provider}:storefront:${params.paymentId}`,
            idempotencyKey: params.idempotencyKey,
        }),
    });
    await readWorkerJson(response);
}

export async function markOrderPaymentFailed(params: {
    orderId: string;
    provider: 'razorpay' | 'stripe' | 'paypal';
    providerEventId: string;
    paymentStatus: 'failed' | 'refunded';
    orderStatus: 'cancelled' | 'refunded';
    reason?: string;
    releaseInventory?: boolean;
    idempotencyKey: string;
}): Promise<void> {
    const response = await internalWorkerFetch('/storefront/internal/payments/failure', {
        method: 'POST',
        body: JSON.stringify({
            orderId: params.orderId,
            provider: params.provider,
            providerEventId: params.providerEventId,
            paymentStatus: params.paymentStatus,
            orderStatus: params.orderStatus,
            reason: params.reason || null,
            releaseInventory: params.releaseInventory || false,
            idempotencyKey: params.idempotencyKey,
        }),
    });
    await readWorkerJson(response);
}
