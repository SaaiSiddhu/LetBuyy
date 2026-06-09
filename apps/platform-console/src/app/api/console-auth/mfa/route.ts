import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    getConsoleSessionFromCookies,
    setConsoleSessionCookie,
    verifyConsoleTotp,
    writeConsoleAuditLog,
} from '@/lib/console-auth-server';

const mfaSchema = z.object({
    code: z.string().trim().regex(/^\d{6}$/),
});

function redirectWithError(request: NextRequest, error: string) {
    return NextResponse.redirect(new URL(`/mfa?error=${encodeURIComponent(error)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
    const session = await getConsoleSessionFromCookies();

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url), 303);
    }

    const formData = await request.formData();
    const parsed = mfaSchema.safeParse({
        code: formData.get('code'),
    });

    if (!parsed.success || !verifyConsoleTotp(parsed.data.code, session.email)) {
        return redirectWithError(request, 'invalid_code');
    }

    const sessionSet = await setConsoleSessionCookie({
        email: session.email,
        userId: session.userId,
        mfaVerified: true,
    });

    if (!sessionSet) {
        return redirectWithError(request, 'session_secret_not_configured');
    }

    await writeConsoleAuditLog({
        action: 'platform_console_mfa_verified',
        email: session.email,
        session: {
            ...session,
            mfaVerified: true,
        },
        requestHeaders: request.headers,
    });

    return NextResponse.redirect(new URL('/dashboard', request.url), 303);
}
