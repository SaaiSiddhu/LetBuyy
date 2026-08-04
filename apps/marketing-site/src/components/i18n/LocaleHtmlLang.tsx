'use client'

import { useEffect } from 'react'

/**
 * Keeps `<html lang>` and `<html dir>` in step with the active locale.
 *
 * The root layout owns <html> and cannot read the [locale] param, and Next
 * offers no way to set those attributes from a nested segment. Rendering a
 * second <html> is not an option, so this writes the two attributes directly.
 *
 * It matters beyond tidiness: screen readers choose a voice from `lang`, and
 * browsers pick hyphenation and font fallbacks from it. Tamil read aloud by an
 * English synthesiser is unintelligible.
 *
 * The attribute is also emitted server-side by the root layout's default, so
 * this only corrects it — there is no flash of the wrong value for anything a
 * user can perceive, and no layout shift.
 */
export default function LocaleHtmlLang({ lang, dir }: { lang: string; dir: 'ltr' | 'rtl' }) {
    useEffect(() => {
        const root = document.documentElement
        if (root.getAttribute('lang') !== lang) root.setAttribute('lang', lang)
        if (root.getAttribute('dir') !== dir) root.setAttribute('dir', dir)
    }, [lang, dir])

    return null
}
