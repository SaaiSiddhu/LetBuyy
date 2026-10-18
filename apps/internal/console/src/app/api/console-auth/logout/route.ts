import { NextRequest, NextResponse } from 'next/server';
import {
    clearConsoleSessionCookie,
    getConsoleSessionFromCookies,
    writeConsoleAuditLog,
} from '@/lib/console-auth-server';

export async function POST(request: NextRequest) {
    const session = await getConsoleSessionFromCookies();

    if (session) {
        await writeConsoleAuditLog({
            action: 'platform_console_logout',
            email: session.email,
            session,
            requestHeaders: request.headers,
        });
    }

    if (!await clearConsoleSessionCookie()) {
        return NextResponse.redirect(new URL('/login?error=logout_unavailable', request.url), 303);
    }

    return NextResponse.redirect(new URL('/login?loggedOut=1', request.url), 303);
}
