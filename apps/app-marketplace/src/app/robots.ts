import type { MetadataRoute } from 'next';
import { getAppMarketplaceUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/my-apps', '/developers/dashboard'],
            },
        ],
        sitemap: getAppMarketplaceUrl('/sitemap.xml'),
        host: getAppMarketplaceUrl(),
    };
}
