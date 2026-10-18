import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS,
    InternalTrustReinstatementExecuteSchema,
    InternalTrustSiteEnforcementSchema,
    TrustSafetyAppealStatusSchema,
    TrustSafetyCaseCategorySchema,
    TrustSafetyCaseStatusSchema,
    TrustSafetyDecisionSchema,
    TrustSafetyEnforcementActionSchema,
    TrustSafetySeveritySchema,
    TrustSafetySubjectTypeSchema,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { AppError, ValidationError } from '../../lib/errors';
import { consoleApprovalRpc, credentialArguments, requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import {
    checkSegregationOfDuty,
    logSensitiveRead,
    requirePermission,
    requirePlatformOperator,
    validateSensitiveReason,
} from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

router.use('*',async(c,next)=>{ if(c.get('auth')?.user.storeId) throw new AppError('A platform operator realm is required.',403,'OPERATOR_REALM_REQUIRED'); await next(); },requirePlatformOperator());

const ListCasesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: TrustSafetyCaseStatusSchema.optional(),
    severity: TrustSafetySeveritySchema.optional(),
    category: TrustSafetyCaseCategorySchema.optional(),
    site_id: z.string().uuid().optional(),
    assignee_id: z.string().uuid().optional(),
});

const OpenCaseSchema = z.object({
    site_id: z.string().uuid().nullable().optional(),
    subject_type: TrustSafetySubjectTypeSchema,
    subject_id: z.string().trim().min(1).max(160),
    category: TrustSafetyCaseCategorySchema,
    severity: TrustSafetySeveritySchema.default('medium'),
    title: z.string().trim().min(3).max(220),
    summary: z.string().trim().max(2000).default(''),
    policy_id: z.string().uuid().nullable().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
    evidence: z.object({
        title: z.string().trim().min(3).max(220),
        evidence_type: z.string().trim().min(2).max(80).default('manual'),
        source: z.string().trim().min(2).max(120).default('operations'),
        description: z.string().trim().max(2000).default(''),
        risk_score_id: z.string().uuid().nullable().optional(),
        risk_action_event_id: z.string().uuid().nullable().optional(),
        uri: z.string().url().nullable().optional(),
        content: z.record(z.string(), z.unknown()).default({}),
    }).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const RiskActionCaseSchema = z.object({
    risk_action_event_id: z.string().uuid(),
    assignee_id: z.string().uuid().nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
});

const EvidenceSchema = z.object({
    title: z.string().trim().min(3).max(220),
    evidence_type: z.string().trim().min(2).max(80).default('manual'),
    source: z.string().trim().min(2).max(120).default('operations'),
    description: z.string().trim().max(2000).default(''),
    risk_score_id: z.string().uuid().nullable().optional(),
    risk_action_event_id: z.string().uuid().nullable().optional(),
    uri: z.string().url().nullable().optional(),
    content: z.record(z.string(), z.unknown()).default({}),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const DecideCaseSchema = z.object({
    decision: TrustSafetyDecisionSchema,
    reason: z.string().trim().min(8).max(1000),
    policy_id: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const EnforceCaseSchema = z.object({
    action: TrustSafetyEnforcementActionSchema.exclude(['none']),
    reason: z.string().trim().min(8).max(1000),
    notify_subject: z.boolean().default(true),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const FileAppealSchema = z.object({
    reason: z.string().trim().min(8).max(2000),
    filed_by_type: z.enum(['subject', 'employee', 'super_admin', 'system']).default('subject'),
    filed_by_id: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const DecideAppealSchema = z.object({
    status: TrustSafetyAppealStatusSchema.extract(['upheld', 'overturned', 'rejected']),
    reason: z.string().trim().min(8).max(1000),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

function actorUserId(c: AppContext): string {
    return c.get('auth').user.id;
}

function actorEmail(c: AppContext): string | null {
    return c.get('auth').user.email || null;
}

function rangeFor(page: number, limit: number) {
    const from = (page - 1) * limit;
    return { from, to: from + limit - 1 };
}

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
}

function addBusinessDays(start: Date, days: number): Date {
    const date = new Date(start);
    let remaining = days;
    while (remaining > 0) {
        date.setUTCDate(date.getUTCDate() + 1);
        const day = date.getUTCDay();
        if (day !== 0 && day !== 6) remaining -= 1;
    }
    return date;
}

async function writeAudit(
    db: Db,
    input: {
        actorId: string;
        actorEmail: string | null;
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason: string;
        metadata?: JsonRecord;
    },
) {
    await db.from('audit_logs').insert({
        actor_id: input.actorId,
        actor_type: 'employee',
        actor_email: input.actorEmail,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason,
        },
    });
}

async function appendCaseEvent(
    db: Db,
    input: {
        caseId: string;
        eventType: string;
        actorType?: 'employee' | 'super_admin' | 'system' | 'subject';
        actorId?: string | null;
        reason: string;
        evidence?: JsonRecord;
        metadata?: JsonRecord;
    },
) {
    await db.from('ts_case_events').insert({
        case_id: input.caseId,
        event_type: input.eventType,
        actor_type: input.actorType || 'employee',
        actor_id: input.actorId || null,
        reason: input.reason,
        evidence: input.evidence || {},
        metadata: input.metadata || {},
        created_by: input.actorType === 'employee' ? input.actorId || null : null,
    });
}

async function attachEvidence(
    db: Db,
    input: z.infer<typeof EvidenceSchema> & { caseId: string; actorId: string },
) {
    const { data, error } = await db
        .from('ts_evidence')
        .insert({
            case_id: input.caseId,
            evidence_type: input.evidence_type,
            source: input.source,
            title: input.title,
            description: input.description,
            risk_score_id: input.risk_score_id || null,
            risk_action_event_id: input.risk_action_event_id || null,
            uri: input.uri || null,
            content: input.content,
            metadata: input.metadata,
            created_by: input.actorId,
        })
        .select('*')
        .single();

    if (error || !data) throw new Error('T&S evidence create failed');

    await appendCaseEvent(db, {
        caseId: input.caseId,
        eventType: 'evidence_attached',
        actorId: input.actorId,
        reason: input.reason,
        evidence: { evidence_id: data.id, title: input.title, source: input.source },
    });

    return data;
}

async function fetchCase(db: Db, caseId: string): Promise<JsonRecord | null> {
    const { data, error } = await db
        .from('ts_cases')
        .select('*')
        .eq('id', caseId)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error('T&S case lookup failed');
    return data as JsonRecord | null;
}

async function createCase(
    db: Db,
    input: z.infer<typeof OpenCaseSchema> & { actorId: string; actorEmail: string | null; source?: string },
) {
    const reason = validateSensitiveReason(input.reason);
    if (!reason) throw new ValidationError('A reason is required for T&S case creation');

    const appealDueAt = addBusinessDays(new Date(), TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS).toISOString();
    const { data: caseRow, error } = await db
        .from('ts_cases')
        .insert({
            site_id: input.site_id || null,
            subject_type: input.subject_type,
            subject_id: input.subject_id,
            category: input.category,
            severity: input.severity,
            status: 'open',
            title: input.title,
            summary: input.summary,
            assignee_id: input.assignee_id || null,
            policy_id: input.policy_id || null,
            opened_by: input.actorId,
            appeal_due_at: appealDueAt,
            metadata: { ...input.metadata, source: input.source || 'operations' },
            created_by: input.actorId,
        })
        .select('*')
        .single();

    if (error || !caseRow) throw new Error('T&S case create failed');

    await appendCaseEvent(db, {
        caseId: caseRow.id,
        eventType: input.source === 'risk' ? 'risk_handoff' : 'case_opened',
        actorId: input.actorId,
        reason,
        metadata: { subject_type: input.subject_type, subject_id: input.subject_id, category: input.category },
    });

    if (input.evidence) {
        await attachEvidence(db, {
            ...input.evidence,
            metadata: {},
            reason,
            caseId: caseRow.id,
            actorId: input.actorId,
        });
    }

    await writeAudit(db, {
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: 'trust_safety.case.open',
        resourceType: 'ts_case',
        resourceId: caseRow.id,
        reason,
        metadata: { subject_type: input.subject_type, subject_id: input.subject_id, severity: input.severity },
    });

    return caseRow;
}

router.get('/overview', requirePermission('ts:view'), async (c) => {
    // This permission-gated platform dashboard intentionally aggregates across sites. Keep the
    // default tenant guard for every tenant-scoped operation; bypass it only for this bounded read.
    const db = getSupabaseAdminForOperatorRead(c);
    const [casesResult, appealsResult, takedownsResult, policiesResult, openResult, pendingResult] = await Promise.all([
        db.from('ts_cases').select('id, site_id, title, status, severity, category, subject_type, subject_id, created_at', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).limit(25),
        db.from('ts_appeals').select('id, case_id, status, due_at', { count: 'exact' }).is('deleted_at', null).order('due_at', { ascending: true }).limit(25),
        db.from('ts_takedowns').select('id, case_id, status, action_type, subject_type, subject_id, site_id, created_at', { count: 'exact' }).eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: false }).limit(25),
        db.from('ts_policies').select('id, policy_key, version, title, active, appeal_window_business_days, severe_violation_ineligible').eq('active', true).is('deleted_at', null).order('policy_key', { ascending: true }).limit(25),
        db.from('ts_cases').select('id', { count: 'exact', head: true }).is('deleted_at', null).in('status', ['open', 'under_review']),
        db.from('ts_appeals').select('id', { count: 'exact', head: true }).is('deleted_at', null).in('status', ['filed', 'under_review']),
    ]);

    if (casesResult.error || appealsResult.error || takedownsResult.error || policiesResult.error || openResult.error || pendingResult.error) throw new AppError('Trust and Safety is unavailable. Retry this review.',503,'TRUST_SAFETY_UNAVAILABLE');

    const cases = (casesResult.data || []) as JsonRecord[];
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    cases.forEach((row) => {
        byStatus[String(row.status)] = (byStatus[String(row.status)] || 0) + 1;
        bySeverity[String(row.severity)] = (bySeverity[String(row.severity)] || 0) + 1;
    });

    await logSensitiveRead(c, {
        action: 'trust_safety.overview.read',
        resourceType: 'ts_case',
        reason: 'Trust & Safety overview inspection',
        metadata: { case_rows_sampled: cases.length },
    });

    return c.json(success({
        counts: {
            total_cases_sampled: cases.length,
            total_cases: casesResult.count || 0,
            open_cases: openResult.count || 0,
            active_takedowns: takedownsResult.count || 0,
            pending_appeals: pendingResult.count || 0,
        },
        by_status: byStatus,
        by_severity: bySeverity,
        recent_cases: cases,
        active_takedowns: takedownsResult.data || [],
        appeals: appealsResult.data || [],
        policies: policiesResult.data || [],
        defaults: { appeal_window_business_days: TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS },
    }));
});

router.get('/policies', requirePermission('ts:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('ts_policies')
        .select('*')
        .is('deleted_at', null)
        .order('policy_key', { ascending: true })
        .order('version', { ascending: false });
    if (error) throw new Error('T&S policy list failed');
    return c.json(success(data || []));
});

router.get('/cases', requirePermission('ts:view'), async (c) => {
    const parsed = ListCasesQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status') || undefined,
        severity: c.req.query('severity') || undefined,
        category: c.req.query('category') || undefined,
        site_id: c.req.query('site_id') || undefined,
        assignee_id: c.req.query('assignee_id') || undefined,
    });
    if (!parsed.success) throw new ValidationError('Invalid T&S case list query', parsed.error.flatten());

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    let request = db
        .from('ts_cases')
        .select('id, site_id, subject_type, subject_id, category, severity, status, title, assignee_id, decision, enforcement_action, appeal_due_at, created_at, updated_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (parsed.data.status) request = request.eq('status', parsed.data.status);
    if (parsed.data.severity) request = request.eq('severity', parsed.data.severity);
    if (parsed.data.category) request = request.eq('category', parsed.data.category);
    if (parsed.data.site_id) request = request.eq('site_id', parsed.data.site_id);
    if (parsed.data.assignee_id) request = request.eq('assignee_id', parsed.data.assignee_id);

    const { data, error, count } = await request;
    if (error) throw new Error('T&S case list failed');

    await logSensitiveRead(c, {
        action: 'trust_safety.cases.read',
        resourceType: 'ts_case',
        reason: 'Trust & Safety case queue inspection',
        metadata: { filters: parsed.data },
    });

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.get('/cases/:id', requirePermission('ts:view'), async (c) => {
    const db = getSupabaseAdminForOperatorRead(c);
    const caseId = c.req.param('id');
    const caseRow = await fetchCase(db, caseId);
    if (!caseRow) return c.json({ error: { code: 'NOT_FOUND', message: 'T&S case not found' } }, 404);

    const [events, evidence, appeals, takedowns] = await Promise.all([
        db.from('ts_case_events').select('*').eq('case_id', caseId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
        db.from('ts_evidence').select('*').eq('case_id', caseId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
        db.from('ts_appeals').select('*').eq('case_id', caseId).is('deleted_at', null).order('created_at', { ascending: false }).limit(25),
        db.from('ts_takedowns').select('*').eq('case_id', caseId).is('deleted_at', null).order('created_at', { ascending: false }).limit(25),
    ]);
    if (events.error || evidence.error || appeals.error || takedowns.error) throw new Error('T&S case detail lookup failed');

    await logSensitiveRead(c, {
        action: 'trust_safety.case.read',
        resourceType: 'ts_case',
        resourceId: caseId,
        reason: 'Trust & Safety case detail inspection',
        metadata: { subject_type: caseRow.subject_type, subject_id: caseRow.subject_id },
    });

    return c.json(success({
        case: caseRow,
        events: events.data || [],
        evidence: evidence.data || [],
        appeals: appeals.data || [],
        takedowns: takedowns.data || [],
    }));
});

router.post('/cases', requirePermission('ts:enforce'), async (c) => {
    const parsed = OpenCaseSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid T&S case payload', parsed.error.flatten());
    const db = getSupabaseAdmin(c);
    const caseRow = await createCase(db, { ...parsed.data, actorId: actorUserId(c), actorEmail: actorEmail(c) });
    return c.json(success({ case: caseRow }), 201);
});

router.post('/cases/from-risk-action', requirePermission('ts:enforce'), async (c) => {
    const parsed = RiskActionCaseSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid risk handoff payload', parsed.error.flatten());
    const db = getSupabaseAdmin(c);
    const { data: riskAction, error } = await db
        .from('risk_action_events')
        .select('id, site_id, entity_type, entity_id, action_type, reason, evidence, score_id, metadata')
        .eq('id', parsed.data.risk_action_event_id)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error('Risk action lookup failed');
    if (!riskAction) return c.json({ error: { code: 'NOT_FOUND', message: 'Risk action event not found' } }, 404);

    const caseRow = await createCase(db, {
        site_id: riskAction.site_id || null,
        subject_type: riskAction.entity_type === 'site' ? 'site' : 'custom',
        subject_id: riskAction.entity_id,
        category: 'fraud',
        severity: 'high',
        title: `Risk handoff: ${riskAction.entity_type} ${riskAction.entity_id}`,
        summary: riskAction.reason || 'Risk platform requested Trust & Safety review.',
        assignee_id: parsed.data.assignee_id || null,
        reason: parsed.data.reason,
        evidence: {
            title: 'Risk action handoff',
            evidence_type: 'risk_action',
            source: 'risk',
            description: riskAction.reason || '',
            risk_score_id: riskAction.score_id || null,
            risk_action_event_id: riskAction.id,
            content: { evidence: riskAction.evidence || {}, metadata: riskAction.metadata || {} },
        },
        metadata: { risk_action_event_id: riskAction.id },
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        source: 'risk',
    });

    return c.json(success({ case: caseRow }), 201);
});

router.post('/cases/:id/evidence', requirePermission('ts:enforce'), async (c) => {
    const parsed = EvidenceSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid T&S evidence payload', parsed.error.flatten());
    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const db = getSupabaseAdmin(c);
    const caseId = c.req.param('id');
    const caseRow = await fetchCase(db, caseId);
    if (!caseRow) return c.json({ error: { code: 'NOT_FOUND', message: 'T&S case not found' } }, 404);

    const evidence = await attachEvidence(db, { ...parsed.data, reason, caseId, actorId: actorUserId(c) });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'trust_safety.evidence.attach',
        resourceType: 'ts_case',
        resourceId: caseId,
        reason,
        metadata: { evidence_id: evidence.id },
    });

    return c.json(success({ evidence }), 201);
});

router.post('/cases/:id/decide', requirePermission('ts:enforce'), async (c) => {
    const parsed = DecideCaseSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid T&S decision payload', parsed.error.flatten());
    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const db = getSupabaseAdmin(c);
    const caseId = c.req.param('id');
    const status = parsed.data.decision === 'violation' ? 'under_review' : parsed.data.decision === 'no_violation' ? 'closed' : 'under_review';
    const { data, error } = await db
        .from('ts_cases')
        .update({
            status,
            decision: parsed.data.decision,
            decision_reason: reason,
            decided_by: actorUserId(c),
            policy_id: parsed.data.policy_id || null,
            closed_at: status === 'closed' ? new Date().toISOString() : null,
            updated_by: actorUserId(c),
            metadata: parsed.data.metadata,
        })
        .eq('id', caseId)
        .is('deleted_at', null)
        .select('*')
        .single();
    if (error || !data) throw new Error('T&S decision failed');

    await appendCaseEvent(db, { caseId, eventType: 'decision_recorded', actorId: actorUserId(c), reason, metadata: { decision: parsed.data.decision } });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'trust_safety.case.decide',
        resourceType: 'ts_case',
        resourceId: caseId,
        reason,
        metadata: { decision: parsed.data.decision, status },
    });

    return c.json(success({ case: data }));
});

router.post('/cases/:id/enforce', requirePermission('ts:enforce'), async(c)=>{
    const parsed=InternalTrustSiteEnforcementSchema.safeParse(await readJson(c)),id=z.string().uuid().safeParse(c.req.param('id'));
    if(!parsed.success||!id.success) throw new ValidationError('Invalid T&S enforcement payload.');
    const {credential,state,witness}=await requireConsolePermission(c,'ts:enforce');
    if(c.get('auth').user.id!==state.actor_id || c.get('auth').user.storeId) throw new AppError('The operator session does not match this action.',403,'ACTOR_MISMATCH');
    if(!parsed.data.idempotency_key) throw new AppError('A stable enforcement request key is required.',428,'IDEMPOTENCY_KEY_REQUIRED');
    const result=await consoleApprovalRpc(c,'enforce_console_trust_site_v1',{
      ...credentialArguments(credential),p_permission_hash:witness,p_case_id:id.data,p_action:parsed.data.action,p_reason:parsed.data.reason,
      p_request_key:parsed.data.idempotency_key,p_note_metadata:parsed.data.metadata,p_notify_subject:parsed.data.notify_subject,
    });
    return c.json(success(result.result));
});

router.post('/cases/:id/appeals', requirePermission('ts:appeal'), async (c) => {
    const parsed = FileAppealSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid T&S appeal payload', parsed.error.flatten());
    const db = getSupabaseAdmin(c);
    const caseId = c.req.param('id');
    const caseRow = await fetchCase(db, caseId);
    if (!caseRow) return c.json({ error: { code: 'NOT_FOUND', message: 'T&S case not found' } }, 404);

    const dueAt = typeof caseRow.appeal_due_at === 'string'
        ? caseRow.appeal_due_at
        : addBusinessDays(new Date(), TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS).toISOString();
    const { data: appeal, error } = await db
        .from('ts_appeals')
        .insert({
            case_id: caseId,
            filed_by_type: parsed.data.filed_by_type,
            filed_by_id: parsed.data.filed_by_id || null,
            reason: parsed.data.reason,
            status: 'filed',
            original_reviewer_id: caseRow.enforced_by || caseRow.decided_by || null,
            due_at: dueAt,
            metadata: parsed.data.metadata,
            created_by: actorUserId(c),
        })
        .select('*')
        .single();
    if (error || !appeal) throw new Error('T&S appeal create failed');

    await db.from('ts_cases').update({ status: 'appealed', updated_by: actorUserId(c) }).eq('id', caseId);
    await appendCaseEvent(db, { caseId, eventType: 'appeal_filed', actorId: actorUserId(c), reason: parsed.data.reason, metadata: { appeal_id: appeal.id } });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'trust_safety.appeal.file',
        resourceType: 'ts_appeal',
        resourceId: appeal.id,
        reason: parsed.data.reason,
        metadata: { case_id: caseId },
    });

    return c.json(success({ appeal }), 201);
});

router.post('/appeals/:id/decide', requirePermission('ts:appeal'), async (c) => {
    const parsed = DecideAppealSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new ValidationError('Invalid T&S appeal decision payload', parsed.error.flatten());
    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const db = getSupabaseAdmin(c);
    const appealId = c.req.param('id');
    const { data: appeal, error: appealLookupError } = await db
        .from('ts_appeals')
        .select('*')
        .eq('id', appealId)
        .is('deleted_at', null)
        .maybeSingle();
    if (appealLookupError) throw new Error('T&S appeal lookup failed');
    if (!appeal) return c.json({ error: { code: 'NOT_FOUND', message: 'T&S appeal not found' } }, 404);

    const sod = checkSegregationOfDuty({
        actorId: actorUserId(c),
        targetAction: 'ts.appeal.decide',
        originalActorId: appeal.original_reviewer_id || null,
    });
    if (!sod.ok) return c.json({ error: { code: sod.code, message: sod.message } }, 403);

    const { data: updatedAppeal, error } = await db
        .from('ts_appeals')
        .update({
            status: parsed.data.status,
            appeal_reviewer_id: actorUserId(c),
            decision_reason: reason,
            decided_at: new Date().toISOString(),
            metadata: parsed.data.metadata,
            updated_by: actorUserId(c),
        })
        .eq('id', appealId)
        .select('*')
        .single();
    if (error || !updatedAppeal) throw new Error('T&S appeal decision failed');

    const caseStatus = parsed.data.status === 'overturned' ? 'appealed' : 'finalized';
    await db.from('ts_cases').update({ status: caseStatus, updated_by: actorUserId(c) }).eq('id', appeal.case_id);
    await appendCaseEvent(db, {
        caseId: appeal.case_id,
        eventType: 'appeal_decided',
        actorId: actorUserId(c),
        reason,
        metadata: { appeal_id: appealId, status: parsed.data.status, reinstatement_required: parsed.data.status === 'overturned' },
    });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'trust_safety.appeal.decide',
        resourceType: 'ts_appeal',
        resourceId: appealId,
        reason,
        metadata: { case_id: appeal.case_id, status: parsed.data.status },
    });

    return c.json(success({ appeal: updatedAppeal }));
});

router.post('/cases/:id/reinstate', requirePermission('ts:enforce'), async (c) => {
    const parsed=InternalTrustReinstatementExecuteSchema.safeParse(await readJson(c)), id=z.string().uuid().safeParse(c.req.param('id'));
    if(!parsed.success||!id.success) throw new ValidationError('Invalid T&S reinstatement payload.');
    const {credential,state,witness}=await requireConsolePermission(c,'ts:enforce');
    if(c.get('auth').user.id!==state.actor_id || c.get('auth').user.storeId) throw new AppError('The operator session does not match this action.',403,'ACTOR_MISMATCH');
    if(!parsed.data.approval_id) throw new AppError('An independently approved request is required before reinstatement.',428,'INDEPENDENT_APPROVAL_REQUIRED');
    const result=await consoleApprovalRpc(c,'execute_console_trust_reinstatement_v1',{
        ...credentialArguments(credential),p_permission_hash:witness,p_id:parsed.data.approval_id,p_case_id:id.data,
        p_reason:parsed.data.reason,p_note_metadata:parsed.data.metadata,
    });
    return c.json(success(result.result));
});
export default router;
