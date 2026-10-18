import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchConsoleApi, type ConsoleDataResponse } from './console-api';
import { readCurrentConsoleSession } from './console-live-session';
import {
    CONSOLE_SESSION_COOKIE,
    CONSOLE_SESSION_MAX_AGE_SECONDS,
    readConsoleSession,
    type ConsoleSession,
} from './console-session';

export {normalizeConsoleEmail,getAllowedConsoleEmails,isConsoleEmailAllowed} from './console-access-allowlist';
import {normalizeConsoleEmail,isConsoleEmailAllowed} from './console-access-allowlist';
import {requestConsoleIdentity} from './console-identity-client';

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
    return readCurrentConsoleSession(cookieStore.get(CONSOLE_SESSION_COOKIE)?.value);
}

/** Persist only a public-key verified, already durably registered Identity
 * credential. A reply from the transport alone cannot set a human cookie. */
export async function persistConsoleIdentityCookie(value:string) {
    const session=await readCurrentConsoleSession(value);
    if(!session||!isConsoleEmailAllowed(session.email))return false;
    (await cookies()).set(CONSOLE_SESSION_COOKIE,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:Math.max(0,Math.min(CONSOLE_SESSION_MAX_AGE_SECONDS,session.exp-Math.floor(Date.now()/1000)))});
    return true;
}
export async function setConsoleMfaCookie(input:{code:string}):Promise<{ok:true}|{ok:false;reason:string}>{
    const token=(await cookies()).get(CONSOLE_SESSION_COOKIE)?.value;
    if(!token)return {ok:false,reason:'unavailable'};
    const result=await requestConsoleIdentity({operation:'mfa',current_token:token,code:input.code});
    if(!result.ok||!result.token)return {ok:false,reason:result.reason||result.error?.code||'unavailable'};
    return await persistConsoleIdentityCookie(result.token)?{ok:true}:{ok:false,reason:'unavailable'};
}

export async function clearConsoleSessionCookie() {
    const cookieStore = await cookies();
    const value = cookieStore.get(CONSOLE_SESSION_COOKIE)?.value;
    const session = await readConsoleSession(value);
    if (session?.sessionId && value) {
        const revoked = await fetchConsoleApi('/internal/console/sessions/revoke', { method: 'POST', body: {}, sessionToken: value });
        // A denied/revoked cookie has no current authority. An unavailable
        // storage service cannot be reported as a completed durable logout.
        if (revoked.error && revoked.status !== 401) return false;
    }
    cookieStore.set(CONSOLE_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    });
    return true;
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
