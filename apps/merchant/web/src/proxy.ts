import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core'
import { getMerchantSignInUrl, MERCHANT_RETURN_PATH_HEADER } from '@/lib/public-urls'

/**
 * Admin proxy:
 * - Checks for lb_session cookie on all /[store]/* routes
 * - Redirects to accounts app login if no session
 *
 * Session validation happens at the page/service boundary through
 * getSessionUser(); the proxy only handles fast path routing.
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionCookie = request.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value
    const session = verifyLetbuyySessionCookieValue('merchant', sessionCookie)

    if (
        pathname === '/' ||
        pathname === '/accept-invite' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/launching-soon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    if (!session.accepted) {
        return NextResponse.redirect(getMerchantSignInUrl(pathname + request.nextUrl.search))
    }

    // Overwrite caller input. The server layout needs this same path when a
    // well-formed cookie is later refused by the authoritative session read.
    const forwarded = new Headers(request.headers)
    forwarded.set(MERCHANT_RETURN_PATH_HEADER, pathname + request.nextUrl.search)
    return NextResponse.next({ request: { headers: forwarded } })
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
