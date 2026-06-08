import {
  insertSupabaseRows,
  selectSupabaseRows,
  upsertSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
  COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
  COMPLIANCE_RETENTION_POLICY_VERSION,
  type JsonRecord,
} from '@letbuyy/shared-types';

export interface ComplianceDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

export interface ComplianceAuditExportResult {
  processed: number;
  skipped: number;
  rowsExported: number;
  failed: number;
}

interface AuditExportCursor extends JsonRecord {
  id?: string;
  cursor_key: string;
  rows_exported?: number | string | null;
  last_audit_log_id?: string | null;
  last_audit_created_at?: string | null;
}

interface AuditLogRow extends JsonRecord {
  id: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at?: string | null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberField(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function writeAudit(env: SupabaseServiceEnv, input: {
  action: string;
  reason: string;
  requestId: string | null;
  metadata: JsonRecord;
}): Promise<void> {
  await insertSupabaseRows(env, 'audit_logs', {
    actor_id: null,
    actor_type: 'system',
    actor_email: null,
    action: input.action,
    resource_type: 'audit_export_cursor',
    resource_id: null,
    metadata: {
      ...input.metadata,
      reason: input.reason,
      request_id: input.requestId,
      retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
    },
  });
}

export function isComplianceAuditExportJob(jobType: string): boolean {
  return jobType === 'compliance.audit_export.run' || jobType === 'compliance.audit_export.dry_run';
}

export async function runComplianceAuditExportDryRun(
  env: SupabaseServiceEnv,
  input: {
    cursorKey?: string | null;
    limit?: number;
    requestId?: string | null;
    reason?: string;
  },
): Promise<{ rowsExported: number; checksum: string; cursorKey: string }> {
  const cursorKey = stringField(input.cursorKey) || 'audit_logs:local_dry_run';
  const limit = Math.min(Math.max(Math.round(numberField(input.limit, 500)), 1), 1000);
  const cursorRows = await selectSupabaseRows<AuditExportCursor>(env, 'audit_export_cursors', {
    select: '*',
    cursor_key: `eq.${cursorKey}`,
    deleted_at: 'is.null',
    limit: '1',
  }).catch(() => []);
  const cursor = cursorRows[0] || null;
  const previousCreatedAt = stringField(cursor?.last_audit_created_at);

  await upsertSupabaseRows(env, 'audit_export_cursors', {
    cursor_key: cursorKey,
    sink_type: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
    sink_name: 'local-dry-run',
    dry_run: true,
    status: 'running',
    request_id: input.requestId || null,
    actor_type: 'worker',
    metadata: {
      dry_run: true,
      worker_started_at: new Date().toISOString(),
    },
  }, { onConflict: 'cursor_key', prefer: 'resolution=merge-duplicates,return=representation' });

  const params: Record<string, string> = {
    select: 'id,actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata,created_at',
    order: 'created_at.asc',
    limit: String(limit),
  };
  if (previousCreatedAt) params.created_at = `gt.${previousCreatedAt}`;
  const rows = await selectSupabaseRows<AuditLogRow>(env, 'audit_logs', params);
  const lastRow = rows[rows.length - 1] || null;
  const checksum = await sha256Hex(JSON.stringify(rows.map((row) => ({
    id: row.id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    created_at: row.created_at,
  }))));
  const rowsExported = Math.max(0, numberField(cursor?.rows_exported, 0)) + rows.length;

  await upsertSupabaseRows(env, 'audit_export_cursors', {
    cursor_key: cursorKey,
    sink_type: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
    sink_name: 'local-dry-run',
    dry_run: true,
    status: 'completed',
    last_audit_log_id: lastRow?.id || cursor?.last_audit_log_id || null,
    last_audit_created_at: lastRow?.created_at || previousCreatedAt || null,
    last_exported_at: new Date().toISOString(),
    rows_exported: rowsExported,
    checksum,
    failure_reason: null,
    request_id: input.requestId || null,
    actor_type: 'worker',
    metadata: {
      dry_run: true,
      rows_exported_this_run: rows.length,
      retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
      sink_unblock: 'External SIEM/WORM destination requires vendor selection and credentials.',
    },
  }, { onConflict: 'cursor_key', prefer: 'resolution=merge-duplicates,return=representation' });

  await writeAudit(env, {
    action: 'audit_export.dry_run',
    reason: input.reason || 'Scheduled local dry-run audit export cursor advance.',
    requestId: input.requestId || null,
    metadata: {
      cursor_key: cursorKey,
      rows_exported_this_run: rows.length,
      total_rows_exported: rowsExported,
      checksum,
      dry_run_sink: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
    },
  });

  return { rowsExported: rows.length, checksum, cursorKey };
}

export async function processComplianceDeliveries(
  env: SupabaseServiceEnv,
  deliveries: ComplianceDelivery[],
): Promise<ComplianceAuditExportResult> {
  const result: ComplianceAuditExportResult = {
    processed: 0,
    skipped: 0,
    rowsExported: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isComplianceAuditExportJob(delivery.input.jobType)) {
      result.skipped += 1;
      continue;
    }

    try {
      const payload = delivery.input.payload || {};
      const run = await runComplianceAuditExportDryRun(env, {
        cursorKey: stringField(payload.cursor_key),
        limit: numberField(payload.limit, 500),
        requestId: delivery.input.requestId,
        reason: stringField(payload.reason) || 'Queue-requested local dry-run audit export cursor advance.',
      });
      result.rowsExported += run.rowsExported;
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
