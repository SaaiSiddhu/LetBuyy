import {
    DEFAULT_LOCALE,
    LOCALE_SEGMENTS,
    getLocale,
    isLocaleSegment,
    type Locale,
} from './locales'

/**
 * URL shape helpers.
 *
 * Every internal link goes through `localePath` so a reader never falls out of
 * their language by clicking. The one rule: paths stored in content (nav data,
 * footer columns, legal cross-references) stay locale-free, and the locale is
 * applied at render. Storing `/in-ta/pricing` in a data file would need every
 * table duplicated per language.
 */

/** Strip a leading locale segment. `/in-ta/pricing` → `/pricing`. */
export function stripLocale(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean)
    if (isLocaleSegment(segments[0])) segments.shift()
    return `/${segments.join('/')}`
}

/** Read the locale out of a pathname, falling back to the default. */
export function localeFromPathname(pathname: string): Locale {
    const [first] = pathname.split('/').filter(Boolean)
    return getLocale(first)
}

/**
 * Prefix a path with a locale. Accepts already-prefixed paths so callers can
 * pass through values of unknown provenance without double-prefixing.
 */
export function localePath(locale: Locale, path = '/'): string {
    // Anything absolute or non-http scheme belongs to another property.
    if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('mailto:') || path.startsWith('tel:')) {
        return path
    }

    // Fragments and query-only links stay relative to the current page.
    if (path.startsWith('#') || path.startsWith('?')) return path

    const bare = stripLocale(path.startsWith('/') ? path : `/${path}`)
    return bare === '/' ? `/${locale.segment}` : `/${locale.segment}${bare}`
}

/** True when a path points inside this app (so it should carry the locale). */
export function isInternalPath(path: string): boolean {
    if (!path) return false
    if (path.startsWith('#') || path.startsWith('?')) return false
    if (path.startsWith('mailto:') || path.startsWith('tel:')) return false
    return path.startsWith('/')
}

/**
 * Alternates for a page, keyed by hreflang, plus x-default.
 *
 * x-default points at the country's default language rather than at an
 * unprefixed URL: there is no unprefixed page — `/` redirects — so pointing
 * there would advertise a URL that answers 308.
 */
export function buildAlternates(
    siteUrl: string,
    path: string,
    locales: readonly Locale[],
): { canonicalOf: (locale: Locale) => string; languages: Record<string, string> } {
    const bare = stripLocale(path)
    const languages: Record<string, string> = {}

    for (const locale of locales) {
        languages[locale.hreflang] = `${siteUrl}${localePath(locale, bare)}`
    }
    languages['x-default'] = `${siteUrl}${localePath(DEFAULT_LOCALE, bare)}`

    return {
        canonicalOf: (locale: Locale) => `${siteUrl}${localePath(locale, bare)}`,
        languages,
    }
}

/** Paths middleware must never rewrite. */
export const LOCALE_EXEMPT_PREFIXES = [
    '/_next',
    '/api',
    '/icons',
    '/og',
    '/assets',
    '/previews',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
]

export function isLocaleExempt(pathname: string): boolean {
    if (LOCALE_EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true
    // Any file request — the marketing site serves several static assets from
    // the public root, and a dotted last segment is the reliable tell.
    const last = pathname.split('/').pop() ?? ''
    return last.includes('.')
}

export { LOCALE_SEGMENTS }
