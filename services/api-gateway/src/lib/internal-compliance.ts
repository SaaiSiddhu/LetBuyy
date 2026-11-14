import {
    COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
    COMPLIANCE_DATA_REQUEST_DUE_DAYS,
    COMPLIANCE_RETENTION_POLICY,
    COMPLIANCE_RETENTION_POLICY_VERSION,
    TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
    type ComplianceDataSubjectRequestType,
    type ComplianceDataSubjectSource,
    type ComplianceDataSubjectStatus,
    type ComplianceDataSubjectSubjectType,
} from '@letbuyy/shared-types';
import { AppError } from './errors';
import { sha256Hex } from './crypto';
import type { getSupabaseAdmin } from './supabase';

export type ComplianceDb = ReturnType<typeof getSupabaseAdmin>;
export type JsonRecord = Record<string, unknown>;

export interface DataSubjectRequestListQuery {
    page: number;
    limit: number;
    status?: ComplianceDataSubjectStatus | 'all';
    request_type?: ComplianceDataSubjectRequestType | 'all';
    source?: ComplianceDataSubjectSource | 'all';
    site_id?: string | null;
    q?: string | null;
}

export interface DataSubjectRequestInput {
    request_type: ComplianceDataSubjectRequestType;
    subject_type: ComplianceDataSubjectSubjectType;
    subject_id?: string | null;
    subject_email?: string | null;
    subject_display?: string | null;
    site_id?: string | null;
    source?: ComplianceDataSubjectSource;
    assignee_id?: string | null;
    reason: string;
    request_payload?: JsonRecord;
    metadata?: JsonRecord;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_type?: 'employee' | 'super_admin' | 'system' | 'webhook' | 'worker';
    request_id?: string | null;
    idempotency_key?: string | null;
}

export interface DataSubjectRequestPatch {
    status?: ComplianceDataSubjectStatus;
    assignee_id?: string | null;
    fulfillment_summary?: string | null;
    metadata?: JsonRecord;
    reason: string;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_type?: 'employee' | 'super_admin' | 'system' | 'webhook' | 'worker';
    request_id?: string | null;
}

export interface AuditExportRunInput {
    cursor_key?: string | null;
    limit?: number;
    reason: string;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_type?: 'employee' | 'super_admin' | 'system' | 'worker';
    request_id?: string | null;
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function recordValue(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function rangeFor(page: number, limit: number) {
    const from = (page - 1) * limit;
    return { from, to: from + limit - 1 };
}

function addDays(value: Date, days: number): Date {
    const next = new Date(value.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function dueAtFrom(requestedAt?: string | null): string {
    const parsed = requestedAt ? Date.parse(requestedAt) : NaN;
    const base = Number.isFinite(parsed) ? new Date(parsed) : new Date();
    return addDays(base, COMPLIANCE_DATA_REQUEST_DUE_DAYS).toISOString();
}

function webhookRequestType(eventType: ComplianceDataSubjectSource): ComplianceDataSubjectRequestType {
    return eventType === 'customers/data_request' ? 'access' : 'erasure';
}

function webhookSubjectType(eventType: ComplianceDataSubjectSource): ComplianceDataSubjectSubjectType {
    return eventType === 'shop/redact' ? 'shop' : 'customer';
}


function safeReason(reason: string | null | undefined, fallback: string): string {
    const trimmed = reason?.trim();
    return trimmed && trimmed.length >= 8 ? trimmed : fallback;
}

export function retentionPolicySnapshot() {
    return {
        version: COMPLIANCE_RETENTION_POLICY_VERSION,
        data_request_due_days: COMPLIANCE_DATA_REQUEST_DUE_DAYS,
        trust_safety_retention_exempt_tables: TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
        policies: COMPLIANCE_RETENTION_POLICY,
    };
}

export async function writeComplianceAudit(
    db: ComplianceDb,
    input: {
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason?: string | null;
        actorId?: string | null;
        actorEmail?: string | null;
        actorType?: 'employee' | 'super_admin' | 'system' | 'webhook' | 'worker';
        requestId?: string | null;
        metadata?: JsonRecord;
    },
): Promise<void> {
    const auditActorType = input.actorType === 'webhook' || input.actorType === 'worker'
        ? 'system'
        : input.actorType || 'super_admin';
    const { error } = await db.from('audit_logs').insert({
        actor_id: input.actorId || null,
        actor_type: auditActorType,
        actor_email: input.actorEmail || null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason || null,
            request_id: input.requestId || null,
            retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
        },
    });
    if (error) throw new Error('Compliance audit could not be recorded');
}

export async function upsertDataSubjectRequestFromComplianceWebhook(
    db: ComplianceDb,
    input: {
        eventType: ComplianceDataSubjectSource;
        siteId: string;
        idempotencyKey: string;
        requestedAt?: string | null;
        actorId?: string | null;
        customerId?: string | null;
        customerEmail?: string | null;
        reason?: string | null;
        requestId?: string | null;
        payload?: JsonRecord;
    },
): Promise<JsonRecord> {
    const source = input.eventType;
    const existing = await db
        .from('data_subject_requests')
        .select('*')
        .eq('source', source)
        .eq('idempotency_key', input.idempotencyKey)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error) throw new Error(`Data-subject request lookup failed: ${existing.error.message}`);
    if (existing.data) return existing.data as JsonRecord;

    const reason = safeReason(input.reason, `Compliance webhook ${source} intake.`);
    const payload = {
        source_event_type: source,
        customer_id: input.customerId || null,
        customer_email: input.customerEmail || null,
        ...(input.payload || {}),
    };
    const insert = await db
        .from('data_subject_requests')
        .insert({
            site_id: input.siteId,
            request_type: webhookRequestType(source),
            subject_type: webhookSubjectType(source),
            subject_id: input.customerId || input.siteId,
            subject_email: input.customerEmail || null,
            subject_display: input.customerEmail || input.customerId || input.siteId,
            source,
            status: 'open',
            due_at: dueAtFrom(input.requestedAt),
            idempotency_key: input.idempotencyKey,
            reason,
            request_payload: payload,
            actor_type: 'webhook',
            actor_id: input.actorId || null,
            request_id: input.requestId || null,
            metadata: {
                retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
                retention_exempt_tables: TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
                webhook_intake: true,
            },
        })
        .select('*')
        .single();

    if (insert.error) throw new Error(`Data-subject request intake failed: ${insert.error.message}`);
    const row = insert.data as JsonRecord;
    await writeComplianceAudit(db, {
        action: 'data_subject_request.intake',
        resourceType: 'data_subject_request',
        resourceId: stringValue(row.id),
        reason,
        actorId: input.actorId || null,
        actorType: 'webhook',
        requestId: input.requestId || null,
        metadata: {
            source,
            site_id: input.siteId,
            request_type: row.request_type || null,
            subject_type: row.subject_type || null,
        },
    });

    return row;
}

export async function listDataSubjectRequests(
    db: ComplianceDb,
    input: DataSubjectRequestListQuery,
): Promise<{ rows: JsonRecord[]; total: number }> {
    const { from, to } = rangeFor(input.page, input.limit);
    let query = db
        .from('data_subject_requests')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('due_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);

    if (input.status && input.status !== 'all') query = query.eq('status', input.status);
    if (input.request_type && input.request_type !== 'all') query = query.eq('request_type', input.request_type);
    if (input.source && input.source !== 'all') query = query.eq('source', input.source);
    if (input.site_id) query = query.eq('site_id', input.site_id);
    if (input.q) {
        const q = input.q.replace(/[%_,]/g, '').slice(0, 100);
        query = query.or(`subject_email.ilike.%${q}%,subject_id.ilike.%${q}%,subject_display.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Data-subject request list failed: ${error.message}`);
    return { rows: (data || []) as JsonRecord[], total: count || 0 };
}

export async function createManualDataSubjectRequest(
    db: ComplianceDb,
    input: DataSubjectRequestInput,
): Promise<JsonRecord> {
    if (input.idempotency_key) {
        let lookup = db.from('data_subject_requests').select('*').eq('source', input.source || 'manual')
            .eq('idempotency_key', input.idempotency_key).is('deleted_at', null);
        lookup = input.site_id ? lookup.eq('site_id', input.site_id) : lookup.filter('site_id', 'is', null);
        const existing = await lookup.maybeSingle();
        if (existing.error) throw new Error('Privacy request recovery is unavailable');
        if (existing.data) {
            const row = existing.data as JsonRecord;
            const same = row.request_type === input.request_type && row.subject_type === input.subject_type
                && (row.subject_id || null) === (input.subject_id || null)
                && (row.subject_email || null) === (input.subject_email || null);
            if (!same) throw new AppError('This request key already belongs to another privacy request.', 409, 'IDEMPOTENCY_CONFLICT');
            // A previous request may have committed before its audit acknowledgement.
            await writeComplianceAudit(db, { action: 'data_subject_request.create.recovered', resourceType: 'data_subject_request',
                resourceId: String(row.id), actorId: input.actor_id, actorEmail: input.actor_email,
                actorType: input.actor_type, reason: input.reason, metadata: { idempotency_key: input.idempotency_key } });
            return row;
        }
    }
    const insert = await db
        .from('data_subject_requests')
        .insert({
            site_id: input.site_id || null,
            request_type: input.request_type,
            subject_type: input.subject_type,
            subject_id: input.subject_id || null,
            subject_email: input.subject_email || null,
            subject_display: input.subject_display || input.subject_email || input.subject_id || null,
            source: input.source || 'manual',
            status: 'open',
            due_at: dueAtFrom(null),
            assignee_id: input.assignee_id || null,
            idempotency_key: input.idempotency_key || null,
            reason: input.reason,
            request_payload: input.request_payload || {},
            metadata: {
                ...(input.metadata || {}),
                retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
                retention_exempt_tables: TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
            },
            actor_type: input.actor_type || 'super_admin',
            actor_id: input.actor_id || null,
            actor_email: input.actor_email || null,
            request_id: input.request_id || null,
            created_by: input.actor_id || null,
            updated_by: input.actor_id || null,
        })
        .select('*')
        .single();

    if (insert.error) throw new Error(`Manual data-subject request failed: ${insert.error.message}`);
    const row = insert.data as JsonRecord;
    await writeComplianceAudit(db, {
        action: 'data_subject_request.create',
        resourceType: 'data_subject_request',
        resourceId: stringValue(row.id),
        reason: input.reason,
        actorId: input.actor_id,
        actorEmail: input.actor_email,
        actorType: input.actor_type || 'super_admin',
        requestId: input.request_id,
        metadata: {
            source: input.source || 'manual',
            site_id: input.site_id || null,
            request_type: input.request_type,
            subject_type: input.subject_type,
        },
    });

    return row;
}

export async function updateDataSubjectRequest(
    db: ComplianceDb,
    id: string,
    input: DataSubjectRequestPatch,
    siteId: string | null,
): Promise<JsonRecord | null> {
    const now = new Date().toISOString();
    const patch: JsonRecord = {
        metadata: input.metadata || {},
        actor_type: input.actor_type || 'super_admin',
        actor_id: input.actor_id || null,
        actor_email: input.actor_email || null,
        request_id: input.request_id || null,
        updated_by: input.actor_id || null,
    };
    if (input.status) {
        patch.status = input.status;
        if (input.status === 'verifying') patch.verified_at = now;
        if (input.status === 'fulfilled') patch.fulfilled_at = now;
        if (input.status === 'rejected') patch.rejected_at = now;
    }
    if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;
    if (input.fulfillment_summary !== undefined) patch.fulfillment_summary = input.fulfillment_summary;

    let update = db
        .from('data_subject_requests')
        .update(patch)
        .eq('id', id)
        .is('deleted_at', null);
    update = siteId === null ? update.filter('site_id', 'is', null) : update.eq('site_id', siteId);
    const updated = await update.select('*').maybeSingle();

    if (updated.error) throw new Error(`Data-subject request update failed: ${updated.error.message}`);
    if (!updated.data) return null;

    const row = updated.data as JsonRecord;
    await writeComplianceAudit(db, {
        action: 'data_subject_request.update',
        resourceType: 'data_subject_request',
        resourceId: stringValue(row.id),
        reason: input.reason,
        actorId: input.actor_id,
        actorEmail: input.actor_email,
        actorType: input.actor_type || 'super_admin',
        requestId: input.request_id,
        metadata: {
            status: input.status || row.status || null,
            assignee_id: input.assignee_id ?? null,
            fulfillment_summary_present: Boolean(input.fulfillment_summary),
        },
    });

    return row;
}

export async function buildComplianceOverview(db: ComplianceDb): Promise<JsonRecord> {
    const now = new Date();
    const dueSoon = addDays(now, 3).toISOString();
    const count = () => db.from('data_subject_requests').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    const open = () => count().not('status', 'in', '(fulfilled,rejected,cancelled,expired)');
    const [total, openCount, overdue, dueSoonCount, fulfilled, erasure, access, latest, cursors] = await Promise.all([
        count(), open(), open().lt('due_at', now.toISOString()), open().lte('due_at', dueSoon),
        count().eq('status', 'fulfilled'), count().eq('request_type', 'erasure'), count().eq('request_type', 'access'),
        db.from('data_subject_requests').select('id, request_type, source, status, due_at, created_at')
            .is('deleted_at', null).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10),
        db.from('audit_export_cursors').select('*').is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
    ]);
    if ([total, openCount, overdue, dueSoonCount, fulfilled, erasure, access, latest, cursors].some(result => result.error)) {
        throw new Error('Compliance overview could not be loaded');
    }
    return {
        generated_at: now.toISOString(),
        totals: { total: total.count ?? 0, open: openCount.count ?? 0, overdue: overdue.count ?? 0,
            due_soon: dueSoonCount.count ?? 0, fulfilled: fulfilled.count ?? 0,
            erasure: erasure.count ?? 0, access: access.count ?? 0 },
        latest_requests: latest.data || [], audit_export_cursors: cursors.data || [], retention_policy: retentionPolicySnapshot(),
    };
}

export async function listAuditExportCursors(db: ComplianceDb): Promise<JsonRecord[]> {
    const { data, error } = await db
        .from('audit_export_cursors')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(25);
    if (error) throw new Error(`Audit export cursor list failed: ${error.message}`);
    return (data || []) as JsonRecord[];
}

export async function runAuditExportDryRun(
    db: ComplianceDb,
    input: AuditExportRunInput,
): Promise<JsonRecord> {
    const cursorKey = stringValue(input.cursor_key) || 'audit_logs:local_dry_run';
    const limit = Math.min(Math.max(input.limit || 500, 1), 1000);
    const startedAt = new Date().toISOString();

    const existingResult = await db
        .from('audit_export_cursors')
        .select('*')
        .eq('cursor_key', cursorKey)
        .is('deleted_at', null)
        .maybeSingle();
    if (existingResult.error) throw new Error(`Audit export cursor lookup failed: ${existingResult.error.message}`);

    const existing = existingResult.data ? existingResult.data as JsonRecord : null;
    const previousCreatedAt = stringValue(existing?.last_audit_created_at);

    await db
        .from('audit_export_cursors')
        .upsert({
            cursor_key: cursorKey,
            sink_type: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
            sink_name: 'local-dry-run',
            dry_run: true,
            status: 'running',
            actor_type: input.actor_type || 'super_admin',
            actor_id: input.actor_id || null,
            actor_email: input.actor_email || null,
            request_id: input.request_id || null,
            metadata: {
                dry_run_started_at: startedAt,
                sink_unblock: 'SIEM/WORM vendor and credentials are human-gated.',
            },
        }, { onConflict: 'cursor_key' });

    let query = db
        .from('audit_logs')
        .select('id, actor_id, actor_type, actor_email, action, resource_type, resource_id, metadata, created_at')
        .order('created_at', { ascending: true })
        .limit(limit);
    if (previousCreatedAt) query = query.gt('created_at', previousCreatedAt);

    const rowsResult = await query;
    if (rowsResult.error) throw new Error(`Audit log export query failed: ${rowsResult.error.message}`);

    const rows = (rowsResult.data || []) as JsonRecord[];
    const lastRow = rows[rows.length - 1] || null;
    const checksum = await sha256Hex(JSON.stringify(rows.map((row) => ({
        id: row.id,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        created_at: row.created_at,
    }))));
    const rowsExported = Number(existing?.rows_exported || 0) + rows.length;
    const exportedAt = new Date().toISOString();
    const cursorPatch = {
        cursor_key: cursorKey,
        sink_type: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
        sink_name: 'local-dry-run',
        dry_run: true,
        status: 'completed',
        last_audit_log_id: stringValue(lastRow?.id) || stringValue(existing?.last_audit_log_id),
        last_audit_created_at: stringValue(lastRow?.created_at) || previousCreatedAt,
        last_exported_at: exportedAt,
        rows_exported: rowsExported,
        checksum,
        failure_reason: null,
        actor_type: input.actor_type || 'super_admin',
        actor_id: input.actor_id || null,
        actor_email: input.actor_email || null,
        request_id: input.request_id || null,
        metadata: {
            dry_run: true,
            batch_rows: rows.length,
            limit,
            exported_at: exportedAt,
            previous_cursor_created_at: previousCreatedAt,
            retention_policy_version: COMPLIANCE_RETENTION_POLICY_VERSION,
        },
    };
    const upserted = await db
        .from('audit_export_cursors')
        .upsert(cursorPatch, { onConflict: 'cursor_key' })
        .select('*')
        .single();
    if (upserted.error) throw new Error(`Audit export cursor update failed: ${upserted.error.message}`);

    await writeComplianceAudit(db, {
        action: 'audit_export.dry_run',
        resourceType: 'audit_export_cursor',
        resourceId: stringValue(upserted.data?.id),
        reason: input.reason,
        actorId: input.actor_id,
        actorEmail: input.actor_email,
        actorType: input.actor_type || 'super_admin',
        requestId: input.request_id,
        metadata: {
            cursor_key: cursorKey,
            rows_exported_this_run: rows.length,
            total_rows_exported: rowsExported,
            checksum,
            dry_run_sink: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
        },
    });

    return {
        cursor: upserted.data as JsonRecord,
        rows_exported: rows.length,
        total_rows_exported: rowsExported,
        checksum,
        dry_run: true,
        sink_type: COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK,
        exported_sample: rows.slice(0, 5).map((row) => ({
            id: row.id,
            action: row.action,
            resource_type: row.resource_type,
            resource_id: row.resource_id,
            created_at: row.created_at,
        })),
    };
}

export function dataSubjectRowFromUnknown(value: unknown): JsonRecord {
    return recordValue(value);
}
