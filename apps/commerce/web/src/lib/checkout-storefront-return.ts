import { normalizeCheckoutOrigin } from '@letbuyy/checkout-core';
import { buildTenantStorefrontUrl, normalizeStoreRootDomain } from '@letbuyy/tenant-core';
import type { StorefrontAccessContext } from './storefront-access';

/** Navigation only. The hint grants no checkout, cart or account authority.
 * Preserve browser storage only on this verified site's storefront. Custom
 * hosts reuse the existing signed ownership resolver; suffix matches never do. */
export async function resolveCheckoutStorefrontReturn(input: {
    siteId: string;
    subdomain: string;
    originHint: unknown;
    rootDomain?: string;
    baseUrl?: string;
    resolveHost: (host: string) => Promise<StorefrontAccessContext | null>;
}): Promise<string> {
    const rootDomain = normalizeStoreRootDomain(input.rootDomain);
    const fallback = rootDomain === 'localhost' && !input.baseUrl
        ? `/store/${encodeURIComponent(input.subdomain)}`
        : buildTenantStorefrontUrl(input.subdomain, { rootDomain, baseUrl: input.baseUrl });
    const origin = normalizeCheckoutOrigin(input.originHint);
    if (!origin) return fallback;
    const url = new URL(origin);
    const configuredBase = input.baseUrl ? new URL(input.baseUrl) : null;
    if (configuredBase && url.origin === configuredBase.origin) return fallback;
    if (rootDomain === 'localhost' && url.hostname === 'localhost'
        && (!configuredBase || url.port === configuredBase.port)) {
        return `${origin}/store/${encodeURIComponent(input.subdomain)}`;
    }
    // The handle is from the verified handoff. This exact platform host cannot
    // select another tenant, and needs no extra database/provider request.
    if (url.hostname === `${input.subdomain}.${rootDomain}`
        && (rootDomain === 'localhost'
            ? !configuredBase || url.port === configuredBase.port
            : url.protocol === 'https:' && !url.port)) return origin;
    // Public custom hosts never accept HTTP, nonstandard ports or a partial
    // resolver answer. Revoked ownership and unavailable evidence use fallback.
    if (url.protocol !== 'https:' || url.port) return fallback;
    try {
        const site = await input.resolveHost(url.hostname);
        if (site?.site_id === input.siteId && site.subdomain === input.subdomain
            && site.custom_domain === url.hostname && site.custom_domain_status === 'active'
            && site.published && site.status === 'published') return origin;
    } catch { /* Navigation must not turn a resolver outage into a checkout grant. */ }
    return fallback;
}
