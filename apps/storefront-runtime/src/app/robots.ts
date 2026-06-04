import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { StoreService } from '@/lib/store-service';
import { getStorefrontUrl, resolveSubdomainFromHost } from '@/lib/seo';

function getSitemapUrl(host: string | null, protocol: string | null): string | undefined {
    if (!host) return undefined;
    const scheme = protocol || 'https';
    return `${scheme}://${host}/sitemap.xml`;
}

export default async function robots(): Promise<MetadataRoute.Robots> {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto');
    const subdomain = resolveSubdomainFromHost(host);

    if (!subdomain) {
        return {
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        };
    }

    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store || store.status !== 'published') {
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
            disallow: ['/api/', '/account/', '/checkout/'],
        },
        sitemap: getSitemapUrl(host, protocol) || getStorefrontUrl(store, '/sitemap.xml'),
    };
}
