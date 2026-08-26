import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import {
    StorefrontCreateOrderSchema,
    StorefrontRazorpayOrderSchema,
    StorefrontRazorpayVerifySchema,
} from '../../schemas/order.schema';
import { OrderExecutionAdapter } from '../../execution/order-execution.adapter';
import { PaymentExecutionAdapter } from '../../execution/payment-execution.adapter';
import { IdempotencyExecutionAdapter } from '../../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { createPublicStorefrontTenantContext } from '../../lib/tenant-context';
import { createRazorpayPaymentProvider } from '@letbuyy/infrastructure/razorpay-adapter';
import { assertProviderPaymentNotReplayed } from '../../lib/payment-route-support';
import type { CreateCheckoutOrderCommand } from '@letbuyy/checkout-core';
import {
    calculateGstLine,
    normalizeIndianStateCode,
    extractGstStateCode,
} from '@letbuyy/checkout-core';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import { resolveShippingRate } from '../../lib/shipping-rate-resolver';

type AppContext = Context<{ Bindings: Env }>;
type StorefrontJsonValue = null | boolean | number | string | StorefrontJsonValue[] | { [key: string]: StorefrontJsonValue };

type StorefrontCreateOrderBody = {
    customer: {
        name: string;
        email: string;
        phone?: string;
        gstin?: string;
        address: {
            address: string;
            city: string;
            state: string;
            stateCode?: string;
            pincode: string;
        };
    };
    items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
    }>;
    paymentMethod: 'razorpay' | 'cod';
    deliveryOption: 'standard' | 'express';
    notes?: string;
    couponCode?: string;
    giftCardCode?: string;
    idempotencyKey: string;
    /** V1 shipping: optional server-side rate ID; back-compat when absent. */
    shippingRateId?: string | null;
};

type OrderRpcResult = {
    id?: string;
    order_number?: string;
    status?: string;
    total?: number | string;
    gst_invoice_number?: string | null;
    gst_invoice?: StorefrontJsonValue | null;
    place_of_supply_state?: string | null;
};

type StorefrontPaidOrderSnapshot = {
    id?: string;
    store_id?: string;
    site_id?: string;
    order_number?: string;
    customer_id?: string;
    total?: number | string;
    currency?: string | null;
};

type StorefrontRazorpayOrderBody = {
    orderId: string;
    idempotencyKey: string;
    amount?: number;
    amountMinorUnits?: number;
};

type StorefrontRazorpayVerifyBody = {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    idempotencyKey: string;
};

function isCheckoutPostCommitDeferralEnabled(env: Pick<Env, 'CHECKOUT_POSTCOMMIT_DEFERRAL'>): boolean {
    return (env.CHECKOUT_POSTCOMMIT_DEFERRAL || 'on').trim().toLowerCase() !== 'off';
}

function requestedAmountMinorUnits(input: { amount?: number; amountMinorUnits?: number }): number | null {
    if (typeof input.amountMinorUnits === 'number') return input.amountMinorUnits;
    if (typeof input.amount === 'number') return Math.round(input.amount * 100);
    return null;
}

function orderAmountMinorUnits(order: { total: number | string; currency?: string | null }): {
    amountMinor: number;
    currency: 'INR';
} | null {
    const currency = (order.currency || 'INR').toUpperCase();
    if (currency !== 'INR') {
        return null;
    }

    return {
        amountMinor: Math.round(Number(order.total) * 100),
        currency: 'INR',
    };
}

function orderEventTotalPayload(totalValue: unknown): { amount_minor: number; currency: 'INR' } | undefined {
    const total = typeof totalValue === 'number' || typeof totalValue === 'string' ? Number(totalValue) : Number.NaN;
    if (!Number.isFinite(total) || total < 0) return undefined;
    return { amount_minor: Math.round(total * 100), currency: 'INR' };
}

async function emitStorefrontOrderCreatedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId: string;
        order: OrderRpcResult;
        requestId: string;
    },
): Promise<void> {
    if (!input.order.id) return;

    const total = orderEventTotalPayload(input.order.total);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.storeId,
        aggregateType: 'order',
        aggregateId: input.order.id,
        eventType: 'order.created',
        payload: {
            site_id: input.storeId,
            order_id: input.order.id,
            order_number: input.order.order_number || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `order.created:${input.storeId}:${input.order.id}:${input.requestId}`,
        requestId: input.requestId,
        actorId: null,
    });
}

export type StorefrontCheckoutPaymentDependencies = {
    loadPublishedStore: (c: AppContext, subdomain: string) => Promise<PublishedStoreRecord | null>;
    getRequestId: (c: AppContext) => string;
    emitStorefrontOrderPaidEvent: (
        db: ReturnType<typeof getSupabaseAdmin>,
        input: {
            env?: Env;
            storeId?: string | null;
            orderId: string;
            order: StorefrontPaidOrderSnapshot;
            fallbackOrder?: StorefrontPaidOrderSnapshot;
            requestId: string;
            idempotencyKey: string;
        },
    ) => Promise<void>;
};

export function registerStorefrontCheckoutPaymentRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontCheckoutPaymentDependencies,
): void {
    const { loadPublishedStore, getRequestId, emitStorefrontOrderPaidEvent } = dependencies;

    router.post('/:subdomain/orders', validate('json', StorefrontCreateOrderSchema), async (c) => {
        const db = getSupabaseAdmin(c);
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontCreateOrderBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        const service = new OrderExecutionAdapter(db);
        const tenant = await createPublicStorefrontTenantContext(c, store.id);
        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: 'storefront.checkout.order.create',
            requestBody: { ...body, resolvedStoreId: store.id },
            requestId: tenant.requestId,
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const shippingAddress = {
                name: body.customer.name,
                line1: body.customer.address.address,
                city: body.customer.address.city,
                state: body.customer.address.state,
                state_code: body.customer.address.stateCode,
                zip: body.customer.address.pincode,
                country: 'IN',
                phone: body.customer.phone,
                gstin: body.customer.gstin,
            };

            // V1 server-side shipping rate resolution — never trust client price.
            const resolvedRate = await resolveShippingRate(db, store.id, body.shippingRateId ?? null);

            // V1 server-side GST computation.
            // Source: tax_registrations (supplier GSTIN/state_code) + tax_rates.rate (site default).
            // If the store has no tax registration or no active tax rate, tax = 0 (existing behavior).
            let computedTaxAmount: number | null = null;
            try {
                const { data: taxRegData } = await db
                    .from('tax_registrations')
                    .select('gstin, state_code')
                    .eq('site_id', store.id)
                    .is('deleted_at', null)
                    .order('effective_from', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const { data: taxRateData } = await db
                    .from('tax_rates')
                    .select('rate')
                    .eq('store_id', store.id)
                    .eq('is_active', true)
                    .eq('is_shipping', false)
                    .is('deleted_at', null)
                    .order('priority', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const supplierStateCode = taxRegData
                    ? normalizeIndianStateCode((taxRegData as { gstin?: string | null; state_code?: string | null }).state_code ?? null)
                        || extractGstStateCode((taxRegData as { gstin?: string | null }).gstin ?? null)
                    : null;
                const recipientStateCode = normalizeIndianStateCode(
                    body.customer.address.stateCode ?? null
                );
                const defaultRateBps = taxRateData
                    ? (() => {
                        const r = Number((taxRateData as { rate?: number | string | null }).rate ?? 0);
                        return Number.isFinite(r) ? Math.round(r <= 1 ? r * 10_000 : r * 100) : 0;
                    })()
                    : 0;

                if (supplierStateCode && recipientStateCode && defaultRateBps > 0) {
                    const supplyType = supplierStateCode === recipientStateCode ? 'intra_state' : 'inter_state';
                    let taxMinor = 0;
                    for (const item of body.items) {
                        const { data: productData } = await db
                            .from('products')
                            .select('price')
                            .eq('id', item.productId)
                            .eq('store_id', store.id)
                            .is('deleted_at', null)
                            .maybeSingle();

                        const unitPrice = productData
                            ? Math.round(Number((productData as { price?: number | string | null }).price ?? 0) * 100)
                            : 0;

                        const gstLine = calculateGstLine(
                            {
                                id: item.productId,
                                description: 'Order item',
                                quantity: item.quantity,
                                unit_amount_minor: unitPrice,
                                discount_amount_minor: 0,
                                gst_rate_bps: defaultRateBps,
                                tax_inclusive: false,
                            },
                            supplyType,
                        );
                        taxMinor += gstLine.tax_amount_minor;
                    }
                    computedTaxAmount = taxMinor / 100;
                }
            } catch {
                // GST computation is best-effort; fall through to 0 if it fails.
                computedTaxAmount = null;
            }

            const orderCommand: CreateCheckoutOrderCommand & {
                shipping_rate_id?: string | null;
                tax_amount?: number | null;
            } = {
                customer_name: body.customer.name,
                customer_email: body.customer.email,
                customer_phone: body.customer.phone,
                shipping_address: shippingAddress,
                customer_gstin: body.customer.gstin,
                items: body.items.map((item) => ({
                    product_id: item.productId,
                    variant_id: item.variantId || null,
                    quantity: item.quantity,
                })),
                payment_method: body.paymentMethod,
                shipping_method: body.deliveryOption,
                notes: body.notes,
                coupon_code: body.couponCode,
                gift_card_code: body.giftCardCode,
                idempotency_key: body.idempotencyKey,
                shipping_rate_id: resolvedRate ? resolvedRate.id : (body.shippingRateId ?? null),
                tax_amount: computedTaxAmount,
            };
            const deferPostCommit = isCheckoutPostCommitDeferralEnabled(c.env);
            const order = await service.createOrder(orderCommand, tenant, { deferPostCommit }) as OrderRpcResult;
            if (deferPostCommit) {
                c.executionCtx.waitUntil(
                    service.completeOrderPostCommitWork(orderCommand, tenant, order).catch((error) => {
                        console.error(JSON.stringify({
                            level: 'error',
                            event: 'storefront.checkout.post_commit_failed',
                            site_id: store.id,
                            order_id: order.id || null,
                            request_id: tenant.requestId,
                            error: error instanceof Error ? error.message : 'Unknown checkout post-commit failure',
                        }));
                    }),
                );
            }

            await emitStorefrontOrderCreatedEvent(db, {
                storeId: store.id,
                order,
                requestId: tenant.requestId,
            });

            const responseBody = success({
                order: {
                    id: order.id || '',
                    orderNumber: order.order_number || '',
                    status: order.status || 'pending',
                    total: Number(order.total || 0),
                    gstInvoiceNumber: order.gst_invoice_number || null,
                    gst_invoice_number: order.gst_invoice_number || null,
                    gstInvoice: order.gst_invoice || null,
                    gst_invoice: order.gst_invoice || null,
                    placeOfSupplyState: order.place_of_supply_state || null,
                    place_of_supply_state: order.place_of_supply_state || null,
                },
                extensionFunctions: [],
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 201,
                resourceType: 'order',
                resourceId: order.id,
            });

            return c.json(responseBody, 201);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    });

    // POST /storefront/:subdomain/payments/razorpay/order — Public Razorpay order creation.
    router.post(
        '/:subdomain/payments/razorpay/order',
        validate('json', StorefrontRazorpayOrderSchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontRazorpayOrderBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                    503
                );
            }

            const db = getSupabaseAdmin(c);
            const paymentService = new PaymentExecutionAdapter(db);
            const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
            const amount = orderAmountMinorUnits(order);
            if (!amount) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                    400
                );
            }

            const amountMinorUnits = amount.amountMinor;
            const requestedMinorUnits = requestedAmountMinorUnits(body);
            if (requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits) {
                return c.json(
                    { success: false, error: { code: 'AMOUNT_MISMATCH', message: 'Order amount changed. Please refresh checkout and try again.' } },
                    400
                );
            }

            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({
                siteId: store.id,
                key: body.idempotencyKey,
                scope: `storefront.payment.razorpay.order:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            try {
                const provider = createRazorpayPaymentProvider({
                    keyId: c.env.RAZORPAY_KEY_ID,
                    keySecret: c.env.RAZORPAY_KEY_SECRET,
                });
                const intent = await provider.createIntent({
                    storeId: store.id,
                    orderId: body.orderId,
                    amount,
                    idempotencyKey: body.idempotencyKey,
                    receipt: body.orderId,
                    metadata: {
                        source: 'storefront',
                    },
                });
                const providerOrderId = intent.references.providerOrderId;

                if (!providerOrderId) {
                    await idempotency.fail(claim.id);
                    return c.json(
                        {
                            success: false,
                            error: {
                                code: 'PAYMENT_PROVIDER_ERROR',
                                message: 'Failed to create Razorpay order',
                            },
                        },
                        502
                    );
                }

                await paymentService.attachPaymentReference({
                    orderId: body.orderId,
                    provider: 'razorpay',
                    providerOrderId,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });

                const responseBody = success({
                    keyId: c.env.RAZORPAY_KEY_ID,
                    key_id: c.env.RAZORPAY_KEY_ID,
                    razorpayOrderId: providerOrderId,
                    razorpay_order_id: providerOrderId,
                    amount: intent.amount.amountMinor,
                    currency: intent.amount.currency,
                });

                await idempotency.complete({
                    id: claim.id,
                    responseBody,
                    statusCode: 200,
                    resourceType: 'order',
                    resourceId: body.orderId,
                });

                return c.json(responseBody);
            } catch (error) {
                await idempotency.fail(claim.id);
                throw error;
            }
        }
    );

    // POST /storefront/:subdomain/payments/razorpay/verify — Public Razorpay signature verification.
    router.post(
        '/:subdomain/payments/razorpay/verify',
        validate('json', StorefrontRazorpayVerifySchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontRazorpayVerifyBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            if (!c.env.RAZORPAY_KEY_SECRET) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                    503
                );
            }

            const db = getSupabaseAdmin(c);
            const paymentService = new PaymentExecutionAdapter(db);
            const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
            const amount = orderAmountMinorUnits(order);
            if (!amount) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                    400
                );
            }
            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({
                siteId: store.id,
                key: body.idempotencyKey,
                scope: `storefront.payment.razorpay.verify:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            // SECURITY: fail closed — the order MUST have been bound to a server-created
            // Razorpay order (via .../razorpay/order → attachPaymentReference) first. A null
            // payment_id means the signature is being replayed from a different order.
            if (!order.payment_id || order.payment_id !== body.razorpay_order_id) {
                await idempotency.fail(claim.id);
                return c.json(
                    { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'Razorpay order does not match this checkout order' } },
                    409
                );
            }

            // SECURITY: reject cross-order payment replay — provider payment IDs are globally
            // unique; if this razorpay_payment_id is already recorded for a different order,
            // the caller is replaying a prior capture.
            await assertProviderPaymentNotReplayed(c, {
                provider: 'razorpay',
                providerPaymentId: body.razorpay_payment_id,
                providerOrderId: body.razorpay_order_id,
                orderId: body.orderId,
            });

            const provider = createRazorpayPaymentProvider({
                keyId: c.env.RAZORPAY_KEY_ID || 'storefront',
                keySecret: c.env.RAZORPAY_KEY_SECRET,
            });
            const verification = await provider.verify({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                providerOrderId: body.razorpay_order_id,
                providerPaymentId: body.razorpay_payment_id,
                signature: body.razorpay_signature,
            });

            if (!verification.verified) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: verification.failureCode || 'PAYMENT_SIGNATURE_INVALID',
                            message: verification.failureMessage || 'Invalid payment signature',
                        },
                    },
                    400
                );
            }

            try {
                const confirmedOrder = await paymentService.confirmPayment({
                    orderId: body.orderId,
                    provider: 'razorpay',
                    providerPaymentId: body.razorpay_payment_id,
                    providerOrderId: body.razorpay_order_id,
                    providerEventId: `razorpay:checkout:${body.razorpay_payment_id}`,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });
                await emitStorefrontOrderPaidEvent(db, {
                    storeId: store.id,
                    orderId: body.orderId,
                    order: confirmedOrder as StorefrontPaidOrderSnapshot,
                    fallbackOrder: order,
                    env: c.env,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });

                const responseBody = success({ verified: true, order: confirmedOrder });
                await idempotency.complete({
                    id: claim.id,
                    responseBody,
                    statusCode: 200,
                    resourceType: 'order',
                    resourceId: body.orderId,
                });

                return c.json(responseBody);
            } catch (error) {
                await idempotency.fail(claim.id);
                throw error;
            }
        }
    );

}
