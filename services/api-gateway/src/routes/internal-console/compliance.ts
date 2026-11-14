import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    ComplianceDataSubjectRequestTypeSchema,
    ComplianceDataSubjectSourceSchema,
    ComplianceDataSubjectStatusSchema,
    ComplianceDataSubjectSubjectTypeSchema,
} from '@letbuyy/shared-types';
import { AppError } from '../../lib/errors';
import { consolePermission, requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import type { Env } from '../../index';
import {
    buildComplianceOverview,
    createManualDataSubjectRequest,
    listAuditExportCursors,
    listDataSubjectRequests,
    retentionPolicySnapshot,
    runAuditExportDryRun,
    updateDataSubjectRequest,
    writeComplianceAudit,
    type JsonRecord,
} from '../../lib/internal-compliance';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import { validateSensitiveReason } from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

const ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.union([ComplianceDataSubjectStatusSchema, z.literal('all')]).default('all'),
    request_type: z.union([ComplianceDataSubjectRequestTypeSchema, z.literal('all')]).default('all'),
    source: z.union([ComplianceDataSubjectSourceSchema, z.literal('all')]).default('all'),
    site_id: z.string().uuid().optional(),
    q: z.string().trim().max(120).optional(),
    actor_id: z.string().uuid().optional(),
    actor_email: z.string().email().optional(),
});

const CreateRequestSchema = z.object({
    site_id: z.string().uuid().nullable().optional(),
    request_type: ComplianceDataSubjectRequestTypeSchema,
    subject_type: ComplianceDataSubjectSubjectTypeSchema,
    subject_id: z.string().trim().max(200).nullable().optional(),
    subject_email: z.string().trim().email().max(320).nullable().optional(),
    subject_display: z.string().trim().max(320).nullable().optional(),
    source: ComplianceDataSubjectSourceSchema.default('manual'),
    assignee_id: z.string().uuid().nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
    request_payload: z.record(z.string(), z.unknown()).default({}),
    metadata: z.record(z.string(), z.unknown()).default({}),
    actor_id: z.string().uuid().nullable().optional(),
    actor_email: z.string().email().nullable().optional(),
    idempotency_key: z.string().trim().min(8).max(160).nullable().optional(),
}).refine((value) => Boolean(value.subject_id || value.subject_email || value.subject_type === 'shop'), {
    message: 'subject_id or subject_email is required unless subject_type is shop',
});

const UpdateRequestSchema = z.object({
    status: ComplianceDataSubjectStatusSchema.optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    fulfillment_summary: z.string().trim().max(4000).nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
    metadata: z.record(z.string(), z.unknown()).default({}),
    actor_id: z.string().uuid().nullable().optional(),
    actor_email: z.string().email().nullable().optional(),
});

const AuditExportRunSchema = z.object({
    cursor_key: z.string().trim().max(120).nullable().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
    reason: z.string().trim().min(8).max(1000),
    actor_id: z.string().uuid().nullable().optional(),
    actor_email: z.string().email().nullable().optional(),
});

function validationMessage(error: z.ZodError): string {
    return error.issues[0]?.message || 'Invalid compliance request';
}

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
}

function requestId(c: AppContext): string | null {
    return c.req.header('X-Request-ID') || null;
}

function cleanOptional(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function dbError() {
    return { error: { code: 'DB_ERROR', message: 'Database operation failed' } };
}

function emptyComplianceOverview() {
    return {
        generated_at: new Date().toISOString(),
        totals: {
            total: 0,
            open: 0,
            overdue: 0,
            due_soon: 0,
            fulfilled: 0,
            erasure: 0,
            access: 0,
        },
        latest_requests: [],
        audit_export_cursors: [],
        retention_policy: retentionPolicySnapshot(),
    };
}

router.get('/overview', consolePermission('compliance:view'), async (c) => {
    try {
        return c.json(success(await buildComplianceOverview(getSupabaseAdminForOperatorRead(c))));
    } catch (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success(emptyComplianceOverview()));
        }
        return c.json(dbError(), 500);
    }
});

router.get('/data-requests', consolePermission('compliance:view'), async (c) => {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page') || undefined,
        limit: c.req.query('limit') || undefined,
        status: c.req.query('status') || undefined,
        request_type: c.req.query('request_type') || undefined,
        source: c.req.query('source') || undefined,
        site_id: c.req.query('site_id') || undefined,
        q: c.req.query('q') || undefined,
        actor_id: c.req.query('actor_id') || undefined,
        actor_email: c.req.query('actor_email') || undefined,
    });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const { state } = await requireConsolePermission(c, 'compliance:view', false);
    const db = getSupabaseAdminForOperatorRead(c);
    try {
        const result = await listDataSubjectRequests(db, parsed.data);
        await writeComplianceAudit(getSupabaseAdmin(c), {
            action: 'data_subject_request.list',
            resourceType: 'data_subject_request',
            actorId: state.actor_id,
            actorEmail: state.email,
            actorType: state.is_super_admin ? 'super_admin' : 'employee',
            requestId: requestId(c),
            metadata: {
                audit_kind: 'sensitive_read',
                status: parsed.data.status,
                request_type: parsed.data.request_type,
                source: parsed.data.source,
                site_id: parsed.data.site_id || null,
                q_present: Boolean(parsed.data.q),
            },
        });
        return c.json(paginated(result.rows, result.total, parsed.data.page, parsed.data.limit));
    } catch (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, parsed.data.page, parsed.data.limit));
        }
        return c.json(dbError(), 500);
    }
});

router.post('/data-requests', consolePermission('compliance:manage'), async (c) => {
    const { state: actor } = await requireConsolePermission(c, 'compliance:manage');
    const parsed = CreateRequestSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason of at least 8 characters is required.' } }, 400);
    }

    try {
        const row = await createManualDataSubjectRequest(getSupabaseAdmin(c), {
            ...parsed.data,
            reason,
            actor_type: actor.is_super_admin ? 'super_admin' : 'employee',
            actor_id: actor.actor_id, actor_email: actor.email,
            request_id: requestId(c),
        });
        return c.json(success({ request: row }), 201);
    } catch (error) {
        if (error instanceof AppError) throw error;
        return c.json(dbError(), 500);
    }
});

router.get('/data-requests/:id', consolePermission('compliance:view'), async (c) => {
    const actor = c.get('consolePermissionState')!;
    if (!z.string().uuid().safeParse(c.req.param('id')).success) return c.json({error:{code:'VALIDATION',message:'A valid request ID is required.'}},400);
    const db = getSupabaseAdminForOperatorRead(c);
    try {
        const { data, error } = await db
            .from('data_subject_requests')
            .select('*')
            .eq('id', c.req.param('id'))
            .is('deleted_at', null)
            .maybeSingle();

        if (error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Data-subject request not found' } }, 404);
            }
            return c.json(dbError(), 500);
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Data-subject request not found' } }, 404);

        await writeComplianceAudit(getSupabaseAdmin(c), {
            action: 'data_subject_request.view',
            resourceType: 'data_subject_request',
            resourceId: String((data as JsonRecord).id),
            actorId: actor.actor_id,
            actorEmail: actor.email,
            actorType: actor.is_super_admin ? 'super_admin' : 'employee',
            reason: cleanOptional(c.req.query('reason')),
            requestId: requestId(c),
            metadata: { audit_kind: 'sensitive_read' },
        });

        return c.json(success(data as JsonRecord));
    } catch (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Data-subject request not found' } }, 404);
        }
        return c.json(dbError(), 500);
    }
});

router.patch('/data-requests/:id', consolePermission('compliance:manage'), async (c) => {
    const { state: actor } = await requireConsolePermission(c, 'compliance:manage');
    const parsed = UpdateRequestSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason of at least 8 characters is required.' } }, 400);
    }

    if (!z.string().uuid().safeParse(c.req.param('id')).success) return c.json({error:{code:'VALIDATION',message:'A valid request ID is required.'}},400);
    const { data: target, error: targetError } = await getSupabaseAdminForOperatorRead(c).from('data_subject_requests').select('id,site_id').eq('id',c.req.param('id')).is('deleted_at',null).maybeSingle();
    if (targetError) return c.json(dbError(),503);
    if (!target) return c.json({error:{code:'NOT_FOUND',message:'Data-subject request not found'}},404);
    try {
        const row = await updateDataSubjectRequest(getSupabaseAdmin(c), c.req.param('id'), {
            ...parsed.data,
            reason,
            actor_type: actor.is_super_admin ? 'super_admin' : 'employee',
            actor_id: actor.actor_id, actor_email: actor.email,
            request_id: requestId(c),
        }, target.site_id);
        if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Data-subject request not found' } }, 404);
        return c.json(success({ request: row }));
    } catch (error) {
        if (error instanceof AppError) throw error;
        return c.json(dbError(), 500);
    }
});

router.get('/retention-policy', consolePermission('compliance:view'), (c) => c.json(success(retentionPolicySnapshot())));

router.get('/audit-exports', consolePermission('compliance:view'), async (c) => {
    try {
        return c.json(success({ cursors: await listAuditExportCursors(getSupabaseAdmin(c)) }));
    } catch (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({ cursors: [] }));
        }
        return c.json(dbError(), 500);
    }
});

router.post('/audit-exports/run', consolePermission('compliance:manage'), async (c) => {
    const { state: actor } = await requireConsolePermission(c, 'compliance:manage');
    const parsed = AuditExportRunSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason of at least 8 characters is required.' } }, 400);
    }

    try {
        const result = await runAuditExportDryRun(getSupabaseAdmin(c), {
            ...parsed.data,
            reason,
            actor_type: actor.is_super_admin ? 'super_admin' : 'employee',
            actor_id: actor.actor_id, actor_email: actor.email,
            request_id: requestId(c),
        });
        return c.json(success(result));
    } catch (error) {
        if (error instanceof AppError) throw error;
        return c.json(dbError(), 500);
    }
});

export default router;
