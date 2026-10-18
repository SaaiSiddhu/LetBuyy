// Adapter for the canonical principals/account_links/sessions_v2 owners. The
// Identity-issued Console cookie remains the credential; this is its durable binding,
// not another issuer or a replacement of merchant/customer session authority.
import type { LetbuyyPlatformSessionPayload } from '@letbuyy/auth-core';
import {verifyIdentityPlatformSession} from '@letbuyy/auth-core/platform-identity';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Env } from '../index';
import { sha256Hex } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';

type ConsoleContext = Context<{ Bindings: Env }>;
export interface ConsoleCredential {
    payload: LetbuyyPlatformSessionPayload & { sessionId: string };
    digest: string;
}
export interface ConsoleSessionState {
    accepted: true;
    actor_id: string;
    email: string;
    session_id: string;
    is_super_admin: boolean;
    mfa_verified: boolean;
    mfa_verified_at: string | null;
    expires_at: string;
}
const SessionStateSchema = z.object({
    accepted: z.literal(true), actor_id: z.string().uuid(), email: z.string().email(), session_id: z.string().uuid(),
    is_super_admin: z.boolean(), mfa_verified: z.boolean(), mfa_verified_at: z.string().nullable(), expires_at: z.string(),
});

export async function readConsoleCredential(c: ConsoleContext, header = 'X-Platform-Console-Session'): Promise<ConsoleCredential> {
    if(!c.env.LETBUYY_IDENTITY_PUBLIC_JWKS)throw new AppError('Public Identity verification is not configured.',503,'CONSOLE_SESSION_NOT_CONFIGURED');
    const token = c.req.header(header);
    const payload = await verifyIdentityPlatformSession(token,{issuer:c.env.LETBUYY_IDENTITY_ISSUER,publicJwks:c.env.LETBUYY_IDENTITY_PUBLIC_JWKS});
    const now = Math.floor(Date.now() / 1000);
    if (!token || !payload || !z.string().uuid().safeParse(payload.sessionId).success
        || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.exp)
        || payload.issuedAt > now + 30 || payload.exp <= payload.issuedAt || payload.exp - payload.issuedAt > 8 * 60 * 60
        || (payload.mfaVerified && !Number.isSafeInteger(payload.mfaVerifiedAt))
        || (!payload.mfaVerified && payload.mfaVerifiedAt != null)) {
        throw new AppError('A current bound Console session is required.', 401, 'CONSOLE_SESSION_REQUIRED');
    }
    return { payload: payload as ConsoleCredential['payload'], digest: await sha256Hex(token) };
}

export async function transitionConsoleSession(c: ConsoleContext, operation: 'register' | 'validate' | 'revoke') {
    const credential = await readConsoleCredential(c);
    if(operation==='register' && credential.payload.mfaVerified)throw new AppError('Use durable authenticator verification for session elevation.',401,'CONSOLE_MFA_PROOF_REQUIRED');
    const previous = operation === 'register' && c.req.header('X-Platform-Console-Previous-Session')
        ? await readConsoleCredential(c, 'X-Platform-Console-Previous-Session') : null;
    const { data, error } = await getSupabaseAdmin(c).rpc('transition_console_session_v1', {
        p_operation: operation, ...consoleRegistrationArguments(credential, previous),
    });
    if (error) throw new AppError('Console session storage is unavailable.', 503, 'CONSOLE_SESSION_STORAGE_UNAVAILABLE');
    const parsed = SessionStateSchema.safeParse(data);
    if (!parsed.success) throw new AppError('Console session is unavailable or revoked.', 401, 'CONSOLE_SESSION_INVALID');
    return { credential, state: parsed.data as ConsoleSessionState };
}

export function consoleRegistrationArguments(credential: ConsoleCredential, previous: ConsoleCredential | null) {
    const {payload}=credential;
    return {
        p_session_id:payload.sessionId,p_cookie_sha256:credential.digest,p_email:payload.email,p_actor_id:payload.userId,
        p_issued_at:new Date(payload.issuedAt*1000).toISOString(),p_expires_at:new Date(payload.exp*1000).toISOString(),
        p_mfa_verified_at:payload.mfaVerifiedAt==null?null:new Date(payload.mfaVerifiedAt*1000).toISOString(),
        p_previous_session_id:previous?.payload.sessionId??null,p_previous_cookie_sha256:previous?.digest??null,
    };
}

/** Adapt only the existing private Console transport to the canonical operator
 * handlers. No generic bearer verifier or role claim is added: live identity
 * comes from the already-bound Console session and all scopes remain DB-read. */
export const bindConsoleOperatorIdentity = createMiddleware<{ Bindings: Env }>(async (c,next) => {
    const { state } = await transitionConsoleSession(c,'validate');
    if (!state.mfa_verified) throw new AppError('Authenticator verification is required.',428,'STEP_UP_REQUIRED');
    c.set('auth',{ user:{ id:state.actor_id,email:state.email,authSource:'internal-sso' } });
    await next();
});
