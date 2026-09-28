import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchConsoleApi, type ConsoleDataResponse } from './console-api';
import {
    CONSOLE_SESSION_COOKIE,
    CONSOLE_SESSION_MAX_AGE_SECONDS,
    createConsoleSessionCookieValue,
    readConsoleSession,
    type ConsoleSession,
} from './console-session';

// The allowlist and TOTP/MFA logic (including the SUSTAINED-E rate-limit/replay/timing-safety
// hardening) lives in console-mfa.ts, which has no `server-only`/Next.js import so it can be
// exercised by a plain `node --test` run. Re-exported here so every existing caller of this
// module is unaffected.
export {
    normalizeConsoleEmail,
    getAllowedConsoleEmails,
    isConsoleEmailAllowed,
    getConsoleTotpSecretForPrincipal,
    verifyConsoleTotp,
    resetConsoleMfaGuardStateForTests,
    resolveConsoleLoginOutcome,
    type MfaVerificationResult,
    type ConsoleLoginOutcome,
} from './console-mfa';
import { normalizeConsoleEmail, isConsoleEmailAllowed } from './console-mfa';

type ConsoleAuditAction =
    | 'platform_console_login_magic_sent'
    | 'platform_console_login_magic_verified'
    | 'platform_console_login_local_magic_verified'
    | 'platform_console_mfa_verified'
    | 'platform_console_logout';

function configured(value: string | undefined): value is string {
    if (!value) return false;
    if (value.includes('replace-with')) return false;
    if (value.startsWith('dev-only-placeholder')) return false;
    return true;
}

export async function getConsoleSessionFromCookies() {
    const cookieStore = await cookies();
    return readConsoleSession(cookieStore.get(CONSOLE_SESSION_COOKIE)?.value);
}

export async function setConsoleSessionCookie(input: {
    email: string;
    userId?: string | null;
    mfaVerified: boolean;
}) {
    const cookieValue = await createConsoleSessionCookieValue(input);
    if (!cookieValue) return false;

    const cookieStore = await cookies();
    cookieStore.set(CONSOLE_SESSION_COOKIE, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: CONSOLE_SESSION_MAX_AGE_SECONDS,
    });

    return true;
}

export async function clearConsoleSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.set(CONSOLE_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    });
}

export async function requireConsoleSession(options: { mfa?: boolean } = {}) {
    const session = await getConsoleSessionFromCookies();

    if (!session) {
        redirect('/login');
    }

    // Phase 2 auth hardening (Section 6), second layer: proxy.ts (this app's middleware) already
    // re-checks the allowlist per request, but a server component/action must not rely solely on
    // middleware having run -- see F-ADM4-1's comment in proxy.ts for why this app deliberately keeps
    // both layers. Same fresh, per-request check, same fail-closed default (an empty allowlist denies
    // everyone) as isConsoleEmailAllowed already provides.
    if (!isConsoleEmailAllowed(session.email)) {
        await clearConsoleSessionCookie();
        redirect('/login?error=access_revoked');
    }

    if (options.mfa && !session.mfaVerified) {
        redirect('/mfa');
    }

    return session;
}

export async function writeConsoleAuditLog(input: {
    action: ConsoleAuditAction;
    email: string;
    session?: ConsoleSession | null;
    requestHeaders?: Headers;
}) {
    if (!configured(process.env.PLATFORM_CONSOLE_API_TOKEN)) {
        return;
    }

    const forwardedFor = input.requestHeaders?.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || input.requestHeaders?.get('x-real-ip') || null;
    const userAgent = input.requestHeaders?.get('user-agent') || null;

    try {
        const response = await fetchConsoleApi<ConsoleDataResponse<{ id: string }>>('/internal/console/audit-logs', {
            method: 'POST',
            body: {
                actor_id: input.session?.userId || null,
                actor_type: 'super_admin',
                actor_email: normalizeConsoleEmail(input.email),
                action: input.action,
                resource_type: 'platform_console_session',
                metadata: {
                    mfa_verified: input.session?.mfaVerified || false,
                },
                ip_address: ipAddress,
                user_agent: userAgent,
            },
        });

        if (response.error) {
            console.error('[admin-web] audit API failed:', response.error);
        }
    } catch (error) {
        console.error('[admin-web] audit API failed:', error instanceof Error ? error.message : 'unknown');
    }
}
