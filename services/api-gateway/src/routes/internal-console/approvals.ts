import { Hono } from 'hono';
import { z } from 'zod';
import { InternalApprovalDecisionSchema, InternalProtectedApprovalRequestSchema } from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { approvalResult, consoleApprovalRpc, credentialArguments, requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import { readConsoleCredential } from '../../identity-foundation/console-session-repository';
import {verifyInternalAppRequest} from '../../lib/internal-auth';
import {AppError} from '../../lib/errors';
import { ValidationError } from '../../lib/errors';
import { success } from '../../lib/supabase';

const router = new Hono<{ Bindings: Env }>();
router.post('/', async c => {
    const parsed = InternalProtectedApprovalRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError('Invalid protected-action request.', parsed.error.flatten());
    const money = parsed.data.action === 'money.reconciliation.resolve', trust=parsed.data.action==='ts.reinstate',mfa=parsed.data.action==='operator.mfa.reset';
    if(mfa && !await verifyInternalAppRequest(c,'accounts'))throw new AppError('Use the canonical Identity configured-factor owner.',401,'IDENTITY_TRANSPORT_REQUIRED');
    const { credential, witness } = await requireConsolePermission(c, money ? 'money:reconcile' : trust ? 'ts:enforce' : mfa ? 'rbac:manage' : 'merchant:suspend');
    const args = parsed.data.action==='operator.mfa.reset'
        ? {...credentialArguments(credential),p_permission_hash:witness,p_actor_id:parsed.data.resource_id,p_reason:parsed.data.reason,p_request_key:parsed.data.request_key,p_configured_fingerprint:parsed.data.configured_fingerprint}
        : parsed.data.action==='ts.reinstate'
        ? {...credentialArguments(credential),p_permission_hash:witness,p_case_id:parsed.data.resource_id,p_reason:parsed.data.reason,p_request_key:parsed.data.request_key,p_note_metadata:parsed.data.metadata}
        : parsed.data.action === 'money.reconciliation.resolve'
        ? { ...credentialArguments(credential), p_permission_hash: witness, p_site_id: parsed.data.resource_id,
            p_reason: parsed.data.reason, p_request_key: parsed.data.request_key, p_details: parsed.data.payload }
        : { ...credentialArguments(credential), p_permission_hash: witness, p_action: parsed.data.action,
            p_resource_id: parsed.data.resource_id, p_reason: parsed.data.reason, p_request_key: parsed.data.request_key };
    const result = approvalResult(await consoleApprovalRpc(c, mfa ? 'create_console_mfa_reset_approval_v1' : money ? 'create_console_money_approval_v1' : trust ? 'create_console_trust_approval_v1' : 'create_console_approval_v1', args));
    return c.json(success({ approval: result.approval, replayed: result.replayed }), result.replayed ? 200 : 201);
});
router.post('/:id/decision', async c => {
    const id = z.string().uuid().safeParse(c.req.param('id'));
    const parsed = InternalApprovalDecisionSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !parsed.success) throw new ValidationError('Invalid approval decision.');
    const credential = await readConsoleCredential(c);
    const result = approvalResult(await consoleApprovalRpc(c, 'decide_console_approval_v1', {
        ...credentialArguments(credential), p_id: id.data, p_decision: parsed.data.decision, p_payload_hash: parsed.data.payload_hash,
    }));
    return c.json(success({ approval: result.approval, replayed: result.replayed }));
});
for (const path of ['/', '/:id']) router.get(path, async c => {
    const id = c.req.param('id');
    const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) })
        .safeParse(c.req.query());
    if (!query.success || (id && !z.string().uuid().safeParse(id).success)) throw new ValidationError('Invalid approval query.');
    const credential = await readConsoleCredential(c);
    const result = await consoleApprovalRpc(c, 'read_console_approvals_v1', { ...credentialArguments(credential),
        p_id: id ?? null, p_page: query.data.page, p_limit: query.data.limit });
    if (id) {
        const items = Array.isArray(result.items) ? result.items : [];
        if (!items.length) return c.json({ error: { code: 'NOT_FOUND', message: 'Approval not found.' } }, 404);
        return c.json(success({ approval: items[0] }));
    }
    return c.json(success({ approvals: result.items, total: result.total, page: result.page, limit: result.limit, has_next: result.has_next }));
});
export default router;
