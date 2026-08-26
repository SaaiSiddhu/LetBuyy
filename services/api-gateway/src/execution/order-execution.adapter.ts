// ============================================================
// ORDER EXECUTION ADAPTER — Application-service-backed runtime adapter
// ============================================================

import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    CHECKOUT_APPLICATION_WORKFLOWS,
    CHECKOUT_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import type { TenantContext } from '../lib/tenant-context';
import { SaasExecutionAdapter } from './saas-execution.adapter';
import {
    generateGstInvoice,
    normalizeIndianStateCode,
    planOrderStatusTransition,
    type CompleteRefundCommand,
    type CreateCheckoutOrderCommand,
    type FulfillOrderCommand,
    type GeneratedGstInvoice,
    type GstInvoiceLineInput,
    type RefundOrderCommand,
} from '@letbuyy/checkout-core';

interface OrderRow {
    id: string;
    status: string;
    store_id?: string | null;
}

interface GstSiteRow {
    id: string;
    name?: string | null;
    store_name?: string | null;
    gstin?: string | null;
    gst_state_code?: string | null;
    invoice_prefix?: string | null;
}

interface GstOrderRow {
    id: string;
    store_id: string;
    order_number: string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_gstin?: string | null;
    shipping_address?: Record<string, unknown> | string | null;
    currency?: string | null;
    gst_invoice_number?: string | null;
    gst_invoice?: Record<string, unknown> | null;
    place_of_supply_state?: string | null;
}

interface GstOrderItemRow {
    id: string;
    product_id?: string | null;
    variant_id?: string | null;
    title?: string | null;
    name?: string | null;
    sku?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    price?: number | string | null;
    hsn_code?: string | null;
    gst_rate?: number | string | null;
    product_snapshot?: Record<string, unknown> | string | null;
}

interface GstTaxRateRow {
    rate?: number | string | null;
}

interface CreateOrderOptions {
    deferPostCommit?: boolean;
}

function toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {};
        } catch {
            return {};
        }
    }

    return {};
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function majorToMinor(value: unknown): number {
    return Math.round(Math.max(0, numberValue(value) || 0) * 100);
}

function taxRateBps(value: unknown): number | null {
    const rate = numberValue(value);
    if (rate === null || rate < 0) return null;
    return Math.round(rate <= 1 ? rate * 10_000 : rate * 100);
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
            tax_amount?: number | null;
            place_of_supply_state?: string | null;
            tax_lines?: Array<{ title: string; rate: number; amount: number; jurisdiction?: Record<string, unknown> }> | null;
        },
        tenant: TenantContext,
        options: CreateOrderOptions = {},
    ) {
        await this.assertOrderQuota(tenant.siteId);
        const shippingAddress = { ...(input.shipping_address || {}) };
        if (input.customer_gstin) shippingAddress.gstin = input.customer_gstin;

        const { data, error } = await this.db.rpc('create_checkout_order', {
            p_store_id: tenant.siteId,
            p_customer_name: input.customer_name,
            p_customer_email: input.customer_email,
            p_customer_phone: input.customer_phone || null,
            p_shipping_address: shippingAddress,
            p_items: input.items,
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
            const invoice = await this.generateAndPersistGstInvoice(String(data.id), tenant.siteId);
            if (invoice) {
                // T13/W4: do NOT overwrite `tax`/`place_of_supply_state` from the invoice here —
                // create_checkout_order (T13 migration 213) already set both authoritatively at
                // creation time, using the post-discount, HSN-aware computation the customer was
                // actually charged from. This invoice-generation step recomputes tax
                // independently (still discount_amount_minor: 0, still no HSN precedence — a
                // known, filed gap, see CAP registry) purely to produce the gst_invoice JSONB
                // snapshot; letting its own, less-correct figure silently overwrite the real
                // charged amount was a genuine money-correctness risk once both paths could ever
                // both resolve a supplier state at the same time (they now read the same
                // sites.gstin/gst_state_code source, so both routinely succeed together).
                return {
                    ...data,
                    gst_invoice_number: invoice.invoice_number,
                    gst_invoice: invoice,
                };
            }
        }

        return data;
    }

    async generateAndPersistGstInvoice(orderId: string, siteId: string): Promise<GeneratedGstInvoice | null> {
        const { data: orderData, error: orderError } = await this.db
            .from('orders')
            .select('id, store_id, order_number, customer_name, customer_email, customer_gstin, shipping_address, currency, gst_invoice_number, gst_invoice, place_of_supply_state')
            .eq('id', orderId)
            .eq('store_id', siteId)
            .is('deleted_at', null)
            .maybeSingle();

        if (orderError) throw new Error(`GST order lookup failed: ${orderError.message}`);
        if (!orderData) return null;

        const order = orderData as GstOrderRow;
        if (order.gst_invoice && order.gst_invoice_number) return order.gst_invoice as unknown as GeneratedGstInvoice;

        const { data: siteData, error: siteError } = await this.db
            .from('sites')
            .select('id, name, store_name, gstin, gst_state_code, invoice_prefix')
            .eq('id', siteId)
            .maybeSingle();

        if (siteError) throw new Error(`GST site lookup failed: ${siteError.message}`);
        if (!siteData) return null;

        const site = siteData as GstSiteRow;
        const supplierStateCode = normalizeIndianStateCode(site.gst_state_code ?? null);
        if (!supplierStateCode) return null;

        const shippingAddress = toRecord(order.shipping_address);
        const recipientGstin = textValue(order.customer_gstin) || textValue(shippingAddress.gstin);
        const recipientStateCode = normalizeIndianStateCode(
            textValue(shippingAddress.state_code) ||
            textValue(shippingAddress.stateCode) ||
            textValue(order.place_of_supply_state),
        );
        if (!recipientGstin && !recipientStateCode) return null;

        const { data: itemData, error: itemError } = await this.db
            .from('order_items')
            .select('id, product_id, variant_id, title, name, sku, quantity, unit_price, price, hsn_code, gst_rate, product_snapshot')
            .eq('order_id', orderId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (itemError) throw new Error(`GST order item lookup failed: ${itemError.message}`);

        const items = (itemData || []) as GstOrderItemRow[];
        if (items.length === 0) return null;

        const { data: taxRateData, error: taxRateError } = await this.db
            .from('tax_rates')
            .select('rate')
            .eq('store_id', siteId)
            .eq('is_active', true)
            .eq('is_shipping', false)
            .is('deleted_at', null)
            .order('priority', { ascending: false })
            .limit(1);

        if (taxRateError) throw new Error(`GST tax rate lookup failed: ${taxRateError.message}`);

        const defaultGstRateBps = taxRateBps(((taxRateData || []) as GstTaxRateRow[])[0]?.rate) || 0;
        const lines: GstInvoiceLineInput[] = items.map((item) => {
            const snapshot = toRecord(item.product_snapshot);
            const description = textValue(item.title) || textValue(item.name) || textValue(snapshot.name) || 'Order item';
            return {
                id: item.id,
                product_id: item.product_id || null,
                variant_id: item.variant_id || null,
                description,
                sku: textValue(item.sku) || textValue(snapshot.sku),
                hsn_code: textValue(item.hsn_code) || textValue(snapshot.hsn_code) || textValue(snapshot.hs_code),
                quantity: Math.max(1, Math.trunc(numberValue(item.quantity) || 1)),
                unit_amount_minor: majorToMinor(item.unit_price ?? item.price),
                discount_amount_minor: 0,
                gst_rate_bps: taxRateBps(item.gst_rate) || defaultGstRateBps,
                tax_inclusive: false,
            };
        });

        const invoicePrefix = textValue(site.invoice_prefix) || 'LBY';
        const invoice = generateGstInvoice({
            order_id: order.id,
            order_number: order.order_number,
            invoice_number: textValue(order.gst_invoice_number) || `${invoicePrefix}-${order.order_number}`,
            invoice_date: new Date().toISOString(),
            currency: (order.currency || 'INR').toUpperCase() === 'INR' ? 'INR' : order.currency || 'INR',
            supplier: {
                name: textValue(site.name) || textValue(site.store_name) || 'LetBuyy merchant',
                gstin: textValue(site.gstin),
                state_code: supplierStateCode,
            },
            recipient: {
                name: textValue(order.customer_name) || textValue(order.customer_email) || 'Customer',
                gstin: recipientGstin,
                state: textValue(shippingAddress.state),
                state_code: recipientStateCode,
                address: shippingAddress,
            },
            place_of_supply_state_code: recipientStateCode,
            marketplace_tcs_bps: 0,
            lines,
        });

        // T13/W4: `tax` and `place_of_supply_state` are intentionally NOT written here —
        // create_checkout_order (migration 213) already sets both authoritatively at order
        // creation, from the same post-discount/HSN-aware computation the customer was
        // actually charged from. This function's own line-building still uses
        // discount_amount_minor: 0 and no HSN precedence (a filed, unfixed gap — see the T13
        // CAP registry entry for GST invoice generation), so its recomputed tax figure can
        // legitimately differ from the real charged amount; overwriting the authoritative
        // value with it would silently corrupt orders.tax.
        const { error: updateError } = await this.db
            .from('orders')
            .update({
                gst_invoice_number: invoice.invoice_number,
                gst_invoice: invoice,
                customer_gstin: invoice.recipient.gstin,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .eq('store_id', siteId);

        if (updateError) throw new Error(`GST invoice persistence failed: ${updateError.message}`);

        for (const line of invoice.lines) {
            if (!line.id) continue;
            const { error: lineError } = await this.db
                .from('order_items')
                .update({
                    hsn_code: line.hsn_code,
                    gst_rate: line.gst_rate_bps / 100,
                    taxable_amount: line.taxable_amount_minor / 100,
                    cgst_amount: line.cgst_amount_minor / 100,
                    sgst_amount: line.sgst_amount_minor / 100,
                    igst_amount: line.igst_amount_minor / 100,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', line.id)
                .eq('order_id', orderId);

            if (lineError) throw new Error(`GST order item persistence failed: ${lineError.message}`);
        }

        return invoice;
    }

    private async assertOrderQuota(siteId: string): Promise<void> {
        const entitlements = await new SaasExecutionAdapter(this.db).resolveEntitlements(siteId);
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
