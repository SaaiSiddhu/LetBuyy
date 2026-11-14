import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { gstStateCodeFromName, gstStateName } from '@letbuyy/checkout-core';

export interface StorefrontShippingAddress {
    country: string;
    state: string;
    stateCode?: string | null;
    pincode: string;
}

export interface StorefrontShippingRateOption {
    id: string;
    name: string;
    type: 'flat' | 'free' | 'price_based';
    currency: 'INR';
    amount_minor: number;
    estimated_days_min: number | null;
    estimated_days_max: number | null;
    cod_available: boolean;
    source: 'seller_zone_configuration';
    carrier_confirmed: false;
}

export interface ShippingZoneRow {
    id: string;
    countries: string[] | null;
    states: string[] | null;
    zip_codes: string[] | null;
    cod_enabled: boolean | null;
}

export interface ShippingRateRow {
    id: string;
    zone_id: string;
    name: string | null;
    type: string | null;
    price: number | string | null;
    min_order_amount: number | string | null;
    max_order_amount: number | string | null;
    estimated_days_min: number | null;
    estimated_days_max: number | null;
    cod_enabled: boolean | null;
}

const normalized = (value: string | null | undefined) => (value || '').trim().toLowerCase();

export function storefrontZoneCoversAddress(zone: Pick<ShippingZoneRow, 'countries' | 'states' | 'zip_codes'>, address: StorefrontShippingAddress): boolean {
    if (!/^[1-9][0-9]{5}$/.test(address.pincode.trim()) || !address.state.trim()) return false;
    const countries = (zone.countries || []).map(normalized);
    const states = (zone.states || []).map(normalized);
    const zipCodes = (zone.zip_codes || []).map((value) => value.trim());
    const countryCovered = countries.includes(normalized(address.country))
        || (normalized(address.country) === 'in' && countries.includes('india'))
        || (normalized(address.country) === 'india' && countries.includes('in'));
    const stateCandidates = [
        address.state,
        address.stateCode || '',
        gstStateCodeFromName(address.state) || '',
        gstStateName(address.stateCode) || '',
    ].map(normalized).filter(Boolean);
    const stateCovered = states.length === 0 || stateCandidates.some((candidate) => states.includes(candidate));
    const pincodeCovered = zipCodes.length === 0 || zipCodes.includes(address.pincode.trim());
    return countryCovered && stateCovered && pincodeCovered;
}

export function quoteStorefrontShippingOptions(
    configuredZones: ShippingZoneRow[],
    configuredRates: ShippingRateRow[],
    address: StorefrontShippingAddress,
    subtotalMinor: number,
): StorefrontShippingRateOption[] {
    const zones = configuredZones.filter((zone) => storefrontZoneCoversAddress(zone, address));
    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
    const subtotal = subtotalMinor / 100;
    return configuredRates.flatMap((rate) => {
        if (rate.type !== 'flat' && rate.type !== 'free' && rate.type !== 'price_based') return [];
        const min = rate.min_order_amount == null ? null : Number(rate.min_order_amount);
        const max = rate.max_order_amount == null ? null : Number(rate.max_order_amount);
        if ((min !== null && subtotal < min) || (max !== null && subtotal > max)) return [];
        const amount = rate.type === 'free' ? 0 : Number(rate.price ?? 0);
        if (!Number.isFinite(amount) || amount < 0) return [];
        const zone = zoneById.get(rate.zone_id);
        if (!zone) return [];
        return [{
            id: rate.id,
            name: rate.name?.trim() || 'Delivery',
            type: rate.type,
            currency: 'INR' as const,
            amount_minor: Math.round(amount * 100),
            estimated_days_min: rate.estimated_days_min,
            estimated_days_max: rate.estimated_days_max,
            cod_available: rate.cod_enabled === true && zone.cod_enabled === true,
            source: 'seller_zone_configuration' as const,
            carrier_confirmed: false as const,
        }];
    });
}

/** Read and price only active, seller-configured rates whose saved zone covers this address. */
export async function listStorefrontShippingRates(
    db: SupabaseClient,
    storeId: string,
    address: StorefrontShippingAddress,
    subtotalMinor: number,
): Promise<StorefrontShippingRateOption[]> {
    const { data: zoneData, error: zoneError } = await db
        .from('shipping_zones')
        .select('id, countries, states, zip_codes, cod_enabled')
        .eq('store_id', storeId)
        .eq('site_id', storeId)
        .is('deleted_at', null);
    if (zoneError) throw new Error(`Shipping zone lookup failed: ${zoneError.message}`);

    const zones = ((zoneData || []) as ShippingZoneRow[]).filter((zone) => storefrontZoneCoversAddress(zone, address));
    if (zones.length === 0) return [];

    const { data: rateData, error: rateError } = await db
        .from('shipping_rates')
        .select('id, zone_id, name, type, price, min_order_amount, max_order_amount, estimated_days_min, estimated_days_max, cod_enabled')
        .eq('site_id', storeId)
        .in('zone_id', zones.map((zone) => zone.id))
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(50);
    if (rateError) throw new Error(`Shipping rate lookup failed: ${rateError.message}`);

    return quoteStorefrontShippingOptions(zones, (rateData || []) as ShippingRateRow[], address, subtotalMinor);
}

export async function loadStorefrontSubtotalMinor(
    db: SupabaseClient,
    storeId: string,
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
): Promise<number> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [...new Set(items.flatMap((item) => item.variantId ? [item.variantId] : []))];
    const { data: productsData, error: productsError } = await db
        .from('products')
        .select('id, price')
        .eq('store_id', storeId)
        .in('id', productIds)
        .is('deleted_at', null);
    if (productsError) throw new Error(`Checkout product pricing lookup failed: ${productsError.message}`);

    const products = new Map(((productsData || []) as Array<{ id: string; price: number | string | null }>).map((product) => [product.id, product]));
    const variants = new Map<string, { product_id: string; price: number | string | null }>();
    if (variantIds.length > 0) {
        const { data: variantData, error: variantError } = await db
            .from('product_variants')
            .select('id, product_id, price')
            .in('id', variantIds);
        if (variantError) throw new Error(`Checkout variant pricing lookup failed: ${variantError.message}`);
        for (const variant of (variantData || []) as Array<{ id: string; product_id: string; price: number | string | null }>) {
            variants.set(variant.id, variant);
        }
    }

    let subtotalMinor = 0;
    for (const item of items) {
        const product = products.get(item.productId);
        const variant = item.variantId ? variants.get(item.variantId) : undefined;
        if (!product || (item.variantId && (!variant || variant.product_id !== product.id))) {
            throw new Error('Checkout item is no longer available for this store');
        }
        const variantPrice = variant ? Number(variant.price ?? 0) : 0;
        const unitPriceMinor = Math.round((variantPrice > 0 ? variantPrice : Number(product.price ?? 0)) * 100);
        if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new Error('Checkout item price is invalid');
        subtotalMinor += unitPriceMinor * item.quantity;
        if (!Number.isSafeInteger(subtotalMinor)) throw new Error('Checkout total is invalid');
    }
    return subtotalMinor;
}
