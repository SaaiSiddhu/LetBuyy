export interface StorefrontCustomerSessionScopeInput {
    headers: { get(name: string): string | null };
    storeId: string;
    resolveStoreIdForHost: (host: string) => Promise<string | null>;
}

/** A legacy customer session is usable only on the storefront that owns its signed storeId. */
export async function customerSessionMatchesRequestStore(input: StorefrontCustomerSessionScopeInput): Promise<boolean> {
    const host = (input.headers.get('x-forwarded-host') || input.headers.get('host') || '').split(',')[0].trim();
    if (!host || !input.storeId) return false;

    try {
        const currentStoreId = await input.resolveStoreIdForHost(host);
        return Boolean(currentStoreId && currentStoreId.toLowerCase() === input.storeId.toLowerCase());
    } catch {
        return false;
    }
}
