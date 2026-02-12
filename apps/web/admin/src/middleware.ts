import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin middleware:
 * - Checks for lb_session cookie on all /[store]/* routes
 * - Redirects to accounts app login if no session
 *
 * Session validation (checking token against DB) happens at the page level
 * via getSessionUser(), since middleware can't make async Supabase calls
 * with the service role key reliably in edge runtime.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionCookie = request.cookies.get('lb_session')?.value

    // Skip for static assets, API routes, root page, and public pages
    if (
        pathname === '/' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/launching-soon') ||
        pathname.includes('.') // static files
    ) {
        return NextResponse.next()
    }

    // All /[store]/* routes require an lb_session cookie
    if (!sessionCookie) {
        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'

        // Build return URL for redirect back after login
        const returnUrl = encodeURIComponent(request.url)
        return NextResponse.redirect(
            `${accountsUrl}/lookup?return_to=${returnUrl}`
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimisation)
         * - favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
