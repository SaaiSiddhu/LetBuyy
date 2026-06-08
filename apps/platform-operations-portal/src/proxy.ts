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

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com', 'letbuyy.store'] as const;
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com';

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

    const loginUrl = new URL('/lookup', getAccountsUrl(request.url));
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
