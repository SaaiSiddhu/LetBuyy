import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    buildMarketplaceReviewAutomatedChecks,
    evaluateMarketplaceReviewChecks,
    type ReviewCheckEvaluation,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { ValidationError } from '../../lib/errors';
import {
    MARKETPLACE_REVIEW_RECORD_COLUMNS,
    type MarketplaceReviewDecision,
    type MarketplaceReviewRecord,
} from '../../lib/marketplace-review-records';
import { getSupabaseAdmin, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import { getRequestId } from '../../lib/tenant-context';
import {
    logSensitiveRead,
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../../middleware/rbac';
import {
    MarketplaceReviewDecisionSchema,
    MarketplaceReviewListQuerySchema,
} from '../../schemas/operations.schema';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

const AssignReviewSchema = z.object({
    assignee_id: z.string().uuid(),
    reason: z.string().trim().min(8).max(1000),
});

const ClaimReviewSchema = z.object({
    reason: z.string().trim().min(8).max(1000),
});

const CommentReviewSchema = z.object({
    comment: z.string().trim().min(3).max(5000),
    visibility: z.enum(['internal', 'developer']).default('internal'),
});

function actorId(c: AppContext): string {
    return c.get('auth').user.id;
}

function actorEmail(c: AppContext): string | null {
    return c.get('auth').user.email || null;
}

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
}

function asJsonRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseMarketplaceReviewListQuery(c: AppContext) {
    const parsed = MarketplaceReviewListQuerySchema.safeParse({
        status: c.req.query('status') || undefined,
        submission_type: c.req.query('submission_type') || undefined,
        limit: c.req.query('limit') || undefined,
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid marketplace review list query', parsed.error.flatten());
    }

    return parsed.data;
}

function marketplaceAppStatusForDecision(decision: MarketplaceReviewDecision): 'published' | 'rejected' | 'in_review' {
    if (decision === 'approved') return 'published';
    if (decision === 'rejected') return 'rejected';
    return 'in_review';
}

function themePackageStatusForDecision(decision: MarketplaceReviewDecision): 'active' | 'disabled' | 'draft' {
    if (decision === 'approved') return 'active';
    if (decision === 'rejected') return 'disabled';
    return 'draft';
}

function themeVersionStatusForDecision(decision: MarketplaceReviewDecision): 'published' | 'revoked' | 'draft' {
    if (decision === 'approved') return 'published';
    if (decision === 'rejected') return 'revoked';
    return 'draft';
}

function eventTypeForMarketplaceReview(
    record: MarketplaceReviewRecord,
    decision: MarketplaceReviewDecision,
): 'app.approved' | 'app.rejected' | 'theme.approved' | 'theme.rejected' | null {
    if (record.submission_type === 'app' && decision === 'approved') return 'app.approved';
    if (record.submission_type === 'app' && decision === 'rejected') return 'app.rejected';
    if (record.submission_type === 'theme' && decision === 'approved') return 'theme.approved';
    if (record.submission_type === 'theme' && decision === 'rejected') return 'theme.rejected';
    return null;
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

async function readReviewRecord(db: Db, reviewId: string): Promise<MarketplaceReviewRecord | null> {
    const { data, error } = await db
        .from('marketplace_review_records')
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .eq('id', reviewId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Marketplace review lookup failed: ${error.message}`);
    return data ? data as unknown as MarketplaceReviewRecord : null;
}

async function readReviewCheckRuns(db: Db, reviewId: string): Promise<JsonRecord[]> {
    const { data, error } = await db
        .from('review_check_runs')
        .select('id, review_record_id, submission_type, resource_id, check_type, result, title, summary, detail, evidence, hard_fail, started_at, completed_at, actor_type, actor_id, request_id, metadata, created_at, updated_at, deleted_at')
        .eq('review_record_id', reviewId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        if (/review_check_runs/i.test(error.message)) return [];
        throw new Error(`Review check run lookup failed: ${error.message}`);
    }

    return (data || []) as JsonRecord[];
}

async function readReviewResource(db: Db, record: MarketplaceReviewRecord): Promise<JsonRecord> {
    if (record.submission_type === 'app') {
        const { data, error } = await db
            .from('marketplace_apps')
            .select('id, slug, name, status, developer_id, oauth_redirect_uris, api_scopes, webhook_url, app_url, privacy_policy_url, terms_url, metadata, discovery_metadata, data_handling')
            .eq('id', record.resource_id)
            .maybeSingle();

        if (error) throw new Error(`Marketplace app lookup failed: ${error.message}`);
        return asJsonRecord(data);
    }

    const [{ data: themePackage, error: packageError }, { data: latestVersion, error: versionError }] = await Promise.all([
        db
            .from('theme_packages')
            .select('id, slug, name, status, marketplace_metadata, legacy_theme_id')
            .eq('id', record.resource_id)
            .maybeSingle(),
        db
            .from('theme_package_versions')
            .select('id, theme_package_id, version, version_number, release_status, renderer_version, schema_version, compatibility_range, package_manifest, checksum, published_at')
            .eq('theme_package_id', record.resource_id)
            .is('deleted_at', null)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (packageError) throw new Error(`Theme package lookup failed: ${packageError.message}`);
    if (versionError) throw new Error(`Theme package version lookup failed: ${versionError.message}`);

    return {
        ...asJsonRecord(themePackage),
        latest_version: asJsonRecord(latestVersion),
        package_manifest: asJsonRecord(asJsonRecord(latestVersion).package_manifest),
        marketplace_metadata: asJsonRecord(asJsonRecord(themePackage).marketplace_metadata),
    };
}

async function publishMarketplaceAppReviewDecision(
    db: Db,
    record: MarketplaceReviewRecord,
    decision: MarketplaceReviewDecision,
): Promise<JsonRecord> {
    const { data, error } = await db
        .from('marketplace_apps')
        .update({ status: marketplaceAppStatusForDecision(decision) })
        .eq('id', record.resource_id)
        .select('id, developer_id, slug, name, status')
        .single();

    if (error || !data) {
        throw new Error(`Marketplace app review decision failed: ${error?.message || 'app not found'}`);
    }

    return asJsonRecord(data);
}

async function publishThemeReviewDecision(
    db: Db,
    record: MarketplaceReviewRecord,
    decision: MarketplaceReviewDecision,
    reviewedAt: string,
): Promise<JsonRecord> {
    const { data: themePackage, error: packageError } = await db
        .from('theme_packages')
        .update({ status: themePackageStatusForDecision(decision) })
        .eq('id', record.resource_id)
        .select('id, slug, name, status, legacy_theme_id')
        .single();

    if (packageError || !themePackage) {
        throw new Error(`Theme package review decision failed: ${packageError?.message || 'theme package not found'}`);
    }

    const { data: latestVersion, error: versionLookupError } = await db
        .from('theme_package_versions')
        .select('id, version, version_number')
        .eq('theme_package_id', record.resource_id)
        .is('deleted_at', null)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (versionLookupError || !latestVersion) {
        throw new Error(`Theme package version lookup failed: ${versionLookupError?.message || 'theme version not found'}`);
    }

    const { data: version, error: versionError } = await db
        .from('theme_package_versions')
        .update({
            release_status: themeVersionStatusForDecision(decision),
            published_at: decision === 'approved' ? reviewedAt : null,
        })
        .eq('id', stringOrNull(asJsonRecord(latestVersion).id) || '')
        .select('id, version, version_number, release_status, published_at')
        .single();

    if (versionError || !version) {
        throw new Error(`Theme package version review decision failed: ${versionError?.message || 'theme version not found'}`);
    }

    const legacyThemeId = stringOrNull(asJsonRecord(themePackage).legacy_theme_id);
    if (legacyThemeId) {
        const { error: legacyThemeError } = await db
            .from('themes')
            .update({ is_active: decision === 'approved' })
            .eq('id', legacyThemeId);

        if (legacyThemeError) {
            throw new Error(`Theme legacy listing update failed: ${legacyThemeError.message}`);
        }
    }

    return {
        ...asJsonRecord(themePackage),
        version: asJsonRecord(version),
    };
}

async function emitMarketplaceReviewDecisionEvent(
    db: Db,
    input: {
        record: MarketplaceReviewRecord;
        resource: JsonRecord;
        eventType: 'app.approved' | 'app.rejected' | 'theme.approved' | 'theme.rejected';
        actorId: string;
        requestId: string;
    },
): Promise<void> {
    if (input.record.submission_type === 'app') {
        const appId = stringOrNull(input.resource.id) || input.record.resource_id;
        const partnerId = stringOrNull(input.resource.developer_id) || input.record.app_developer_id;
        if (!partnerId) throw new Error('Marketplace app review event requires a partner id');

        await new EventExecutionAdapter(db).emitDomainEvent({
            storeId: null,
            aggregateType: 'app',
            aggregateId: appId,
            eventType: input.eventType,
            payload: {
                app_id: appId,
                partner_id: partnerId,
                review_id: input.record.id,
                reviewer_id: input.actorId,
            },
            idempotencyKey: `${input.eventType}:${input.record.id}`,
            requestId: input.requestId,
            actorId: input.actorId,
        });
        return;
    }

    const version = asJsonRecord(input.resource.version);
    const themeVersionId = stringOrNull(version.id);
    if (!themeVersionId) throw new Error('Theme review event requires a theme version id');

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: null,
        aggregateType: 'theme',
        aggregateId: input.record.resource_id,
        eventType: input.eventType,
        payload: {
            theme_package_id: input.record.resource_id,
            theme_version_id: themeVersionId,
            partner_id: input.record.partner_user_id,
            review_id: input.record.id,
            reviewer_id: input.actorId,
        },
        idempotencyKey: `${input.eventType}:${input.record.id}:${themeVersionId}`,
        requestId: input.requestId,
        actorId: input.actorId,
    });
}

async function updateReviewMetadata(
    db: Db,
    record: MarketplaceReviewRecord,
    metadata: JsonRecord,
    reviewerId: string,
): Promise<MarketplaceReviewRecord> {
    const { data, error } = await db
        .from('marketplace_review_records')
        .update({
            metadata,
            updated_by: reviewerId,
        })
        .eq('id', record.id)
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .single();

    if (error || !data) throw new Error(`Marketplace review metadata update failed: ${error?.message || 'record not found'}`);
    return data as unknown as MarketplaceReviewRecord;
}

async function persistReviewCheckRuns(
    db: Db,
    record: MarketplaceReviewRecord,
    checks: ReviewCheckEvaluation[],
    input: {
        actorType: 'employee' | 'worker';
        actorId?: string | null;
        requestId?: string | null;
    },
): Promise<JsonRecord[]> {
    const now = new Date().toISOString();
    const rows = checks.map((check) => ({
        review_record_id: record.id,
        submission_type: record.submission_type,
        resource_id: record.resource_id,
        check_type: check.check_type,
        result: check.result,
        title: check.title,
        summary: check.summary,
        detail: check.detail,
        evidence: check.evidence,
        hard_fail: check.hard_fail,
        started_at: now,
        completed_at: now,
        actor_type: input.actorType,
        actor_id: input.actorId || null,
        request_id: input.requestId || null,
        metadata: {
            source: 'operations-api',
        },
        created_by: input.actorId || null,
        updated_by: input.actorId || null,
    }));

    const { data, error } = await db
        .from('review_check_runs')
        .insert(rows)
        .select('id, review_record_id, submission_type, resource_id, check_type, result, title, summary, detail, evidence, hard_fail, started_at, completed_at, actor_type, actor_id, request_id, metadata, created_at, updated_at, deleted_at');

    if (error) throw new Error(`Review check run persistence failed: ${error.message}`);
    return (data || []) as JsonRecord[];
}

async function runAutomatedChecks(
    db: Db,
    record: MarketplaceReviewRecord,
    input: {
        actorId: string;
        actorEmail: string | null;
        requestId: string;
    },
) {
    const resource = await readReviewResource(db, record);
    const checks = evaluateMarketplaceReviewChecks({
        submission_type: record.submission_type,
        metadata: record.metadata,
        automated_checks: record.automated_checks,
        resource,
    });
    const summary = buildMarketplaceReviewAutomatedChecks({
        source: 'operations-review-runner',
        checks,
        metadata: {
            review_id: record.id,
            resource_id: record.resource_id,
            submission_type: record.submission_type,
        },
    });
    const checkRuns = await persistReviewCheckRuns(db, record, checks, {
        actorType: 'employee',
        actorId: input.actorId,
        requestId: input.requestId,
    });
    const metadata = {
        ...asJsonRecord(record.metadata),
        last_check_run_at: summary.checked_at,
        last_check_run_by: input.actorId,
    };
    const { data, error } = await db
        .from('marketplace_review_records')
        .update({
            automated_checks: summary,
            status: record.status === 'pending' ? 'in_review' : record.status,
            metadata,
            updated_by: input.actorId,
        })
        .eq('id', record.id)
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .single();

    if (error || !data) throw new Error(`Marketplace review automated-check update failed: ${error?.message || 'record not found'}`);

    await writeAudit(db, {
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: 'marketplace.review.check_run',
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        reason: 'Automated app/theme review checks executed.',
        metadata: { summary, check_run_count: checkRuns.length },
    });

    return {
        reviewRecord: data as unknown as MarketplaceReviewRecord,
        checkRuns,
        automatedChecks: summary,
        resource,
    };
}

function approvalBlocked(record: MarketplaceReviewRecord): { code: string; message: string } | null {
    const checks = asJsonRecord(record.automated_checks);
    if (!checks.checked_at) {
        return {
            code: 'REVIEW_CHECKS_REQUIRED',
            message: 'Automated checks must run before approval.',
        };
    }

    if (String(checks.status || '') === 'failed' || Number(checks.hard_fail_count || 0) > 0) {
        return {
            code: 'REVIEW_CHECKS_BLOCKING',
            message: 'Hard-failed automated checks block approval until changes are requested or the submission is rejected.',
        };
    }

    return null;
}

router.get('/', requirePermission('review:view'), async (c) => {
    const query = parseMarketplaceReviewListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('marketplace_review_records')
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(query.limit);

    if (query.status) request = request.eq('status', query.status);
    if (query.submission_type) request = request.eq('submission_type', query.submission_type);

    const { data, error } = await request;
    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({ review_records: [] }));
        }
        throw new Error(`Marketplace review list failed: ${error.message}`);
    }

    return c.json(success({ review_records: (data || []) as unknown as MarketplaceReviewRecord[] }));
});

router.get('/:id', requirePermission('review:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const reviewId = c.req.param('id');
    const record = await readReviewRecord(db, reviewId);
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    await logSensitiveRead(c, {
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        action: 'marketplace.review.view',
        reason: 'Marketplace reviewer opened app/theme submission detail.',
        metadata: { submission_type: record.submission_type, resource_id: record.resource_id },
    });

    const [checkRuns, resource] = await Promise.all([
        readReviewCheckRuns(db, record.id),
        readReviewResource(db, record),
    ]);

    return c.json(success({ review_record: record, check_runs: checkRuns, resource }));
});

router.post('/:id/claim', requirePermission('review:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = ClaimReviewSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid marketplace review claim request', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'Review claims require a reason.' } }, 400);

    const db = getSupabaseAdmin(c);
    const reviewerId = actorId(c);
    const record = await readReviewRecord(db, c.req.param('id'));
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    const metadata = asJsonRecord(record.metadata);
    const { data: updatedRecord, error: updateError } = await db
        .from('marketplace_review_records')
        .update({
            status: 'in_review',
            metadata: {
                ...metadata,
                assignment: {
                    assignee_id: reviewerId,
                    claimed_by: reviewerId,
                    claimed_at: new Date().toISOString(),
                },
            },
            updated_by: reviewerId,
        })
        .eq('id', record.id)
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .single();

    if (updateError || !updatedRecord) {
        throw new Error(`Marketplace review claim failed: ${updateError?.message || 'record not found'}`);
    }

    const updated = updatedRecord as unknown as MarketplaceReviewRecord;

    await writeAudit(db, {
        actorId: reviewerId,
        actorEmail: actorEmail(c),
        action: 'marketplace.review.claim',
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        reason,
        metadata: { submission_type: record.submission_type },
    });

    return c.json(success({ review_record: updated }));
});

router.patch('/:id/assign', requirePermission('review:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = AssignReviewSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid marketplace review assignment request', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'Review assignment requires a reason.' } }, 400);

    const db = getSupabaseAdmin(c);
    const reviewerId = actorId(c);
    const record = await readReviewRecord(db, c.req.param('id'));
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    const metadata = asJsonRecord(record.metadata);
    const updated = await updateReviewMetadata(db, record, {
        ...metadata,
        assignment: {
            assignee_id: parsed.data.assignee_id,
            assigned_by: reviewerId,
            assigned_at: new Date().toISOString(),
        },
    }, reviewerId);

    await writeAudit(db, {
        actorId: reviewerId,
        actorEmail: actorEmail(c),
        action: 'marketplace.review.assign',
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        reason,
        metadata: { assignee_id: parsed.data.assignee_id, submission_type: record.submission_type },
    });

    return c.json(success({ review_record: updated }));
});

router.post('/:id/comments', requirePermission('review:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = CommentReviewSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid marketplace review comment request', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const reviewerId = actorId(c);
    const record = await readReviewRecord(db, c.req.param('id'));
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    const metadata = asJsonRecord(record.metadata);
    const comments = Array.isArray(metadata.comments) ? metadata.comments : [];
    const comment = {
        id: crypto.randomUUID(),
        body: parsed.data.comment,
        visibility: parsed.data.visibility,
        actor_id: reviewerId,
        created_at: new Date().toISOString(),
    };
    const updated = await updateReviewMetadata(db, record, {
        ...metadata,
        comments: [...comments, comment].slice(-100),
    }, reviewerId);

    await writeAudit(db, {
        actorId: reviewerId,
        actorEmail: actorEmail(c),
        action: 'marketplace.review.comment',
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        reason: parsed.data.comment,
        metadata: { visibility: parsed.data.visibility, comment_id: comment.id },
    });

    return c.json(success({ review_record: updated, comment }));
});

router.post('/:id/run-checks', requirePermission('review:decide'), async (c) => {
    const db = getSupabaseAdmin(c);
    const record = await readReviewRecord(db, c.req.param('id'));
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    const result = await runAutomatedChecks(db, record, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        requestId: getRequestId(c),
    });

    return c.json(success({
        review_record: result.reviewRecord,
        check_runs: result.checkRuns,
        automated_checks: result.automatedChecks,
        resource: result.resource,
    }));
});

router.post('/:id/decision', requirePermission('review:decide'), async (c) => {
    const body = await readJson(c);
    const parsed = MarketplaceReviewDecisionSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid marketplace review decision request', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json(
            { error: { code: 'REASON_REQUIRED', message: 'Marketplace review decisions require a reason.' } },
            400,
        );
    }

    const reviewId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const reviewerId = actorId(c);
    const reviewedAt = new Date().toISOString();
    const record = await readReviewRecord(db, reviewId);
    if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Marketplace review record not found' } }, 404);

    if (parsed.data.decision === 'approved') {
        const blocked = approvalBlocked(record);
        if (blocked) return c.json({ error: blocked }, 409);
    }

    const resource = record.submission_type === 'app'
        ? await publishMarketplaceAppReviewDecision(db, record, parsed.data.decision)
        : await publishThemeReviewDecision(db, record, parsed.data.decision, reviewedAt);

    const { data: updatedRecord, error: updateError } = await db
        .from('marketplace_review_records')
        .update({
            status: parsed.data.decision,
            reviewed_by: reviewerId,
            reviewed_at: reviewedAt,
            review_notes: parsed.data.reason || null,
            updated_by: reviewerId,
            metadata: {
                ...asJsonRecord(record.metadata),
                decided_at: reviewedAt,
                decided_by: reviewerId,
            },
        })
        .eq('id', record.id)
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .single();

    if (updateError || !updatedRecord) {
        throw new Error(`Marketplace review update failed: ${updateError?.message || 'record not found'}`);
    }

    const reviewRecord = updatedRecord as unknown as MarketplaceReviewRecord;
    const eventType = eventTypeForMarketplaceReview(reviewRecord, parsed.data.decision);
    if (eventType) {
        await emitMarketplaceReviewDecisionEvent(db, {
            record: reviewRecord,
            resource,
            eventType,
            actorId: reviewerId,
            requestId: getRequestId(c),
        });
    }

    await writeAudit(db, {
        actorId: reviewerId,
        actorEmail: actorEmail(c),
        action: 'marketplace.review.decision',
        resourceType: 'marketplace_review_record',
        resourceId: record.id,
        reason,
        metadata: {
            decision: parsed.data.decision,
            event_type: eventType,
            submission_type: record.submission_type,
        },
    });

    return c.json(success({
        review_record: reviewRecord,
        resource,
        event_type: eventType,
    }));
});

export default router;
