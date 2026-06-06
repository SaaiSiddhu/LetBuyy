import type { MetadataRoute } from 'next'
import { getMarketingSiteUrl } from '@/lib/public-urls'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/signup'],
            },
        ],
        sitemap: getMarketingSiteUrl('/sitemap.xml'),
    }
}
