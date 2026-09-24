import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core'
import { getAccountsUrl } from '@/lib/site-url'

const PROTECTED_ROUTES = ['/my-apps', '/developers/register', '/developers/dashboard', '/developers/apps']
const PROTECTED_API_ROUTES = ['/api/developers']
const ACCOUNTS_URL = getAccountsUrl()

function isProtectedApiRoute(pathname: string) {
    return PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route))
        || /^\/api\/apps\/[^/]+\/install$/.test(pathname)
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const session = verifyLetbuyySessionCookieValue(
        'merchant',
        request.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value
    )

    const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
    if (isProtected && !session.accepted) {
        const loginUrl = new URL('/lookup', ACCOUNTS_URL)
        loginUrl.searchParams.set('return_to', request.url)
        return NextResponse.redirect(loginUrl)
    }

    const isProtectedApi = isProtectedApiRoute(pathname)
    if (isProtectedApi && !session.accepted) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
