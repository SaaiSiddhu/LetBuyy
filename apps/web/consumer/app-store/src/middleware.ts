import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected route prefixes (require authentication)
const PROTECTED_ROUTES = ['/my-apps', '/developers/register', '/developers/dashboard', '/developers/apps'];

// API routes that require auth
const PROTECTED_API_ROUTES = ['/api/apps/install', '/api/developers'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check for SSO session cookie (from accounts.letbuyy.store)
    const session = request.cookies.get('lb_session')?.value;

    // Protected page routes — redirect to login
    const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtected && !session) {
        const loginUrl = new URL('https://accounts.letbuyy.store/login');
        loginUrl.searchParams.set('redirect', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Protected API routes — return 401
    const isProtectedApi = PROTECTED_API_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedApi && !session) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    // Pass the session info along via headers
    const response = NextResponse.next();
    if (session) {
        response.headers.set('x-lb-session', session);
    }

    return response;
}

export const config = {
    matcher: [
        // Match all routes except static assets
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
