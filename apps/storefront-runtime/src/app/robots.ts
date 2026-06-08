import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { StoreService } from '@/lib/store-service';
import { getStorefrontUrl, isStorefrontIndexable, resolveSubdomainFromHost } from '@/lib/seo';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';

function getSitemapUrl(host: string | null, protocol: string | null): string | undefined {
    if (!host) return undefined;
    const scheme = protocol || 'https';
    return `${scheme}://${host}/sitemap.xml`;
}

export default async function robots(): Promise<MetadataRoute.Robots> {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto');
    const accessContext = host ? await resolveStorefrontAccessContext(host).catch(() => null) : null;
    const subdomain = accessContext?.subdomain || resolveSubdomainFromHost(host);

    if (!subdomain) {
        return {
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        };
    }

    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (
        !store
        || !isStorefrontIndexable(store)
        || accessContext?.access_mode !== 'public'
        || accessContext?.published === false
    ) {
        return {
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        };
    }

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/account/', '/checkout/', '/preview/'],
        },
        sitemap: getSitemapUrl(host, protocol) || getStorefrontUrl(store, '/sitemap.xml'),
    };
}
