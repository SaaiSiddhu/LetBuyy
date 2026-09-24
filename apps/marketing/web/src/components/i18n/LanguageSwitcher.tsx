'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Check, ChevronDown, Globe } from '@letbuyy/ui'
import {
    COUNTRIES,
    LANGUAGES,
    localesForCountry,
    type Locale,
} from '@/lib/i18n/locales'
import { localeFromPathname, localePath, stripLocale } from '@/lib/i18n/routing'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

/**
 * Region and language picker.
 *
 * Switching keeps you on the same page — it rewrites only the locale segment,
 * so a reader on /in/legal/refunds lands on /in-ta/legal/refunds rather than
 * being dumped at the home page, which is the usual failure of these controls.
 *
 * The choice is persisted here, and only here. Middleware never writes the
 * cookie from a detected language, so what is stored is always something the
 * reader actually picked.
 */
const LOCALE_COOKIE = 'letbuyy_locale'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/* Module scope rather than inline: writing document.cookie from inside a
   component body trips react-hooks/immutability, and the write is not
   component state anyway — it is a side effect on the document. */
function persistLocale(segment: string): void {
    document.cookie = `${LOCALE_COOKIE}=${segment};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`
}

export default function LanguageSwitcher({ dict }: { dict: Dictionary }) {
    const pathname = usePathname()
    const router = useRouter()
    const current = localeFromPathname(pathname)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    function choose(next: Locale) {
        persistLocale(next.segment)
        setOpen(false)
        // Same page, different locale — never a reset to the home page.
        router.push(localePath(next, stripLocale(pathname)))
    }

    const options = localesForCountry(current.country.code)
    const countries = Object.values(COUNTRIES)

    return (
        <div className="lang-switch" ref={ref}>
            <Button
                unstyled
                type="button"
                className="footer-region-button"
                aria-label={dict.languageSwitcher.title}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen(value => !value)}
            >
                <Globe width={19} height={19} aria-hidden="true" />
                <span>{current.country.label}</span>
                <span className="footer-region-divider" aria-hidden="true" />
                <span>{current.language.label}</span>
                <ChevronDown width={18} height={18} aria-hidden="true" />
            </Button>

            {open && (
                <div className="lang-switch-panel" role="dialog" aria-label={dict.languageSwitcher.title}>
                    <section className="lang-switch-group">
                        <p className="lang-switch-label">{dict.languageSwitcher.country}</p>
                        <ul className="lang-switch-list">
                            {countries.map(country => (
                                <li key={country.code}>
                                    {/* One country today. It is rendered as a real
                                        list rather than a hardcoded line so adding
                                        the second needs no markup change. */}
                                    <span
                                        className={`lang-switch-option${
                                            country.code === current.country.code ? ' is-active' : ''
                                        }`}
                                        aria-current={country.code === current.country.code}
                                    >
                                        <span>{country.label}</span>
                                        {country.code === current.country.code && (
                                            <Check width={15} height={15} aria-hidden="true" />
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {countries.length === 1 && (
                            <p className="lang-switch-note">{dict.languageSwitcher.moreCountriesSoon}</p>
                        )}
                    </section>

                    <section className="lang-switch-group">
                        <p className="lang-switch-label">{dict.languageSwitcher.language}</p>
                        <ul className="lang-switch-list">
                            {options.map(option => {
                                const isActive = option.segment === current.segment
                                return (
                                    <li key={option.segment}>
                                        <Button
                                            unstyled
                                            type="button"
                                            className={`lang-switch-option is-button${isActive ? ' is-active' : ''}`}
                                            aria-current={isActive}
                                            onClick={() => choose(option)}
                                            /* The English name is what a
                                               non-reader of the script needs
                                               announced. */
                                            aria-label={LANGUAGES[option.language.code].englishLabel}
                                            lang={option.language.bcp47}
                                        >
                                            <span>{option.language.label}</span>
                                            {isActive && <Check width={15} height={15} aria-hidden="true" />}
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                </div>
            )}
        </div>
    )
}
