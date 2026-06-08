import {
  insertSupabaseRows,
  patchSupabaseRows,
  selectSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import type { JsonRecord } from '@letbuyy/shared-types';

export interface SupportAutomationDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

export interface SupportAutomationResult {
  processed: number;
  skipped: number;
  slaBreachesMarked: number;
  csatDispatchesRecorded: number;
  failed: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function isSupportAutomationJob(jobType: string): boolean {
  return jobType === 'support.sla.recompute' || jobType === 'support.csat.dispatch';
}

async function recordSupportAutomationAudit(
  env: SupabaseServiceEnv,
  input: { action: string; reason: string; metadata: JsonRecord },
): Promise<void> {
  await insertSupabaseRows(env, 'audit_logs', {
    actor_id: null,
    actor_type: 'system',
    actor_email: null,
    action: input.action,
    resource_type: 'support_ticket',
    resource_id: null,
    metadata: {
      ...input.metadata,
      reason: input.reason,
    },
  });
}

async function recomputeSlaBreaches(env: SupabaseServiceEnv, payload: JsonRecord): Promise<number> {
  const now = stringField(payload.now) || new Date().toISOString();
  const rows = await patchSupabaseRows<JsonRecord>(
    env,
    'ticket_sla_clocks',
    {
      due_at: `lt.${now}`,
      satisfied_at: 'is.null',
      paused: 'eq.false',
      deleted_at: 'is.null',
    },
    {
      breached: true,
      metadata: {
        worker: 'queue-workers',
        recomputed_at: now,
      },
    },
  );

  await recordSupportAutomationAudit(env, {
    action: 'support.sla.recompute',
    reason: 'Support SLA breach recompute completed by queue worker.',
    metadata: { marked: rows.length, now },
  });

  return rows.length;
}

async function recordCsatDispatches(env: SupabaseServiceEnv, payload: JsonRecord): Promise<number> {
  const now = stringField(payload.now) || new Date().toISOString();
  const limit = typeof payload.limit === 'number' && Number.isFinite(payload.limit)
    ? Math.max(1, Math.min(100, Math.round(payload.limit)))
    : 50;
  const surveys = await selectSupabaseRows<JsonRecord>(env, 'ticket_csat', {
    score: 'is.null',
    responded_at: 'is.null',
    deleted_at: 'is.null',
    order: 'created_at.asc',
    limit: String(limit),
  });

  for (const survey of surveys) {
    const id = stringField(survey.id);
    if (!id) continue;
    await patchSupabaseRows<JsonRecord>(
      env,
      'ticket_csat',
      { id: `eq.${id}` },
      {
        metadata: {
          ...(isRecord(survey.metadata) ? survey.metadata : {}),
          dispatch_mode: 'dry_run',
          dispatched_at: now,
          worker: 'queue-workers',
        },
      },
    );
  }

  if (surveys.length > 0) {
    await recordSupportAutomationAudit(env, {
      action: 'support.csat.dispatch',
      reason: 'Support CSAT survey dispatch recorded on dry-run queue path.',
      metadata: { dispatched: surveys.length, now },
    });
  }

  return surveys.length;
}

export async function processSupportAutomationDeliveries(
  env: SupabaseServiceEnv,
  deliveries: SupportAutomationDelivery[],
): Promise<SupportAutomationResult> {
  const result: SupportAutomationResult = {
    processed: 0,
    skipped: 0,
    slaBreachesMarked: 0,
    csatDispatchesRecorded: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isSupportAutomationJob(delivery.input.jobType)) {
      result.skipped += 1;
      continue;
    }

    try {
      const payload = isRecord(delivery.input.payload) ? delivery.input.payload : {};
      if (delivery.input.jobType === 'support.sla.recompute') {
        result.slaBreachesMarked += await recomputeSlaBreaches(env, payload);
      } else {
        result.csatDispatchesRecorded += await recordCsatDispatches(env, payload);
      }
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
