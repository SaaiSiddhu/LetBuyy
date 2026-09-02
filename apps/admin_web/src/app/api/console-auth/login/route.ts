import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    isConsoleEmailAllowed,
    normalizeConsoleEmail,
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
    if (!isConsoleEmailAllowed(email)) {
        return redirectWithError(request, 'access_denied');
    }

    if (process.env.NODE_ENV === 'production') {
        return redirectWithError(request, 'magic_link_delivery_not_configured');
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
