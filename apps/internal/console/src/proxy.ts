import { NextRequest, NextResponse } from 'next/server';
import { CONSOLE_SESSION_COOKIE, readConsoleSession } from './lib/console-session';
import { isConsoleEmailAllowed } from './lib/console-access-allowlist';
import { readCurrentConsoleSession } from './lib/console-live-session';

const protectedPrefixes = [
    '/dashboard',
    '/merchants',
    '/support',
    '/merchant-messages',
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
    '/approvals',
    '/money-reconciliation',
];

function isProtectedPath(pathname: string) {
    return pathname === '/' || protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Phase 2 auth hardening (Section 6): the session JWT's signature and `exp` are self-contained and
// say nothing about whether this email is STILL on the allowlist right now. Without this re-check, an
// operator removed from PLATFORM_CONSOLE_ALLOWED_EMAILS keeps full console access with their existing
// cookie until it naturally expires (CONSOLE_SESSION_MAX_AGE_SECONDS = 8 hours) -- this is the
// confirmed defect this mandate names. isConsoleEmailAllowed reads the CURRENT env value on every
// call, so revocation takes effect on the very next request after redeploy, regardless of how old the
// session cookie is. This function clears the cookie on the way out so the browser stops resending a
// dead credential; the check itself does not depend on that cleanup succeeding.
function redirectRevoked(request: NextRequest, destination: string) {
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete(CONSOLE_SESSION_COOKIE);
    return response;
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const value = request.cookies.get(CONSOLE_SESSION_COOKIE)?.value;
    const signedSession = await readConsoleSession(value);
    const sessionRevoked = signedSession !== null && !isConsoleEmailAllowed(signedSession.email);
    const session = signedSession && !sessionRevoked ? await readCurrentConsoleSession(value) : signedSession;
    if (pathname === '/login') {
        if (session?.mfaVerified && !sessionRevoked) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        return NextResponse.next();
    }

    if (signedSession && !session && (pathname === '/mfa' || isProtectedPath(pathname))) {
        // Storage unavailability is not durable logout. Keep the signed cookie
        // for retry; every protected request remains denied by the live check.
        return NextResponse.redirect(new URL('/login?error=session_unavailable', request.url));
    }

    if (pathname === '/mfa') {
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (sessionRevoked) {
            return redirectRevoked(request, '/login?error=access_revoked');
        }

        if (session.mfaVerified && request.nextUrl.searchParams.get('step_up') !== '1') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        return NextResponse.next();
    }

    if (!isProtectedPath(pathname)) {
        return NextResponse.next();
    }

    if (!session) {
        // The existing Console entry uses Identity's operator realm. Generic
        // account lookup starts the merchant flow and cannot admit an operator.
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (sessionRevoked) {
        return redirectRevoked(request, '/login?error=access_revoked');
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
        '/merchants/:path*',
        '/support/:path*',
        '/merchant-messages/:path*',
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
        '/approvals/:path*',
        '/money-reconciliation/:path*',
    ],
};
