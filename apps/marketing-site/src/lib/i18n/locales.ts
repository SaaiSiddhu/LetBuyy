/**
 * Locale registry.
 *
 * A locale is a (country, language) pair, and the URL segment is derived from
 * it rather than stored as an opaque string:
 *
 *   country's default language →  /in          (India, English)
 *   any other language         →  /in-ta       (India, Tamil)
 *                                 /in-hi       (India, Hindi)
 *
 * That is the same shape Shopify uses (`/in-hi?country=in&lang=hi`), and it is
 * why the model is a pair rather than a flat list: adding the United States is
 * one COUNTRIES entry plus its languages, and every segment, hreflang tag,
 * sitemap entry and switcher option follows automatically. Nothing below is
 * India-specific except the data.
 */

export interface Country {
    /** ISO 3166-1 alpha-2, lowercased — the first half of the URL segment. */
    code: string
    label: string
    /** Language that gets the bare segment (`/in`), with no suffix. */
    defaultLanguage: string
    /** Every language served for this country, default first. */
    languages: string[]
    currency: string
}

export interface Language {
    /** ISO 639-1 — the second half of the URL segment, and the `lang` param. */
    code: string
    /** Name in that language, which is how a switcher should list it. */
    label: string
    /** Name in English, for aria-labels and analytics. */
    englishLabel: string
    /** BCP 47 tag for the <html lang> attribute and hreflang. */
    bcp47: string
    dir: 'ltr' | 'rtl'
}

export const LANGUAGES: Record<string, Language> = {
    en: { code: 'en', label: 'English', englishLabel: 'English', bcp47: 'en', dir: 'ltr' },
    ta: { code: 'ta', label: 'தமிழ்', englishLabel: 'Tamil', bcp47: 'ta', dir: 'ltr' },
    hi: { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', bcp47: 'hi', dir: 'ltr' },
}

export const COUNTRIES: Record<string, Country> = {
    in: {
        code: 'in',
        label: 'India',
        defaultLanguage: 'en',
        languages: ['en', 'ta', 'hi'],
        currency: 'INR',
    },
}

export const DEFAULT_COUNTRY = 'in'
export const DEFAULT_LANGUAGE = 'en'

export interface Locale {
    /** URL segment: `in`, `in-ta`, `in-hi`. */
    segment: string
    country: Country
    language: Language
    /** BCP 47 with region, for hreflang: `en-IN`, `ta-IN`. */
    hreflang: string
}

function buildLocale(countryCode: string, languageCode: string): Locale {
    const country = COUNTRIES[countryCode]
    const language = LANGUAGES[languageCode]
    const segment =
        languageCode === country.defaultLanguage ? country.code : `${country.code}-${language.code}`

    return {
        segment,
        country,
        language,
        hreflang: `${language.bcp47}-${country.code.toUpperCase()}`,
    }
}

/** Every locale served, in URL order. */
export const LOCALES: Locale[] = Object.values(COUNTRIES).flatMap(country =>
    country.languages.map(lang => buildLocale(country.code, lang)),
)

export const LOCALE_SEGMENTS: string[] = LOCALES.map(locale => locale.segment)

export const DEFAULT_LOCALE: Locale = buildLocale(DEFAULT_COUNTRY, DEFAULT_LANGUAGE)

export function isLocaleSegment(value: string | undefined | null): boolean {
    return typeof value === 'string' && LOCALE_SEGMENTS.includes(value)
}

export function getLocale(segment: string | undefined | null): Locale {
    return LOCALES.find(locale => locale.segment === segment) ?? DEFAULT_LOCALE
}

/**
 * Resolve `?country=in&lang=ta` to a locale. Shopify carries these alongside
 * the path segment; accepting them means a link built by an external tool
 * still lands on the right locale instead of silently falling back.
 * Returns null when the pair is not one we serve, so callers can ignore it
 * rather than redirecting somewhere arbitrary.
 */
export function resolveLocaleFromQuery(
    country: string | null | undefined,
    lang: string | null | undefined,
): Locale | null {
    if (!country && !lang) return null

    const countryCode = (country || DEFAULT_COUNTRY).toLowerCase()
    const resolvedCountry = COUNTRIES[countryCode]
    if (!resolvedCountry) return null

    const languageCode = (lang || resolvedCountry.defaultLanguage).toLowerCase()
    if (!resolvedCountry.languages.includes(languageCode)) return null

    return buildLocale(countryCode, languageCode)
}

/**
 * Best locale for an Accept-Language header, constrained to what we serve.
 * Region is ignored — a `ta-LK` reader still wants Tamil, and India is the
 * only country we serve today.
 */
export function matchLocaleFromAcceptLanguage(header: string | null | undefined): Locale | null {
    if (!header) return null

    const ranked = header
        .split(',')
        .map(part => {
            const [tag, q] = part.trim().split(';q=')
            return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 }
        })
        .filter(entry => entry.tag && !Number.isNaN(entry.q))
        .sort((a, b) => b.q - a.q)

    for (const { tag } of ranked) {
        const base = tag.split('-')[0]
        const country = COUNTRIES[DEFAULT_COUNTRY]
        if (country.languages.includes(base)) {
            return buildLocale(country.code, base)
        }
    }

    return null
}

/** The `?country=&lang=` pair for a locale, for outbound/canonical links. */
export function localeQuery(locale: Locale): string {
    return `country=${locale.country.code}&lang=${locale.language.code}`
}

/** Every locale that serves the same country — i.e. the switcher's options. */
export function localesForCountry(countryCode: string): Locale[] {
    return LOCALES.filter(locale => locale.country.code === countryCode)
}
