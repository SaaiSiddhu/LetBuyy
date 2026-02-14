import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/onboarding', '/set-password']

// Routes only for unauthenticated users
const AUTH_ROUTES = ['/lookup', '/signup', '/forgot-password', '/reset-password']

// Public routes (no auth check)
const PUBLIC_ROUTES = ['/check-email', '/api/']

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionToken = request.cookies.get('lb_session')?.value

    // Redirect /login → /lookup (deleted page)
    if (pathname === '/login') {
        return NextResponse.redirect(new URL('/lookup', request.url))
    }

    // Root path redirect
    if (pathname === '/') {
        if (sessionToken) {
            return NextResponse.redirect(new URL(process.env.NEXT_PUBLIC_ADMIN_URL || '/onboarding', request.url))
        }
        return NextResponse.redirect(new URL('/lookup', request.url))
    }

    // Skip middleware for API routes and static files
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/icons/')) {
        return NextResponse.next()
    }

    // Skip for public routes
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    // Protected routes: require session
    if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
        if (!sessionToken) {
            const url = new URL('/lookup', request.url)
            url.searchParams.set('redirect', pathname)
            return NextResponse.redirect(url)
        }
    }

    // Auth routes: redirect to admin if already logged in
    if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
        if (sessionToken) {
            // User is already logged in — redirect to admin
            return NextResponse.redirect(new URL(process.env.NEXT_PUBLIC_ADMIN_URL || '/onboarding', request.url))
        }
    }

    // Set CSRF token cookie on every response (using Edge-compatible approach)
    const response = NextResponse.next()
    const existingCsrf = request.cookies.get('lb_csrf')?.value

    if (!existingCsrf) {
        // Generate a random CSRF token (Edge-compatible)
        const array = new Uint8Array(32)
        crypto.getRandomValues(array)
        const csrfToken = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

        response.cookies.set('lb_csrf', csrfToken, {
            httpOnly: false, // Client JS must read this to send in X-CSRF-Token header
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60, // 1 hour
        })
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico (favicon)
         * - public files (icons, images)
         */
        '/((?!_next/static|_next/image|favicon.ico|icons/).*)',
    ],
}
