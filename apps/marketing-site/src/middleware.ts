import { NextResponse, type NextRequest } from 'next/server'
import {
    DEFAULT_LOCALE,
    getLocale,
    isLocaleSegment,
    matchLocaleFromAcceptLanguage,
    resolveLocaleFromQuery,
    type Locale,
} from '@/lib/i18n/locales'
import { isLocaleExempt } from '@/lib/i18n/routing'

/**
 * Locale routing.
 *
 * Every page lives under a locale segment, so a request without one has to be
 * sent somewhere. Order of precedence, strongest signal first:
 *
 *   1. an explicit ?country=&lang= pair  — someone asked for this exact locale
 *   2. the saved cookie                  — this reader already chose
 *   3. Accept-Language                   — the browser's stated preference
 *   4. the default locale                — India, English
 *
 * The cookie is written only when the reader picks a language themselves (see
 * the switcher), never from a guess, so a detected language never hardens into
 * a stored preference the reader did not make.
 */

const LOCALE_COOKIE = 'letbuyy_locale'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function localeFromCookie(request: NextRequest): Locale | null {
    const value = request.cookies.get(LOCALE_COOKIE)?.value
    if (!value || !isLocaleSegment(value)) return null
    return getLocale(value)
}

export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl

    if (isLocaleExempt(pathname)) return NextResponse.next()

    const [firstSegment] = pathname.split('/').filter(Boolean)
    const queryLocale = resolveLocaleFromQuery(
        searchParams.get('country'),
        searchParams.get('lang'),
    )

    // ── Already on a locale path ────────────────────────────────────────────
    if (isLocaleSegment(firstSegment)) {
        const current = getLocale(firstSegment)

        /* An explicit query pair that disagrees with the path wins — it is the
           more deliberate signal, and leaving them disagreeing would serve one
           language at a URL that claims another. */
        if (queryLocale && queryLocale.segment !== current.segment) {
            const url = request.nextUrl.clone()
            url.pathname = pathname.replace(`/${current.segment}`, `/${queryLocale.segment}`)
            const redirect = NextResponse.redirect(url)
            redirect.cookies.set(LOCALE_COOKIE, queryLocale.segment, {
                maxAge: COOKIE_MAX_AGE,
                sameSite: 'lax',
                path: '/',
            })
            return redirect
        }

        return NextResponse.next()
    }

    // ── No locale in the path — pick one and redirect ───────────────────────
    const target =
        queryLocale ??
        localeFromCookie(request) ??
        matchLocaleFromAcceptLanguage(request.headers.get('accept-language')) ??
        DEFAULT_LOCALE

    const url = request.nextUrl.clone()
    url.pathname = `/${target.segment}${pathname === '/' ? '' : pathname}`

    const response = NextResponse.redirect(url)
    /* Only persist when the reader asked for it explicitly. A cookie written
       from Accept-Language would make a one-off guess permanent. */
    if (queryLocale) {
        response.cookies.set(LOCALE_COOKIE, queryLocale.segment, {
            maxAge: COOKIE_MAX_AGE,
            sameSite: 'lax',
            path: '/',
        })
    }
    return response
}

export const config = {
    /* Exclusions are duplicated from isLocaleExempt because matcher patterns
       are compiled at build time and cannot call into app code. isLocaleExempt
       remains the runtime authority; this is the cheap first pass. */
    matcher: ['/((?!_next|api|icons|og|assets|previews|.*\\.).*)'],
}
