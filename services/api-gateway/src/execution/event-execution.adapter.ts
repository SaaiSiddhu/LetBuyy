import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { OutboxExecutionAdapter } from './outbox-execution.adapter';
import { NOTIFICATION_APPLICATION_WORKFLOWS, NOTIFICATION_EXECUTION_PIPELINES, defineRuntimeBridge } from '@letbuyy/shared-types';
import { getDomainEventContract, parseDomainEventPayload } from '@letbuyy/event-core';

type JsonRecord = Record<string, unknown>;

function isMissingOptionalEventTable(error: { message?: string } | null | undefined, tableName: string): boolean {
    return Boolean(error?.message?.includes(tableName) && error.message.includes('schema cache'));
}

export interface DomainEventInput {
    storeId?: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload?: JsonRecord;
    idempotencyKey: string;
    requestId?: string | null;
    actorId?: string | null;
}

export interface AuditEventInput {
    storeId?: string | null;
    actorId?: string | null;
    actorType?: 'user' | 'customer' | 'employee' | 'system' | 'webhook';
    action: string;
    resourceType: string;
    resourceId?: string | null;
    requestId?: string | null;
    beforeState?: JsonRecord | null;
    afterState?: JsonRecord | null;
    metadata?: JsonRecord;
}

export class EventExecutionAdapter {
    static readonly applicationWorkflows = NOTIFICATION_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = NOTIFICATION_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'event-execution.adapter',
        workflowAuthority: 'notification-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) { }

    async emitDomainEvent(input: DomainEventInput) {
        const contract = getDomainEventContract(input.eventType);
        if (!contract) {
            throw new Error(`Uncontracted domain event type: ${input.eventType}`);
        }

        if (input.aggregateType !== contract.aggregateType) {
            throw new Error(`Event ${input.eventType} must use aggregate type ${contract.aggregateType}`);
        }

        const payload = parseDomainEventPayload(contract.eventType, input.payload || {});

        const { data, error } = await this.db
            .from('outbox_events')
            .upsert(
                {
                    store_id: input.storeId || null,
                    site_id: input.storeId || null,
                    aggregate_type: input.aggregateType,
                    aggregate_id: input.aggregateId,
                    event_type: input.eventType,
                    payload,
                    idempotency_key: input.idempotencyKey,
                    request_id: input.requestId || null,
                    actor_id: input.actorId || null,
                    schema_version: contract?.schemaVersion || 1,
                },
                { onConflict: 'idempotency_key' }
            )
            .select('id, event_type, status, created_at')
            .single();

        if (error) {
            if (isMissingOptionalEventTable(error, 'outbox_events')) {
                return null;
            }

            throw new Error(`Outbox event emit failed: ${error.message}`);
        }

        if (input.storeId && input.aggregateType === 'order') {
            // Delivery is already durable. A lost post-commit wakeup is recovered
            // by the existing outbox cron, without failing a committed order.
            try { await new OutboxExecutionAdapter(this.db).dispatchOrderEmails(input.storeId, input.aggregateId); }
            catch { console.warn(JSON.stringify({ level: 'warn', event: 'order_email_outbox_wakeup_deferred', site_id: input.storeId })); }
        }
        return data;
    }

    async emitAuditEvent(input: AuditEventInput) {
        const { data, error } = await this.db
            .from('audit_activity_events')
            .insert({
                store_id: input.storeId || null,
                actor_id: input.actorId || null,
                actor_type: input.actorType || 'user',
                action: input.action,
                resource_type: input.resourceType,
                resource_id: input.resourceId || null,
                request_id: input.requestId || null,
                before_state: input.beforeState || null,
                after_state: input.afterState || null,
                metadata: input.metadata || {},
            })
            .select('id, action, created_at')
            .single();

        if (error) {
            if (isMissingOptionalEventTable(error, 'audit_activity_events')) {
                return null;
            }

            throw new Error(`Audit event emit failed: ${error.message}`);
        }

        return data;
    }
}
