import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { gstStateCodeFromName, gstStateName } from '@letbuyy/checkout-core';

export interface CheckoutDeliveryAddress {
    country: string;
    state: string;
    stateCode?: string;
    pincode: string;
}

export interface CheckoutDeliveryOption {
    id: string;
    name: string;
    type: string;
    amount: number;
    currency: 'INR';
    estimated_days_min: number | null;
    estimated_days_max: number | null;
}

interface CartLine {
    quantity?: unknown;
    line_total?: unknown;
    unit_price?: unknown;
}

function normalizedText(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
}

function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function arrayIncludes(values: unknown, candidates: string[]): boolean {
    if (!Array.isArray(values)) return false;
    const normalized = values.map(normalizedText);
    return candidates.some((candidate) => normalized.includes(normalizedText(candidate)));
}

function cartSubtotal(lines: CartLine[]): number | null {
    let subtotal = 0;
    for (const line of lines) {
        const quantity = numberValue(line.quantity);
        const lineTotal = numberValue(line.line_total);
        const unitPrice = numberValue(line.unit_price);
        const amount = lineTotal ?? (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);
        if (amount === null || amount < 0) return null;
        subtotal += amount;
    }
    return Number.isFinite(subtotal) ? subtotal : null;
}

/**
 * Resolve active, COD-capable merchant rates for the exact destination from the signed cart.
 * A configured zone is the seller's delivery-area declaration; this does not claim live carrier
 * serviceability. Only flat/free/price-bounded rates are offered because checkout cart lines do
 * not carry a verified shipment weight for weight-based pricing.
 */
export async function checkoutDeliveryOptions(
    db: SupabaseClient,
    siteId: string,
    lines: CartLine[],
    address: CheckoutDeliveryAddress,
): Promise<CheckoutDeliveryOption[]> {
    if (normalizedText(address.country) !== 'in' && normalizedText(address.country) !== 'india') return [];
    if (!/^[1-9][0-9]{5}$/.test(address.pincode)) return [];
    const subtotal = cartSubtotal(lines);
    if (subtotal === null || lines.length === 0) return [];

    const { data: zones, error: zoneError } = await db
        .from('shipping_zones')
        .select('id, countries, states, zip_codes, cod_enabled')
        .eq('store_id', siteId)
        .eq('site_id', siteId)
        .eq('cod_enabled', true)
        .is('deleted_at', null);
    if (zoneError) throw new Error(`Shipping-zone lookup failed: ${zoneError.message}`);

    const stateCandidates = [
        address.state,
        address.stateCode || '',
        gstStateCodeFromName(address.state) || '',
        gstStateName(address.stateCode) || '',
    ].filter(Boolean);
    const matchingZoneIds = (zones || []).filter((zone) => {
        if (zone.cod_enabled !== true) return false;
        const countriesMatch = arrayIncludes(zone.countries, ['IN', 'India']);
        const states = Array.isArray(zone.states) ? zone.states.filter((value) => typeof value === 'string' && value.trim()) : [];
        const stateMatches = states.length === 0 || arrayIncludes(states, stateCandidates);
        const zipCodes = Array.isArray(zone.zip_codes) ? zone.zip_codes.filter((value) => typeof value === 'string' && value.trim()) : [];
        const pincodeMatches = zipCodes.length === 0 || zipCodes.includes(address.pincode);
        return countriesMatch && stateMatches && pincodeMatches;
    }).map((zone) => String(zone.id));
    if (matchingZoneIds.length === 0) return [];

    const { data: rates, error: rateError } = await db
        .from('shipping_rates')
        .select('id, zone_id, name, type, price, min_order_amount, max_order_amount, estimated_days_min, estimated_days_max, is_active, cod_enabled')
        .eq('site_id', siteId)
        .in('zone_id', matchingZoneIds)
        .eq('is_active', true)
        .eq('cod_enabled', true)
        .is('deleted_at', null);
    if (rateError) throw new Error(`Shipping-rate lookup failed: ${rateError.message}`);

    return (rates || []).flatMap((rate) => {
        if (rate.is_active !== true || rate.cod_enabled !== true) return [];
        const type = normalizedText(rate.type);
        if (type !== 'flat' && type !== 'free' && type !== 'price_based') return [];
        const minAmount = numberValue(rate.min_order_amount);
        const maxAmount = numberValue(rate.max_order_amount);
        if ((minAmount !== null && subtotal < minAmount) || (maxAmount !== null && subtotal > maxAmount)) return [];
        const configuredAmount = type === 'free' ? 0 : numberValue(rate.price);
        if (configuredAmount === null || configuredAmount < 0) return [];
        const amount = type === 'free' ? 0 : configuredAmount;
        return [{
            id: String(rate.id),
            name: typeof rate.name === 'string' && rate.name.trim() ? rate.name.trim() : 'Delivery',
            type,
            amount,
            currency: 'INR' as const,
            estimated_days_min: numberValue(rate.estimated_days_min),
            estimated_days_max: numberValue(rate.estimated_days_max),
        }];
    }).sort((left, right) => left.amount - right.amount || left.name.localeCompare(right.name));
}
