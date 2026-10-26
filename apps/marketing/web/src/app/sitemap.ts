import type { MetadataRoute } from 'next'
import { getMarketingSiteUrl } from '@/lib/public-urls'
import { CATEGORIES } from '@/lib/resources/categories'
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/locales'
import { localePath } from '@/lib/i18n/routing'

const baseUrl = getMarketingSiteUrl()
const lastModified = new Date('2026-06-04T00:00:00.000Z')

/**
 * Locale-free paths, each with the priority it carries in every locale.
 *
 * `/signup` is deliberately absent — it is a redirect to the accounts app, and
 * listing a redirect tells crawlers to index a URL that never serves a page.
 */
const PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/resources', priority: 0.9, changeFrequency: 'daily' },
    { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/support', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/resources/changelog', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/create', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/resources/releases', priority: 0.7, changeFrequency: 'weekly' },
    ...CATEGORIES.map(category => ({
        path: `/resources/${category.slug}`,
        priority: 0.7,
        changeFrequency: 'weekly' as const,
    })),
    { path: '/legal', priority: 0.6, changeFrequency: 'monthly' },
    ...LEGAL_DOCUMENTS.map(doc => ({
        path: `/legal/${doc.slug}`,
        priority: 0.5,
        changeFrequency: 'monthly' as const,
    })),
    { path: '/sitemap', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/resources/search', priority: 0.4, changeFrequency: 'monthly' },
]

/**
 * Every path × every locale, each entry carrying the full alternates set.
 *
 * The alternates matter more than the extra rows: without them Google sees
 * three near-identical Indian-English-adjacent pages and picks one, which is
 * how translated sites end up with only their default locale indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return PATHS.flatMap(({ path, priority, changeFrequency }) => {
        const languages = Object.fromEntries(
            LOCALES.map(locale => [locale.hreflang, `${baseUrl}${localePath(locale, path)}`]),
        )
        languages['x-default'] = `${baseUrl}${localePath(DEFAULT_LOCALE, path)}`

        return LOCALES.map(locale => ({
            url: `${baseUrl}${localePath(locale, path)}`,
            lastModified,
            changeFrequency,
            priority,
            alternates: { languages },
        }))
    })
}
