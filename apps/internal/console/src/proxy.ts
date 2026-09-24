import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';
import { CONSOLE_SESSION_COOKIE, readConsoleSession } from './lib/console-session';

const protectedPrefixes = [
    '/dashboard',
    '/operations',
    '/users',
    '/stores',
    '/revenue',
    '/subscriptions',
    '/marketplace-governance',
    // F-ADM4-1: the listing moderation queue (CAP-ADM-2) was added without joining this list. The page and
    // its server actions call requireConsoleSession themselves; this restores the second layer.
    '/marketplace-listings',
    '/trust-safety',
    '/employees',
    '/analytics',
    '/settings',
    '/audit-logs',
];

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com'] as const;
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com';

function isProtectedPath(pathname: string) {
    return pathname === '/' || protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getKnownPlatformRoot(hostname: string): string | null {
    const normalized = hostname.toLowerCase().replace(/^www\./, '');
    return PLATFORM_ROOT_DOMAINS.find((root) => normalized === root || normalized.endsWith(`.${root}`)) ?? null;
}

function getConfiguredPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    );
}

function getAccountsUrl(requestUrl: string): string {
    const configured = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');

    const requestOrigin = new URL(requestUrl);
    const platformRoot = getKnownPlatformRoot(requestOrigin.hostname) || getConfiguredPlatformRootDomain();
    return `${requestOrigin.protocol}//accounts.${platformRoot}`;
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const session = await readConsoleSession(request.cookies.get(CONSOLE_SESSION_COOKIE)?.value);
    const merchantSession = verifyLetbuyySessionCookieValue(
        'merchant',
        request.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value,
    );

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
        if (!merchantSession.accepted) {
            const loginUrl = new URL('/lookup', getAccountsUrl(request.url));
            loginUrl.searchParams.set('return_to', request.url);
            return NextResponse.redirect(loginUrl);
        }

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
        '/revenue/:path*',
        '/subscriptions/:path*',
        '/marketplace-governance/:path*',
        '/marketplace-listings/:path*',
        '/trust-safety/:path*',
        '/employees/:path*',
        '/analytics/:path*',
        '/settings/:path*',
        '/audit-logs/:path*',
    ],
};
