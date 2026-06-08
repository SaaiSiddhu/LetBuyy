import type { MetadataRoute } from 'next';
import { getThemeMarketplaceUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/auth', '/dashboard', '/checkout', '/install'],
            },
        ],
        sitemap: getThemeMarketplaceUrl('/sitemap.xml'),
        host: getThemeMarketplaceUrl(),
    };
}
