// Auth hardening follow-up (Section 13): a session gate for Route Handlers (API routes), not Server
// Components. Deliberately does NOT import console-auth-server.ts (marked `server-only`, and it reads
// cookies via next/headers' request-scoped cookies() rather than the request object itself) -- an API
// route already receives its own NextRequest, so it reads the session cookie directly from THAT
// request, exactly like proxy.ts already does. This also makes the gate testable with a plain
// constructed NextRequest, with no Next.js server-rendering context required.
//
// Returns a Response to return immediately (401/403) when unauthorized, or null when the caller may
// proceed -- the same "return a Response or null" shape console-auth-server.ts's own
// assertStaffPermission-style helpers use elsewhere in this repo.

import { NextRequest, NextResponse } from 'next/server';
import { CONSOLE_SESSION_COOKIE, readConsoleSession } from './console-session';
import { isConsoleEmailAllowed } from './console-access-allowlist';
import { readCurrentConsoleSession } from './console-live-session';

export async function requireConsoleApiSession(request: NextRequest, options: { mfa?: boolean } = {}): Promise<NextResponse | null> {
    const session = await readConsoleSession(request.cookies.get(CONSOLE_SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isConsoleEmailAllowed(session.email)) return NextResponse.json({ error: 'Access revoked' }, { status: 403 });
    if (options.mfa && !session.mfaVerified) return NextResponse.json({ error: 'MFA required' }, { status: 401 });
    if (!await readCurrentConsoleSession(request.cookies.get(CONSOLE_SESSION_COOKIE)?.value)) {
        return NextResponse.json({ error: 'Session unavailable or revoked' }, { status: 401 });
    }
    return null;
}
