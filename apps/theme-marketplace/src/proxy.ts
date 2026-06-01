import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core'

const PROTECTED_ROUTES = ['/checkout', '/dashboard', '/install']
const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'

function isProtectedPath(pathname: string) {
    return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (!isProtectedPath(pathname)) {
        return NextResponse.next()
    }

    const session = verifyLetbuyySessionCookieValue(
        'merchant',
        request.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value,
    )

    if (session.accepted) {
        return NextResponse.next()
    }

    const loginUrl = new URL('/lookup', ACCOUNTS_URL)
    loginUrl.searchParams.set('return_to', request.url)
    return NextResponse.redirect(loginUrl)
}

export const config = {
    matcher: [
        '/checkout/:path*',
        '/dashboard/:path*',
        '/install/:path*',
    ],
}
