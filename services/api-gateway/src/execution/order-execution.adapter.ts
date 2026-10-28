// ============================================================
// ORDER EXECUTION ADAPTER — Application-service-backed runtime adapter
// ============================================================

import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    CHECKOUT_APPLICATION_WORKFLOWS,
    CHECKOUT_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import { AppError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../lib/errors';
import type { TenantContext } from '../lib/tenant-context';
import { OutboxExecutionAdapter } from './outbox-execution.adapter';
import { SaasExecutionAdapter, assertResolvedCreationEntitlements } from './saas-execution.adapter';
import {
    planOrderStatusTransition,
    type CompleteRefundCommand,
    type CompleteReturnRefundInput,
    type CreateCheckoutOrderCommand,
    type FulfillOrderCommand,
    type RefundOrderCommand,
} from '@letbuyy/checkout-core';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface OrderRow {
    id: string;
    status: string;
    store_id?: string | null;
}

interface CreateOrderOptions {
    deferPostCommit?: boolean;
}

export class OrderExecutionAdapter {
    static readonly applicationWorkflows = CHECKOUT_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = CHECKOUT_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'order-execution.adapter',
        workflowAuthority: 'checkout-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

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
    async createOrder(
        input: CreateCheckoutOrderCommand & {
            shipping_rate_id?: string | null;
            expected_shipping_amount?: number | null;
            tax_amount?: number | null;
            place_of_supply_state?: string | null;
            tax_lines?: Array<{ title: string; rate: number; amount: number; jurisdiction?: Record<string, unknown> }> | null;
            /** Set only from a currently verified site-bound buyer session, never from request JSON. */
            buyer_account_id?: string | null;
            buyer_session_epoch?: number | null;
        },
        tenant: TenantContext,
        options: CreateOrderOptions = {},
    ) {
        await this.assertOrderQuota(tenant.siteId);
        const shippingAddress = { ...(input.shipping_address || {}) };
        if (input.customer_gstin) shippingAddress.gstin = input.customer_gstin;

        const checkoutArgs = {
            p_store_id: tenant.siteId,
            p_customer_name: input.customer_name,
            p_customer_email: input.customer_email,
            p_customer_phone: input.customer_phone || null,
            p_shipping_address: shippingAddress,
            // Persisted cart references only. Never forward a caller's snapshot, price,
            // accepted labels or personalization as fulfillment authority to the RPC.
            p_items: input.items.map(item => ({
                product_id: item.product_id, variant_id: item.variant_id || null, quantity: item.quantity,
                ...(item.marketplace_listing_id ? { marketplace_listing_id: item.marketplace_listing_id } : {}),
                ...(item.cart_fact_ref ? { cart_fact_ref: item.cart_fact_ref } : {}),
            })),
            p_payment_method: input.payment_method,
            p_notes: input.notes || null,
            p_coupon_code: input.coupon_code || null,
            p_gift_card_code: input.gift_card_code || null,
            p_shipping_method: input.shipping_method || 'standard',
            p_idempotency_key: input.idempotency_key,
            p_actor_id: tenant.userId,
            p_request_id: tenant.requestId,
            // V1 LB-7: thread server-resolved shipping rate ID and GST amount.
            p_shipping_rate_id: input.shipping_rate_id ?? null,
            p_tax_amount: typeof input.tax_amount === 'number' ? input.tax_amount : null,
            // T13/W3-W4: the recipient GST state code the gateway resolved, and the
            // CGST/SGST/IGST breakdown behind p_tax_amount — written atomically with order
            // creation (place_of_supply_state directly on orders; tax_lines into order_tax_lines).
            p_place_of_supply_state: input.place_of_supply_state ?? null,
            p_tax_lines: input.tax_lines && input.tax_lines.length > 0 ? input.tax_lines : null,
        };
        const { data, error } = input.sales_origin === 'marketplace'
            ? typeof input.expected_shipping_amount === 'number'
                ? await this.db.rpc('create_marketplace_checkout_order_with_delivery_rate', {
                    ...checkoutArgs,
                    p_buyer_account_id: input.buyer_account_id ?? null,
                    p_buyer_session_epoch: input.buyer_session_epoch ?? null,
                    p_expected_shipping_amount: input.expected_shipping_amount,
                })
                : await this.db.rpc('create_marketplace_checkout_order', {
                    ...checkoutArgs,
                    p_buyer_account_id: input.buyer_account_id ?? null,
                    p_buyer_session_epoch: input.buyer_session_epoch ?? null,
                })
            : typeof input.expected_shipping_amount === 'number'
            ? await this.db.rpc('create_storefront_checkout_order_with_delivery_rate', {
                ...checkoutArgs,
                p_buyer_account_id: input.buyer_account_id ?? null,
                p_buyer_session_epoch: input.buyer_session_epoch ?? null,
                p_expected_shipping_amount: input.expected_shipping_amount,
            })
            : input.buyer_account_id
            ? await this.db.rpc('create_checkout_order_for_buyer', {
                ...checkoutArgs,
                p_buyer_account_id: input.buyer_account_id,
                p_buyer_session_epoch: input.buyer_session_epoch,
                p_loyalty_points: null,
            })
            : await this.db.rpc('create_checkout_order', checkoutArgs);

        if (error) {
            const message = error.message || 'Order creation failed';
            if (/CART_FACT|CART_VARIANT_REQUIRED/.test(message)) {
                throw new AppError('Product choices changed or need review. Refresh your cart and review its details before ordering.', 409, 'CHECKOUT_PRODUCT_CHANGED');
            }
            if (message.includes('INSUFFICIENT_INVENTORY')) {
                throw new AppError(
                    'One or more items are no longer available in the requested quantity. Review your cart and try again.',
                    409,
                    'INSUFFICIENT_INVENTORY',
                );
            }
            if (message.includes('marketplace listing revision')) {
                throw new AppError(
                    'A marketplace listing changed after review. Review the current seller total before trying again.',
                    409,
                    'MARKETPLACE_LISTING_CHANGED',
                );
            }
            if (message.includes('marketplace listing is unavailable')) {
                throw new AppError(
                    'A marketplace listing became unavailable before order creation. Review your cart and try again.',
                    409,
                    'MARKETPLACE_LISTING_UNAVAILABLE',
                );
            }
            if (message.includes('marketplace delivery rate quote changed') || message.includes('marketplace delivery rate is no longer available') || message.includes('marketplace delivery rate does not cover')
                || message.includes('storefront delivery rate quote changed') || message.includes('storefront delivery rate is no longer available') || message.includes('storefront delivery rate does not cover')
                || message.includes('storefront delivery rate subtotal range changed') || message.includes('storefront delivery rate does not support COD')) {
                throw new AppError('The delivery option changed before order creation. Review delivery options and try again.', 409, 'CHECKOUT_SHIPPING_CHANGED');
            }
            if (message.includes('marketplace checkout') || message.includes('marketplace order listing identity')) {
                throw new ConflictError('Marketplace checkout could not safely bind this order. Refresh the marketplace cart and try again.');
            }
            if (message.includes('buyer session is no longer active')) {
                throw new AppError('A storefront sign-in is required.', 401, 'UNAUTHORIZED');
            }
            if (message.includes('checkout idempotency key is already bound') || message.includes('checkout order ownership conflicts')) {
                throw new ConflictError('This checkout key is already associated with another checkout. Start checkout again.');
            }
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

        const committedOrder = data && typeof data === 'object' && 'id' in data ? String(data.id) : null;
        if (committedOrder) {
            try { await new OutboxExecutionAdapter(this.db).dispatchOrderEmails(tenant.siteId, committedOrder); }
            catch { console.warn(JSON.stringify({ level: 'warn', event: 'order_email_outbox_wakeup_deferred', site_id: tenant.siteId })); }
        }
        if (options.deferPostCommit) return data;
        return this.completeOrderPostCommitWork(input, tenant, data);
    }

    async completeOrderPostCommitWork(
        input: CreateCheckoutOrderCommand,
        tenant: TenantContext,
        data: unknown,
    ): Promise<unknown> {
        await new SaasExecutionAdapter(this.db).recordUsage({
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

        if (typeof data === 'object' && data && 'id' in data) {
            // T14/W0-W1: this used to call generateAndPersistGstInvoice, a TS-side function that
            // (a) had never once run to completion since it shipped — its own order_items query
            // carried no tenant predicate, and the app-layer tenant guard correctly rejected it
            // on every order, every time (confirmed live by placing a real order and reading the
            // gateway's own log: event: storefront.checkout.post_commit_failed, error: "Tenant
            // table order_items requires a tenant/owner predicate before execution") -- and
            // (b) even once unblocked, recomputed tax independently with the pre-T13 logic (no
            // discount apportionment, no HSN precedence), which would have disagreed with the
            // authoritative orders.tax/order_tax_lines T13 already computed and stored. Replaced
            // with issue_gst_invoice (migration 214), a SECURITY DEFINER RPC that reads T13's
            // stored figures directly -- never recomputes GST a second way -- and atomically
            // allocates a per-site sequential invoice number under a row lock. gst_invoices is
            // the canonical invoice representation; orders.gst_invoice (a full JSONB duplicate)
            // is intentionally not populated here to avoid a third, unwired representation.
            const { data: invoiceData, error: invoiceError } = await this.db.rpc('issue_gst_invoice', {
                p_order_id: String(data.id),
                p_actor_id: tenant.userId,
                p_request_id: tenant.requestId,
            });

            if (invoiceError) {
                // A store with no GST registration configured, or an order with no computed tax
                // (both legitimate, common states -- e.g. a store that hasn't set up GSTIN yet)
                // is not a failure worth surfacing loudly; anything else is logged so it does not
                // silently vanish the way the old function's failures did.
                if (!/no GST registration configured|has no computed GST to invoice/.test(invoiceError.message || '')) {
                    console.error(JSON.stringify({
                        level: 'error',
                        event: 'gst_invoice_issue_failed',
                        site_id: tenant.siteId,
                        order_id: String(data.id),
                        error: invoiceError.message,
                    }));
                }
            } else if (invoiceData && typeof invoiceData === 'object' && 'invoice_number' in invoiceData) {
                return {
                    ...data,
                    gst_invoice_number: (invoiceData as { invoice_number: string }).invoice_number,
                };
            }
        }

        return data;
    }

    private async assertOrderQuota(siteId: string): Promise<void> {
        const entitlements = await new SaasExecutionAdapter(this.db).resolveEntitlements(siteId);
        assertResolvedCreationEntitlements(entitlements);
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
        if (newStatus === 'refunded') {
            throw new ValidationError('Complete refunds through the verified refund workflow. Updating fulfilment cannot confirm a refund.');
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

        const plan = planOrderStatusTransition(ownedOrder.status, newStatus, metadata || {});
        if (plan.delegatesToFulfillment) {
            return this.fulfillOrder(orderId, tenant, {
                idempotency_key: String(metadata?.idempotency_key || tenant.requestId),
                carrier: typeof metadata?.carrier === 'string' ? metadata.carrier : undefined,
                tracking_number: typeof metadata?.tracking_number === 'string' ? metadata.tracking_number : undefined,
            });
        }

        if (!plan.allowed) {
            throw new ValidationError(
                `Cannot transition from "${ownedOrder.status}" to "${newStatus}". ` +
                `Allowed transitions: ${plan.allowedTransitions.length > 0 ? plan.allowedTransitions.join(', ') : 'none (terminal state)'}`
            );
        }

        if (plan.requiresInventoryRelease) {
            await this.returnInventory(orderId, tenant);
        }

        const { data, error } = await this.db
            .from('orders')
            .update(plan.updates)
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

    async completeRefund(orderId: string, tenant: TenantContext, input: CompleteRefundCommand, proof: Record<string, unknown>) {
        return this.completeOwnedRefund(orderId, tenant, input, proof);
    }

    async completeReturnRefund(orderId: string, returnId: string, tenant: TenantContext, input: CompleteReturnRefundInput, proof: Record<string, unknown>) {
        return (await this.completeOwnedRefund(orderId, tenant, input, proof, returnId)).data;
    }

    private async completeOwnedRefund(orderId: string, tenant: TenantContext,
        input: { idempotency_key: string; refund_id?: string; provider_refund_id?: string; provider_event_id?: string; notes?: string },
        proof: Record<string, unknown>, returnId?: string) {
        if (input.refund_id) {
            let query = this.db.from('refunds').select('id').eq('id', input.refund_id)
                .eq('order_id', orderId).eq('site_id', tenant.siteId).is('deleted_at', null);
            if (returnId) query = query.eq('return_id', returnId);
            const { data: refund, error: refundError } = await query.maybeSingle();
            if (refundError) throw new Error('Refund scope lookup failed');
            if (!refund) throw new NotFoundError('Refund not found');
        }
        // The SQL boundary rechecks/locks live ownership and all source FKs, and
        // commits its receipt in the same transaction as complete_order_refund.
        const { data: outcome, error } = await this.db.rpc('complete_owned_order_refund_v1', {
            p_site_id: tenant.siteId, p_order_id: orderId, p_return_id: returnId ?? null,
            p_actor_id: tenant.userId, p_intent: { ...input, _step_up: proof }, p_request_id: tenant.requestId,
        });
        if (error?.code === '22023') throw new ConflictError('Refund provider reference conflicts with its committed source');
        if (error?.message?.includes('refund amount exceeds captured order total')) throw new ConflictError('The refundable order amount has already been used. Refresh the return.');
        if (error?.message?.includes('succeeded refund requires its matching canonical posting') || error?.message?.includes('refund source already posted; reconciliation is required'))
            throw new AppError('This refund needs review before it can be completed.', 409, 'REFUND_REVIEW_REQUIRED');
        if (error) throw new Error('Refund completion failed');
        const result = outcome as { status?: number; error?: string; data?: Record<string, JsonValue>; replayed?: boolean; source_replayed?: boolean } | null;
        if (result?.status === 404) throw new NotFoundError('Refund not found');
        if (result?.status === 403) throw new ForbiddenError('Not authorized to complete this refund');
        if (result?.status === 428) throw new AppError('Approval changed or expired. Verify again.', 428, result.error || 'STEP_UP_INVALID');
        if (result?.status === 400) throw new ValidationError('Invalid refund completion');
        if (result?.error === 'REFUND_REVIEW_REQUIRED') throw new AppError('This refund needs review before it can be completed.', 409, 'REFUND_REVIEW_REQUIRED');
        if (result?.status === 409) throw new AppError(result.error === 'REFUND_SELECTION_REQUIRED'
            ? 'Choose the refund to complete.' : 'This refund request conflicts with its saved receipt.', 409, result.error || 'REFUND_CONFLICT');
        const order = result?.data?.order;
        if (result?.status !== 200 || !order || typeof order !== 'object' || Array.isArray(order) || order.id !== orderId || order.store_id !== tenant.siteId)
            throw new AppError('Refund completion is temporarily unavailable.', 503, 'REFUND_COMPLETE_UNAVAILABLE');
        return {data: result.data!, replayed: result.replayed === true || result.source_replayed === true};
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
