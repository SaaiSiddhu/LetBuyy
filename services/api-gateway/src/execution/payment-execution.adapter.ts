import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { CHECKOUT_APPLICATION_WORKFLOWS, CHECKOUT_EXECUTION_PIPELINES, defineRuntimeBridge } from '@letbuyy/shared-types';
import { AppError, ConflictError, NotFoundError } from '../lib/errors';
import { FIXED_PUBLIC_ERROR_MESSAGES } from '../lib/public-errors';

type PayableOrder = {
    id: string;
    store_id: string;
    total: number | string;
    currency?: string | null;
    payment_id?: string | null;
    payment_status?: string | null;
    status?: string | null;
    inventory_released_at?: string | null;
};

// F-PAY4-1 (migration 252): what confirm_order_payment_with_ledger decided about a provider capture.
//   confirmed              — this capture paid a fulfillable order.
//   duplicate              — this provider payment was already recorded for the order; nothing new was written.
//   captured_unfulfillable — the provider took the money but the order could no longer be fulfilled (its
//                            reservation was released by the unpaid sweep, or it was cancelled). The RPC
//                            recorded the capture once, cancelled the order and queued the refund owed.
// A caller may announce order.paid only when `fulfillable` is true.
export type CaptureOutcome = 'confirmed' | 'duplicate' | 'captured_unfulfillable';

export type CaptureResult = {
    outcome: CaptureOutcome;
    fulfillable: boolean;
    reason: string | null;
};

/**
 * Read the capture decision off the RPC result. The database is the authority; this only reports what
 * it decided. A result without `capture_outcome` came from a database older than migration 252, whose
 * wrapper confirmed every capture it did not raise on — so it is read as the 'confirmed' it was.
 */
export function readCaptureResult(result: unknown): CaptureResult {
    const record = result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {};
    const outcome = record.capture_outcome;
    if (outcome !== 'confirmed' && outcome !== 'duplicate' && outcome !== 'captured_unfulfillable') {
        return { outcome: 'confirmed', fulfillable: true, reason: null };
    }
    return {
        outcome,
        fulfillable: record.fulfillable === true,
        reason: typeof record.unfulfillable_reason === 'string' ? record.unfulfillable_reason : null,
    };
}

// Phase M1 (DOC 03 row 11 "Payments"): Razorpay is the only live money-in
// gateway; every method below posts an externally-confirmed provider
// reference/payment/failure/event to the canonical ledger, which COD (no
// external gateway) never reaches.
type CapturedPaymentProvider = 'razorpay';

export class PaymentExecutionAdapter {
    static readonly applicationWorkflows = CHECKOUT_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = CHECKOUT_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'payment-execution.adapter',
        workflowAuthority: 'checkout-application',
        allowedResponsibilities: ['database-rpc', 'provider-adapter-wiring', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) { }

    async loadStorefrontPayableOrder(orderId: string, storeId: string): Promise<PayableOrder> {
        const { data: order } = await this.db
            .from('orders')
            .select('id, store_id, total, currency, payment_id, payment_status, status, inventory_released_at')
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

        // F-PAY4-1: no NEW payment may start against a released reservation. The unpaid sweep
        // (expire_unpaid_committed_reservations, migration 211) has already put this order's stock back
        // on the shelf, so a payment taken now would buy a unit that may belong to someone else. The buyer
        // checks out again instead; nothing has been charged.
        if (payableOrder.inventory_released_at) {
            throw new AppError(FIXED_PUBLIC_ERROR_MESSAGES.ORDER_RESERVATION_EXPIRED, 409, 'ORDER_RESERVATION_EXPIRED');
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

    /**
     * F-PAY4-1: the order a provider-verified capture is being reported against.
     *
     * Unlike loadStorefrontPayableOrder this never refuses a paid, cancelled or released order. By the
     * time a capture is reported the buyer's money has already been taken, and
     * confirm_order_payment_with_ledger (migration 252) is the single authority that decides whether it
     * paid a fulfillable order, repeats a capture already recorded, or must be recorded with a refund
     * owed. Refusing here first would leave that money unrecorded on this path.
     */
    async loadStorefrontOrderForCapture(orderId: string, storeId: string): Promise<PayableOrder> {
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

        const captureOrder = order as PayableOrder;
        const total = Number(captureOrder.total);
        if (!Number.isFinite(total) || total <= 0) {
            throw new ConflictError('Order does not have a payable total');
        }

        return {
            ...captureOrder,
            total,
            currency: captureOrder.currency || 'INR',
        };
    }

    async attachPaymentReference(params: {
        orderId: string;
        provider: CapturedPaymentProvider;
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
        provider: CapturedPaymentProvider;
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
        provider: CapturedPaymentProvider;
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

    async recordPaymentEvent(params: {
        orderId: string;
        provider: CapturedPaymentProvider;
        providerEventId: string;
        eventType: string;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        const { data, error } = await this.db
            .from('orders')
            .update({
                last_payment_event_id: params.providerEventId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.orderId)
            .is('deleted_at', null)
            .select('id, store_id, payment_status, status, last_payment_event_id')
            .single();

        if (error) {
            throw new Error(`Failed to record payment event: ${error.message}`);
        }

        return {
            order: data,
            provider: params.provider,
            provider_event_id: params.providerEventId,
            event_type: params.eventType,
            request_id: params.requestId || null,
            idempotency_key: params.idempotencyKey || null,
        };
    }
}
