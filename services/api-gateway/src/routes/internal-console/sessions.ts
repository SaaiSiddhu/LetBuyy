import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { transitionConsoleSession } from '../../identity-foundation/console-session-repository';
import { consoleApprovalRpc, credentialArguments, requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import { ValidationError } from '../../lib/errors';
import { success } from '../../lib/supabase';
import {verifyInternalAppRequest} from '../../lib/internal-auth';
import {AppError} from '../../lib/errors';
import { completeConsoleMfa } from '../../execution/console-mfa-execution.adapter';

// Mounted behind internal-console's service-token gate. The service token alone
// cannot supply a human identity, MFA, an active membership or a durable session.
const router = new Hono<{ Bindings: Env }>();
router.post('/mfa',async c=>{
    if(!await verifyInternalAppRequest(c,'accounts'))throw new AppError('Use the canonical Identity authenticator owner.',401,'IDENTITY_TRANSPORT_REQUIRED');
    const parsed=z.object({counter:z.number().int().safe().nonnegative().nullable(),factor_fingerprint:z.string().regex(/^[0-9a-f]{64}$/)}).strict().safeParse(await c.req.json().catch(()=>null));
    if(!parsed.success)throw new ValidationError('Invalid authenticator verification request.');
    return c.json(success(await completeConsoleMfa(c,parsed.data.counter,parsed.data.factor_fingerprint)));
});
router.get('/mfa-reset/targets',async c=>{
    const query=z.object({actor_id:z.string().uuid().optional(),q:z.string().trim().max(160).default('')}).safeParse(c.req.query());
    if(!query.success)throw new ValidationError('Invalid operator query.');
    const {credential,witness}=await requireConsolePermission(c,'rbac:manage',false);
    return c.json(success(await consoleApprovalRpc(c,'read_console_mfa_reset_targets_v1',{...credentialArguments(credential),p_permission_hash:witness,p_actor_id:query.data.actor_id??null,p_query:query.data.q})));
});
router.post('/mfa-reset/:id',async c=>{
    const id=z.string().uuid().safeParse(c.req.param('id'));
    const body=z.object({approval_id:z.string().uuid(),reason:z.string().trim().min(8).max(1000)}).strict().safeParse(await c.req.json().catch(()=>null));
    if(!id.success||!body.success)throw new ValidationError('Invalid operator reset request.');
    const {credential,witness}=await requireConsolePermission(c,'rbac:manage');
    const result=await consoleApprovalRpc(c,'execute_console_mfa_reset_v1',{...credentialArguments(credential),p_permission_hash:witness,p_id:body.data.approval_id,p_actor_id:id.data,p_reason:body.data.reason});
    return c.json(success(result.result));
});
router.get('/current', async c => c.json(success((await transitionConsoleSession(c, 'validate')).state)));
for (const operation of ['register', 'revoke'] as const) {
    router.post('/' + operation, async c => {
        if(operation==='register' && !await verifyInternalAppRequest(c,'accounts'))throw new AppError('Use the canonical Identity exchange.',401,'IDENTITY_TRANSPORT_REQUIRED');
        if (!z.object({}).strict().safeParse(await c.req.json().catch(() => null)).success) {
            throw new ValidationError('Session operations accept no caller-supplied identity or authority.');
        }
        return c.json(success((await transitionConsoleSession(c, operation)).state));
    });
}
export default router;
