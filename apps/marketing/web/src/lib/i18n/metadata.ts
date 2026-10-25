import type { Metadata } from 'next'
import { createCopy } from './copy'
import { LOCALES, getLocale } from './locales'
import { buildAlternates } from './routing'
import { getMarketingSiteUrl } from '../public-urls'

export function localizeMetadata(source: Metadata, segment: string, path: string): Metadata {
    const locale = getLocale(segment)
    const t = createCopy(locale.language.code)
    const alternates = buildAlternates(getMarketingSiteUrl(), path, LOCALES)
    return {
        ...source,
        title: typeof source.title === 'string' ? t(source.title) : source.title,
        description: source.description ? t(source.description) : source.description,
        alternates: { canonical: alternates.canonicalOf(locale), languages: alternates.languages },
        ...(source.openGraph ? { openGraph: { ...source.openGraph, title: typeof source.openGraph.title === 'string' ? t(source.openGraph.title) : source.openGraph.title, description: source.openGraph.description ? t(source.openGraph.description) : source.openGraph.description, locale: `${locale.language.code}_IN` } } : {}),
        ...(source.twitter ? { twitter: { ...source.twitter, title: typeof source.twitter.title === 'string' ? t(source.twitter.title) : source.twitter.title, description: source.twitter.description ? t(source.twitter.description) : source.twitter.description } } : {}),
    }
}
