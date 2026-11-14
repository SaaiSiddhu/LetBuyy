import type { MetadataRoute } from 'next'
import type { Article } from '@/lib/resources/types'
import { getMarketingSiteUrl } from '../lib/public-urls'
import { getAllArticlesForSitemap } from '../lib/resources/utils'
import { localizeArticleContent } from '../lib/i18n/article-content'
import { CHANGELOG } from '../lib/resources/changelog'
import { CATEGORIES } from '../lib/resources/categories'
import { LEGAL_DOCUMENTS } from '../lib/legal/documents'
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n/locales'
import { localePath } from '../lib/i18n/routing'

const baseUrl = getMarketingSiteUrl()

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
    ...(CHANGELOG.length ? [{ path: '/resources/changelog', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/resources/releases', priority: 0.7, changeFrequency: 'weekly' as const }] : []),
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
    // The visitor-facing HTML directory is noindex; it stays linked in the
    // footer, but the XML inventory advertises indexable landing pages only.
]

/** Canonical public pages and actual translated articles; no build-time dates. */
export default function sitemap(): MetadataRoute.Sitemap {
    const paths: Array<(typeof PATHS)[number] & { article?: Article }> = [
        ...PATHS,
        ...getAllArticlesForSitemap().map(article => ({
            path: `/resources/${article.category}/${article.slug}`,
            priority: 0.7,
            changeFrequency: 'monthly' as const,
            article,
        })),
    ]
    return paths.flatMap(entry => {
        const article = entry.article
        const locales = article !== undefined
            ? LOCALES.filter(locale => locale.language.code === 'en' || localizeArticleContent(article, locale.language.code).translated)
            : LOCALES
        const languages = Object.fromEntries(locales.map(locale => [locale.hreflang, `${baseUrl}${localePath(locale, entry.path)}`]))
        languages['x-default'] = `${baseUrl}${localePath(DEFAULT_LOCALE, entry.path)}`
        return locales.map(locale => ({
            url: `${baseUrl}${localePath(locale, entry.path)}`,
            ...(article !== undefined ? { lastModified: new Date(article.updatedAt) } : {}),
            changeFrequency: entry.changeFrequency,
            priority: entry.priority,
            alternates: { languages },
        }))
    })
}
