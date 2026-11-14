'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Check, ChevronDown, Globe, X } from '@letbuyy/ui'
import {
    LANGUAGES,
    localesForCountry,
    type Locale,
} from '@/lib/i18n/locales'
import { localeFromPathname, switchLocaleHref } from '@/lib/i18n/routing'
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
    const panelId = useId()

    function close() { setOpen(false); ref.current?.querySelector<HTMLButtonElement>('.footer-region-button')?.focus({ preventScroll: true }) }

    useEffect(() => {
        if (!open) return
        ref.current?.querySelector<HTMLButtonElement>('.lang-switch-option[aria-current="true"]')?.focus({ preventScroll: true })
        const onPointerDown = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); ref.current?.querySelector<HTMLButtonElement>('.footer-region-button')?.focus({ preventScroll: true }) }
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
        close()
        // Same page, different locale — never a reset to the home page.
        router.push(switchLocaleHref(next, pathname, window.location.search, window.location.hash))
    }

    const options = localesForCountry(current.country.code)

    return (
        <div className="lang-switch" ref={ref} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
            <Button
                unstyled
                type="button"
                className="footer-region-button"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen(value => !value)}
            >
                <Globe width={19} height={19} aria-hidden="true" />
                <span>{dict.legal.india}</span>{' '}
                <span className="footer-region-divider" aria-hidden="true" />
                {' '}<span>{current.language.label}</span>
                <ChevronDown width={18} height={18} aria-hidden="true" />
            </Button>

            {open && (
                <div id={panelId} className="lang-switch-panel" role="dialog" aria-label={dict.languageSwitcher.title}>
                    <div className="lang-switch-head"><span><Globe size={15} aria-hidden="true" />{dict.legal.india}</span><Button unstyled type="button" onClick={close} aria-label={dict.languageSwitcher.close}><X size={16} aria-hidden="true" /></Button></div>
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
