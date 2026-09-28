import { NextRequest, NextResponse } from 'next/server';
import {
    isConsoleEmailAllowed,
    normalizeConsoleEmail,
    setConsoleSessionCookie,
    writeConsoleAuditLog,
} from '@/lib/console-auth-server';
import { readConsoleMagicLinkToken } from '@/lib/console-session';
import { fetchConsoleApi } from '@/lib/console-api';

function redirectWithError(request: NextRequest, error: string) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url), 303);
}

async function issueConsoleSession(input: {
    request: NextRequest;
    email: string;
    userId?: string | null;
    auditAction: 'platform_console_login_magic_verified' | 'platform_console_login_local_magic_verified';
}) {
    const email = normalizeConsoleEmail(input.email);

    if (!isConsoleEmailAllowed(email)) {
        return redirectWithError(input.request, 'access_denied');
    }

    const sessionSet = await setConsoleSessionCookie({
        email,
        userId: input.userId || null,
        mfaVerified: false,
    });

    if (!sessionSet) {
        return redirectWithError(input.request, 'session_secret_not_configured');
    }

    await writeConsoleAuditLog({
        action: input.auditAction,
        email,
        session: {
            type: 'platform_session',
            email,
            userId: input.userId || null,
            mfaVerified: false,
            issuedAt: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
        },
        requestHeaders: input.request.headers,
    });

    return NextResponse.redirect(new URL('/mfa', input.request.url), 303);
}

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
        return redirectWithError(request, 'missing_token');
    }

    const payload = await readConsoleMagicLinkToken(token);
    if (!payload) {
        return redirectWithError(request, 'invalid_magic_link');
    }

    // Phase 2 / Mandate 7, Section 6: atomic single-use consumption, BEFORE any session is issued.
    // A token whose signature and expiry already verified above is still refused here if its jti has
    // already been recorded as consumed (a replay) or if consumption itself could not be durably
    // recorded (a storage failure) -- either way, issueConsoleSession is never reached, so a replayed
    // or unconsumable token can never become a session, let alone a reusable MFA challenge.
    const consumption = await fetchConsoleApi('/internal/console/magic-link/consume', {
        method: 'POST',
        body: {
            jti: payload.jti,
            email: payload.email,
            expires_at: new Date(payload.exp * 1000).toISOString(),
        },
    });
    if (consumption.error) {
        return redirectWithError(request, 'invalid_magic_link');
    }

    return issueConsoleSession({
        request,
        email: payload.email,
        auditAction: 'platform_console_login_local_magic_verified',
    });
}
