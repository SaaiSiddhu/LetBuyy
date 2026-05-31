import { NextRequest, NextResponse } from 'next/server';
import { CONSOLE_SESSION_COOKIE, readConsoleSession } from './lib/console-session';

const protectedPrefixes = [
    '/dashboard',
    '/operations',
    '/users',
    '/stores',
    '/subscriptions',
    '/employees',
    '/analytics',
    '/settings',
    '/audit-logs',
];

function isProtectedPath(pathname: string) {
    return pathname === '/' || protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const session = await readConsoleSession(request.cookies.get(CONSOLE_SESSION_COOKIE)?.value);

    if (pathname === '/login') {
        if (session?.mfaVerified) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        return NextResponse.next();
    }

    if (pathname === '/mfa') {
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (session.mfaVerified) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        return NextResponse.next();
    }

    if (!isProtectedPath(pathname)) {
        return NextResponse.next();
    }

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!session.mfaVerified) {
        return NextResponse.redirect(new URL('/mfa', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/login',
        '/mfa',
        '/dashboard/:path*',
        '/operations/:path*',
        '/users/:path*',
        '/stores/:path*',
        '/subscriptions/:path*',
        '/employees/:path*',
        '/analytics/:path*',
        '/settings/:path*',
        '/audit-logs/:path*',
    ],
};
