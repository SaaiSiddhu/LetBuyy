import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { createMerchantStaffInvitationToken, verifyMerchantStaffInvitationToken, LETBUYY_STAFF_INVITATION_TTL_MS } from '@letbuyy/auth-core';
import type { Env } from '../index';
import type { WorkerAuthUser } from '../lib/auth-user';
import { AppError } from '../lib/errors';
import { sha256Hex } from '../lib/crypto';
import { readStaffSeatPolicy } from './staff-execution.adapter';
import { signQueueTenantEnvelope } from '../lib/queue-tenant-envelope';

function signingSecret(env: Env): string {
    const key = env.STAFF_INVITATION_SIGNING_SECRET || '';
    if (key.length < 32 || /placeholder|replace-with|skip_needs_human/i.test(key)) throw new AppError('Staff invitation signing is not configured.', 503, 'STAFF_INVITATION_UNAVAILABLE');
    return key;
}
function adminOrigin(env: Env): string {
    try {
        const url = new URL(env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.com');
        const local = ['local','development','test'].includes(env.ENVIRONMENT) && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
        if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) throw new Error();
        return url.origin;
    } catch { throw new AppError('Staff invitation destination is not configured.', 503, 'STAFF_INVITATION_UNAVAILABLE'); }
}
const messages: Record<string,string> = {
    FORBIDDEN: 'Not authorized for this staff member or store.', VALIDATION: 'Invalid staff invitation request.',
    IDEMPOTENCY_CONFLICT: 'This retry key belongs to a different staff action.',
    STAFF_STATE_UNAVAILABLE: 'Staff invitation state is unavailable. Retry the same request.',
    STAFF_INVITATION_UNAVAILABLE: 'This invitation is unavailable for this account, expired, revoked or changed.',
    STAFF_VERSION_CONFLICT: 'This staff record changed. Reload before issuing or accepting an invitation.',
    EMPLOYEE_ALREADY_EXISTS: 'This email is already registered as staff.',
    STAFF_POLICY_CHANGED: 'The store plan changed. Retry this request.', STAFF_LIMIT_REACHED: 'The store has reached its plan staff limit.',
};
function rpcResult(data: any, error: unknown) {
    if (error || !data || ![200,201,400,403,409,503].includes(data.status)) throw new AppError(messages.STAFF_STATE_UNAVAILABLE,503,'STAFF_STATE_UNAVAILABLE');
    if (data.error) {
        const code = typeof data.error === 'string' && data.error in messages ? data.error : 'STAFF_STATE_UNAVAILABLE';
        throw new AppError(messages[code],data.status,code);
    }
    return data as { data: any; status: 200|201; replayed: boolean };
}
export async function createStaffInvitation(input: { db: SupabaseClient; env: Env; actor: WorkerAuthUser; storeId: string;
    intent: Record<string,unknown>; key: string; employeeId?: string; expectedUpdatedAt?: string; requestId?: string }) {
    const secret = signingSecret(input.env), origin = adminOrigin(input.env), inviteId = crypto.randomUUID();
    const token = await createMerchantStaffInvitationToken(inviteId,secret);
    const policy = input.employeeId ? null : await readStaffSeatPolicy(input.db,input.actor,input.storeId);
    const { data,error } = await input.db.rpc('create_merchant_staff_invitation_v1', {
        p_actor_id: input.actor.id,p_store_id:input.storeId,p_intent:input.intent,p_key:input.key,
        p_invite_id:inviteId,p_token_hash:await sha256Hex(token),p_expires_at:new Date(Date.now()+LETBUYY_STAFF_INVITATION_TTL_MS).toISOString(),
        p_accept_origin:origin,p_sender:input.env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
        p_policy_hash:policy?.source_hash || null,p_seat_limit:policy?.limit ?? null,p_employee_id:input.employeeId || null,
        p_expected_updated_at:input.expectedUpdatedAt || null,p_bound_site_id:input.actor.storeId || null,p_request_id:input.requestId || null,
    });
    const result=rpcResult(data,error), invitation=result.data.invitation;
    const canonicalToken=await createMerchantStaffInvitationToken(invitation.id,secret);
    if(await sha256Hex(canonicalToken) !== invitation.token_hash) throw new AppError('The invitation signing configuration changed. Reissue the invitation.',503,'STAFF_INVITATION_UNAVAILABLE');
    const publicInvitation={...invitation};delete publicInvitation.token_hash;
    // The durable database job already exists. Queue delivery is a wakeup only;
    // scheduled catch-up owns recovery when a wakeup is absent or lost.
    let wakeup='unavailable';
    if(input.env.NOTIFICATION_QUEUE) {
        try {
            await input.env.NOTIFICATION_QUEUE.send(await signQueueTenantEnvelope(input.env, {
                messageId:'staff-invite-wake:'+invitation.id,queueName:'notification-jobs',jobType:'staff-invitation.wake',siteId:input.storeId,
                idempotencyKey:'staff-invite-wake:'+invitation.id,requestId:input.requestId || invitation.id,payload:{invitation_id:invitation.id},
            }));wakeup='queued';
        } catch { wakeup='retry_pending'; }
    }
    return { ...result,data:{...result.data.employee,invitation:{...publicInvitation,wakeup,
        accept_url:invitation.accept_origin+'/accept-invite?token='+encodeURIComponent(canonicalToken)}} };
}
export async function readStaffInvitationProof(env: Env, token: unknown) {
    const id=await verifyMerchantStaffInvitationToken(token,signingSecret(env));
    if(!id)throw new AppError(messages.STAFF_INVITATION_UNAVAILABLE,403,'STAFF_INVITATION_UNAVAILABLE');
    return {id,hash:await sha256Hex(token as string)};
}
export async function previewStaffInvitation(input:{db:SupabaseClient;env:Env;actor:WorkerAuthUser;token:unknown}) {
    const proof=await readStaffInvitationProof(input.env,input.token);
    const {data,error}=await input.db.rpc('preview_merchant_staff_invitation_v1',{
        p_actor_id:input.actor.id,p_invite_id:proof.id,p_token_hash:proof.hash,p_bound_site_id:input.actor.storeId || null,
    });
    if(error)throw new AppError(messages.STAFF_STATE_UNAVAILABLE,503,'STAFF_STATE_UNAVAILABLE');
    if(!data)throw new AppError(messages.STAFF_INVITATION_UNAVAILABLE,403,'STAFF_INVITATION_UNAVAILABLE');
    return data;
}
export async function acceptStaffInvitation(input:{db:SupabaseClient;env:Env;actor:WorkerAuthUser;token:unknown;key:string;requestId?:string}) {
    const proof=await readStaffInvitationProof(input.env,input.token);
    const {data,error}=await input.db.rpc('accept_merchant_staff_invitation_v1',{
        p_actor_id:input.actor.id,p_invite_id:proof.id,p_token_hash:proof.hash,p_key:input.key,
        p_bound_site_id:input.actor.storeId || null,p_request_id:input.requestId || null,
    });return rpcResult(data,error);
}
