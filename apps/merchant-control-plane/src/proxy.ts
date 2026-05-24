import { NextRequest, NextResponse } from 'next/server'

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
    const sessionCookie = request.cookies.get('lb_session')?.value

    if (
        pathname === '/' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/launching-soon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    if (!sessionCookie) {
        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3001'
        const returnUrl = encodeURIComponent(request.url)

        return NextResponse.redirect(
            `${accountsUrl}/lookup?return_to=${returnUrl}`
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
