import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import {
    StorefrontCreateOrderSchema,
    StorefrontCashfreeOrderSchema,
    StorefrontCashfreeVerifySchema,
    StorefrontPayPalCaptureSchema,
    StorefrontPayPalOrderSchema,
    StorefrontRazorpayOrderSchema,
    StorefrontRazorpayVerifySchema,
    StorefrontStripeCheckoutSchema,
} from '../../schemas/order.schema';
import { OrderExecutionAdapter } from '../../execution/order-execution.adapter';
import { PaymentExecutionAdapter } from '../../execution/payment-execution.adapter';
import { IdempotencyExecutionAdapter } from '../../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { evaluateCheckoutAppFunctions } from '../../extensions/app-functions-runtime';
import { createPublicStorefrontTenantContext } from '../../lib/tenant-context';
import { isGatewayFeatureEnabled } from '../../middleware/featureFlags';
import { createPayPalPaymentProvider } from '@letbuyy/infrastructure/paypal-adapter';
import { createCashfreePaymentProvider } from '@letbuyy/infrastructure/cashfree-adapter';
import { createRazorpayPaymentProvider } from '@letbuyy/infrastructure/razorpay-adapter';
import { createStripePaymentProvider } from '@letbuyy/infrastructure/stripe-adapter';
import type { CreateCheckoutOrderCommand } from '@letbuyy/checkout-core';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';

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
    paymentMethod: 'razorpay' | 'stripe' | 'paypal' | 'cashfree' | 'cod';
    deliveryOption: 'standard' | 'express';
    notes?: string;
    couponCode?: string;
    giftCardCode?: string;
    idempotencyKey: string;
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

type StorefrontStripeCheckoutBody = {
    orderId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    idempotencyKey: string;
};

type StorefrontPayPalOrderBody = {
    orderId: string;
    returnUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
};

type StorefrontPayPalCaptureBody = {
    orderId: string;
    paypalOrderId: string;
    idempotencyKey: string;
};

type StorefrontCashfreeOrderBody = {
    orderId: string;
    returnUrl: string;
    notifyUrl?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    paymentMethods?: string;
    idempotencyKey: string;
    amount?: number;
    amountMinorUnits?: number;
};

type StorefrontCashfreeVerifyBody = {
    orderId: string;
    cashfree_order_id: string;
    cf_payment_id?: string;
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

function getPayPalCredentials(c: AppContext) {
    if (!c.env.PAYPAL_CLIENT_ID || !c.env.PAYPAL_CLIENT_SECRET) {
        return null;
    }

    return {
        clientId: c.env.PAYPAL_CLIENT_ID,
        clientSecret: c.env.PAYPAL_CLIENT_SECRET,
        mode: c.env.PAYPAL_MODE === 'live' ? 'live' as const : 'sandbox' as const,
        webhookId: c.env.PAYPAL_WEBHOOK_ID,
    };
}

function getCashfreeCredentials(c: AppContext) {
    if (!c.env.CASHFREE_APP_ID || !c.env.CASHFREE_SECRET_KEY) {
        return null;
    }

    return {
        appId: c.env.CASHFREE_APP_ID,
        secretKey: c.env.CASHFREE_SECRET_KEY,
        environment: c.env.CASHFREE_ENVIRONMENT === 'production' ? 'production' as const : 'sandbox' as const,
        apiVersion: c.env.CASHFREE_API_VERSION || '2025-01-01',
    };
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
            const functionEvaluation = isGatewayFeatureEnabled(c.env, 'FEATURE_EXTENSIONS')
                ? await evaluateCheckoutAppFunctions(c, {
                    siteId: store.id,
                    requestId: tenant.requestId,
                    couponCode: body.couponCode,
                    cart: {
                        lines: body.items.map((item) => ({
                            product_id: item.productId,
                            variant_id: item.variantId || null,
                            quantity: item.quantity,
                        })),
                        coupon_code: body.couponCode || null,
                        gift_card_code: body.giftCardCode || null,
                    },
                    checkout: {
                        payment_method: body.paymentMethod,
                        shipping_method: body.deliveryOption,
                        customer: {
                            name: body.customer.name,
                            email: body.customer.email,
                            phone: body.customer.phone,
                            gstin: body.customer.gstin,
                        },
                        shipping_address: shippingAddress,
                    },
                })
                : null;
            const checkoutDecision = functionEvaluation?.decision || {
                validationErrors: [],
                paymentMethod: body.paymentMethod,
                shippingMethod: body.deliveryOption,
                couponCode: body.couponCode,
            };

            if (checkoutDecision.validationErrors.length > 0) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'CHECKOUT_FUNCTION_VALIDATION',
                            message: checkoutDecision.validationErrors[0]?.message || 'Checkout validation failed',
                            details: checkoutDecision.validationErrors,
                        },
                    },
                    400
                );
            }

            const orderCommand: CreateCheckoutOrderCommand = {
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
                payment_method: checkoutDecision.paymentMethod,
                shipping_method: checkoutDecision.shippingMethod,
                notes: body.notes,
                coupon_code: checkoutDecision.couponCode,
                gift_card_code: body.giftCardCode,
                idempotency_key: body.idempotencyKey,
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
                extensionFunctions: (functionEvaluation?.executions || []).map((execution) => ({
                    registrationId: execution.registrationId,
                    appId: execution.appId,
                    hook: execution.hook,
                    handle: execution.handle,
                    status: execution.status,
                    durationMs: execution.durationMs,
                    operations: execution.operations,
                    errorCode: execution.errorCode || null,
                })),
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

    // POST /storefront/:subdomain/payments/cashfree/order — Public Cashfree order creation.
    router.post(
        '/:subdomain/payments/cashfree/order',
        validate('json', StorefrontCashfreeOrderSchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontCashfreeOrderBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            const credentials = getCashfreeCredentials(c);
            if (!credentials) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Cashfree is not configured' } },
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

            const requestedMinorUnits = requestedAmountMinorUnits(body);
            if (requestedMinorUnits !== null && requestedMinorUnits !== amount.amountMinor) {
                return c.json(
                    { success: false, error: { code: 'AMOUNT_MISMATCH', message: 'Order amount changed. Please refresh checkout and try again.' } },
                    400
                );
            }

            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({
                siteId: store.id,
                key: body.idempotencyKey,
                scope: `storefront.payment.cashfree.order:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            try {
                const provider = createCashfreePaymentProvider(credentials);
                const intent = await provider.createIntent({
                    storeId: store.id,
                    orderId: body.orderId,
                    amount,
                    idempotencyKey: body.idempotencyKey,
                    description: `LetBuyy order ${body.orderId}`,
                    customer: {
                        email: body.customerEmail,
                        phone: body.customerPhone,
                        name: body.customerName,
                    },
                    metadata: {
                        return_url: body.returnUrl,
                        notify_url: body.notifyUrl,
                        payment_methods: body.paymentMethods,
                        request_id: getRequestId(c),
                        source: 'storefront',
                    },
                });
                const providerOrderId = intent.references.providerOrderId;
                if (!providerOrderId || !intent.clientSecret) {
                    await idempotency.fail(claim.id);
                    return c.json(
                        { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create Cashfree order' } },
                        502
                    );
                }

                await paymentService.attachPaymentReference({
                    orderId: body.orderId,
                    provider: 'cashfree',
                    providerOrderId,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });

                const responseBody = success({
                    cashfreeOrderId: providerOrderId,
                    cashfree_order_id: providerOrderId,
                    paymentSessionId: intent.clientSecret,
                    payment_session_id: intent.clientSecret,
                    amount: intent.amount.amountMinor,
                    currency: intent.amount.currency,
                    environment: credentials.environment,
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

    // POST /storefront/:subdomain/payments/cashfree/verify — Public Cashfree payment verification.
    router.post(
        '/:subdomain/payments/cashfree/verify',
        validate('json', StorefrontCashfreeVerifySchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontCashfreeVerifyBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            const credentials = getCashfreeCredentials(c);
            if (!credentials) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Cashfree is not configured' } },
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

            if (!order.payment_id || (order.payment_id !== body.cashfree_order_id && order.payment_id !== body.cf_payment_id)) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'Cashfree order does not match this checkout order' } },
                    409
                );
            }

            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({
                siteId: store.id,
                key: body.idempotencyKey,
                scope: `storefront.payment.cashfree.verify:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            const provider = createCashfreePaymentProvider(credentials);
            const verification = await provider.verify({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                providerOrderId: body.cashfree_order_id,
                providerPaymentId: body.cf_payment_id,
                metadata: {
                    request_id: getRequestId(c),
                    source: 'storefront',
                },
            });

            if (!verification.verified || !verification.references.providerPaymentId) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: verification.failureCode || 'CASHFREE_PAYMENT_NOT_PAID',
                            message: verification.failureMessage || 'Cashfree payment is not paid',
                        },
                    },
                    400
                );
            }

            try {
                const confirmedOrder = await paymentService.confirmPayment({
                    orderId: body.orderId,
                    provider: 'cashfree',
                    providerPaymentId: verification.references.providerPaymentId,
                    providerOrderId: verification.references.providerOrderId || body.cashfree_order_id,
                    providerEventId: `cashfree:checkout:${verification.references.providerPaymentId}`,
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

                const responseBody = success({
                    verified: true,
                    paymentId: verification.references.providerPaymentId,
                    payment_id: verification.references.providerPaymentId,
                    order: confirmedOrder,
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

    // POST /storefront/:subdomain/payments/stripe/checkout — Public Stripe checkout session creation.
    router.post(
        '/:subdomain/payments/stripe/checkout',
        validate('json', StorefrontStripeCheckoutSchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontStripeCheckoutBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            if (!c.env.STRIPE_SECRET_KEY) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Stripe is not configured' } },
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
                scope: `storefront.payment.stripe.checkout:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            try {
                const provider = createStripePaymentProvider({ secretKey: c.env.STRIPE_SECRET_KEY });
                const intent = await provider.createIntent({
                    storeId: store.id,
                    orderId: body.orderId,
                    amount,
                    idempotencyKey: body.idempotencyKey,
                    description: `LetBuyy order ${body.orderId}`,
                    customer: {
                        email: body.customerEmail,
                    },
                    metadata: {
                        success_url: body.successUrl,
                        cancel_url: body.cancelUrl,
                        name: `LetBuyy order ${body.orderId}`,
                        source: 'storefront',
                    },
                });
                const providerOrderId = intent.references.providerOrderId;
                if (!providerOrderId || !intent.redirectUrl) {
                    await idempotency.fail(claim.id);
                    return c.json(
                        { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create Stripe checkout session' } },
                        502
                    );
                }

                await paymentService.attachPaymentReference({
                    orderId: body.orderId,
                    provider: 'stripe',
                    providerOrderId,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });

                const responseBody = success({
                    sessionId: providerOrderId,
                    session_id: providerOrderId,
                    url: intent.redirectUrl,
                    session_url: intent.redirectUrl,
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

    // POST /storefront/:subdomain/payments/paypal/order — Public PayPal order creation.
    router.post(
        '/:subdomain/payments/paypal/order',
        validate('json', StorefrontPayPalOrderSchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontPayPalOrderBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            const credentials = getPayPalCredentials(c);
            if (!credentials) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'PayPal is not configured' } },
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
                scope: `storefront.payment.paypal.order:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            try {
                const provider = createPayPalPaymentProvider(credentials);
                const intent = await provider.createIntent({
                    storeId: store.id,
                    orderId: body.orderId,
                    amount,
                    idempotencyKey: body.idempotencyKey,
                    description: `LetBuyy order ${body.orderId}`,
                    metadata: {
                        return_url: body.returnUrl,
                        cancel_url: body.cancelUrl,
                        source: 'storefront',
                    },
                });
                const providerOrderId = intent.references.providerOrderId;
                if (!providerOrderId || !intent.redirectUrl) {
                    await idempotency.fail(claim.id);
                    return c.json(
                        { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create PayPal order' } },
                        502
                    );
                }

                await paymentService.attachPaymentReference({
                    orderId: body.orderId,
                    provider: 'paypal',
                    providerOrderId,
                    requestId: getRequestId(c),
                    idempotencyKey: body.idempotencyKey,
                });

                const responseBody = success({
                    paypalOrderId: providerOrderId,
                    paypal_order_id: providerOrderId,
                    approvalUrl: intent.redirectUrl,
                    approval_url: intent.redirectUrl,
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

    // POST /storefront/:subdomain/payments/paypal/capture — Public PayPal capture confirmation.
    router.post(
        '/:subdomain/payments/paypal/capture',
        validate('json', StorefrontPayPalCaptureSchema),
        async (c) => {
            const subdomain = c.req.param('subdomain');
            const body = c.get('validatedBody') as StorefrontPayPalCaptureBody;
            const store = await loadPublishedStore(c, subdomain);

            if (!store) {
                return c.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                    404
                );
            }

            const credentials = getPayPalCredentials(c);
            if (!credentials) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'PayPal is not configured' } },
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

            if (!order.payment_id || order.payment_id !== body.paypalOrderId) {
                return c.json(
                    { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'PayPal order does not match this checkout order' } },
                    409
                );
            }

            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({
                siteId: store.id,
                key: body.idempotencyKey,
                scope: `storefront.payment.paypal.capture:${body.orderId}`,
                requestBody: body,
                requestId: getRequestId(c),
            });

            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }

            try {
                const provider = createPayPalPaymentProvider(credentials);
                const capture = await provider.capture({
                    storeId: store.id,
                    orderId: body.orderId,
                    amount,
                    idempotencyKey: body.idempotencyKey,
                    providerOrderId: body.paypalOrderId,
                });

                if (capture.status !== 'paid' || !capture.references.providerPaymentId) {
                    await idempotency.fail(claim.id);
                    return c.json(
                        {
                            success: false,
                            error: {
                                code: capture.failureCode || 'PAYPAL_CAPTURE_FAILED',
                                message: capture.failureMessage || 'PayPal capture failed',
                            },
                        },
                        400
                    );
                }

                const confirmedOrder = await paymentService.confirmPayment({
                    orderId: body.orderId,
                    provider: 'paypal',
                    providerPaymentId: capture.references.providerPaymentId,
                    providerOrderId: body.paypalOrderId,
                    providerEventId: `paypal:checkout:${capture.references.providerPaymentId}`,
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

                const responseBody = success({
                    captured: true,
                    captureId: capture.references.providerPaymentId,
                    capture_id: capture.references.providerPaymentId,
                    status: capture.status,
                    order: confirmedOrder,
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

}
