import type { Metadata } from 'next'
import { createCopy } from './copy'
import { LOCALES, getLocale } from './locales'
import { buildAlternates } from './routing'
import { getMarketingSiteUrl } from '../public-urls'
import { BRAND_SOCIAL_IMAGE } from '../brand-assets'

/** One final identity for canonical, language alternatives and social previews. */
export function localizeMetadata(source: Metadata, segment: string, path: string): Metadata {
    const locale = getLocale(segment)
    const t = createCopy(locale.language.code)
    const alternates = buildAlternates(getMarketingSiteUrl(), path, LOCALES)
    const url = alternates.canonicalOf(locale)
    const rawTitle = typeof source.title === 'string' ? t(source.title) : null
    const title = rawTitle ? (/\bLetBuyy\b/i.test(rawTitle) ? rawTitle : `${rawTitle} | LetBuyy`) : undefined
    const description = source.description ? t(source.description) : undefined
    return {
        ...source,
        ...(title ? { title: { absolute: title } } : {}),
        description,
        alternates: { canonical: url, languages: alternates.languages },
        openGraph: {
            type: 'website',
            ...source.openGraph,
            siteName: 'LetBuyy',
            url,
            locale: `${locale.language.code}_IN`,
            title: typeof source.openGraph?.title === 'string' ? t(source.openGraph.title) : title,
            description: typeof source.openGraph?.description === 'string' ? t(source.openGraph.description) : description,
            images: source.openGraph?.images ?? [BRAND_SOCIAL_IMAGE],
        },
        twitter: {
            ...source.twitter,
            card: 'summary_large_image',
            title: typeof source.twitter?.title === 'string' ? t(source.twitter.title) : title,
            description: typeof source.twitter?.description === 'string' ? t(source.twitter.description) : description,
            images: source.twitter?.images ?? [BRAND_SOCIAL_IMAGE],
        },
    }
}
