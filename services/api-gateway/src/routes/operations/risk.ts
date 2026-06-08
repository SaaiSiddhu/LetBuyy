import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    RISK_DEFAULT_RULE_WEIGHTS,
    RiskBandSchema,
    RiskDecisionSchema,
    RiskEntityTypeSchema,
    RiskSignalSeveritySchema,
    RiskSignalTypeSchema,
    scoreRiskSignals,
    type RiskSignalForScoring,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import {
    logSensitiveRead,
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

const ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    band: RiskBandSchema.optional(),
    status: z.enum(['open', 'confirmed', 'dismissed', 'restricted']).optional(),
    entity_type: RiskEntityTypeSchema.optional(),
    site_id: z.string().uuid().optional(),
});

const RiskSignalCreateSchema = z.object({
    site_id: z.string().uuid().nullable().optional(),
    entity_type: RiskEntityTypeSchema,
    entity_id: z.string().trim().min(1).max(160),
    signal_type: RiskSignalTypeSchema,
    source: z.string().trim().min(2).max(120).default('operations'),
    severity: RiskSignalSeveritySchema.default('medium'),
    weight: z.number().int().min(0).max(100).optional(),
    rule_id: z.string().uuid().nullable().optional(),
    value: z.number().optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
    metadata: z.record(z.string(), z.unknown()).default({}),
    observed_at: z.string().datetime().optional(),
});

const ScoreEntitySchema = z.object({
    site_id: z.string().uuid().nullable().optional(),
    entity_type: RiskEntityTypeSchema,
    entity_id: z.string().trim().min(1).max(160),
    signals: z.array(RiskSignalCreateSchema.omit({ entity_type: true, entity_id: true, site_id: true }).partial({
        source: true,
        severity: true,
        evidence: true,
        metadata: true,
    })).max(25).default([]),
    reason: z.string().trim().min(8).max(1000),
});

const RiskRuleSchema = z.object({
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).nullable().optional(),
    signal_type: RiskSignalTypeSchema,
    predicate: z.record(z.string(), z.unknown()).default({}),
    weight: z.number().int().min(0).max(100),
    enabled: z.boolean().default(false),
    sandbox: z.boolean().default(true),
    action: z.enum(['score', 'review', 'restrict']).default('score'),
    reason: z.string().trim().min(8).max(1000),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const RiskRulePatchSchema = RiskRuleSchema.partial({
    name: true,
    description: true,
    signal_type: true,
    predicate: true,
    weight: true,
    enabled: true,
    sandbox: true,
    action: true,
    metadata: true,
}).extend({
    reason: z.string().trim().min(8).max(1000),
});

const RiskScoreDecisionBodySchema = z.object({
    decision: RiskDecisionSchema,
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

async function insertRiskActionEvent(
    db: Db,
    input: {
        siteId?: string | null;
        entityType: string;
        entityId: string;
        actionType: 'score' | 'auto_restrict' | 'manual_decision' | 'ts_case_open_requested' | 'rule_change';
        actionStatus?: 'recorded' | 'applied' | 'failed';
        ruleId?: string | null;
        scoreId?: string | null;
        signalIds?: string[];
        reason: string;
        evidence?: JsonRecord;
        actorType?: 'employee' | 'super_admin' | 'system';
        actorId?: string | null;
        metadata?: JsonRecord;
    },
) {
    await db.from('risk_action_events').insert({
        site_id: input.siteId || null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action_type: input.actionType,
        action_status: input.actionStatus || 'recorded',
        rule_id: input.ruleId || null,
        score_id: input.scoreId || null,
        signal_ids: input.signalIds || [],
        reason: input.reason,
        evidence: input.evidence || {},
        actor_type: input.actorType || 'system',
        actor_id: input.actorId || null,
        metadata: input.metadata || {},
    });
}

function signalForScoring(row: JsonRecord): RiskSignalForScoring {
    return {
        id: typeof row.id === 'string' ? row.id : null,
        rule_id: typeof row.rule_id === 'string' ? row.rule_id : null,
        signal_type: String(row.signal_type || 'manual_review'),
        severity: typeof row.severity === 'string' ? row.severity : 'medium',
        weight: typeof row.weight === 'number' ? row.weight : null,
        evidence: (row.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence)) ? row.evidence as JsonRecord : null,
        metadata: (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) ? row.metadata as JsonRecord : null,
    };
}

async function fetchActiveSignals(db: Db, entityType: string, entityId: string): Promise<JsonRecord[]> {
    const { data, error } = await db
        .from('risk_signals')
        .select('id, rule_id, signal_type, severity, weight, evidence, metadata, observed_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .is('deleted_at', null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('observed_at', { ascending: false })
        .limit(100);

    if (error) throw new Error('Risk signal lookup failed');
    return (data || []) as JsonRecord[];
}

async function scoreAndPersistEntity(
    db: Db,
    input: {
        siteId?: string | null;
        entityType: string;
        entityId: string;
        signals: JsonRecord[];
        reason: string;
        actorId: string;
        actorEmail: string | null;
        actorType?: 'employee' | 'system';
    },
) {
    const computation = scoreRiskSignals(input.signals.map(signalForScoring));
    const scorePayload = {
        site_id: input.siteId || null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        score: computation.score,
        band: computation.band,
        breakdown: computation.breakdown,
        status: computation.auto_restrict ? 'restricted' : 'open',
        scored_at: new Date().toISOString(),
        updated_by: input.actorType === 'employee' ? input.actorId : null,
    };

    const { data: scoreRow, error } = await db
        .from('risk_scores')
        .upsert(scorePayload, { onConflict: 'entity_type,entity_id' })
        .select('id, site_id, entity_type, entity_id, score, band, breakdown, status, scored_at, created_at, updated_at')
        .single();

    if (error || !scoreRow) throw new Error('Risk score persistence failed');

    const signalIds = input.signals
        .map((signal) => typeof signal.id === 'string' ? signal.id : null)
        .filter((id): id is string => Boolean(id));

    await insertRiskActionEvent(db, {
        siteId: input.siteId,
        entityType: input.entityType,
        entityId: input.entityId,
        actionType: 'score',
        actionStatus: 'recorded',
        scoreId: String(scoreRow.id),
        signalIds,
        reason: input.reason,
        evidence: computation.breakdown,
        actorType: input.actorType || 'employee',
        actorId: input.actorType === 'system' ? null : input.actorId,
        metadata: { score: computation.score, band: computation.band },
    });

    if (computation.auto_restrict && input.siteId) {
        const { error: siteError } = await db
            .from('sites')
            .update({
                status: 'frozen',
                frozen_at: new Date().toISOString(),
                updated_by: input.actorType === 'employee' ? input.actorId : null,
            })
            .eq('id', input.siteId)
            .neq('status', 'suspended');

        await insertRiskActionEvent(db, {
            siteId: input.siteId,
            entityType: input.entityType,
            entityId: input.entityId,
            actionType: 'auto_restrict',
            actionStatus: siteError ? 'failed' : 'applied',
            scoreId: String(scoreRow.id),
            signalIds,
            reason: `High risk score ${computation.score} crossed the auto-restrict threshold.`,
            evidence: computation.breakdown,
            actorType: 'system',
            metadata: { threshold: computation.breakdown.threshold, site_update_error: siteError?.message || null },
        });

        await insertRiskActionEvent(db, {
            siteId: input.siteId,
            entityType: input.entityType,
            entityId: input.entityId,
            actionType: 'ts_case_open_requested',
            actionStatus: 'recorded',
            scoreId: String(scoreRow.id),
            signalIds,
            reason: 'High risk score requires Trust & Safety case intake.',
            evidence: computation.breakdown,
            actorType: 'system',
            metadata: { wave: 2, downstream: 'trust-safety-case' },
        });
    }

    await writeAudit(db, {
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: 'risk.score.compute',
        resourceType: 'risk_score',
        resourceId: String(scoreRow.id),
        reason: input.reason,
        metadata: { entity_type: input.entityType, entity_id: input.entityId, score: computation.score, band: computation.band },
    });

    return scoreRow;
}

router.get('/overview', requirePermission('risk:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [scoresResult, highTodayResult, signalsResult, actionsResult] = await Promise.all([
        db.from('risk_scores').select('id, band, status, score, entity_type, entity_id, site_id, scored_at', { count: 'exact' }).is('deleted_at', null).order('scored_at', { ascending: false }).limit(25),
        db.from('risk_scores').select('id', { count: 'exact', head: true }).eq('band', 'high').gte('scored_at', today.toISOString()).is('deleted_at', null),
        db.from('risk_signals').select('signal_type, severity').is('deleted_at', null).order('observed_at', { ascending: false }).limit(500),
        db.from('risk_action_events').select('id, action_type, action_status, reason, entity_type, entity_id, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(15),
    ]);

    if (scoresResult.error || highTodayResult.error || signalsResult.error || actionsResult.error) {
        const error = scoresResult.error || highTodayResult.error || signalsResult.error || actionsResult.error;
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                counts: {
                    total_scores_sampled: 0,
                    by_band: { low: 0, medium: 0, high: 0 },
                    high_today: 0,
                    restricted: 0,
                },
                thresholds: {
                    default_weights: RISK_DEFAULT_RULE_WEIGHTS,
                    bands: scoreRiskSignals([]).breakdown.bands,
                },
                top_signals: [],
                recent_scores: [],
                recent_actions: [],
            }));
        }
        throw new Error('Risk overview lookup failed');
    }

    const scores = (scoresResult.data || []) as JsonRecord[];
    const byBand = { low: 0, medium: 0, high: 0 };
    scores.forEach((score) => {
        if (score.band === 'low' || score.band === 'medium' || score.band === 'high') byBand[score.band] += 1;
    });

    const signalCounts = new Map<string, number>();
    ((signalsResult.data || []) as JsonRecord[]).forEach((signal) => {
        const type = String(signal.signal_type || 'unknown');
        signalCounts.set(type, (signalCounts.get(type) || 0) + 1);
    });

    await logSensitiveRead(c, {
        action: 'risk.overview.read',
        resourceType: 'risk_score',
        reason: 'Risk overview inspection',
        metadata: { score_rows_sampled: scores.length },
    });

    return c.json(success({
        counts: {
            total_scores_sampled: scores.length,
            by_band: byBand,
            high_today: highTodayResult.count || 0,
            restricted: scores.filter((score) => score.status === 'restricted').length,
        },
        thresholds: {
            default_weights: RISK_DEFAULT_RULE_WEIGHTS,
            bands: scoreRiskSignals([]).breakdown.bands,
        },
        top_signals: [...signalCounts.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, 8)
            .map(([signal_type, count]) => ({ signal_type, count })),
        recent_scores: scores,
        recent_actions: actionsResult.data || [],
    }));
});

router.get('/scores', requirePermission('risk:view'), async (c) => {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        band: c.req.query('band') || undefined,
        status: c.req.query('status') || undefined,
        entity_type: c.req.query('entity_type') || undefined,
        site_id: c.req.query('site_id') || undefined,
    });
    if (!parsed.success) throw new ValidationError('Invalid risk score list query', parsed.error.flatten());

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    let request = db
        .from('risk_scores')
        .select('id, site_id, entity_type, entity_id, score, band, breakdown, status, manual_decision, decision_reason, decided_by, decided_at, scored_at, created_at, updated_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('scored_at', { ascending: false })
        .range(from, to);

    if (parsed.data.band) request = request.eq('band', parsed.data.band);
    if (parsed.data.status) request = request.eq('status', parsed.data.status);
    if (parsed.data.entity_type) request = request.eq('entity_type', parsed.data.entity_type);
    if (parsed.data.site_id) request = request.eq('site_id', parsed.data.site_id);

    const { data, error, count } = await request;
    if (error) throw new Error('Risk score list failed');

    await logSensitiveRead(c, {
        action: 'risk.scores.read',
        resourceType: 'risk_score',
        reason: 'Risk score queue inspection',
        metadata: { filters: parsed.data },
    });

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.get('/scores/:id', requirePermission('risk:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const scoreId = c.req.param('id');
    const { data: score, error } = await db
        .from('risk_scores')
        .select('id, site_id, entity_type, entity_id, score, band, breakdown, status, manual_decision, decision_reason, decided_by, decided_at, scored_at, created_at, updated_at')
        .eq('id', scoreId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error('Risk score detail failed');
    if (!score) return c.json({ error: { code: 'NOT_FOUND', message: 'Risk score not found' } }, 404);

    const [signals, actions] = await Promise.all([
        db.from('risk_signals').select('*').eq('entity_type', score.entity_type).eq('entity_id', score.entity_id).is('deleted_at', null).order('observed_at', { ascending: false }).limit(100),
        db.from('risk_action_events').select('*').eq('score_id', score.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
    ]);
    if (signals.error || actions.error) throw new Error('Risk score evidence lookup failed');

    await logSensitiveRead(c, {
        action: 'risk.score.read',
        resourceType: 'risk_score',
        resourceId: scoreId,
        reason: 'Risk score detail inspection',
        metadata: { entity_type: score.entity_type, entity_id: score.entity_id },
    });

    return c.json(success({ score, signals: signals.data || [], actions: actions.data || [] }));
});

router.get('/review-queue', requirePermission('risk:decide'), async (c) => {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        band: c.req.query('band') || undefined,
        status: 'open',
    });
    if (!parsed.success) throw new ValidationError('Invalid risk review queue query', parsed.error.flatten());

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    let request = db
        .from('risk_scores')
        .select('id, site_id, entity_type, entity_id, score, band, breakdown, status, scored_at, created_at, updated_at', { count: 'exact' })
        .in('band', parsed.data.band ? [parsed.data.band] : ['medium', 'high'])
        .eq('status', 'open')
        .is('deleted_at', null)
        .order('scored_at', { ascending: false })
        .range(from, to);

    const { data, error, count } = await request;
    if (error) throw new Error('Risk review queue lookup failed');

    await logSensitiveRead(c, {
        action: 'risk.review_queue.read',
        resourceType: 'risk_score',
        reason: 'Risk review queue inspection',
        metadata: { band: parsed.data.band || 'medium_high' },
    });

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/signals', requirePermission('risk:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = RiskSignalCreateSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid risk signal payload', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('risk_signals')
        .insert({
            site_id: parsed.data.site_id || null,
            entity_type: parsed.data.entity_type,
            entity_id: parsed.data.entity_id,
            signal_type: parsed.data.signal_type,
            source: parsed.data.source,
            severity: parsed.data.severity,
            weight: parsed.data.weight ?? RISK_DEFAULT_RULE_WEIGHTS[parsed.data.signal_type],
            rule_id: parsed.data.rule_id || null,
            value: parsed.data.value ?? null,
            evidence: parsed.data.evidence,
            metadata: parsed.data.metadata,
            observed_at: parsed.data.observed_at || new Date().toISOString(),
            created_by: actorUserId(c),
        })
        .select('*')
        .single();

    if (error || !data) throw new Error('Risk signal create failed');

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'risk.signal.create',
        resourceType: 'risk_signal',
        resourceId: data.id,
        reason: 'Manual risk signal recorded',
        metadata: { entity_type: parsed.data.entity_type, entity_id: parsed.data.entity_id, signal_type: parsed.data.signal_type },
    });

    const signals = await fetchActiveSignals(db, parsed.data.entity_type, parsed.data.entity_id);
    const score = await scoreAndPersistEntity(db, {
        siteId: parsed.data.site_id || null,
        entityType: parsed.data.entity_type,
        entityId: parsed.data.entity_id,
        signals,
        reason: 'Risk signal created and score recomputed',
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
    });

    return c.json(success({ signal: data, score }), 201);
});

router.post('/score', requirePermission('risk:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = ScoreEntitySchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid risk scoring payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const db = getSupabaseAdmin(c);
    let signals: JsonRecord[] = [];

    if (parsed.data.signals.length > 0) {
        const rows = parsed.data.signals.map((signal) => ({
            site_id: parsed.data.site_id || null,
            entity_type: parsed.data.entity_type,
            entity_id: parsed.data.entity_id,
            signal_type: signal.signal_type || 'manual_review',
            source: signal.source || 'operations',
            severity: signal.severity || 'medium',
            weight: signal.weight ?? RISK_DEFAULT_RULE_WEIGHTS[signal.signal_type || 'manual_review'],
            rule_id: signal.rule_id || null,
            value: signal.value ?? null,
            evidence: signal.evidence || {},
            metadata: signal.metadata || {},
            observed_at: signal.observed_at || new Date().toISOString(),
            created_by: actorUserId(c),
        }));
        const { data, error } = await db.from('risk_signals').insert(rows).select('*');
        if (error) throw new Error('Risk scoring signal create failed');
        signals = (data || []) as JsonRecord[];
    } else {
        signals = await fetchActiveSignals(db, parsed.data.entity_type, parsed.data.entity_id);
    }

    const score = await scoreAndPersistEntity(db, {
        siteId: parsed.data.site_id || null,
        entityType: parsed.data.entity_type,
        entityId: parsed.data.entity_id,
        signals,
        reason,
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
    });

    return c.json(success({ score, signals }));
});

router.post('/scores/:id/decision', requirePermission('risk:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = RiskScoreDecisionBodySchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid risk decision payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const scoreId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const actorId = auth.user.id;
    const actorEmailAddress = auth.user.email || null;
    const status = parsed.data.decision === 'dismiss'
        ? 'dismissed'
        : parsed.data.decision === 'manual_block'
            ? 'restricted'
            : 'confirmed';

    const { data: score, error } = await db
        .from('risk_scores')
        .update({
            status,
            manual_decision: parsed.data.decision,
            decision_reason: reason,
            decided_by: actorId,
            decided_at: new Date().toISOString(),
            updated_by: actorId,
        })
        .eq('id', scoreId)
        .is('deleted_at', null)
        .select('id, site_id, entity_type, entity_id, score, band, breakdown, status, manual_decision, decision_reason, decided_by, decided_at, scored_at, created_at, updated_at')
        .single();

    if (error || !score) throw new Error('Risk decision update failed');

    if (parsed.data.decision === 'manual_block' && score.site_id) {
        await db
            .from('sites')
            .update({ status: 'suspended', updated_by: actorId })
            .eq('id', score.site_id);
    }

    await insertRiskActionEvent(db, {
        siteId: score.site_id || null,
        entityType: String(score.entity_type),
        entityId: String(score.entity_id),
        actionType: 'manual_decision',
        actionStatus: 'applied',
        scoreId: String(score.id),
        reason,
        evidence: { decision: parsed.data.decision, metadata: parsed.data.metadata },
        actorType: 'employee',
        actorId,
    });

    await writeAudit(db, {
        actorId,
        actorEmail: actorEmailAddress,
        action: 'risk.score.decision',
        resourceType: 'risk_score',
        resourceId: scoreId,
        reason,
        metadata: { decision: parsed.data.decision, status },
    });

    return c.json(success({ score }));
});

router.get('/rules', requirePermission('risk:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('risk_rules')
        .select('id, name, description, signal_type, predicate, weight, enabled, sandbox, action, version, metadata, activated_at, disabled_at, created_at, updated_at')
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (error) throw new Error('Risk rules list failed');

    await logSensitiveRead(c, {
        action: 'risk.rules.read',
        resourceType: 'risk_rule',
        reason: 'Risk rule policy inspection',
        metadata: { count: data?.length || 0 },
    });

    return c.json(success({ rules: data || [] }));
});

router.post('/rules', requirePermission('risk:rules'), async (c) => {
    const body = await readJson(c);
    const parsed = RiskRuleSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid risk rule payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const now = new Date().toISOString();
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('risk_rules')
        .insert({
            name: parsed.data.name,
            description: parsed.data.description || null,
            signal_type: parsed.data.signal_type,
            predicate: parsed.data.predicate,
            weight: parsed.data.weight,
            enabled: parsed.data.enabled,
            sandbox: parsed.data.sandbox,
            action: parsed.data.action,
            metadata: parsed.data.metadata,
            created_by: actorUserId(c),
            updated_by: actorUserId(c),
            activated_by: parsed.data.enabled ? actorUserId(c) : null,
            activated_at: parsed.data.enabled ? now : null,
        })
        .select('*')
        .single();

    if (error || !data) throw new Error('Risk rule create failed');

    await insertRiskActionEvent(db, {
        entityType: 'site',
        entityId: 'risk-policy',
        actionType: 'rule_change',
        actionStatus: 'recorded',
        ruleId: data.id,
        reason,
        evidence: { rule: data },
        actorType: 'employee',
        actorId: actorUserId(c),
    });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'risk.rule.create',
        resourceType: 'risk_rule',
        resourceId: data.id,
        reason,
        metadata: { enabled: parsed.data.enabled, sandbox: parsed.data.sandbox },
    });

    return c.json(success({ rule: data }), 201);
});

router.patch('/rules/:id', requirePermission('risk:rules'), async (c) => {
    const body = await readJson(c);
    const parsed = RiskRulePatchSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid risk rule update payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);

    const ruleId = c.req.param('id');
    const now = new Date().toISOString();
    const patch: JsonRecord = {
        updated_by: actorUserId(c),
    };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.signal_type !== undefined) patch.signal_type = parsed.data.signal_type;
    if (parsed.data.predicate !== undefined) patch.predicate = parsed.data.predicate;
    if (parsed.data.weight !== undefined) patch.weight = parsed.data.weight;
    if (parsed.data.sandbox !== undefined) patch.sandbox = parsed.data.sandbox;
    if (parsed.data.action !== undefined) patch.action = parsed.data.action;
    if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
    if (parsed.data.enabled !== undefined) {
        patch.enabled = parsed.data.enabled;
        patch.activated_by = parsed.data.enabled ? actorUserId(c) : null;
        patch.activated_at = parsed.data.enabled ? now : null;
        patch.disabled_at = parsed.data.enabled ? null : now;
    }
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('risk_rules')
        .update(patch)
        .eq('id', ruleId)
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error || !data) throw new Error('Risk rule update failed');

    await insertRiskActionEvent(db, {
        entityType: 'site',
        entityId: 'risk-policy',
        actionType: 'rule_change',
        actionStatus: 'recorded',
        ruleId,
        reason,
        evidence: { patch },
        actorType: 'employee',
        actorId: actorUserId(c),
    });
    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'risk.rule.update',
        resourceType: 'risk_rule',
        resourceId: ruleId,
        reason,
        metadata: { patch },
    });

    return c.json(success({ rule: data }));
});

export default router;
