import type { MetadataRoute } from 'next'
import { getPlatformSitemapUrls } from '@/lib/platform-links'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/signup'],
            },
        ],
        sitemap: getPlatformSitemapUrls(),
    }
}
