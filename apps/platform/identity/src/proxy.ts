import { NextRequest, NextResponse } from 'next/server'
import { getAdminUrl } from '@/lib/config/urls'
import { resolveLetbuyyPlatformCookieNames, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core'

const PUBLIC_ROUTES = ['/check-email', '/api/']
const ACCIDENTAL_ADMIN_PATH = /^\/[^/]+\/(?:dashboard|analytics|products|orders|customers|settings|appearance|online-store)(?:\/|$)/

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const names = resolveLetbuyyPlatformCookieNames(process.env.NEXT_PUBLIC_ENV)
    const sessionToken = request.cookies.get(names.session)?.value
    const session = verifyLetbuyySessionCookieValue('merchant', sessionToken)
    const hasSessionCookie = Boolean(sessionToken)

    if (pathname === '/') {
        if (session.accepted || hasSessionCookie) {
            return NextResponse.redirect(new URL('/select', request.url))
        }

        return NextResponse.redirect(new URL('/lookup', request.url))
    }

    if (ACCIDENTAL_ADMIN_PATH.test(pathname)) {
        const redirectUrl = new URL(pathname + request.nextUrl.search, getAdminUrl())
        return NextResponse.redirect(redirectUrl)
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/icons/') || pathname.startsWith('/.well-known/')) {
        return NextResponse.next()
    }

    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    // This route renders a data-free password form. Its API still requires
    // CSRF and a fresh server-validated, single-use verification intent.
    const response = NextResponse.next()
    const existingCsrf = request.cookies.get(names.csrf)?.value || request.cookies.get(names.legacyCsrf)?.value

    if (!existingCsrf) {
        const array = new Uint8Array(32)
        crypto.getRandomValues(array)
        const csrfToken = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

        response.cookies.set(names.csrf, csrfToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60,
        })
    }

    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (pathname.startsWith('/mobile') || pathname.startsWith('/merchant/auth/callback')) {
        response.headers.set('Cache-Control', 'private, no-store')
        response.headers.set('Referrer-Policy', 'no-referrer')
        response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|icons/).*)',
    ],
}
