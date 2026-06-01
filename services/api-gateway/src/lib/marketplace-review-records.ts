import type { getSupabaseAdmin } from './supabase';

export type MarketplaceSubmissionType = 'app' | 'theme';
export type MarketplaceReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';
export type MarketplaceReviewDecision = Extract<MarketplaceReviewStatus, 'approved' | 'rejected' | 'changes_requested'>;

type JsonRecord = Record<string, unknown>;

export const MARKETPLACE_REVIEW_RECORD_COLUMNS = [
    'id',
    'submission_type',
    'resource_id',
    'resource_slug',
    'resource_name',
    'partner_user_id',
    'app_developer_id',
    'status',
    'automated_checks',
    'submitted_at',
    'reviewed_by',
    'reviewed_at',
    'review_notes',
    'metadata',
    'created_at',
    'updated_at',
    'deleted_at',
].join(', ');

type MarketplaceReviewInsert = {
    submission_type: MarketplaceSubmissionType;
    resource_id: string;
    resource_slug: string | null;
    resource_name: string;
    partner_user_id: string;
    app_developer_id: string | null;
    status: MarketplaceReviewStatus;
    automated_checks: JsonRecord;
    submitted_at: string;
    metadata: JsonRecord;
    created_by: string | null;
    updated_by: string | null;
};

type MarketplaceReviewDb = ReturnType<typeof getSupabaseAdmin>;

export type MarketplaceReviewRecord = {
    id: string;
    submission_type: MarketplaceSubmissionType;
    resource_id: string;
    resource_slug: string | null;
    resource_name: string;
    partner_user_id: string;
    app_developer_id: string | null;
    status: MarketplaceReviewStatus;
    automated_checks: JsonRecord;
    submitted_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    metadata: JsonRecord;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type MarketplaceReviewCheck = {
    name: string;
    status: 'passed' | 'warning' | 'failed';
    message: string;
};

export type MarketplaceReviewInput = {
    submissionType: MarketplaceSubmissionType;
    resourceId: string;
    resourceSlug?: string | null;
    resourceName: string;
    partnerUserId: string;
    appDeveloperId?: string | null;
    actorId?: string | null;
    automatedChecks: JsonRecord;
    metadata?: JsonRecord;
    status?: MarketplaceReviewStatus;
};

export function buildMarketplaceAutomatedChecks(input: {
    source: string;
    checks: MarketplaceReviewCheck[];
    metadata?: JsonRecord;
}): JsonRecord {
    const failed = input.checks.filter((check) => check.status === 'failed');
    const warnings = input.checks.filter((check) => check.status === 'warning');

    return {
        status: failed.length > 0 ? 'failed' : 'passed',
        checked_at: new Date().toISOString(),
        source: input.source,
        checks: input.checks,
        failed_count: failed.length,
        warning_count: warnings.length,
        metadata: input.metadata ?? {},
    };
}

export async function createMarketplaceReviewRecord(
    db: MarketplaceReviewDb,
    input: MarketplaceReviewInput,
): Promise<MarketplaceReviewRecord> {
    const submittedAt = new Date().toISOString();
    const reviewInsert: MarketplaceReviewInsert = {
        submission_type: input.submissionType,
        resource_id: input.resourceId,
        resource_slug: input.resourceSlug ?? null,
        resource_name: input.resourceName,
        partner_user_id: input.partnerUserId,
        app_developer_id: input.appDeveloperId ?? null,
        status: input.status ?? 'pending',
        automated_checks: input.automatedChecks,
        submitted_at: submittedAt,
        metadata: input.metadata ?? {},
        created_by: input.actorId ?? input.partnerUserId,
        updated_by: input.actorId ?? input.partnerUserId,
    };
    const { data, error } = await db
        .from('marketplace_review_records')
        .insert(reviewInsert)
        .select(MARKETPLACE_REVIEW_RECORD_COLUMNS)
        .single();

    if (error) {
        throw new Error(`Marketplace review record creation failed: ${error.message}`);
    }

    return data as unknown as MarketplaceReviewRecord;
}
