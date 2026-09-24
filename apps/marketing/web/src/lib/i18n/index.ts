import { en, type Dictionary } from './dictionaries/en'
import { ta } from './dictionaries/ta'
import { hi } from './dictionaries/hi'
import { DEFAULT_LOCALE, getLocale, type Locale } from './locales'

/**
 * Dictionaries are plain objects imported statically rather than loaded with
 * `import()`. The whole set is a few KB, all pages are static, and a dynamic
 * import here would push every page that reads copy into a Promise for no
 * benefit.
 */
const DICTIONARIES: Record<string, Dictionary> = { en, ta, hi }

export function getDictionary(locale: Locale): Dictionary {
    return DICTIONARIES[locale.language.code] ?? en
}

/** Convenience for server components that only have the URL segment. */
export function getDictionaryForSegment(segment: string | undefined): Dictionary {
    return getDictionary(getLocale(segment))
}

export { DEFAULT_LOCALE, getLocale }
export type { Dictionary }
export * from './locales'
export * from './routing'
