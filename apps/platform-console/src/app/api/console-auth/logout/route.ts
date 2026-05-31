import { NextRequest, NextResponse } from 'next/server';
import {
    clearConsoleSessionCookie,
    createConsoleSupabaseServerClient,
    getConsoleSessionFromCookies,
    hasSupabaseConsoleAuthConfig,
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

    if (hasSupabaseConsoleAuthConfig()) {
        const supabase = await createConsoleSupabaseServerClient();
        await supabase.auth.signOut();
    }

    await clearConsoleSessionCookie();

    return NextResponse.redirect(new URL('/login?loggedOut=1', request.url), 303);
}
