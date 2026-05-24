import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { CHECKOUT_APPLICATION_WORKFLOWS } from '@letbuyy/application-services';
import { ConflictError, NotFoundError } from '../lib/errors';

type PayableOrder = {
    id: string;
    store_id: string;
    total: number | string;
    currency?: string | null;
    payment_id?: string | null;
    payment_status?: string | null;
    status?: string | null;
};

export class PaymentExecutionAdapter {
    static readonly applicationWorkflows = CHECKOUT_APPLICATION_WORKFLOWS;

    constructor(private db: SupabaseClient) { }

    async loadStorefrontPayableOrder(orderId: string, storeId: string): Promise<PayableOrder> {
        const { data: order } = await this.db
            .from('orders')
            .select('id, store_id, total, currency, payment_id, payment_status, status')
            .eq('id', orderId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .single();

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        const payableOrder = order as PayableOrder;

        if (payableOrder.payment_status === 'paid') {
            throw new ConflictError('Order is already paid');
        }

        if (payableOrder.status === 'cancelled' || payableOrder.status === 'refunded') {
            throw new ConflictError('Order is not payable');
        }

        const total = Number(payableOrder.total);
        if (!Number.isFinite(total) || total <= 0) {
            throw new ConflictError('Order does not have a payable total');
        }

        return {
            ...payableOrder,
            total,
            currency: payableOrder.currency || 'INR',
        };
    }

    async attachPaymentReference(params: {
        orderId: string;
        provider: 'razorpay' | 'stripe' | 'paypal';
        providerOrderId: string;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        const { data, error } = await this.db.rpc('attach_order_payment_reference_with_ledger', {
            p_order_id: params.orderId,
            p_provider: params.provider,
            p_provider_order_id: params.providerOrderId,
            p_request_id: params.requestId || null,
            p_idempotency_key: params.idempotencyKey || null,
        });

        if (error) {
            throw new Error(`Failed to attach payment reference: ${error.message}`);
        }

        return data;
    }

    async confirmPayment(params: {
        orderId: string;
        provider: 'razorpay' | 'stripe' | 'paypal';
        providerPaymentId: string;
        providerOrderId?: string | null;
        providerEventId?: string | null;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        const { data, error } = await this.db.rpc('confirm_order_payment_with_ledger', {
            p_order_id: params.orderId,
            p_provider: params.provider,
            p_provider_payment_id: params.providerPaymentId,
            p_provider_order_id: params.providerOrderId || null,
            p_provider_event_id: params.providerEventId || null,
            p_request_id: params.requestId || null,
            p_idempotency_key: params.idempotencyKey || null,
        });

        if (error) {
            throw new Error(`Failed to confirm payment: ${error.message}`);
        }

        return data;
    }

    async recordPaymentFailure(params: {
        orderId: string;
        provider: 'razorpay' | 'stripe' | 'paypal';
        providerEventId: string;
        paymentStatus: 'failed' | 'refunded';
        orderStatus: 'cancelled' | 'refunded';
        reason?: string | null;
        releaseInventory?: boolean;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        const { data, error } = await this.db.rpc('record_order_payment_failure_with_ledger', {
            p_order_id: params.orderId,
            p_provider: params.provider,
            p_provider_event_id: params.providerEventId,
            p_payment_status: params.paymentStatus,
            p_order_status: params.orderStatus,
            p_reason: params.reason || null,
            p_release_inventory: params.releaseInventory || false,
            p_request_id: params.requestId || null,
            p_idempotency_key: params.idempotencyKey || null,
        });

        if (error) {
            throw new Error(`Failed to record payment failure: ${error.message}`);
        }

        return data;
    }
}
