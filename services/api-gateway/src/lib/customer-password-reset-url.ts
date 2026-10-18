export interface StorefrontResetUrlSite {
    id: string;
}

export interface CustomerPasswordResetUrlInput {
    storeId: string;
    requestedUrl?: string | null;
    fallbackUrl: string;
    storeRootDomain?: string | null;
    resolveSiteByHost: (host: string, storeRootDomain?: string | null) => Promise<StorefrontResetUrlSite | null>;
}

function isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost');
}

/**
 * A reset token is a password-changing bearer secret. A public request may choose a destination
 * only when that exact host currently resolves to the same storefront whose customer is reset.
 * Otherwise, use the operator-configured reset destination.
 */
export async function chooseCustomerPasswordResetUrl(input: CustomerPasswordResetUrlInput): Promise<string> {
    if (!input.requestedUrl) return input.fallbackUrl;

    try {
        const requested = new URL(input.requestedUrl);
        const secureTransport = requested.protocol === 'https:'
            || (requested.protocol === 'http:' && isLocalHostname(requested.hostname));
        if (!secureTransport || requested.username || requested.password || requested.hash) return input.fallbackUrl;

        const site = await input.resolveSiteByHost(requested.host, input.storeRootDomain);
        if (site?.id.toLowerCase() !== input.storeId.toLowerCase()) return input.fallbackUrl;
        return requested.toString();
    } catch {
        return input.fallbackUrl;
    }
}
