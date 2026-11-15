// Permission policy stays in the canonical resolver. SQL snapshots and session
// revocation serialize that decision with protected effects; no caller-supplied
// scope, role, approver ID or MFA flag is accepted as authority.
import { InternalSensitiveApprovalSchema, type InternalPermissionScope } from '@letbuyy/shared-types';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';
import { hasPermissionScope, resolveEffectivePermissionScopes, type EmployeePermissionResolutionInput } from '../middleware/rbac';
import { readConsoleCredential, type ConsoleCredential, type ConsoleSessionState } from './console-session-repository';

type ConsoleContext = Context<{ Bindings: Env }>;
const ApprovalResultSchema = z.object({ accepted: z.literal(true), approval: InternalSensitiveApprovalSchema, replayed: z.boolean() });
const SnapshotSchema = z.object({ accepted: z.literal(true), evidence_hash: z.string().regex(/^[0-9a-f]{64}$/),
    input: z.record(z.string(), z.unknown()), session: z.object({ actor_id: z.string().uuid() }).passthrough() });
const codes: Record<string, { status: number; message: string }> = {
    MFA_RESET_ALREADY_REQUIRED: {status:409,message:'This operator already requires a configured replacement factor.'},
    MFA_FACTOR_CONFIGURATION_CHANGED: {status:409,message:'The configured factor changed. Review its recovery state before requesting a reset.'},
    CONSOLE_FACTOR_PROOF_REQUIRED: {status:401,message:'A current configured-factor proof is required.'},
    STEP_UP_REQUIRED: { status: 428, message: 'Verify a new authenticator code before this protected action.' },
    PERMISSION_CHANGED: { status: 403, message: 'Operator permissions changed. Sign in again.' },
    APPROVAL_NO_ACTIVE_RESTRICTION: { status:409,message:'This case has no active restriction to reinstate.' },
    APPROVAL_CONTEXT_TOO_LARGE: { status:409,message:'This case requires a bounded restoration review before execution.' },
    APPROVAL_RESTORATION_SCOPE_UNAVAILABLE: { status:503,message:'This action awaits its approved canonical restoration or provider owner.' },
    APPROVAL_TARGET_SCOPE_MISMATCH: { status:409,message:'The case and restriction ownership do not match.' },
    APPROVAL_INTENT_INVALID: { status: 400, message: 'The approval request is invalid.' },
    APPROVAL_QUERY_INVALID: { status: 400, message: 'The approval query is invalid.' },
    APPROVAL_TARGET_NOT_FOUND: { status: 404, message: 'The approval target was not found.' },
    APPROVAL_NOT_FOUND: { status: 404, message: 'Approval not found.' },
    MONEY_RECONCILIATION_ALREADY_VERIFIED: { status: 409, message: 'This reconciliation has no outstanding break to review.' },
    APPROVAL_EVIDENCE_MISMATCH: { status: 409, message: 'The referenced journal evidence is unavailable for this store.' },
    APPROVAL_TARGET_STATE_CHANGED: { status: 409, message: 'The reviewed resource changed. Review it and request a new approval.' },
    IDEMPOTENCY_CONFLICT: { status: 409, message: 'This request key already names a different request or session.' },
    INDEPENDENT_SUPER_ADMIN_REQUIRED: { status: 403, message: 'A distinct active platform super admin must decide this request.' },
    APPROVAL_REQUESTER_MISMATCH: { status: 403, message: 'This approval belongs to a different requester or session.' },
    APPROVAL_PAYLOAD_MISMATCH: { status: 409, message: 'The action, target or reviewed payload does not match this approval.' },
    APPROVAL_EXPIRED_OR_REVOKED: { status: 428, message: 'The approval expired or an associated session was revoked. Request a new approval.' },
    INDEPENDENT_APPROVAL_REQUIRED: { status: 428, message: 'An independently approved request is required before this action.' },
    APPROVAL_ALREADY_DECIDED: { status: 409, message: 'This request already has a different decision.' },
    KYC_HOLD_ADMIN_REQUIRED: { status: 403, message: 'A platform compliance administrator is required.' },
    KYC_HOLD_INVALID: { status: 400, message: 'A valid exact-receipt hold and documented authority are required.' },
    KYC_HOLD_TOO_LATE: { status: 409, message: 'Deletion has started or completed; the document can no longer be held.' },
    KYC_HOLD_ALREADY_EXISTS: { status: 409, message: 'This exact receipt already has an active hold.' },
    KYC_HOLD_NOT_FOUND: { status: 404, message: 'This exact receipt hold was not found.' },
};
export function requireAcceptedConsoleResult(value: unknown): asserts value is Record<string, unknown> & { accepted: true } {
    if (value && typeof value === 'object' && 'accepted' in value && value.accepted === true) return;
    const code = value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' ? value.code : 'CONSOLE_SESSION_INVALID';
    const error = codes[code] ?? { status: 401, message: 'A current permitted Console session is required.' };
    throw new AppError(error.message, error.status, code);
}
export async function consoleApprovalRpc(c: ConsoleContext, name: string, args: Record<string, unknown>) {
    const { data, error } = await getSupabaseAdmin(c).rpc(name, args);
    if (error?.code==='23514' && error.message.includes('TS_ACTIVE_SITE_RESTRICTION')) throw new AppError('An active safety restriction still controls this store.',409,'TS_ACTIVE_SITE_RESTRICTION');
    if (error) throw new AppError('The approval operation could not be saved. Retry the same request.', 503, 'APPROVAL_STORAGE_UNAVAILABLE');
    requireAcceptedConsoleResult(data); return data;
}
export async function requireConsolePermission(c: ConsoleContext, scope: InternalPermissionScope, stepUp = true) {
    const credential = await readConsoleCredential(c);
    const raw = await consoleApprovalRpc(c, 'console_permission_snapshot_v1', {
        p_session_id: credential.payload.sessionId, p_cookie_sha256: credential.digest, p_step_up: stepUp,
    });
    const snapshot = SnapshotSchema.safeParse(raw);
    if (!snapshot.success) throw new AppError('Operator permission state is unavailable.', 503, 'CONSOLE_PERMISSION_STATE_UNAVAILABLE');
    const resolution = resolveEffectivePermissionScopes(snapshot.data.input as EmployeePermissionResolutionInput);
    if (!hasPermissionScope(resolution.scopes, scope)) throw new AppError('The required operator permission is missing.', 403, 'PERMISSION_SCOPE_DENIED');
    return { credential, state: snapshot.data.session as unknown as ConsoleSessionState, witness: snapshot.data.evidence_hash };
}
/** A real bound human session and canonical live scope, for Console read routes. */
export function consolePermission(scope: InternalPermissionScope) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        await requireConsolePermission(c, scope, false); await next();
    });
}
export function credentialArguments(credential: ConsoleCredential) {
    return { p_session_id: credential.payload.sessionId, p_cookie_sha256: credential.digest };
}
export function approvalResult(value: unknown) {
    const result = ApprovalResultSchema.safeParse(value);
    if (!result.success) throw new AppError('The approval response is unavailable.', 503, 'APPROVAL_RESPONSE_UNAVAILABLE');
    return result.data;
}
