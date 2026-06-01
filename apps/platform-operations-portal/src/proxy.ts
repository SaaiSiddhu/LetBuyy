import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';

const protectedPrefixes = [
    '/',
    '/marketing',
    '/operations',
    '/stores',
    '/support',
    '/users',
];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const session = verifyLetbuyySessionCookieValue(
        'merchant',
        request.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value,
    );

    if (pathname === '/login' || pathname.startsWith('/invite')) {
        if (session.accepted) {
            return NextResponse.redirect(new URL('/operations', request.url));
        }

        return NextResponse.next();
    }

    if (!isProtectedPath(pathname) || session.accepted) {
        return NextResponse.next();
    }

    const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store';
    const loginUrl = new URL('/lookup', accountsUrl);
    loginUrl.searchParams.set('return_to', request.url);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        '/',
        '/login',
        '/invite/:path*',
        '/marketing/:path*',
        '/operations/:path*',
        '/stores/:path*',
        '/support/:path*',
        '/users/:path*',
    ],
};
