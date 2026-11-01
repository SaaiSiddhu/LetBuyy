import { CheckoutTotalsQuoteSchema, type CheckoutTotalsQuote } from '@letbuyy/shared-types';
import { normalizeIndianStateCode, gstStateCodeFromName, type CreateCheckoutOrderCommand } from '@letbuyy/checkout-core';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { AppError } from './errors';

export function checkoutTaxAddress(address: Record<string, unknown>): Record<string, unknown> {
    const stateCode = normalizeIndianStateCode(typeof address.state_code === 'string' ? address.state_code : undefined)
        || gstStateCodeFromName(typeof address.state === 'string' ? address.state : undefined);
    return { ...address, state_code: stateCode || null };
}

/** Read-only domain operation; the same SQL authority runs inside order creation.
 * Only derived server cart/product references cross this boundary, never prices. */
export async function quoteCheckoutTotals(db: SupabaseClient, input: {
    siteId: string; items: CreateCheckoutOrderCommand['items']; shippingAddress: Record<string, unknown>;
    shippingRateId: string; couponCode?: string | null; customerEmail?: string | null;
}): Promise<CheckoutTotalsQuote> {
    const result = await db.rpc('quote_storefront_checkout_totals', {
        p_store_id: input.siteId, p_items: input.items,
        p_shipping_address: checkoutTaxAddress(input.shippingAddress),
        p_shipping_rate_id: input.shippingRateId,
        p_coupon_code: input.couponCode || null, p_customer_email: input.customerEmail || null,
    });
    if (result.error) {
        if (/GST_(RATE_REQUIRED|REGISTRATION_REQUIRED|SUPPLIER_DETAILS_REQUIRED|PLACE_OF_SUPPLY_REQUIRED|RATE_AMBIGUOUS|RATE_INVALID|COMPOUND_RATE_UNSUPPORTED)/.test(result.error.message || '')) {
            throw new AppError('Tax setup for this order needs attention. Please contact the store before paying.', 503, 'CHECKOUT_TAX_SETUP_REQUIRED');
        }
        if (/CART_FACT|CART_VARIANT|CHECKOUT_(ITEM_UNAVAILABLE|SHIPPING_CHANGED|DISCOUNT_INVALID|DUPLICATE_LINE)/.test(result.error.message || '')) {
            throw new AppError('Your items, coupon or delivery option changed. Review checkout again.', 409, 'CHECKOUT_QUOTE_CHANGED');
        }
        throw new AppError('The order total is temporarily unavailable. Please retry.', 503, 'CHECKOUT_QUOTE_UNAVAILABLE');
    }
    const parsed = CheckoutTotalsQuoteSchema.safeParse(result.data);
    if (!parsed.success) throw new AppError('The order total could not be verified. Please retry.', 503, 'CHECKOUT_QUOTE_UNAVAILABLE');
    return parsed.data;
}
