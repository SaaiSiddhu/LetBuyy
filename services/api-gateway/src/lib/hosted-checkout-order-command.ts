import type { CreateCheckoutOrderCommand } from '@letbuyy/checkout-core';
import { selectedHostedDiscountCodes, type HostedCheckoutSession } from './hosted-checkout-session';
import type { VerifiedHandoff } from '../routes/checkout';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };
type CheckoutSessionRow = HostedCheckoutSession;
export type HostedCheckoutPaymentProvider = 'razorpay' | 'cod';

export type CartRow = {
    id: string;
    store_id: string;
    session_id?: string | null;
    items?: unknown;
    coupon_code?: string | null;
    buyer_email?: string | null;
    channel?: string | null;
    sales_origin?: 'storefront' | 'marketplace' | null;
    status?: string | null;
    checkout_handoff?: { storefront_admission?: unknown; order_id?: string; checkout_origin?: string;
        buyer_binding?: { buyer_account_id?: string; session_epoch?: number; digest?: string } | null } | null;
};

export function cartLines(cart: CartRow): JsonRecord[] {
    return Array.isArray(cart.items)
        ? cart.items.filter((line): line is JsonRecord => Boolean(line) && typeof line === 'object' && !Array.isArray(line))
        : [];
}

export function signedCartSubtotalMinor(lines: JsonRecord[]): number | null {
    if (lines.length === 0) return null;
    let subtotalMinor = 0;
    for (const line of lines) {
        const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
        const lineTotal = typeof line.line_total === 'number' ? line.line_total : Number(line.line_total);
        const unitPrice = typeof line.unit_price === 'number' ? line.unit_price : Number(line.unit_price);
        const amount = Number.isFinite(lineTotal) ? lineTotal : quantity * unitPrice;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(amount) || amount < 0) return null;
        subtotalMinor += Math.round(amount * 100);
        if (!Number.isSafeInteger(subtotalMinor)) return null;
    }
    return subtotalMinor;
}

export function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeHostedCheckoutPaymentProvider(value: unknown): HostedCheckoutPaymentProvider | null {
    const provider = stringValue(value)?.toLowerCase();
    if (provider === 'razorpay' || provider === 'cod') {
        return provider;
    }
    return null;
}

export function checkoutPaymentProvider(session: CheckoutSessionRow): HostedCheckoutPaymentProvider | null {
    const intent = session.payment_intent;
    return normalizeHostedCheckoutPaymentProvider(intent?.provider)
        || normalizeHostedCheckoutPaymentProvider(session.payment_method)
        || null;
}

export function checkoutShippingMethod(session: CheckoutSessionRow): 'standard' | 'express' {
    const method = stringValue(session.shipping_method)
        || stringValue(session.delivery_quote?.shipping_method)
        || stringValue(session.delivery_quote?.method);
    return method === 'express' ? 'express' : 'standard';
}

export function checkoutOrderItems(cart: CartRow): CreateCheckoutOrderCommand['items'] {
    return cartLines(cart).map((line) => ({
        product_id: stringValue(line.product_id) || stringValue(line.productId) || '',
        variant_id: stringValue(line.variant_id) || stringValue(line.variantId) || null,
        ...(stringValue(line.marketplace_listing_id) ? { marketplace_listing_id: stringValue(line.marketplace_listing_id) } : {}),
        quantity: Number(line.quantity || 0),
        ...(typeof line.snapshot_fingerprint === 'string' ? { cart_fact_ref: {
            cart_id: String(cart.id), cart_token: String(cart.session_id), line_id: String(line.id),
            product_version: Number(line.product_version),
            configuration_fingerprint: typeof line.configuration_fingerprint === 'string' ? line.configuration_fingerprint : null,
            snapshot_fingerprint: line.snapshot_fingerprint,
        } } : {}),
    })).filter((line) => line.product_id && Number.isInteger(line.quantity) && line.quantity > 0);
}

export function buildHostedCheckoutOrderCommand(
    handoff: Pick<VerifiedHandoff, 'siteId' | 'cartId' | 'cart'>,
    session: CheckoutSessionRow,
    idempotencyKey: string,
): { ok: true; provider: HostedCheckoutPaymentProvider; command: CreateCheckoutOrderCommand & { shipping_rate_id?: string | null; expected_shipping_amount?: number | null; expected_quote_fingerprint?: string; buyer_account_id?: string; buyer_session_epoch?: number } } | { ok: false; code: string; message: string } {
    const provider = checkoutPaymentProvider(session);
    if (!provider) {
        return {
            ok: false,
            code: 'CHECKOUT_PAYMENT_METHOD_UNSUPPORTED',
            message: 'Checkout payment method is not supported for hosted confirmation.',
        };
    }

    const items = checkoutOrderItems(handoff.cart);
    if (items.length === 0) {
        return { ok: false, code: 'CHECKOUT_CART_EMPTY', message: 'Cart has no valid order items.' };
    }
    if (handoff.cart.sales_origin === 'marketplace' && items.some((item) => !item.marketplace_listing_id)) {
        return { ok: false, code: 'MARKETPLACE_LISTING_REQUIRED', message: 'Every marketplace checkout item must remain bound to its approved listing.' };
    }

    const email = stringValue(session.customer_email) || stringValue(handoff.cart.buyer_email);
    const name = stringValue(session.buyer_name) || email;
    if (!email || !name) {
        return { ok: false, code: 'CHECKOUT_CUSTOMER_REQUIRED', message: 'Checkout customer details are incomplete.' };
    }
    if ((session.buyer_account_id && !Number.isInteger(session.buyer_session_epoch))
        || (!session.buyer_account_id && session.buyer_session_epoch !== null && session.buyer_session_epoch !== undefined)) {
        return { ok: false, code: 'CHECKOUT_BUYER_BINDING_INVALID', message: 'Checkout identity could not be verified.' };
    }

    const discountCodes = selectedHostedDiscountCodes(session, handoff.cart.coupon_code);
    if (!discountCodes) return { ok: false, code: 'CHECKOUT_DISCOUNT_INVALID', message: 'Checkout coupon selection is unavailable.' };

    return {
        ok: true,
        provider,
        command: {
            customer_name: name,
            customer_email: email,
            customer_phone: stringValue(session.buyer_phone),
            customer_gstin: stringValue(session.buyer_gstin),
            shipping_address: session.shipping_address || {},
            items,
            payment_method: provider,
            shipping_method: checkoutShippingMethod(session),
            shipping_rate_id: stringValue(session.delivery_quote?.shipping_rate_id) || null,
            expected_shipping_amount: typeof session.delivery_quote?.amount === 'number' ? session.delivery_quote.amount : null,
            ...(typeof session.delivery_quote?.tax_quote_fingerprint === 'string'
                ? { expected_quote_fingerprint: session.delivery_quote.tax_quote_fingerprint } : {}),
            sales_origin: handoff.cart.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
            coupon_code: discountCodes[0] || undefined,
            idempotency_key: `hosted-checkout:${handoff.cartId}:${idempotencyKey}`,
            ...(session.buyer_account_id ? {
                buyer_account_id: session.buyer_account_id,
                buyer_session_epoch: session.buyer_session_epoch!,
            } : {}),
        },
    };
}
