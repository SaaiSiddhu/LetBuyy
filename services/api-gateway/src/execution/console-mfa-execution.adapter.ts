import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { readConsoleCredential, consoleRegistrationArguments } from '../identity-foundation/console-session-repository';
import { requireAcceptedConsoleResult } from '../identity-foundation/console-approval-repository';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';

const ResultSchema=z.discriminatedUnion('verified',[
    z.object({accepted:z.literal(true),verified:z.literal(true),state:z.object({actor_id:z.string().uuid(),session_id:z.string().uuid(),mfa_verified:z.literal(true)}).passthrough(),replayed:z.boolean()}),
    z.object({accepted:z.literal(true),verified:z.literal(false),reason:z.enum(['invalid','locked','reset_required'])}),
]);

/** The canonical Identity server matches its configured factor; the database owns
 * attempts, one-use counters and session rotation together. Raw OTPs/secrets,
 * caller-supplied actor IDs and MFA booleans are not accepted by this endpoint. */
export async function completeConsoleMfa(c:Context<{Bindings:Env}>,counter:number|null,factorFingerprint:string) {
    const target=await readConsoleCredential(c),previous=await readConsoleCredential(c,'X-Platform-Console-Previous-Session');
    if(!target.payload.mfaVerified||(previous.payload.userId!=null && target.payload.userId!==previous.payload.userId)||target.payload.email!==previous.payload.email) {
        throw new AppError('A matching current Console session is required.',401,'CONSOLE_PREVIOUS_SESSION_REQUIRED');
    }
    const {data,error}=await getSupabaseAdmin(c).rpc('complete_console_mfa_v1',{
        ...consoleRegistrationArguments(target,previous),p_counter:counter,p_factor_fingerprint:factorFingerprint,
    });
    if(error)throw new AppError('Authenticator verification is temporarily unavailable. Try again shortly.',503,'CONSOLE_MFA_UNAVAILABLE');
    requireAcceptedConsoleResult(data);const parsed=ResultSchema.safeParse(data);
    if(!parsed.success)throw new AppError('Authenticator verification state is unavailable.',503,'CONSOLE_MFA_RESPONSE_UNAVAILABLE');
    return parsed.data;
}
