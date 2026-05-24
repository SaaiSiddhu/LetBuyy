import type { SupabaseClient } from '@supabase/supabase-js';

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

export class EventService {
    constructor(private db: SupabaseClient) { }

    async emitDomainEvent(input: DomainEventInput) {
        const { data, error } = await this.db
            .from('outbox_events')
            .upsert(
                {
                    store_id: input.storeId || null,
                    aggregate_type: input.aggregateType,
                    aggregate_id: input.aggregateId,
                    event_type: input.eventType,
                    payload: input.payload || {},
                    idempotency_key: input.idempotencyKey,
                    request_id: input.requestId || null,
                    actor_id: input.actorId || null,
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
