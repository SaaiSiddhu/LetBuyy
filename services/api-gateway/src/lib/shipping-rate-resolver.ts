// Shared server-side shipping rate resolver.
//
// SECURITY: callers must NEVER trust a client-supplied price for shipping.
// Resolve from the database using a caller-supplied rate ID; the resolved
// amount is the authoritative figure written to the order.

import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

export interface ResolvedShippingRate {
    /** The rate row id that was resolved. */
    id: string;
    /** The authoritative shipping cost in major currency units (e.g. ₹). */
    amount: number;
}

interface ShippingRateRow {
    id: string;
    type: string | null;
    price: number | null;
    min_order_amount: number | null;
    max_order_amount: number | null;
    site_id: string | null;
}

/**
 * Resolve a single shipping rate from the database.
 *
 * Validates that the rate belongs to the given store and is active.
 * Returns null when the store has no configured rates (fall-through to legacy).
 * Throws when a rate ID is provided but cannot be validated.
 */
export async function resolveShippingRate(
    db: SupabaseClient,
    storeId: string,
    shippingRateId: string | null | undefined,
): Promise<ResolvedShippingRate | null> {
    // Check whether the store has any active rates at all.
    // T11/W1 — a `head: true` Supabase query returns no rows: the count lives on the response's
    // `count` property, never on `data` (which is always null/empty for a head request). This
    // used to destructure `{ data: countData }` and test `Array.isArray(countData)`, which is
    // always false for a head response, so `hasRates` was always false — server-side shipping-
    // rate resolution never activated for ANY store, even ones with real configured rates
    // (confirmed live: snaz has a real ₹99 flat rate, yet a bogus/nonexistent shippingRateId was
    // silently accepted and the order fell through to the legacy free/₹99 standard-express logic
    // instead of being rejected). Reading `count` instead of `data` is the fix.
    const { count } = await db
        .from('shipping_rates')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', storeId)
        .eq('is_active', true)
        .is('deleted_at', null);

    const hasRates = Boolean(count && count > 0);

    if (!hasRates) {
        // No configured rates — caller uses legacy standard/express logic.
        return null;
    }

    if (!shippingRateId) {
        // Store has rates but caller passed no ID — signal fall-through.
        return null;
    }

    const { data, error } = await db
        .from('shipping_rates')
        .select('id, type, price, min_order_amount, max_order_amount, site_id')
        .eq('id', shippingRateId)
        .eq('site_id', storeId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Shipping rate lookup failed: ${error.message}`);

    const rate = data as ShippingRateRow | null;
    if (!rate) {
        throw new Error(`Shipping rate ${shippingRateId} not found or does not belong to this store`);
    }

    const amount = rate.type === 'free' ? 0 : Math.max(0, Number(rate.price ?? 0));
    return { id: rate.id, amount };
}
