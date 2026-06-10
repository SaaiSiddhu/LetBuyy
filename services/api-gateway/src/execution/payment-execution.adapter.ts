import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { CHECKOUT_APPLICATION_WORKFLOWS, CHECKOUT_EXECUTION_PIPELINES, defineRuntimeBridge } from '@letbuyy/shared-types';
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

type LegacyInventoryOrder = {
    id: string;
    items?: unknown;
    inventory_reserved_at?: string | null;
    inventory_released_at?: string | null;
};

type LegacyInventoryItem = {
    productId: string;
    quantity: number;
};

type ProductInventoryRow = {
    id: string;
    stock?: number | string | null;
    track_inventory?: boolean | null;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

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

    private legacyOrderItemsFromJson(order: LegacyInventoryOrder): LegacyInventoryItem[] {
        if (!Array.isArray(order.items)) return [];

        return order.items
            .map((item) => {
                const record = asRecord(item);
                const productId = stringValue(record.product_id) || stringValue(record.productId);
                const quantity = numberValue(record.quantity);
                return productId && quantity > 0 ? { productId, quantity } : null;
            })
            .filter((item): item is LegacyInventoryItem => Boolean(item));
    }

    private async loadJsonOnlyLegacyInventoryOrder(orderId: string): Promise<LegacyInventoryOrder | null> {
        const { data: order } = await this.db
            .from('orders')
            .select('id, items, inventory_reserved_at, inventory_released_at')
            .eq('id', orderId)
            .is('deleted_at', null)
            .single();

        if (!order) return null;

        const { data: relationalItems } = await this.db
            .from('order_items')
            .select('id')
            .eq('order_id', orderId)
            .is('deleted_at', null)
            .limit(1);

        if (Array.isArray(relationalItems) && relationalItems.length > 0) return null;
        return order as LegacyInventoryOrder;
    }

    private async adjustLegacyProductStock(order: LegacyInventoryOrder, direction: 'reserve' | 'release'): Promise<boolean> {
        const items = this.legacyOrderItemsFromJson(order);
        if (items.length === 0) return false;

        for (const item of items) {
            const { data: product } = await this.db
                .from('products')
                .select('id, stock, track_inventory')
                .eq('id', item.productId)
                .is('deleted_at', null)
                .single();

            const inventory = product as ProductInventoryRow | null;
            if (!inventory || inventory.track_inventory === false) continue;

            const currentStock = numberValue(inventory.stock);
            const nextStock = direction === 'reserve'
                ? Math.max(0, currentStock - item.quantity)
                : currentStock + item.quantity;

            const { error } = await this.db
                .from('products')
                .update({
                    stock: nextStock,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.productId);

            if (error) {
                throw new Error(`Failed to adjust legacy product stock: ${error.message}`);
            }
        }

        return true;
    }

    private async reserveLegacyProductStockIfNeeded(orderId: string): Promise<void> {
        const order = await this.loadJsonOnlyLegacyInventoryOrder(orderId);
        if (!order || order.inventory_reserved_at) return;

        const adjusted = await this.adjustLegacyProductStock(order, 'reserve');
        if (!adjusted) return;

        const { error } = await this.db
            .from('orders')
            .update({
                inventory_reserved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .is('deleted_at', null);

        if (error) {
            throw new Error(`Failed to mark legacy inventory reservation: ${error.message}`);
        }
    }

    private async releaseLegacyProductStockIfNeeded(orderId: string): Promise<void> {
        const order = await this.loadJsonOnlyLegacyInventoryOrder(orderId);
        if (!order?.inventory_reserved_at || order.inventory_released_at) return;

        await this.adjustLegacyProductStock(order, 'release');
    }

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
        provider: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
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
        provider: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
        providerPaymentId: string;
        providerOrderId?: string | null;
        providerEventId?: string | null;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        await this.reserveLegacyProductStockIfNeeded(params.orderId);

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
        provider: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
        providerEventId: string;
        paymentStatus: 'failed' | 'refunded';
        orderStatus: 'cancelled' | 'refunded';
        reason?: string | null;
        releaseInventory?: boolean;
        requestId?: string | null;
        idempotencyKey?: string | null;
    }) {
        if (params.releaseInventory) {
            await this.releaseLegacyProductStockIfNeeded(params.orderId);
        }

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
        provider: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
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
