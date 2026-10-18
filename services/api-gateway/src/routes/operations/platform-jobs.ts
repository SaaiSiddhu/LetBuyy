import { Hono } from 'hono';
import { z } from 'zod';
import { InternalPlatformJobSchema, InternalPlatformJobRecoveryRequestSchema, InternalPlatformJobRecoveryExecuteSchema, InternalPlatformJobRecoveryResultSchema, InternalPlatformJobQuerySchema } from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { AppError, ValidationError } from '../../lib/errors';
import { success } from '../../lib/supabase';
import { approvalResult, consoleApprovalRpc, credentialArguments, requireConsolePermission } from '../../identity-foundation/console-approval-repository';

// Mounted only inside the existing private Console perimeter. The live human
// session is checked by the canonical resolver on every request, including retry.
const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });

router.get('/', async c => {
    const { credential, witness, state } = await requireConsolePermission(c, 'incident:view', false);
    if (!state.is_super_admin) throw new AppError('An active platform super admin is required.', 403, 'INDEPENDENT_SUPER_ADMIN_REQUIRED');
    const parsed = InternalPlatformJobQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError('Invalid recovery inspection query.');
    const result = await consoleApprovalRpc(c, 'read_console_platform_jobs_v1', {
        ...credentialArguments(credential), p_permission_hash: witness, p_site_id: parsed.data.site_id ?? null,
        p_job_id: parsed.data.job_id ?? null, p_page: parsed.data.page, p_limit: parsed.data.limit,
    });
    const projection = z.object({items:z.array(InternalPlatformJobSchema),total:z.number().int().nonnegative(),
        page:z.literal(parsed.data.page),limit:z.literal(parsed.data.limit),has_next:z.boolean()}).safeParse(result);
    if (!projection.success) throw new AppError('Recovery inspection is unavailable. Retry loading.',503,'PLATFORM_JOB_RECOVERY_UNAVAILABLE');
    return c.json(success(projection.data));
});

router.post('/:jobId/approvals', async c => {
    const { credential, witness, state } = await requireConsolePermission(c, 'incident:command');
    if (!state.is_super_admin) throw new AppError('An active platform super admin is required.', 403, 'INDEPENDENT_SUPER_ADMIN_REQUIRED');
    const id = z.string().uuid().safeParse(c.req.param('jobId'));
    const parsed = InternalPlatformJobRecoveryRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !parsed.success) throw new ValidationError('Invalid recovery review request.');
    // A presentation context is a refusal precondition, never an identity proof.
    if (parsed.data.expected_session_id !== credential.payload.sessionId) {
        throw new AppError('Your sign-in changed. Review the job again in the current session.', 409, 'CONSOLE_CONTEXT_CHANGED');
    }
    const result = approvalResult(await consoleApprovalRpc(c, 'create_console_platform_job_recovery_v1', {
        ...credentialArguments(credential), p_permission_hash: witness, p_job_id: id.data, p_site_id: parsed.data.site_id,
        p_source_fingerprint: parsed.data.source_fingerprint, p_reason: parsed.data.reason, p_request_key: parsed.data.request_key,
    }));
    const payload = z.object({operation:z.literal('platform.job.redrive'),retry_budget:z.literal(1),reason:z.string(),job:InternalPlatformJobSchema}).strict().safeParse(result.approval.payload);
    if (result.approval.action !== 'platform.job.redrive' || !payload.success ||
        (result.approval.result !== null && !InternalPlatformJobRecoveryResultSchema.safeParse(result.approval.result).success)) {
        throw new AppError('Recovery review is unavailable. Retry the same request.',503,'PLATFORM_JOB_RECOVERY_UNAVAILABLE');
    }
    return c.json(success({ approval: result.approval, replayed: result.replayed }), result.replayed ? 200 : 201);
});

router.post('/:jobId/redrive', async c => {
    const { credential, witness, state } = await requireConsolePermission(c, 'incident:command');
    if (!state.is_super_admin) throw new AppError('An active platform super admin is required.', 403, 'INDEPENDENT_SUPER_ADMIN_REQUIRED');
    const id = z.string().uuid().safeParse(c.req.param('jobId'));
    const parsed = InternalPlatformJobRecoveryExecuteSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !parsed.success) throw new ValidationError('Invalid approved recovery request.');
    const result = await consoleApprovalRpc(c, 'execute_console_platform_job_recovery_v1', {
        ...credentialArguments(credential), p_permission_hash: witness, p_id: parsed.data.approval_id,
        p_job_id: id.data, p_site_id: parsed.data.site_id, p_reason: parsed.data.reason, p_request_key: parsed.data.request_key,
    });
    const receipt = InternalPlatformJobRecoveryResultSchema.safeParse(result.result);
    if (!receipt.success) throw new AppError('Recovery receipt is unavailable. Retry the same request.',503,'PLATFORM_JOB_RECOVERY_UNAVAILABLE');
    return c.json(success(receipt.data));
});
export default router;
