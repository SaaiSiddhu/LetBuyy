import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    NOTIFICATION_APPLICATION_WORKFLOWS,
    NOTIFICATION_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import { isValidWebhookTarget } from '@letbuyy/notification-core';
import {
    buildDomainEventEnvelope,
    eventMatchesSubscription,
    eventRetryDelaySeconds,
    queueNamesForEvent,
} from '@letbuyy/event-core';

type JsonObject = Record<string, unknown>;

export interface OutboxEventClaim {
    id: string;
    store_id: string | null;
    site_id: string | null;
    event_id: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: JsonObject;
    idempotency_key: string;
    request_id: string | null;
    trace_id: string | null;
    schema_version: number;
    actor_id: string | null;
    attempts: number;
    max_attempts: number;
    created_at: string;
}

interface WebhookSubscription {
    id: string;
    site_id: string;
    target_url: string;
    event_types: string[];
}

export interface DispatchBatchResult {
    dispatcher_id: string;
    claimed: number;
    processed: number;
    failed: number;
    queued_jobs: number;
    webhook_deliveries: number;
    webhook_succeeded: number;
    webhook_failed: number;
}

interface DispatchOptions {
    dispatcherId: string;
    outboxLimit?: number;
    webhookLimit?: number;
    orderEmail?: { siteId: string; orderId: string };
}

export class OutboxExecutionAdapter {
    static readonly applicationWorkflows = NOTIFICATION_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = NOTIFICATION_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'outbox-execution.adapter',
        workflowAuthority: 'notification-application',
        allowedResponsibilities: ['queue-claim', 'database-rpc'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) {}

    dispatchOrderEmails(siteId: string, orderId: string) {
        return this.dispatchBatch({ dispatcherId: 'order-email:'+crypto.randomUUID(), orderEmail: { siteId, orderId }, outboxLimit: 5 });
    }

    async dispatchBatch(options: DispatchOptions): Promise<DispatchBatchResult> {
        const dispatcherId = options.dispatcherId;
        const outboxLimit = Math.min(Math.max(options.outboxLimit || 25, 1), 100);
        void options.webhookLimit;

        const result: DispatchBatchResult = {
            dispatcher_id: dispatcherId,
            claimed: 0,
            processed: 0,
            failed: 0,
            queued_jobs: 0,
            webhook_deliveries: 0,
            webhook_succeeded: 0,
            webhook_failed: 0,
        };

        const events = options.orderEmail
            ? await this.claimOrderEmailEvents(dispatcherId, options.orderEmail)
            : await this.claimOutboxEvents(dispatcherId, outboxLimit);
        result.claimed = events.length;

        for (const event of events) {
            try {
                const dispatch = await this.dispatchOutboxEvent(event);
                await this.completeOutboxEvent(dispatcherId, event.id, dispatch.webhookDeliveries, dispatch.queueJobs);
                result.processed += 1;
                result.queued_jobs += dispatch.queueJobs;
                result.webhook_deliveries += dispatch.webhookDeliveries;
            } catch (error) {
                result.failed += 1;
                await this.failOutboxEvent(dispatcherId, event, error);
            }
        }

        return result;
    }

    private async claimOrderEmailEvents(dispatcherId: string, order: { siteId: string; orderId: string }): Promise<OutboxEventClaim[]> {
        const { data, error } = await this.db.rpc('claim_order_email_outbox_v1', {
            p_site_id: order.siteId, p_order_id: order.orderId, p_dispatcher_id: dispatcherId,
        });
        if (error) throw new Error('Order email dispatch state is unavailable');
        return Array.isArray(data) ? data as OutboxEventClaim[] : [];
    }

    private async claimOutboxEvents(dispatcherId: string, limit: number): Promise<OutboxEventClaim[]> {
        const { data, error } = await this.db.rpc('claim_outbox_events', {
            p_dispatcher_id: dispatcherId,
            p_limit: limit,
            p_lock_seconds: 120,
        });

        if (error) {
            throw new Error(`Outbox claim failed: ${error.message}`);
        }

        return Array.isArray(data) ? (data as OutboxEventClaim[]) : [];
    }

    private async dispatchOutboxEvent(event: OutboxEventClaim): Promise<{ queueJobs: number; webhookDeliveries: number }> {
        const envelope = buildDomainEventEnvelope(event);
        const queueJobs = await this.enqueuePlatformJobs(event, envelope);
        const webhookDeliveries = await this.createWebhookDeliveries(event, envelope);

        return { queueJobs, webhookDeliveries };
    }

    private async enqueuePlatformJobs(event: OutboxEventClaim, envelope: JsonObject): Promise<number> {
        const queues = queueNamesForEvent(event.event_type);
        const rows = queues.map((queueName) => ({
            site_id: event.site_id,
            outbox_event_id: event.id,
            event_id: event.event_id,
            queue_name: queueName,
            job_type: event.event_type,
            payload: envelope,
            request_id: event.request_id,
            trace_id: event.trace_id,
            idempotency_key: `${event.idempotency_key}:${queueName}`,
            schema_version: event.schema_version,
            created_by: event.actor_id,
            updated_by: event.actor_id,
        }));

        if (rows.length === 0) return 0;

        const { data, error } = await this.db
            .from('platform_queue_jobs')
            .upsert(rows, { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true })
            .select('id');

        if (error) {
            throw new Error(`Platform queue fanout failed: ${error.message}`);
        }

        return Array.isArray(data) ? data.length : 0;
    }

    private async createWebhookDeliveries(event: OutboxEventClaim, envelope: JsonObject): Promise<number> {
        // Private review metadata has no external consumer or delivery authority.
        if (event.event_type === 'reel.review.changed' || event.event_type === 'reel.upload.changed'
            || event.event_type === 'order.lifecycle_email_queued') return 0;
        if (!event.site_id) return 0;

        const { data, error } = await this.db
            .from('webhook_subscriptions')
            .select('id, site_id, target_url, event_types')
            .eq('site_id', event.site_id)
            .eq('status', 'active')
            .is('deleted_at', null);

        if (error) {
            throw new Error(`Webhook subscription lookup failed: ${error.message}`);
        }

        const subscriptions = (Array.isArray(data) ? data : []) as WebhookSubscription[];
        const eligible = subscriptions.filter((subscription) => (
            isValidWebhookTarget(subscription.target_url) &&
            eventMatchesSubscription(event.event_type, subscription.event_types || ['*'])
        ));

        if (eligible.length === 0) return 0;

        const deliveries = eligible.map((subscription) => ({
            site_id: event.site_id,
            subscription_id: subscription.id,
            outbox_event_id: event.id,
            event_id: event.event_id,
            event_type: event.event_type,
            target_url: subscription.target_url,
            payload: envelope,
            request_id: event.request_id,
            trace_id: event.trace_id,
            idempotency_key: `${event.idempotency_key}:webhook:${subscription.id}`,
            schema_version: event.schema_version,
            created_by: event.actor_id,
            updated_by: event.actor_id,
        }));

        const { data: inserted, error: insertError } = await this.db
            .from('webhook_deliveries')
            .upsert(deliveries, { onConflict: 'subscription_id,event_id', ignoreDuplicates: true })
            .select('id');

        if (insertError) {
            throw new Error(`Webhook delivery fanout failed: ${insertError.message}`);
        }

        return Array.isArray(inserted) ? inserted.length : 0;
    }

    private async completeOutboxEvent(
        dispatcherId: string,
        eventId: string,
        deliveryCount: number,
        jobCount: number
    ): Promise<void> {
        const { error } = await this.db.rpc('complete_outbox_event', {
            p_event_id: eventId,
            p_dispatcher_id: dispatcherId,
            p_delivery_count: deliveryCount,
            p_job_count: jobCount,
            p_metadata: { dispatcher_id: dispatcherId },
        });

        if (error) {
            throw new Error(`Outbox completion failed: ${error.message}`);
        }
    }

    private async failOutboxEvent(dispatcherId: string, event: OutboxEventClaim, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : 'Unknown outbox dispatch failure';
        const { error: failError } = await this.db.rpc('fail_outbox_event', {
            p_event_id: event.id,
            p_dispatcher_id: dispatcherId,
            p_error_message: message,
            p_retry_seconds: eventRetryDelaySeconds(event.attempts),
            p_metadata: { dispatcher_id: dispatcherId },
        });

        if (failError) {
            throw new Error(`Outbox failure recording failed: ${failError.message}`);
        }
    }

}
