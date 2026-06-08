import {
  insertSupabaseRows,
  selectSupabaseRows,
  upsertSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
  RISK_DEFAULT_RULE_WEIGHTS,
  RiskEntityTypeSchema,
  RiskSignalSeveritySchema,
  RiskSignalTypeSchema,
  scoreRiskSignals,
  type JsonRecord,
  type RiskSignalForScoring,
} from '@letbuyy/shared-types';

export interface RiskQueueDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

interface RiskScorePayload {
  siteId: string | null;
  entityType: string;
  entityId: string;
  reason: string;
  signals: Array<{
    signal_type: string;
    source: string;
    severity: string;
    weight: number;
    rule_id: string | null;
    value: number | null;
    evidence: JsonRecord;
    metadata: JsonRecord;
  }>;
}

export interface RiskScoringResult {
  processed: number;
  skipped: number;
  restricted: number;
  failed: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function recordField(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizeSignal(value: unknown): RiskScorePayload['signals'][number] | null {
  if (!isRecord(value)) return null;
  const signalType = RiskSignalTypeSchema.safeParse(value.signal_type).success ? String(value.signal_type) : null;
  if (!signalType) return null;
  const severity = RiskSignalSeveritySchema.safeParse(value.severity).success ? String(value.severity) : 'medium';
  const defaultWeight = RISK_DEFAULT_RULE_WEIGHTS[signalType as keyof typeof RISK_DEFAULT_RULE_WEIGHTS] || 15;
  const rawWeight = typeof value.weight === 'number' && Number.isFinite(value.weight) ? value.weight : defaultWeight;

  return {
    signal_type: signalType,
    source: stringField(value.source) || 'queue-workers',
    severity,
    weight: Math.max(0, Math.min(100, Math.round(rawWeight))),
    rule_id: stringField(value.rule_id),
    value: typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null,
    evidence: recordField(value.evidence),
    metadata: recordField(value.metadata),
  };
}

export function normalizeRiskScorePayload(payload: Record<string, unknown>, fallbackSiteId: string | null): RiskScorePayload | null {
  const entityType = RiskEntityTypeSchema.safeParse(payload.entity_type).success ? String(payload.entity_type) : null;
  const entityId = stringField(payload.entity_id);
  if (!entityType || !entityId) return null;

  const signals = Array.isArray(payload.signals)
    ? payload.signals.map(normalizeSignal).filter((signal): signal is RiskScorePayload['signals'][number] => Boolean(signal))
    : [];

  return {
    siteId: stringField(payload.site_id) || fallbackSiteId,
    entityType,
    entityId,
    reason: stringField(payload.reason) || 'Risk score recomputed by queue worker.',
    signals,
  };
}

function scoringSignal(row: JsonRecord): RiskSignalForScoring {
  return {
    id: stringField(row.id),
    rule_id: stringField(row.rule_id),
    signal_type: String(row.signal_type || 'manual_review'),
    severity: stringField(row.severity) || 'medium',
    weight: typeof row.weight === 'number' ? row.weight : null,
    evidence: recordField(row.evidence),
    metadata: recordField(row.metadata),
  };
}

async function readExistingSignals(env: SupabaseServiceEnv, payload: RiskScorePayload): Promise<JsonRecord[]> {
  return selectSupabaseRows<JsonRecord>(env, 'risk_signals', {
    select: 'id,rule_id,signal_type,severity,weight,evidence,metadata,observed_at',
    entity_type: `eq.${payload.entityType}`,
    entity_id: `eq.${payload.entityId}`,
    deleted_at: 'is.null',
    order: 'observed_at.desc',
    limit: '100',
  });
}

async function insertSignals(env: SupabaseServiceEnv, payload: RiskScorePayload): Promise<JsonRecord[]> {
  if (payload.signals.length === 0) return readExistingSignals(env, payload);

  return insertSupabaseRows<JsonRecord>(env, 'risk_signals', payload.signals.map((signal) => ({
    site_id: payload.siteId,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    signal_type: signal.signal_type,
    source: signal.source,
    severity: signal.severity,
    weight: signal.weight,
    rule_id: signal.rule_id,
    value: signal.value,
    evidence: signal.evidence,
    metadata: signal.metadata,
    observed_at: new Date().toISOString(),
  })));
}

async function writeRiskActions(
  env: SupabaseServiceEnv,
  payload: RiskScorePayload,
  scoreId: string,
  signalIds: string[],
  actionStatus: 'recorded' | 'applied' | 'failed',
  actionType: 'score' | 'auto_restrict' | 'ts_case_open_requested',
  reason: string,
  evidence: JsonRecord,
): Promise<void> {
  await insertSupabaseRows(env, 'risk_action_events', {
    site_id: payload.siteId,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    action_type: actionType,
    action_status: actionStatus,
    score_id: scoreId,
    signal_ids: signalIds,
    reason,
    evidence,
    actor_type: 'system',
    metadata: {
      worker: 'queue-workers',
    },
  });
}

function addBusinessDays(start: Date, days: number): string {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString();
}

async function openTrustSafetyCaseFromRisk(
  env: SupabaseServiceEnv,
  payload: RiskScorePayload,
  scoreId: string,
  signalIds: string[],
  evidence: JsonRecord,
): Promise<void> {
  const [caseRow] = await insertSupabaseRows<JsonRecord>(env, 'ts_cases', {
    site_id: payload.siteId,
    subject_type: payload.entityType === 'site' ? 'site' : 'custom',
    subject_id: payload.entityId,
    category: 'fraud',
    severity: 'high',
    status: 'open',
    title: `Risk handoff: ${payload.entityType} ${payload.entityId}`,
    summary: 'High risk score requires Trust & Safety review.',
    opened_by: null,
    appeal_due_at: addBusinessDays(new Date(), 7),
    metadata: {
      source: 'risk-worker',
      score_id: scoreId,
      signal_ids: signalIds,
    },
  });

  const caseId = stringField(caseRow?.id);
  if (!caseId) return;

  await insertSupabaseRows(env, 'ts_evidence', {
    case_id: caseId,
    evidence_type: 'risk_score',
    source: 'risk-worker',
    title: 'High risk score evidence',
    description: payload.reason,
    risk_score_id: scoreId,
    content: evidence,
    metadata: { signal_ids: signalIds },
  });
  await insertSupabaseRows(env, 'ts_case_events', {
    case_id: caseId,
    event_type: 'risk_handoff',
    actor_type: 'system',
    actor_id: null,
    reason: 'High risk score auto-opened a Trust & Safety case.',
    evidence,
    metadata: { score_id: scoreId, signal_ids: signalIds },
  });
}

export async function processRiskScoringDeliveries(
  env: SupabaseServiceEnv,
  deliveries: RiskQueueDelivery[],
): Promise<RiskScoringResult> {
  const result: RiskScoringResult = {
    processed: 0,
    skipped: 0,
    restricted: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || delivery.input.jobType !== 'risk.score.entity') {
      result.skipped += 1;
      continue;
    }

    const payload = normalizeRiskScorePayload(delivery.input.payload, delivery.input.siteId);
    if (!payload) {
      result.failed += 1;
      continue;
    }

    const signals = await insertSignals(env, payload);
    const computation = scoreRiskSignals(signals.map(scoringSignal));
    const [score] = await upsertSupabaseRows<JsonRecord>(env, 'risk_scores', {
      site_id: payload.siteId,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      score: computation.score,
      band: computation.band,
      breakdown: computation.breakdown,
      status: computation.auto_restrict ? 'restricted' : 'open',
      scored_at: new Date().toISOString(),
    }, { onConflict: 'entity_type,entity_id', prefer: 'resolution=merge-duplicates,return=representation' });

    const scoreId = stringField(score?.id);
    if (!scoreId) {
      result.failed += 1;
      continue;
    }

    const signalIds = signals.map((signal) => stringField(signal.id)).filter((id): id is string => Boolean(id));
    await writeRiskActions(env, payload, scoreId, signalIds, 'recorded', 'score', payload.reason, computation.breakdown);

    if (computation.auto_restrict && payload.siteId) {
      result.restricted += 1;

      await writeRiskActions(
        env,
        payload,
        scoreId,
        signalIds,
        'recorded',
        'auto_restrict',
        `High risk score ${computation.score} crossed the auto-restrict threshold.`,
        {
          ...computation.breakdown,
          requested_site_status: 'frozen',
          enforcement_owner: 'services/api-gateway',
        },
      );
      await writeRiskActions(
        env,
        payload,
        scoreId,
        signalIds,
        'recorded',
        'ts_case_open_requested',
        'High risk score requires Trust & Safety case intake.',
        computation.breakdown,
      );
      try {
        await openTrustSafetyCaseFromRisk(env, payload, scoreId, signalIds, computation.breakdown);
      } catch {
        // Keep risk scoring live if the Wave 3 T&S migration has not been applied yet.
      }
    }

    result.processed += 1;
  }

  return result;
}
