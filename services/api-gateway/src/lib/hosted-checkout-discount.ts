import type { getSupabaseAdmin } from './supabase';
import { cartLines, signedCartSubtotalMinor, type CartRow } from './hosted-checkout-order-command';
import { selectedHostedDiscountCodes, type HostedCheckoutSession } from './hosted-checkout-session';

type DiscountRefusal = { body: { success: false; error: { code: string; message: string } }; status: 409 | 503; retryable?: boolean };
type DiscountSelection = { ok: true; codes: string[]; amount: number } | { ok: false; refusal: DiscountRefusal };
type DiscountInput = {
    siteId: string; cart: CartRow; observed: HostedCheckoutSession | null; shippingAmount: number;
    codes?: string[]; expectedAmountMinor?: number;
};
function refuse(code: string, message: string, status: 409 | 503, retryable?: boolean): DiscountSelection {
    return { ok: false, refusal: { body: { success: false, error: { code, message } }, status, ...(retryable === undefined ? {} : { retryable }) } };
}

/** Validate the signed cart's tenant against the existing promotion authority before
 * the delivery CAS. The client amount is only a reviewed-price comparison. */
export async function verifyHostedDiscountSelection(db: ReturnType<typeof getSupabaseAdmin>, input: DiscountInput): Promise<DiscountSelection> {
    const codes = input.codes ?? selectedHostedDiscountCodes(input.observed, input.cart.coupon_code);
    if (!codes) return refuse('CHECKOUT_DISCOUNT_INVALID', 'Coupon selection is unavailable. Please try again.', 409);
    let amount = 0;
    if (codes.length) {
        const subtotalMinor = signedCartSubtotalMinor(cartLines(input.cart));
        if (subtotalMinor === null) return refuse('CHECKOUT_SUBTOTAL_UNAVAILABLE', 'Cart pricing could not be verified.', 409);
        const promotion = await db.rpc('evaluate_checkout_promotion', {
            p_store_id: input.siteId, p_code: codes[0], p_subtotal: subtotalMinor / 100,
            p_shipping_amount: input.shippingAmount, p_customer_email: input.observed?.customer_email || null,
        });
        if (promotion.error) return refuse(
            promotion.error.code === 'P0001' ? 'CHECKOUT_DISCOUNT_INVALID' : 'CHECKOUT_UNAVAILABLE',
            promotion.error.code === 'P0001' ? 'This coupon is no longer eligible. Remove it or choose another code.' : 'Coupon verification is temporarily unavailable.',
            promotion.error.code === 'P0001' ? 409 : 503, promotion.error.code !== 'P0001');
        const quote = promotion.data as { valid?: boolean; discount?: unknown } | null;
        amount = Number(quote?.discount);
        if (!quote?.valid || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100)))
            return refuse('CHECKOUT_UNAVAILABLE', 'Coupon verification is temporarily unavailable.', 503, true);
    }
    if (input.codes !== undefined && input.expectedAmountMinor !== Math.round(amount * 100))
        return refuse('CHECKOUT_DISCOUNT_CHANGED', 'The coupon discount changed. Review it again before paying.', 409);
    return { ok: true, codes, amount };
}
