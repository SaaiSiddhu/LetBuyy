import { authorizeFreshStorefrontPurchase } from '../../lib/storefront-visitor-access';
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
import { PaymentExecutionAdapter, readCaptureResult } from '../../execution/payment-execution.adapter';
import { FIXED_PUBLIC_ERROR_MESSAGES } from '../../lib/public-errors';
import { IdempotencyExecutionAdapter } from '../../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { createPublicStorefrontTenantContext } from '../../lib/tenant-context';
import { createRazorpayPaymentProvider } from '@letbuyy/infrastructure/razorpay-adapter';
import { assertProviderPaymentNotReplayed } from '../../lib/payment-route-support';
import type {
    CreateCheckoutOrderCommand,
    // The wire contracts these handlers receive. They are `z.infer` of the very schemas that parse
    // the request, so the type checker and the validator can no longer disagree. Three hand-written
    // copies of these shapes used to live in this file; one of them claimed a `shippingRateId` the
    // real schema did not declare, `z.object()` stripped the field silently, and a merchant's
    // configured shipping rate was unreachable while the build stayed green (CAP-C39/C42/C46).
    StorefrontCreateOrderInput,
    StorefrontRazorpayOrderInput,
    StorefrontRazorpayVerifyInput,
} from '@letbuyy/checkout-core';
import {
    calculateGstLine,
    normalizeIndianStateCode,
    extractGstStateCode,
} from '@letbuyy/checkout-core';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import { listStorefrontShippingRates, loadStorefrontSubtotalMinor } from '../../lib/storefront-shipping';
import { authenticateStorefrontBuyerSession, getStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';

type AppContext = Context<{ Bindings: Env }>;
type StorefrontJsonValue = null | boolean | number | string | StorefrontJsonValue[] | { [key: string]: StorefrontJsonValue };

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

    router.get('/:subdomain/shipping-rates', async (c) => {
        const pincode = c.req.query('pincode')?.trim() || '';
        const state = c.req.query('state')?.trim() || '';
        const stateCode = c.req.query('state_code')?.trim() || '';
        const subtotalMinor = Number(c.req.query('subtotal_minor'));
        if (!/^[1-9][0-9]{5}$/.test(pincode) || !state || state.length > 100
            || !Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A valid India delivery address and cart subtotal are required.' } }, 400);
        }
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        try {
            const rates = await listStorefrontShippingRates(getSupabaseAdmin(c), store.id, {
                country: 'IN', state, stateCode, pincode,
            }, subtotalMinor);
            return c.json(success({
                serviceability: {
                    serviceable: rates.length > 0,
                    source: 'seller_zone_configuration',
                    carrier_confirmed: false,
                },
                rates,
            }));
        } catch {
            return c.json({ success: false, error: { code: 'SHIPPING_CONFIGURATION_UNAVAILABLE', message: 'Delivery options could not be verified. Please retry.' } }, 503);
        }
    });

    router.post('/:subdomain/orders', validate('json', StorefrontCreateOrderSchema), async (c) => {
        const db = getSupabaseAdmin(c);
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontCreateOrderInput;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        await authorizeFreshStorefrontPurchase(c, store.id);

        // A supplied token is never downgraded to a guest checkout. Its site binding is checked
        // against the store resolved from the route, and the live account epoch is revalidated
        // before any idempotency replay or order write.
        const buyerToken = c.req.header(LETBUYY_STOREFRONT_SESSION_HEADER);
        if (buyerToken) {
            const rejected = await authenticateStorefrontBuyerSession(c, buyerToken, store.id);
            if (rejected) return rejected;
        }
        const buyerSession = getStorefrontBuyerSession(c);

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
        if (!body.shippingRateId || !Number.isSafeInteger(body.shippingAmountMinor) || body.shippingAmountMinor === null || body.shippingAmountMinor === undefined) {
            return c.json({ success: false, error: { code: 'CHECKOUT_SHIPPING_RATE_REQUIRED', message: 'Choose an available delivery option before placing the order.' } }, 409);
        }
        let resolvedRate: { id: string; amount: number; codAvailable: boolean };
        try {
            const subtotalMinor = await loadStorefrontSubtotalMinor(db, store.id, body.items);
            const options = await listStorefrontShippingRates(db, store.id, {
                country: 'IN',
                state: body.customer.address.state,
                stateCode: body.customer.address.stateCode,
                pincode: body.customer.address.pincode,
            }, subtotalMinor);
            const selected = options.find((option) => option.id === body.shippingRateId);
            if (!selected) {
                return c.json({ success: false, error: { code: 'CHECKOUT_SHIPPING_CHANGED', message: 'That delivery option is no longer available for this address. Refresh delivery options and try again.' } }, 409);
            }
            if (selected.amount_minor !== body.shippingAmountMinor) {
                return c.json({ success: false, error: { code: 'CHECKOUT_SHIPPING_CHANGED', message: 'The delivery price changed. Review the updated delivery option and try again.' } }, 409);
            }
            if (body.paymentMethod === 'cod' && !selected.cod_available) {
                return c.json({ success: false, error: { code: 'CHECKOUT_COD_UNAVAILABLE', message: 'Cash on delivery is not available for the selected delivery option.' } }, 409);
            }
            resolvedRate = { id: selected.id, amount: selected.amount_minor / 100, codAvailable: selected.cod_available };
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (message.includes('Checkout item is no longer available')) {
                return c.json({ success: false, error: { code: 'CHECKOUT_ITEM_UNAVAILABLE', message: 'An item changed before checkout. Refresh your cart and try again.' } }, 409);
            }
            return c.json({ success: false, error: { code: 'SHIPPING_CONFIGURATION_UNAVAILABLE', message: 'Delivery options could not be verified. Please retry.' } }, 503);
        }

        const service = new OrderExecutionAdapter(db);
        const tenant = await createPublicStorefrontTenantContext(c, store.id);
        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: 'storefront.checkout.order.create',
            requestBody: { ...body, resolvedStoreId: store.id, buyerAccountId: buyerSession?.buyerAccountId ?? null },
            requestId: tenant.requestId,
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            // T13/W0-W3 — server-side GST computation, recomputed entirely from DB rows this
            // request, never trusted from the client. Three legs, each read fresh:
            //   supplier state <- sites.gstin/gst_state_code (T13: was tax_registrations, a
            //     table with zero merchant-facing surface anywhere in the app; sites.gstin/
            //     gst_state_code already has a real, working merchant UI at
            //     settings/business/page.tsx and is already what generateAndPersistGstInvoice
            //     reads post-commit -- reading a DIFFERENT table here than the post-commit
            //     invoice step risked the two silently disagreeing the moment either table
            //     was ever populated; unifying on sites removes that risk entirely)
            //   recipient state <- body.customer.address.stateCode (T13/W1: now a real
            //     picker-sourced GST state code on the client, not a free-text name)
            //   rate <- tax_rates, HSN-specific (tax_rates.hsn_code) taking precedence over
            //     the store default (hsn_code IS NULL), per item
            // Taxable value is POST-DISCOUNT: the order-level coupon discount (evaluated via
            // the SAME evaluate_checkout_promotion RPC create_checkout_order will call moments
            // later -- read-only, no usage-count mutation, so calling it twice here is safe)
            // is apportioned across lines by each line's share of the pre-discount subtotal.
            // products.charge_tax = false is honoured (that line is skipped entirely).
            let computedTaxAmount: number | null = null;
            let placeOfSupplyStateCode: string | null = null;
            let computedTaxLines: Array<{ title: string; rate: number; amount: number; jurisdiction: Record<string, unknown> }> | null = null;
            try {
                const { data: siteData } = await db
                    .from('sites')
                    .select('gstin, gst_state_code')
                    .eq('id', store.id)
                    .maybeSingle();

                const supplierStateCode = siteData
                    ? normalizeIndianStateCode((siteData as { gst_state_code?: string | null }).gst_state_code ?? null)
                        || extractGstStateCode((siteData as { gstin?: string | null }).gstin ?? null)
                    : null;
                const recipientStateCode = normalizeIndianStateCode(body.customer.address.stateCode ?? null);
                placeOfSupplyStateCode = recipientStateCode;

                if (supplierStateCode && recipientStateCode) {
                    const supplyType = supplierStateCode === recipientStateCode ? 'intra_state' : 'inter_state';

                    const productIds = [...new Set(body.items.map((item) => item.productId))];
                    const variantIds = body.items.map((item) => item.variantId).filter((id): id is string => Boolean(id));

                    const { data: productsData } = await db
                        .from('products')
                        .select('id, price, hsn_code, charge_tax')
                        .in('id', productIds)
                        .eq('store_id', store.id)
                        .is('deleted_at', null);
                    const productById = new Map(
                        (productsData || []).map((p: { id: string }) => [p.id, p as { id: string; price?: number | string | null; hsn_code?: string | null; charge_tax?: boolean | null }]),
                    );

                    const variantById = new Map<string, { id: string; price?: number | string | null }>();
                    if (variantIds.length > 0) {
                        const { data: variantsData } = await db
                            .from('product_variants')
                            .select('id, price')
                            .in('id', variantIds);
                        for (const v of (variantsData || []) as Array<{ id: string; price?: number | string | null }>) {
                            variantById.set(v.id, v);
                        }
                    }

                    const { data: rateRows } = await db
                        .from('tax_rates')
                        .select('rate, hsn_code')
                        .eq('store_id', store.id)
                        .eq('is_active', true)
                        .eq('is_shipping', false)
                        .is('deleted_at', null)
                        .order('priority', { ascending: false });
                    const toBps = (r: unknown): number => {
                        const n = Number(r ?? 0);
                        return Number.isFinite(n) ? Math.round(n <= 1 ? n * 10_000 : n * 100) : 0;
                    };
                    const rateRowList = (rateRows || []) as Array<{ rate?: number | string | null; hsn_code?: string | null }>;
                    const defaultRateBps = toBps(rateRowList.find((r) => !r.hsn_code)?.rate);
                    const rateByHsn = new Map(
                        rateRowList.filter((r) => r.hsn_code).map((r) => [r.hsn_code as string, toBps(r.rate)]),
                    );

                    if (defaultRateBps > 0 || rateByHsn.size > 0) {
                        const lineInputs = body.items.map((item) => {
                            const product = productById.get(item.productId);
                            const variant = item.variantId ? variantById.get(item.variantId) : undefined;
                            const variantPrice = variant ? Number(variant.price ?? 0) : 0;
                            const unitPriceMajor = variantPrice > 0 ? variantPrice : Number(product?.price ?? 0);
                            const unitPriceMinor = Math.round(unitPriceMajor * 100);
                            return { item, product, lineAmountMinor: unitPriceMinor * item.quantity, unitPriceMinor };
                        });
                        const subtotalMinor = lineInputs.reduce((sum, l) => sum + l.lineAmountMinor, 0);

                        let discountMinor = 0;
                        if (body.couponCode) {
                            const { data: promo } = await db.rpc('evaluate_checkout_promotion', {
                                p_store_id: store.id,
                                p_code: body.couponCode,
                                p_subtotal: subtotalMinor / 100,
                                p_shipping_amount: resolvedRate ? resolvedRate.amount : 0,
                                p_customer_email: body.customer.email,
                            });
                            const discountMajor = promo && typeof promo === 'object' && 'discount' in (promo as Record<string, unknown>)
                                ? Number((promo as { discount?: number | string | null }).discount ?? 0)
                                : 0;
                            discountMinor = Number.isFinite(discountMajor) ? Math.round(discountMajor * 100) : 0;
                        }

                        let taxMinor = 0;
                        let cgstMinor = 0;
                        let sgstMinor = 0;
                        let igstMinor = 0;
                        for (const { item, product, lineAmountMinor, unitPriceMinor } of lineInputs) {
                            if (product?.charge_tax === false) continue;
                            const lineDiscountMinor = subtotalMinor > 0
                                ? Math.round((lineAmountMinor / subtotalMinor) * discountMinor)
                                : 0;
                            const hsn = product?.hsn_code ?? null;
                            const rateBps = (hsn && rateByHsn.has(hsn)) ? (rateByHsn.get(hsn) as number) : defaultRateBps;
                            if (rateBps <= 0) continue;

                            const gstLine = calculateGstLine(
                                {
                                    id: item.productId,
                                    description: 'Order item',
                                    quantity: item.quantity,
                                    unit_amount_minor: unitPriceMinor,
                                    discount_amount_minor: lineDiscountMinor,
                                    hsn_code: hsn ?? undefined,
                                    gst_rate_bps: rateBps,
                                    tax_inclusive: false,
                                },
                                supplyType,
                            );
                            taxMinor += gstLine.tax_amount_minor;
                            cgstMinor += gstLine.cgst_amount_minor;
                            sgstMinor += gstLine.sgst_amount_minor;
                            igstMinor += gstLine.igst_amount_minor;
                        }
                        computedTaxAmount = taxMinor / 100;

                        // Order-level CGST/SGST (intra-state) or IGST (inter-state) components,
                        // written into order_tax_lines by create_checkout_order (migration 213).
                        const halfRateBps = Math.round(defaultRateBps / 2);
                        computedTaxLines = supplyType === 'intra_state'
                            ? [
                                { title: 'CGST', rate: halfRateBps / 100, amount: cgstMinor / 100, jurisdiction: { supply_type: supplyType, supplier_state_code: supplierStateCode, recipient_state_code: recipientStateCode } },
                                { title: 'SGST', rate: halfRateBps / 100, amount: sgstMinor / 100, jurisdiction: { supply_type: supplyType, supplier_state_code: supplierStateCode, recipient_state_code: recipientStateCode } },
                            ]
                            : [
                                { title: 'IGST', rate: defaultRateBps / 100, amount: igstMinor / 100, jurisdiction: { supply_type: supplyType, supplier_state_code: supplierStateCode, recipient_state_code: recipientStateCode } },
                            ];
                    }
                }
            } catch (taxError) {
                // T13/W3 — fail OPEN (order still completes at tax=0), never SILENT. Blocking
                // every checkout on a tax-config error is its own outage; silently mischarging
                // GST is a compliance exposure but does not stop commerce. The previous
                // `catch { computedTaxAmount = null }` swallowed this with no signal at all —
                // logged loudly here so a misconfigured store's zero-tax orders are visible to
                // observability, not just to whoever eventually reconciles GST filings.
                console.error(JSON.stringify({
                    level: 'error',
                    event: 'gst_computation_failed',
                    store_id: store.id,
                    error: taxError instanceof Error ? taxError.message : String(taxError),
                }));
                computedTaxAmount = null;
                computedTaxLines = null;
                // placeOfSupplyStateCode is deliberately NOT reset — it is derived from the
                // client's address alone and should still be recorded on the order even when
                // tax itself could not be computed (a missing supplier registration or rate is
                // a tax-config gap, not a reason to lose the recipient's state on the order).
            }

            const orderCommand: CreateCheckoutOrderCommand & {
                shipping_rate_id?: string | null;
                expected_shipping_amount?: number | null;
                tax_amount?: number | null;
                place_of_supply_state?: string | null;
                tax_lines?: Array<{ title: string; rate: number; amount: number; jurisdiction?: Record<string, unknown> }> | null;
                buyer_account_id?: string | null;
                buyer_session_epoch?: number | null;
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
                expected_shipping_amount: resolvedRate.amount,
                tax_amount: computedTaxAmount,
                place_of_supply_state: placeOfSupplyStateCode,
                tax_lines: computedTaxLines,
                buyer_account_id: buyerSession?.buyerAccountId ?? null,
                buyer_session_epoch: buyerSession?.sessionEpoch ?? null,
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
            const body = c.get('validatedBody') as StorefrontRazorpayOrderInput;
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
            const body = c.get('validatedBody') as StorefrontRazorpayVerifyInput;
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
            // F-PAY4-1: a capture is reported here after the buyer has paid, so the order is loaded
            // without the payable-order refusals — a released, cancelled or already-paid order must still
            // reach confirm_order_payment_with_ledger, which records the money and decides its outcome.
            const order = await paymentService.loadStorefrontOrderForCapture(body.orderId, store.id);
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
            // F-PAY4-1: once THIS payment has confirmed the order, payment_id holds the payment id
            // (confirm_order_payment writes it there), so the webhook-first ordering — the webhook
            // confirms, then the buyer's callback arrives — is still bound. The RPC applies the same
            // predicate and returns 'duplicate' for it instead of an error after the buyer has paid.
            if (!order.payment_id || (order.payment_id !== body.razorpay_order_id && order.payment_id !== body.razorpay_payment_id)) {
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

                // F-PAY4-1: the provider has the buyer's money but the order could no longer be fulfilled
                // (its reservation expired, or it was cancelled). Migration 252 recorded the capture once,
                // cancelled the order and queued the refund owed; nothing here may announce it as paid.
                // The answer is stored against the idempotency key so a retried callback gets the same one.
                const capture = readCaptureResult(confirmedOrder);
                if (!capture.fulfillable) {
                    const unfulfillableBody = {
                        success: false,
                        error: {
                            code: 'PAYMENT_CAPTURED_ORDER_UNFULFILLABLE',
                            message: FIXED_PUBLIC_ERROR_MESSAGES.PAYMENT_CAPTURED_ORDER_UNFULFILLABLE,
                        },
                    };
                    await idempotency.complete({
                        id: claim.id,
                        responseBody: unfulfillableBody,
                        statusCode: 409,
                        resourceType: 'order',
                        resourceId: body.orderId,
                    });
                    return c.json(unfulfillableBody, 409);
                }

                // Keyed on the provider payment, not the request, so the verify callback and the webhook
                // announcing the same payment produce one order.paid event, not two.
                await emitStorefrontOrderPaidEvent(db, {
                    storeId: store.id,
                    orderId: body.orderId,
                    order: confirmedOrder as StorefrontPaidOrderSnapshot,
                    fallbackOrder: order,
                    env: c.env,
                    requestId: getRequestId(c),
                    idempotencyKey: `razorpay:${body.razorpay_payment_id}`,
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
