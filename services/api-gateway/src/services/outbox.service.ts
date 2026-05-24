import type { SupabaseClient } from '@supabase/supabase-js';
import { hmacSha256Hex } from '../lib/internal-auth';

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

interface WebhookDeliveryClaim {
    id: string;
    site_id: string;
    subscription_id: string;
    event_id: string;
    event_type: string;
    target_url: string;
    payload: JsonObject;
    signing_secret: string;
    request_id: string | null;
    trace_id: string | null;
    idempotency_key: string;
    schema_version: number;
    attempts: number;
    max_attempts: number;
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
}

interface WebhookSendResult {
    ok: boolean;
    status: number | null;
    preview: string | null;
    error: string | null;
}

const QUEUE_NAMES = [
    'payment-events',
    'inventory-jobs',
    'webhook-deliveries',
    'analytics-events',
    'search-indexing',
    'fulfillment-jobs',
    'bulk-admin-jobs',
] as const;

type QueueName = (typeof QUEUE_NAMES)[number];

function retryDelaySeconds(attempt: number, baseSeconds = 30): number {
    const exponent = Math.max(0, Math.min(attempt - 1, 8));
    return Math.min(3600, baseSeconds * 2 ** exponent);
}

function isValidHttpsWebhookUrl(targetUrl: string): boolean {
    try {
        const url = new URL(targetUrl);
        return url.protocol === 'https:' && url.hostname.length > 0;
    } catch {
        return false;
    }
}

function eventMatchesSubscription(eventType: string, eventTypes: string[]): boolean {
    return eventTypes.some((candidate) => {
        if (candidate === '*') return true;
        if (candidate === eventType) return true;
        if (!candidate.endsWith('.*')) return false;
        return eventType.startsWith(candidate.slice(0, -1));
    });
}

function queueNamesForEvent(eventType: string): QueueName[] {
    const queues = new Set<QueueName>();

    if (eventType.startsWith('payment.') || eventType.startsWith('refund.')) {
        queues.add('payment-events');
    }

    if (
        eventType.startsWith('inventory.') ||
        eventType.startsWith('po.') ||
        eventType.startsWith('transfer.')
    ) {
        queues.add('inventory-jobs');
    }

    if (
        eventType.startsWith('fulfillment.') ||
        eventType.startsWith('shipment.') ||
        eventType.startsWith('return.') ||
        eventType.includes('.fulfillment.')
    ) {
        queues.add('fulfillment-jobs');
    }

    if (
        eventType.startsWith('product.') ||
        eventType.startsWith('collection.') ||
        eventType.startsWith('category.') ||
        eventType.startsWith('customer.') ||
        eventType.startsWith('order.') ||
        eventType.startsWith('theme.')
    ) {
        queues.add('search-indexing');
    }

    queues.add('analytics-events');

    return [...queues];
}

function buildEventEnvelope(event: OutboxEventClaim): JsonObject {
    return {
        id: event.event_id,
        type: event.event_type,
        site_id: event.site_id,
        aggregate: {
            type: event.aggregate_type,
            id: event.aggregate_id,
        },
        occurred_at: event.created_at,
        request_id: event.request_id,
        trace_id: event.trace_id,
        idempotency_key: event.idempotency_key,
        schema_version: event.schema_version,
        payload: event.payload,
    };
}

async function readResponsePreview(response: Response, maxCharacters = 2000): Promise<string | null> {
    if (!response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = '';

    while (output.length < maxCharacters) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
    }

    output += decoder.decode();
    await reader.cancel().catch(() => undefined);

    return output.slice(0, maxCharacters);
}

export class OutboxService {
    constructor(private db: SupabaseClient, private fetcher: typeof fetch = fetch) {}

    async dispatchBatch(options: DispatchOptions): Promise<DispatchBatchResult> {
        const dispatcherId = options.dispatcherId;
        const outboxLimit = Math.min(Math.max(options.outboxLimit || 25, 1), 100);
        const webhookLimit = Math.min(Math.max(options.webhookLimit || 25, 1), 100);

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

        const events = await this.claimOutboxEvents(dispatcherId, outboxLimit);
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

        const webhookResult = await this.dispatchWebhookDeliveries(dispatcherId, webhookLimit);
        result.webhook_succeeded = webhookResult.succeeded;
        result.webhook_failed = webhookResult.failed;

        return result;
    }

    async dispatchWebhookDeliveries(
        dispatcherId: string,
        limit = 25
    ): Promise<{ claimed: number; succeeded: number; failed: number }> {
        const deliveries = await this.claimWebhookDeliveries(dispatcherId, Math.min(Math.max(limit, 1), 100));
        let succeeded = 0;
        let failed = 0;

        for (const delivery of deliveries) {
            const response = await this.sendWebhookDelivery(delivery);

            if (response.ok) {
                await this.completeWebhookDelivery(dispatcherId, delivery.id, response.status || 200, response.preview);
                succeeded += 1;
            } else {
                await this.failWebhookDelivery(dispatcherId, delivery, response);
                failed += 1;
            }
        }

        return { claimed: deliveries.length, succeeded, failed };
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
        const envelope = buildEventEnvelope(event);
        const queueJobs = await this.enqueuePlatformJobs(event, envelope);
        const webhookDeliveries = await this.createWebhookDeliveries(event, envelope);

        if (webhookDeliveries > 0) {
            await this.enqueueWebhookDeliveryJob(event, envelope);
        }

        return { queueJobs: queueJobs + (webhookDeliveries > 0 ? 1 : 0), webhookDeliveries };
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

    private async enqueueWebhookDeliveryJob(event: OutboxEventClaim, envelope: JsonObject): Promise<void> {
        const { error } = await this.db
            .from('platform_queue_jobs')
            .upsert(
                {
                    site_id: event.site_id,
                    outbox_event_id: event.id,
                    event_id: event.event_id,
                    queue_name: 'webhook-deliveries',
                    job_type: 'webhook.deliver',
                    payload: envelope,
                    request_id: event.request_id,
                    trace_id: event.trace_id,
                    idempotency_key: `${event.idempotency_key}:webhook-deliveries`,
                    schema_version: event.schema_version,
                    created_by: event.actor_id,
                    updated_by: event.actor_id,
                },
                { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true }
            );

        if (error) {
            throw new Error(`Webhook queue fanout failed: ${error.message}`);
        }
    }

    private async createWebhookDeliveries(event: OutboxEventClaim, envelope: JsonObject): Promise<number> {
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
            isValidHttpsWebhookUrl(subscription.target_url) &&
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
            p_retry_seconds: retryDelaySeconds(event.attempts),
            p_metadata: { dispatcher_id: dispatcherId },
        });

        if (failError) {
            throw new Error(`Outbox failure recording failed: ${failError.message}`);
        }
    }

    private async claimWebhookDeliveries(dispatcherId: string, limit: number): Promise<WebhookDeliveryClaim[]> {
        const { data, error } = await this.db.rpc('claim_webhook_deliveries', {
            p_dispatcher_id: dispatcherId,
            p_limit: limit,
            p_lock_seconds: 120,
        });

        if (error) {
            throw new Error(`Webhook delivery claim failed: ${error.message}`);
        }

        return Array.isArray(data) ? (data as WebhookDeliveryClaim[]) : [];
    }

    private async sendWebhookDelivery(delivery: WebhookDeliveryClaim): Promise<WebhookSendResult> {
        if (!isValidHttpsWebhookUrl(delivery.target_url)) {
            return {
                ok: false,
                status: null,
                preview: null,
                error: 'Webhook target URL must be HTTPS',
            };
        }

        const body = JSON.stringify(delivery.payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await hmacSha256Hex(delivery.signing_secret, `${timestamp}.${body}`);

        try {
            const response = await this.fetcher(delivery.target_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LetBuyy-Webhooks/1.0',
                    'X-LetBuyy-Event-ID': delivery.event_id,
                    'X-LetBuyy-Event-Type': delivery.event_type,
                    'X-LetBuyy-Request-ID': delivery.request_id || '',
                    'X-LetBuyy-Trace-ID': delivery.trace_id || '',
                    'X-LetBuyy-Timestamp': timestamp,
                    'X-LetBuyy-Signature': `v1=${signature}`,
                },
                body,
            });
            const preview = await readResponsePreview(response);

            if (response.ok) {
                return { ok: true, status: response.status, preview, error: null };
            }

            return {
                ok: false,
                status: response.status,
                preview,
                error: `Webhook endpoint returned HTTP ${response.status}`,
            };
        } catch (error) {
            return {
                ok: false,
                status: null,
                preview: null,
                error: error instanceof Error ? error.message : 'Webhook request failed',
            };
        }
    }

    private async completeWebhookDelivery(
        dispatcherId: string,
        deliveryId: string,
        responseStatus: number,
        responsePreview: string | null
    ): Promise<void> {
        const { error } = await this.db.rpc('complete_webhook_delivery', {
            p_delivery_id: deliveryId,
            p_dispatcher_id: dispatcherId,
            p_response_status: responseStatus,
            p_response_body_preview: responsePreview,
        });

        if (error) {
            throw new Error(`Webhook completion failed: ${error.message}`);
        }
    }

    private async failWebhookDelivery(
        dispatcherId: string,
        delivery: WebhookDeliveryClaim,
        response: WebhookSendResult
    ): Promise<void> {
        const { error } = await this.db.rpc('fail_webhook_delivery', {
            p_delivery_id: delivery.id,
            p_dispatcher_id: dispatcherId,
            p_error_message: response.error || 'Webhook delivery failed',
            p_response_status: response.status,
            p_response_body_preview: response.preview,
            p_retry_seconds: retryDelaySeconds(delivery.attempts, 120),
        });

        if (error) {
            throw new Error(`Webhook failure recording failed: ${error.message}`);
        }
    }
}
