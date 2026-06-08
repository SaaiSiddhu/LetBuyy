import {
  insertSupabaseRows,
  patchSupabaseRows,
  selectSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
  buildMarketplaceReviewAutomatedChecks,
  evaluateMarketplaceReviewChecks,
  type JsonRecord,
  type MarketplaceSubmissionType,
  type ReviewCheckEvaluation,
} from '@letbuyy/shared-types';

export interface ReviewCheckDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

interface ReviewRecord {
  id: string;
  submission_type: MarketplaceSubmissionType;
  resource_id: string;
  resource_slug: string | null;
  resource_name: string;
  partner_user_id: string;
  app_developer_id: string | null;
  status: string;
  automated_checks: JsonRecord;
  metadata: JsonRecord;
}

export interface ReviewCheckWorkerResult {
  processed: number;
  skipped: number;
  checksWritten: number;
  failed: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function jsonField(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

export function isReviewCheckJob(jobType: string): boolean {
  return jobType === 'marketplace.review.run_checks';
}

async function readReviewRecord(env: SupabaseServiceEnv, reviewId: string): Promise<ReviewRecord | null> {
  const [record] = await selectSupabaseRows<ReviewRecord>(env, 'marketplace_review_records', {
    select: 'id,submission_type,resource_id,resource_slug,resource_name,partner_user_id,app_developer_id,status,automated_checks,metadata',
    id: `eq.${reviewId}`,
    deleted_at: 'is.null',
    limit: '1',
  });

  return record || null;
}

async function readReviewResource(env: SupabaseServiceEnv, record: ReviewRecord): Promise<JsonRecord> {
  if (record.submission_type === 'app') {
    const [app] = await selectSupabaseRows<JsonRecord>(env, 'marketplace_apps', {
      select: 'id,slug,name,status,developer_id,oauth_redirect_uris,api_scopes,webhook_url,app_url,privacy_policy_url,terms_url,metadata,discovery_metadata,data_handling',
      id: `eq.${record.resource_id}`,
      limit: '1',
    });
    return jsonField(app);
  }

  const [themePackage] = await selectSupabaseRows<JsonRecord>(env, 'theme_packages', {
    select: 'id,slug,name,status,marketplace_metadata,legacy_theme_id',
    id: `eq.${record.resource_id}`,
    deleted_at: 'is.null',
    limit: '1',
  });
  const [latestVersion] = await selectSupabaseRows<JsonRecord>(env, 'theme_package_versions', {
    select: 'id,theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at',
    theme_package_id: `eq.${record.resource_id}`,
    deleted_at: 'is.null',
    order: 'version_number.desc',
    limit: '1',
  });

  return {
    ...jsonField(themePackage),
    latest_version: jsonField(latestVersion),
    package_manifest: jsonField(jsonField(latestVersion).package_manifest),
    marketplace_metadata: jsonField(jsonField(themePackage).marketplace_metadata),
  };
}

async function persistCheckRuns(
  env: SupabaseServiceEnv,
  record: ReviewRecord,
  checks: ReviewCheckEvaluation[],
  requestId: string | null,
): Promise<number> {
  const now = new Date().toISOString();
  await insertSupabaseRows(env, 'review_check_runs', checks.map((check) => ({
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
    actor_type: 'worker',
    actor_id: null,
    request_id: requestId,
    metadata: {
      source: 'queue-workers',
    },
  })));

  return checks.length;
}

async function recordAudit(env: SupabaseServiceEnv, input: {
  reviewId: string;
  reason: string;
  metadata: JsonRecord;
}): Promise<void> {
  await insertSupabaseRows(env, 'audit_logs', {
    actor_id: null,
    actor_type: 'system',
    actor_email: null,
    action: 'marketplace.review.check_run',
    resource_type: 'marketplace_review_record',
    resource_id: input.reviewId,
    metadata: {
      ...input.metadata,
      reason: input.reason,
    },
  });
}

async function processReviewChecks(
  env: SupabaseServiceEnv,
  payload: JsonRecord,
  requestId: string | null,
): Promise<number> {
  const reviewId = stringField(payload.review_id);
  if (!reviewId) throw new Error('marketplace.review.run_checks requires review_id');

  const record = await readReviewRecord(env, reviewId);
  if (!record) throw new Error(`Marketplace review record not found: ${reviewId}`);

  const resource = await readReviewResource(env, record);
  const checks = evaluateMarketplaceReviewChecks({
    submission_type: record.submission_type,
    metadata: record.metadata,
    automated_checks: record.automated_checks,
    resource,
  });
  const automatedChecks = buildMarketplaceReviewAutomatedChecks({
    source: 'queue-review-runner',
    checks,
    metadata: {
      review_id: record.id,
      resource_id: record.resource_id,
      submission_type: record.submission_type,
    },
  });
  const checkCount = await persistCheckRuns(env, record, checks, requestId);

  await patchSupabaseRows(env, 'marketplace_review_records', { id: `eq.${record.id}` }, {
    automated_checks: automatedChecks,
    status: record.status === 'pending' ? 'in_review' : record.status,
    metadata: {
      ...jsonField(record.metadata),
      last_check_run_at: automatedChecks.checked_at,
      last_check_run_by: 'queue-workers',
    },
  }, 'return=minimal');

  await recordAudit(env, {
    reviewId: record.id,
    reason: 'Automated app/theme review checks executed by queue worker.',
    metadata: { summary: automatedChecks, check_count: checkCount },
  });

  return checkCount;
}

export async function processReviewCheckDeliveries(
  env: SupabaseServiceEnv,
  deliveries: ReviewCheckDelivery[],
): Promise<ReviewCheckWorkerResult> {
  const result: ReviewCheckWorkerResult = {
    processed: 0,
    skipped: 0,
    checksWritten: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isReviewCheckJob(delivery.input.jobType)) {
      result.skipped += 1;
      continue;
    }

    try {
      const payload = isRecord(delivery.input.payload) ? delivery.input.payload : {};
      result.checksWritten += await processReviewChecks(env, payload, delivery.input.requestId);
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
