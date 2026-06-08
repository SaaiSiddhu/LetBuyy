import {
  insertSupabaseRows,
  selectSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import type { JsonRecord } from '@letbuyy/shared-types';

export interface IncidentCommandDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

export interface IncidentCommandResult {
  processed: number;
  skipped: number;
  dryRunPages: number;
  postmortemReminders: number;
  failed: number;
}

interface PagingAdapterInput {
  incidentId: string | null;
  targetTeam: string | null;
  severity: string;
  summary: string;
  reason: string;
  requestId: string | null;
  schedule: JsonRecord | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberField(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isIncidentCommandJob(jobType: string): boolean {
  return jobType === 'incident.page.dry_run' || jobType === 'incident.postmortem.reminder';
}

async function writeIncidentAudit(env: SupabaseServiceEnv, input: {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  reason: string;
  metadata: JsonRecord;
}): Promise<void> {
  await insertSupabaseRows(env, 'audit_logs', {
    actor_id: null,
    actor_type: 'system',
    actor_email: null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    metadata: {
      ...input.metadata,
      reason: input.reason,
    },
  });
}

async function currentOncallSchedule(env: SupabaseServiceEnv, targetTeam: string | null, now: string): Promise<JsonRecord | null> {
  const rows = await selectSupabaseRows<JsonRecord>(env, 'oncall_schedules', {
    select: '*',
    active: 'eq.true',
    starts_at: `lte.${now}`,
    deleted_at: 'is.null',
    order: 'starts_at.desc',
    limit: '25',
  });

  return rows.find((row) => {
    const endsAt = stringField(row.ends_at);
    const teamName = stringField(row.team_name);
    const inWindow = !endsAt || Date.parse(endsAt) > Date.parse(now);
    const matchesTeam = !targetTeam || teamName === targetTeam;
    return inWindow && matchesTeam;
  }) || null;
}

async function sendIncidentPage(env: SupabaseServiceEnv, input: PagingAdapterInput): Promise<JsonRecord> {
  const payload = {
    mode: 'dry_run',
    adapter: stringField(input.schedule?.paging_adapter) || 'dry_run',
    incident_id: input.incidentId,
    target_team: input.targetTeam || stringField(input.schedule?.team_name),
    primary_employee_id: stringField(input.schedule?.primary_employee_id),
    backup_employee_ids: Array.isArray(input.schedule?.backup_employee_ids) ? input.schedule?.backup_employee_ids : [],
    severity: input.severity,
    summary: input.summary,
    request_id: input.requestId,
  };

  if (input.incidentId) {
    await insertSupabaseRows(env, 'production_incident_events', {
      incident_id: input.incidentId,
      event_type: 'escalation',
      actor_id: null,
      summary: `Dry-run page: ${input.summary}`,
      details: {
        ...payload,
        reason: input.reason,
      },
    });
  }

  await writeIncidentAudit(env, {
    action: 'incident.page.dry_run.worker',
    resourceType: 'production_incident',
    reason: input.reason,
    metadata: payload,
  });

  return payload;
}

async function processDryRunPage(env: SupabaseServiceEnv, delivery: IncidentCommandDelivery): Promise<number> {
  const payload = isRecord(delivery.input.payload) ? delivery.input.payload : {};
  const now = new Date().toISOString();
  const targetTeam = stringField(payload.target_team);
  const schedule = await currentOncallSchedule(env, targetTeam, now);

  await sendIncidentPage(env, {
    incidentId: stringField(payload.incident_id),
    targetTeam,
    severity: stringField(payload.severity) || 'sev3',
    summary: stringField(payload.summary) || 'Incident page dry run',
    reason: stringField(payload.reason) || 'Incident dry-run paging requested by automation.',
    requestId: delivery.input.requestId,
    schedule,
  });

  return 1;
}

export async function runIncidentPostmortemReminders(
  env: SupabaseServiceEnv,
  input: { requestId?: string | null; now?: string; limit?: number } = {},
): Promise<{ reminders: number }> {
  const now = input.now || new Date().toISOString();
  const limit = Math.max(1, Math.min(100, Math.round(numberField(input.limit, 50))));
  const rows = await selectSupabaseRows<JsonRecord>(env, 'incident_postmortems', {
    select: 'id,incident_id,status,due_at,owner_id,metadata,deleted_at',
    status: 'in.(draft,review)',
    due_at: `lte.${now}`,
    deleted_at: 'is.null',
    order: 'due_at.asc',
    limit: String(limit),
  });

  for (const row of rows) {
    await writeIncidentAudit(env, {
      action: 'incident.postmortem.reminder',
      resourceType: 'incident_postmortem',
      resourceId: stringField(row.id),
      reason: 'Incident postmortem due reminder recorded by queue worker.',
      metadata: {
        incident_id: stringField(row.incident_id),
        status: stringField(row.status),
        due_at: stringField(row.due_at),
        owner_id: stringField(row.owner_id),
        request_id: input.requestId || null,
      },
    });
  }

  return { reminders: rows.length };
}

export async function processIncidentCommandDeliveries(
  env: SupabaseServiceEnv,
  deliveries: IncidentCommandDelivery[],
): Promise<IncidentCommandResult> {
  const result: IncidentCommandResult = {
    processed: 0,
    skipped: 0,
    dryRunPages: 0,
    postmortemReminders: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isIncidentCommandJob(delivery.input.jobType)) {
      result.skipped += 1;
      continue;
    }

    try {
      if (delivery.input.jobType === 'incident.page.dry_run') {
        result.dryRunPages += await processDryRunPage(env, delivery);
      } else {
        const payload = isRecord(delivery.input.payload) ? delivery.input.payload : {};
        const reminders = await runIncidentPostmortemReminders(env, {
          requestId: delivery.input.requestId,
          now: stringField(payload.now) || undefined,
          limit: numberField(payload.limit, 50),
        });
        result.postmortemReminders += reminders.reminders;
      }
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
