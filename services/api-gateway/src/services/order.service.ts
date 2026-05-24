// ============================================================
// ORDER SERVICE — Business logic extraction from routes
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { VALID_TRANSITIONS } from '../schemas/order.schema';
import type { TenantContext } from '../lib/tenant-context';
import { SaasService } from './saas.service';
import type {
    CompleteRefundCommand,
    CreateCheckoutOrderCommand,
    FulfillOrderCommand,
    RefundOrderCommand,
} from '@letbuyy/checkout-core';

interface OrderRow {
    id: string;
    status: string;
    store_id?: string | null;
}

export class OrderService {
    constructor(private db: SupabaseClient) { }

    /**
     * Create an order with SERVER-SIDE price calculation.
     *
     * CRITICAL SECURITY FIX: All totals are calculated from DB product prices.
     * The client NEVER sends price/total — only product_id + quantity.
     *
     * Steps:
     * 1. Validate all products exist and are active
     * 2. Check inventory for each item
     * 3. Calculate totals from DB prices (NOT client)
     * 4. Generate collision-free order number
     * 5. Insert order + items atomically through the inventory RPC
     */
    async createOrder(input: CreateCheckoutOrderCommand, tenant: TenantContext) {
        await this.assertOrderQuota(tenant.siteId);

        const { data, error } = await this.db.rpc('create_checkout_order', {
            p_store_id: tenant.siteId,
            p_customer_name: input.customer_name,
            p_customer_email: input.customer_email,
            p_customer_phone: input.customer_phone || null,
            p_shipping_address: input.shipping_address || {},
            p_items: input.items,
            p_payment_method: input.payment_method,
            p_notes: input.notes || null,
            p_coupon_code: input.coupon_code || null,
            p_gift_card_code: input.gift_card_code || null,
            p_shipping_method: input.shipping_method || 'standard',
            p_idempotency_key: input.idempotency_key,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
        });

        if (error) {
            const message = error.message || 'Order creation failed';
            if (this.isMissingOrderRpc(message)) {
                throw new Error(
                    'Order creation requires migrations 032_inventory_reservations_order_commit.sql and 046_checkout_payment_inventory_ledgers.sql. ' +
                    'Unsafe compatibility order creation is disabled.'
                );
            }
            if (message.toLowerCase().includes('insufficient stock')) {
                throw new ValidationError(message);
            }
            throw new Error(`Order creation failed: ${message}`);
        }

        await new SaasService(this.db).recordUsage({
            siteId: tenant.siteId,
            meterName: 'orders',
            amount: 1,
            idempotencyKey: `order.create:${tenant.siteId}:${input.idempotency_key}`,
            source: 'checkout-engine',
            resourceType: 'order',
            resourceId: typeof data === 'object' && data && 'id' in data ? String(data.id) : null,
            requestId: tenant.requestId,
            traceId: tenant.requestId,
            metadata: {
                actor_id: tenant.userId,
                payment_method: input.payment_method,
            },
        });

        return data;
    }

    private async assertOrderQuota(siteId: string): Promise<void> {
        const entitlements = await new SaasService(this.db).resolveEntitlements(siteId);
        const rawLimit = entitlements.limits.orders_monthly;
        if (rawLimit === null || rawLimit === undefined) return;

        const orderLimit = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
        if (!Number.isFinite(orderLimit)) return;

        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

        const { count, error } = await this.db
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', siteId)
            .gte('created_at', periodStart)
            .is('deleted_at', null);

        if (error) throw new Error(`Order quota check failed: ${error.message}`);
        if ((count || 0) >= orderLimit) {
            throw new ForbiddenError(`Monthly order limit reached for the ${entitlements.plan} plan`);
        }
    }

    private isMissingOrderRpc(message: string) {
        const normalized = message.toLowerCase();
        return (normalized.includes('create_checkout_order') || normalized.includes('create_order_with_inventory_reservations')) &&
            (normalized.includes('schema cache') || normalized.includes('could not find the function'));
    }

    private toNumber(value: number | string | null | undefined, fallback: number) {
        if (value === null || value === undefined) return fallback;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    /**
     * Transition order status using the state machine.
     * Only allows valid transitions defined in VALID_TRANSITIONS.
     */
    async transitionStatus(
        orderId: string,
        tenant: TenantContext,
        newStatus: string,
        metadata?: Record<string, unknown>
    ) {
        if (newStatus === 'shipped') {
            return this.fulfillOrder(orderId, tenant, {
                idempotency_key: String(metadata?.idempotency_key || tenant.requestId),
                carrier: typeof metadata?.carrier === 'string' ? metadata.carrier : undefined,
                tracking_number: typeof metadata?.tracking_number === 'string' ? metadata.tracking_number : undefined,
            });
        }

        const { data: order } = await this.db
            .from('orders')
            .select('id, store_id, status')
            .eq('id', orderId)
            .eq('store_id', tenant.siteId)
            .single();

        const ownedOrder = order as OrderRow | null;
        if (!ownedOrder?.store_id) throw new NotFoundError('Order not found');
        if (ownedOrder.store_id !== tenant.siteId) {
            throw new ForbiddenError('Not authorized to update this order');
        }

        // Validate transition
        const allowed = VALID_TRANSITIONS[ownedOrder.status] || [];
        if (!allowed.includes(newStatus)) {
            throw new ValidationError(
                `Cannot transition from "${ownedOrder.status}" to "${newStatus}". ` +
                `Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`
            );
        }

        // Build updates
        const updates: Record<string, unknown> = { status: newStatus };

        if (newStatus === 'shipped') {
            updates.fulfillment_status = 'fulfilled';
            if (metadata?.tracking_number) updates.tracking_number = metadata.tracking_number;
            if (metadata?.carrier) updates.carrier = metadata.carrier;
        }

        if (newStatus === 'delivered') {
            updates.payment_status = 'paid';
        }

        if (newStatus === 'cancelled') {
            updates.payment_status = 'refunded';
            updates.notes = metadata?.cancellation_reason || 'Order cancelled';
            await this.returnInventory(orderId, tenant);
        }

        const { data, error } = await this.db
            .from('orders')
            .update(updates)
            .eq('id', orderId)
            .eq('store_id', tenant.siteId)
            .select()
            .single();

        if (error) throw new Error(`Status update failed: ${error.message}`);
        return data;
    }

    async fulfillOrder(orderId: string, tenant: TenantContext, input: FulfillOrderCommand) {
        const { data, error } = await this.db.rpc('create_order_fulfillment', {
            p_order_id: orderId,
            p_lines: input.lines || null,
            p_location_id: input.location_id || null,
            p_carrier: input.carrier || null,
            p_tracking_number: input.tracking_number || null,
            p_tracking_url: input.tracking_url || null,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
            p_idempotency_key: input.idempotency_key,
        });

        if (error) {
            throw new Error(`Fulfillment failed: ${error.message}`);
        }

        return data;
    }

    async createRefund(orderId: string, tenant: TenantContext, input: RefundOrderCommand) {
        const { data, error } = await this.db.rpc('create_order_return_and_refund', {
            p_order_id: orderId,
            p_lines: input.lines || null,
            p_reason: input.reason || null,
            p_refund_method: input.refund_method,
            p_restock: input.restock,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
            p_idempotency_key: input.idempotency_key,
        });

        if (error) {
            throw new Error(`Refund creation failed: ${error.message}`);
        }

        return data;
    }

    async completeRefund(orderId: string, tenant: TenantContext, input: CompleteRefundCommand) {
        const { data, error } = await this.db.rpc('complete_order_refund', {
            p_refund_id: input.refund_id,
            p_provider_refund_id: input.provider_refund_id || null,
            p_provider_event_id: input.provider_event_id || null,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
            p_idempotency_key: input.idempotency_key,
        });

        if (error) {
            throw new Error(`Refund completion failed: ${error.message}`);
        }

        const order = data && typeof data === 'object' && 'order' in data ? (data as { order?: OrderRow }).order : null;
        if (order?.store_id && order.store_id !== tenant.siteId) {
            throw new ForbiddenError('Not authorized to complete this refund');
        }

        return data;
    }

    /**
     * Return inventory to products when an order is cancelled.
     */
    private async returnInventory(orderId: string, tenant: TenantContext) {
        const { error } = await this.db.rpc('release_order_inventory_with_ledger', {
            p_order_id: orderId,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
            p_release_reason: 'order_cancelled',
        });

        if (error) {
            throw new Error(`Inventory release failed: ${error.message}`);
        }
    }
}
