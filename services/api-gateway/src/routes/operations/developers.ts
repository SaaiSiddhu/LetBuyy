import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import {
    buildDeveloperOverview,
    rangeFor,
    readDeveloperByIdOrSlug,
    reconcileDeveloperPayouts,
    recordValue,
    requestIdFromContext,
    searchDeveloperProfiles,
    stringValue,
    writeDeveloperAudit,
    type JsonRecord,
} from '../../lib/internal-developer-ops';
import { getSupabaseAdmin, paginated, success } from '../../lib/supabase';
import {
    checkSegregationOfDuty,
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

const DeveloperSearchQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(120).optional(),
    status: z.enum(['pending', 'approved', 'suspended', 'rejected', 'all']).default('all'),
});

const DeveloperModerationSchema = z.object({
    action: z.enum(['verify', 'reject', 'suspend', 'restore']),
    reason: z.string().trim().min(8).max(1000),
    secondary_approver_id: z.string().uuid().optional(),
});

const PayoutReleaseSchema = z.object({
    reason: z.string().trim().min(8).max(1000),
    secondary_approver_id: z.string().uuid(),
});

const ReconciliationRunSchema = z.object({
    reason: z.string().trim().min(8).max(1000),
    limit: z.number().int().min(1).max(500).optional(),
});

const ListFinancialQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.string().trim().max(40).optional(),
});

const CreateDisputeSchema = z.object({
    payout_ledger_entry_id: z.string().uuid().nullable().optional(),
    reconciliation_record_id: z.string().uuid().nullable().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
    amount_minor: z.number().int().min(0).default(0),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const UpdateDisputeSchema = z.object({
    status: z.enum(['open', 'in_review', 'waiting_partner', 'resolved', 'rejected', 'withdrawn']).optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    resolution: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

function actorId(c: AppContext): string {
    return c.get('auth').user.id;
}

function actorEmail(c: AppContext): string | null {
    return c.get('auth').user.email || null;
}

async function actorEmployeeId(db: Db, userId: string): Promise<string | null> {
    const { data } = await db
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

    return stringValue(data?.id);
}

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
}

function validationMessage(error: z.ZodError): string {
    return error.issues[0]?.message || 'Invalid request body';
}

async function requireDeveloper(db: Db, developerId: string): Promise<JsonRecord | null> {
    return readDeveloperByIdOrSlug(db, developerId);
}

async function readPayoutForDeveloper(db: Db, developerId: string, payoutId: string): Promise<JsonRecord | null> {
    const { data, error } = await db
        .from('partner_payout_ledger_entries')
        .select('id, partner_id, site_id, app_id, charge_id, status, rail, partner_amount_minor, currency, held_at, hold_reason, metadata, created_at, updated_at')
        .eq('id', payoutId)
        .eq('partner_id', developerId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Payout lookup failed: ${error.message}`);
    return data ? data as JsonRecord : null;
}

router.get('/search', requirePermission('developer:view'), async (c) => {
    const parsed = DeveloperSearchQuerySchema.safeParse({
        page: c.req.query('page') || undefined,
        limit: c.req.query('limit') || undefined,
        q: c.req.query('q') || undefined,
        status: c.req.query('status') || undefined,
    });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const result = await searchDeveloperProfiles(db, parsed.data);
    await writeDeveloperAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'developer.search',
        resourceType: 'app_developer',
        reason: null,
        metadata: { audit_kind: 'sensitive_read', q: parsed.data.q || null, status: parsed.data.status },
    });

    return c.json(paginated(result.rows, result.total, parsed.data.page, parsed.data.limit));
});

router.get('/:developerId/overview', requirePermission('developer:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const overview = await buildDeveloperOverview(db, c.req.param('developerId'), {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        actorType: 'employee',
        auditRead: true,
    });

    if (!overview) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    return c.json(success(overview));
});

router.post('/:developerId/moderation', requirePermission('developer:manage'), async (c) => {
    const input = DeveloperModerationSchema.safeParse(await readJson(c));
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(input.error) } }, 400);
    }

    const reason = validateSensitiveReason(input.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason of at least 8 characters is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const developerId = stringValue(developer.id) || '';
    const requesterId = actorId(c);
    const employeeId = await actorEmployeeId(db, requesterId);
    const now = new Date().toISOString();

    if (input.data.action === 'suspend') {
        const sod = checkSegregationOfDuty({
            actorId: requesterId,
            targetAction: 'developer.suspend',
            secondaryApproverId: input.data.secondary_approver_id || null,
        });
        if (!sod.ok) {
            return c.json({ error: { code: sod.code || 'DUAL_CONTROL_REQUIRED', message: sod.message || 'Dual control required' } }, 409);
        }
    }

    const developerPatch: JsonRecord = {
        updated_at: now,
    };
    if (input.data.action === 'verify') {
        developerPatch.status = 'approved';
        developerPatch.verified = true;
    }
    if (input.data.action === 'reject') {
        developerPatch.status = 'rejected';
        developerPatch.verified = false;
    }
    if (input.data.action === 'suspend') {
        developerPatch.status = 'suspended';
        developerPatch.verified = false;
    }
    if (input.data.action === 'restore') {
        developerPatch.status = 'approved';
        developerPatch.verified = true;
    }

    const { data: updatedDeveloper, error: updateError } = await db
        .from('app_developers')
        .update(developerPatch)
        .eq('id', developerId)
        .select('id, user_id, company_name, slug, support_email, verified, status, country, created_at, updated_at')
        .single();

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Developer moderation failed' } }, 500);
    }

    let cascades: JsonRecord = {};
    if (input.data.action === 'suspend') {
        const [appsUpdate, payoutHold] = await Promise.all([
            db
                .from('marketplace_apps')
                .update({
                    status: 'suspended',
                    updated_at: now,
                })
                .eq('developer_id', developerId)
                .in('status', ['published', 'in_review'])
                .select('id, status'),
            db
                .from('partner_payout_ledger_entries')
                .update({
                    held_at: now,
                    hold_reason: reason,
                    hold_actor_id: employeeId,
                    hold_metadata: {
                        source: 'developer_suspension',
                        developer_id: developerId,
                        secondary_approver_id: input.data.secondary_approver_id || null,
                    },
                    updated_by: employeeId,
                })
                .eq('partner_id', developerId)
                .in('status', ['pending', 'processing'])
                .is('deleted_at', null)
                .is('held_at', null)
                .select('id, partner_amount_minor, status, held_at'),
        ]);

        if (appsUpdate.error || payoutHold.error) {
            return c.json({ error: { code: 'DB_ERROR', message: 'Developer suspension cascade failed' } }, 500);
        }

        cascades = {
            suspended_apps: appsUpdate.data || [],
            held_payouts: payoutHold.data || [],
        };
    }

    if (input.data.action === 'restore') {
        const { data: restoredHolds, error: restoreError } = await db
            .from('partner_payout_ledger_entries')
            .update({
                held_at: null,
                hold_reason: null,
                hold_actor_id: null,
                hold_metadata: {},
                updated_by: employeeId,
            })
            .eq('partner_id', developerId)
            .contains('hold_metadata', { source: 'developer_suspension' })
            .is('deleted_at', null)
            .select('id, status');

        if (restoreError) {
            return c.json({ error: { code: 'DB_ERROR', message: 'Developer restoration payout-hold update failed' } }, 500);
        }

        cascades = { cleared_payout_holds: restoredHolds || [] };
    }

    await writeDeveloperAudit(db, {
        actorId: requesterId,
        actorEmail: actorEmail(c),
        action: `developer.${input.data.action}`,
        resourceType: 'app_developer',
        resourceId: developerId,
        reason,
        metadata: {
            secondary_approver_id: input.data.secondary_approver_id || null,
            cascades,
        },
    });

    return c.json(success({ developer: updatedDeveloper, cascades }));
});

router.post('/:developerId/payouts/:payoutId/release', requirePermission('developer:manage', 'payout:release'), async (c) => {
    const input = PayoutReleaseSchema.safeParse(await readJson(c));
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(input.error) } }, 400);
    }

    const reason = validateSensitiveReason(input.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason of at least 8 characters is required.' } }, 400);
    }

    const requesterId = actorId(c);
    const sod = checkSegregationOfDuty({
        actorId: requesterId,
        targetAction: 'payout.release',
        secondaryApproverId: input.data.secondary_approver_id,
    });
    if (!sod.ok) {
        return c.json({ error: { code: sod.code || 'DUAL_CONTROL_REQUIRED', message: sod.message || 'Dual control required' } }, 409);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const developerId = stringValue(developer.id) || '';
    const payout = await readPayoutForDeveloper(db, developerId, c.req.param('payoutId'));
    if (!payout) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Payout ledger entry not found' } }, 404);
    }
    if (stringValue(payout.held_at)) {
        return c.json({ error: { code: 'PAYOUT_HELD', message: 'This payout is held and cannot be released until the hold is cleared.' } }, 409);
    }
    if (!['pending', 'processing'].includes(String(payout.status))) {
        return c.json({ error: { code: 'INVALID_PAYOUT_STATUS', message: 'Only pending or processing payouts can be approved for release.' } }, 409);
    }

    const employeeId = await actorEmployeeId(db, requesterId);
    const metadata = {
        ...recordValue(payout.metadata),
        release_approval: {
            approved_by: requesterId,
            secondary_approver_id: input.data.secondary_approver_id,
            approved_at: new Date().toISOString(),
            mode: 'dry_run_provider_pending',
        },
    };

    const { data: updatedPayout, error: updateError } = await db
        .from('partner_payout_ledger_entries')
        .update({
            status: 'processing',
            metadata,
            updated_by: employeeId,
        })
        .eq('id', payout.id)
        .select('id, partner_id, site_id, app_id, charge_id, status, rail, partner_amount_minor, currency, held_at, metadata, created_at, updated_at')
        .single();

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Payout release approval failed' } }, 500);
    }

    await writeDeveloperAudit(db, {
        actorId: requesterId,
        actorEmail: actorEmail(c),
        action: 'payout.release_approved',
        resourceType: 'partner_payout',
        resourceId: stringValue(payout.id),
        reason,
        metadata: {
            developer_id: developerId,
            secondary_approver_id: input.data.secondary_approver_id,
            transfer_mode: 'dry_run_provider_pending',
        },
    });

    return c.json(success({
        payout: updatedPayout,
        transfer_mode: 'dry_run_provider_pending',
    }));
});

router.post('/:developerId/reconciliation/run', requirePermission('developer:manage'), async (c) => {
    const input = ReconciliationRunSchema.safeParse(await readJson(c));
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(input.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const developerId = stringValue(developer.id) || '';
    const result = await reconcileDeveloperPayouts(db, {
        developerId,
        actorId: actorId(c),
        reason: input.data.reason,
        requestId: requestIdFromContext(c),
        limit: input.data.limit,
    });

    await writeDeveloperAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'payout.reconcile',
        resourceType: 'app_developer',
        resourceId: developerId,
        reason: input.data.reason,
        metadata: result.summary,
    });

    return c.json(success(result));
});

router.get('/:developerId/reconciliation', requirePermission('developer:view', 'payout:view'), async (c) => {
    const parsed = ListFinancialQuerySchema.safeParse({
        page: c.req.query('page') || undefined,
        limit: c.req.query('limit') || undefined,
        status: c.req.query('status') || undefined,
    });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    let query = db
        .from('payout_reconciliation_records')
        .select('*', { count: 'exact' })
        .eq('partner_id', developer.id)
        .is('deleted_at', null)
        .order('checked_at', { ascending: false })
        .range(from, to);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);

    const { data, error, count } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Payout reconciliation lookup failed' } }, 500);

    return c.json(paginated((data || []) as JsonRecord[], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/:developerId/disputes', requirePermission('developer:manage'), async (c) => {
    const input = CreateDisputeSchema.safeParse(await readJson(c));
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(input.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const employeeId = await actorEmployeeId(db, actorId(c));
    const { data: dispute, error } = await db
        .from('payout_disputes')
        .insert({
            partner_id: developer.id,
            payout_ledger_entry_id: input.data.payout_ledger_entry_id || null,
            reconciliation_record_id: input.data.reconciliation_record_id || null,
            opened_by: employeeId,
            assignee_id: input.data.assignee_id || null,
            reason: input.data.reason,
            amount_minor: input.data.amount_minor,
            metadata: input.data.metadata,
            actor_type: 'employee',
            actor_id: actorId(c),
            request_id: requestIdFromContext(c),
            created_by: employeeId,
            updated_by: employeeId,
        })
        .select('*')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Payout dispute creation failed' } }, 500);

    await writeDeveloperAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'payout.dispute_opened',
        resourceType: 'app_developer',
        resourceId: stringValue(developer.id),
        reason: input.data.reason,
        metadata: {
            dispute_id: stringValue(dispute.id),
            payout_ledger_entry_id: input.data.payout_ledger_entry_id || null,
            reconciliation_record_id: input.data.reconciliation_record_id || null,
        },
    });

    return c.json(success({ dispute }), 201);
});

router.get('/:developerId/disputes', requirePermission('developer:view', 'payout:view'), async (c) => {
    const parsed = ListFinancialQuerySchema.safeParse({
        page: c.req.query('page') || undefined,
        limit: c.req.query('limit') || undefined,
        status: c.req.query('status') || undefined,
    });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    let query = db
        .from('payout_disputes')
        .select('*', { count: 'exact' })
        .eq('partner_id', developer.id)
        .is('deleted_at', null)
        .order('opened_at', { ascending: false })
        .range(from, to);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);

    const { data, error, count } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Payout dispute lookup failed' } }, 500);

    return c.json(paginated((data || []) as JsonRecord[], count || 0, parsed.data.page, parsed.data.limit));
});

router.patch('/:developerId/disputes/:disputeId', requirePermission('developer:manage'), async (c) => {
    const input = UpdateDisputeSchema.safeParse(await readJson(c));
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(input.error) } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const developer = await requireDeveloper(db, c.req.param('developerId'));
    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const terminal = input.data.status && ['resolved', 'rejected', 'withdrawn'].includes(input.data.status);
    const employeeId = await actorEmployeeId(db, actorId(c));
    const patch: JsonRecord = {
        metadata: input.data.metadata,
        updated_by: employeeId,
    };
    if (input.data.status) patch.status = input.data.status;
    if ('assignee_id' in input.data) patch.assignee_id = input.data.assignee_id || null;
    if ('resolution' in input.data) patch.resolution = input.data.resolution || null;
    if (terminal) patch.resolved_at = new Date().toISOString();

    const { data: dispute, error } = await db
        .from('payout_disputes')
        .update(patch)
        .eq('id', c.req.param('disputeId'))
        .eq('partner_id', developer.id)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Payout dispute update failed' } }, 500);
    if (!dispute) return c.json({ error: { code: 'NOT_FOUND', message: 'Payout dispute not found' } }, 404);

    await writeDeveloperAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'payout.dispute_updated',
        resourceType: 'app_developer',
        resourceId: stringValue(developer.id),
        reason: input.data.reason,
        metadata: {
            dispute_id: c.req.param('disputeId'),
            status: input.data.status || null,
        },
    });

    return c.json(success({ dispute }));
});

export default router;
