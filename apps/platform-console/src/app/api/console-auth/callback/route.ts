import { NextRequest, NextResponse } from 'next/server';
import {
    createConsoleSupabaseServerClient,
    isConsoleEmailAllowed,
    normalizeConsoleEmail,
    setConsoleSessionCookie,
    writeConsoleAuditLog,
} from '@/lib/console-auth-server';
import { readConsoleMagicLinkToken } from '@/lib/console-session';

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
            type: 'console_session',
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
    const code = request.nextUrl.searchParams.get('code');

    if (token) {
        const payload = await readConsoleMagicLinkToken(token);
        if (!payload) {
            return redirectWithError(request, 'invalid_magic_link');
        }

        return issueConsoleSession({
            request,
            email: payload.email,
            auditAction: 'platform_console_login_local_magic_verified',
        });
    }

    if (!code) {
        return redirectWithError(request, 'missing_code');
    }

    const supabase = await createConsoleSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const email = data.user?.email;

    if (error || !email) {
        return redirectWithError(request, 'callback_failed');
    }

    return issueConsoleSession({
        request,
        email,
        userId: data.user?.id || null,
        auditAction: 'platform_console_login_magic_verified',
    });
}
