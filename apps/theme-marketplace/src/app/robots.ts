import type { MetadataRoute } from 'next';
import { appendOriginPath, getPlatformRequestOrigin } from '@/lib/platform-request-origin';
import { getThemeMarketplaceUrl } from '@/lib/site-url';

export default async function robots(): Promise<MetadataRoute.Robots> {
    const origin = await getPlatformRequestOrigin(getThemeMarketplaceUrl());

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/auth', '/dashboard', '/checkout', '/install'],
            },
        ],
        sitemap: appendOriginPath(origin, '/sitemap.xml'),
        host: origin,
    };
}
