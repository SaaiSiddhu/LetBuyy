import type { MetadataRoute } from 'next'
import { getMarketingSiteUrl } from '@/lib/public-urls'

const baseUrl = getMarketingSiteUrl()
const lastModified = new Date('2026-06-04T00:00:00.000Z')

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: baseUrl,
            lastModified,
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/pricing`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/create`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
    ]
}
