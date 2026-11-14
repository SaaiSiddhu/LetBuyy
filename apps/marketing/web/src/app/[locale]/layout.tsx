import { BRAND_SOCIAL_IMAGE } from '@/lib/brand-assets'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, getLocale, isLocaleSegment } from '@/lib/i18n/locales'
import { buildAlternates } from '@/lib/i18n/routing'
import { getDictionary } from '@/lib/i18n'
import { getMarketingSiteUrl } from '@/lib/public-urls'
import LocaleHtmlLang from '@/components/i18n/LocaleHtmlLang'
import CopyProvider from '@/components/i18n/CopyProvider'
import { getCopyMessages } from '@/lib/i18n/copy'

const siteUrl = getMarketingSiteUrl()

/** Prerender every locale. Adding a language to the registry adds it here. */
export function generateStaticParams() {
    return LOCALES.map(locale => ({ locale: locale.segment }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale: segment } = await params
    const locale = getLocale(segment)
    const dict = getDictionary(locale)
    const alternates = buildAlternates(siteUrl, '/', LOCALES)

    return {
        title: { absolute: dict.meta.title },
        description: dict.meta.description,
        alternates: {
            canonical: alternates.canonicalOf(locale),
            languages: alternates.languages,
        },
        openGraph: {
            images: [BRAND_SOCIAL_IMAGE],
            url: alternates.canonicalOf(locale),
            type: 'website',
            siteName: 'LetBuyy',
            title: dict.meta.title,
            description: dict.meta.description,
            locale: `${locale.language.bcp47}_${locale.country.code.toUpperCase()}`,
        },
    }
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}) {
    const { locale: segment } = await params

    /* An unknown segment is a 404, not a silent fallback to English: serving
       real content at /in-xx would let any typo become an indexable duplicate
       of the whole site. */
    if (!isLocaleSegment(segment)) notFound()

    const locale = getLocale(segment)

    return (
        <>
            {/* The <html> element is owned by the root layout, which cannot see
                the locale param. This syncs lang/dir from inside the segment. */}
            <LocaleHtmlLang lang={locale.language.bcp47} dir={locale.language.dir} />
            <CopyProvider segment={segment} messages={getCopyMessages(locale.language.code)} dictionary={getDictionary(locale)}>
                <div lang={locale.language.bcp47} dir={locale.language.dir}>{children}</div>
            </CopyProvider>
        </>
    )
}
