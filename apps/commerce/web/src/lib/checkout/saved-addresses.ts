export interface CheckoutSavedAddress {
    id: string;
    label?: string | null;
    full_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    customer_phone?: string | null;
}

export interface CheckoutSavedAddressesResult {
    addresses: CheckoutSavedAddress[];
    source: 'buyer' | 'store_customer';
}

/**
 * Resolve the active storefront identity before loading saved addresses. A canonical buyer
 * session is authoritative when present; only a signed-out buyer session may fall back to the
 * explicitly separate store-customer session. Verification failures fail closed instead of
 * silently showing addresses from a different identity realm.
 */
export async function loadCheckoutSavedAddresses(
    fetcher: typeof fetch = fetch,
    signal?: AbortSignal,
): Promise<CheckoutSavedAddressesResult> {
    const sessionResponse = await fetcher('/api/buyer-auth/session', { cache: 'no-store', signal });
    if (!sessionResponse.ok) throw new Error('Your account could not be verified. You can enter an address manually.');

    const sessionPayload = await sessionResponse.json() as { buyer?: unknown };
    const source = sessionPayload.buyer ? 'buyer' : 'store_customer';
    const addressesResponse = await fetcher(
        source === 'buyer' ? '/api/buyer/addresses' : '/api/customer/addresses',
        { cache: 'no-store', signal },
    );
    if (!addressesResponse.ok) throw new Error('Saved addresses could not be loaded. You can enter an address manually.');

    const payload = await addressesResponse.json() as { addresses?: unknown };
    return {
        addresses: Array.isArray(payload.addresses) ? payload.addresses as CheckoutSavedAddress[] : [],
        source,
    };
}
