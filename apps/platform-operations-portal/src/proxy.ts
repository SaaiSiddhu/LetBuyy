import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';

const protectedPrefixes = [
    '/',
    '/crm',
    '/tickets',
    '/merchant-health',
    '/retention',
    '/campaigns',
    '/communications',
    '/onboarding',
    '/marketing',
    '/operations',
    '/stores',
    '/support',
    '/users',
];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getAccountsUrl(): string {
    const configured = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.trim();
    if (!configured) {
        throw new Error('NEXT_PUBLIC_ACCOUNTS_URL is not configured; refusing to use a hardcoded accounts host');
    }
    return configured.replace(/\/+$/, '');
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

    const loginUrl = new URL('/lookup', getAccountsUrl());
    loginUrl.searchParams.set('return_to', request.url);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        '/',
        '/crm/:path*',
        '/tickets/:path*',
        '/merchant-health/:path*',
        '/retention/:path*',
        '/campaigns/:path*',
        '/communications/:path*',
        '/onboarding/:path*',
        '/login',
        '/invite/:path*',
        '/marketing/:path*',
        '/operations/:path*',
        '/stores/:path*',
        '/support/:path*',
        '/users/:path*',
    ],
};
