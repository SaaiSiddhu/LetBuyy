import type { MetadataRoute } from 'next'
import { getMarketingSiteUrl } from '@/lib/public-urls'
import { CATEGORIES } from '@/lib/resources/categories'
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents'

const baseUrl = getMarketingSiteUrl()
const lastModified = new Date('2026-06-04T00:00:00.000Z')

/**
 * Only pages that render their own content belong here.
 *
 * `/signup` is deliberately absent — it is a redirect to the accounts app, and
 * listing a redirect in a sitemap tells crawlers to index a URL that never
 * serves a page.
 */
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
            url: `${baseUrl}/resources`,
            lastModified,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/resources/changelog`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/create`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/resources/releases`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        // One entry per guide category, generated so a new topic is indexed
        // without a second edit here.
        ...CATEGORIES.map(category => ({
            url: `${baseUrl}/resources/${category.slug}`,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        })),
        {
            url: `${baseUrl}/legal`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        // Every policy is separately indexable — "letbuyy refund policy" should
        // land on the refund policy, not on the library index.
        ...LEGAL_DOCUMENTS.map(doc => ({
            url: `${baseUrl}/legal/${doc.slug}`,
            lastModified,
            changeFrequency: 'monthly' as const,
            priority: 0.5,
        })),
        {
            url: `${baseUrl}/sitemap`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/resources/search`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
    ]
}
