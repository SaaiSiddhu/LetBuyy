import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    isConsoleEmailAllowed,
    normalizeConsoleEmail,
    resolveConsoleLoginOutcome,
    writeConsoleAuditLog,
} from '@/lib/console-auth-server';
import { createConsoleMagicLinkToken } from '@/lib/console-session';

const loginSchema = z.object({
    email: z.string().email(),
});

function redirectWithError(request: NextRequest, error: string) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const parsed = loginSchema.safeParse({
        email: formData.get('email'),
    });

    if (!parsed.success) {
        return redirectWithError(request, 'invalid_email');
    }

    const email = normalizeConsoleEmail(parsed.data.email);

    // Mandate 6 / D04 finding: resolveConsoleLoginOutcome (console-mfa.ts) checks production status
    // BEFORE allowlist membership so every production response is identical regardless of whether
    // the submitted email is a real operator account -- see its own comment for why the order
    // matters (an enumeration path, not just a stylistic choice).
    const outcome = resolveConsoleLoginOutcome({
        isProduction: process.env.NODE_ENV === 'production',
        isAllowed: isConsoleEmailAllowed(email),
    });
    if (outcome.kind === 'magic_link_delivery_not_configured' || outcome.kind === 'access_denied') {
        return redirectWithError(request, outcome.kind);
    }

    const token = await createConsoleMagicLinkToken(email);
    if (!token) {
        return redirectWithError(request, 'session_secret_not_configured');
    }

    await writeConsoleAuditLog({
        action: 'platform_console_login_magic_sent',
        email,
        requestHeaders: request.headers,
    });

    const devMagicLink = new URL('/api/console-auth/callback', request.url);
    devMagicLink.searchParams.set('token', token);

    return NextResponse.redirect(
        new URL(`/login?sent=1&devMagicLink=${encodeURIComponent(devMagicLink.pathname + devMagicLink.search)}`, request.url),
        303,
    );
}
