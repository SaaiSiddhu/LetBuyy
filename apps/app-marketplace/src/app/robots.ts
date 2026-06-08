import type { MetadataRoute } from 'next';
import { appendOriginPath, getPlatformRequestOrigin } from '@/lib/platform-request-origin';
import { getAppMarketplaceUrl } from '@/lib/site-url';

export default async function robots(): Promise<MetadataRoute.Robots> {
    const origin = await getPlatformRequestOrigin(getAppMarketplaceUrl());

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/my-apps', '/developers/dashboard'],
            },
        ],
        sitemap: appendOriginPath(origin, '/sitemap.xml'),
        host: origin,
    };
}
