import type { SupabaseClient } from '@supabase/supabase-js';

type JsonObject = Record<string, unknown>;

type ConsumableQueueName = 'analytics-events' | 'search-indexing';

interface PlatformQueueJob {
    id: string;
    site_id: string | null;
    outbox_event_id: string | null;
    event_id: string;
    queue_name: ConsumableQueueName;
    job_type: string;
    payload: JsonObject;
    attempts: number;
    max_attempts: number;
    request_id: string | null;
    trace_id: string | null;
    idempotency_key: string;
    schema_version: number;
}

interface QueueConsumeResult {
    worker_id: string;
    queue_name: ConsumableQueueName;
    claimed: number;
    succeeded: number;
    failed: number;
    skipped: number;
}

interface EventEnvelope {
    id?: string;
    type?: string;
    site_id?: string | null;
    aggregate?: {
        type?: string;
        id?: string;
    };
    occurred_at?: string;
    request_id?: string | null;
    trace_id?: string | null;
    idempotency_key?: string;
    schema_version?: number;
    payload?: JsonObject;
}

interface ProductSearchRow {
    id: string;
    store_id: string;
    name: string;
    description?: string | null;
    sku?: string | null;
    category?: string | null;
    product_type?: string | null;
    vendor?: string | null;
    tags?: string[] | null;
    status?: string | null;
    is_active?: boolean | null;
    price?: number | string | null;
    deleted_at?: string | null;
}

interface OrderSearchRow {
    id: string;
    store_id: string;
    order_number?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    status?: string | null;
    total?: number | string | null;
    deleted_at?: string | null;
}

function retryDelaySeconds(attempt: number): number {
    const exponent = Math.max(0, Math.min(attempt - 1, 8));
    return Math.min(3600, 60 * 2 ** exponent);
}

function toEnvelope(payload: JsonObject): EventEnvelope {
    return payload as EventEnvelope;
}

function rollupDate(occurredAt?: string): string {
    const date = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function textParts(...parts: Array<string | number | null | undefined | string[]>): string {
    return parts
        .flatMap((part) => Array.isArray(part) ? part : [part])
        .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
        .map((part) => String(part))
        .join(' ');
}

export class QueueService {
    constructor(private db: SupabaseClient) {}

    async consumeQueues(
        workerId: string,
        queueNames: ConsumableQueueName[] = ['analytics-events', 'search-indexing'],
        limit = 25
    ): Promise<QueueConsumeResult[]> {
        const results: QueueConsumeResult[] = [];

        for (const queueName of queueNames) {
            results.push(await this.consumeQueue(workerId, queueName, limit));
        }

        return results;
    }

    async consumeQueue(workerId: string, queueName: ConsumableQueueName, limit = 25): Promise<QueueConsumeResult> {
        const jobs = await this.claimJobs(workerId, queueName, Math.min(Math.max(limit, 1), 100));
        const result: QueueConsumeResult = {
            worker_id: workerId,
            queue_name: queueName,
            claimed: jobs.length,
            succeeded: 0,
            failed: 0,
            skipped: 0,
        };

        for (const job of jobs) {
            try {
                const processed = queueName === 'analytics-events'
                    ? await this.processAnalyticsJob(job)
                    : await this.processSearchJob(job);

                await this.completeJob(workerId, job.id, { processed });
                if (processed) {
                    result.succeeded += 1;
                } else {
                    result.skipped += 1;
                }
            } catch (error) {
                result.failed += 1;
                await this.failJob(workerId, job, error);
            }
        }

        return result;
    }

    private async claimJobs(workerId: string, queueName: ConsumableQueueName, limit: number): Promise<PlatformQueueJob[]> {
        const { data, error } = await this.db.rpc('claim_platform_queue_jobs', {
            p_queue_name: queueName,
            p_worker_id: workerId,
            p_limit: limit,
            p_lock_seconds: 120,
        });

        if (error) {
            throw new Error(`Queue claim failed for ${queueName}: ${error.message}`);
        }

        return Array.isArray(data) ? (data as PlatformQueueJob[]) : [];
    }

    private async processAnalyticsJob(job: PlatformQueueJob): Promise<boolean> {
        const envelope = toEnvelope(job.payload);
        const siteId = job.site_id || envelope.site_id;
        if (!siteId) return false;

        const eventType = envelope.type || job.job_type;
        const aggregateType = envelope.aggregate?.type || null;
        const aggregateId = envelope.aggregate?.id || null;
        const occurredAt = envelope.occurred_at || new Date().toISOString();
        const eventId = envelope.id || job.event_id;

        const { error } = await this.db
            .from('analytics_event_stream')
            .upsert(
                {
                    site_id: siteId,
                    event_id: eventId,
                    event_type: eventType,
                    aggregate_type: aggregateType,
                    aggregate_id: aggregateId,
                    occurred_at: occurredAt,
                    request_id: envelope.request_id || job.request_id,
                    trace_id: envelope.trace_id || job.trace_id,
                    idempotency_key: envelope.idempotency_key || job.idempotency_key,
                    schema_version: envelope.schema_version || job.schema_version,
                    properties: envelope.payload || {},
                },
                { onConflict: 'event_id' }
            );

        if (error) throw new Error(`Analytics event projection failed: ${error.message}`);

        await this.incrementRollup(siteId, 'events.total', rollupDate(occurredAt), {});
        await this.incrementRollup(siteId, `events.${eventType}`, rollupDate(occurredAt), {
            aggregate_type: aggregateType,
        });

        return true;
    }

    private async processSearchJob(job: PlatformQueueJob): Promise<boolean> {
        const envelope = toEnvelope(job.payload);
        const aggregateType = envelope.aggregate?.type || '';
        const aggregateId = envelope.aggregate?.id || '';

        if (!aggregateId) return false;

        if (aggregateType === 'product' || job.job_type.startsWith('product.')) {
            return this.projectProductSearchDocument(job, aggregateId);
        }

        if (aggregateType === 'order' || job.job_type.startsWith('order.')) {
            return this.projectOrderSearchDocument(job, aggregateId);
        }

        return false;
    }

    private async projectProductSearchDocument(job: PlatformQueueJob, productId: string): Promise<boolean> {
        const { data, error } = await this.db
            .from('products')
            .select('id, store_id, name, description, sku, category, product_type, vendor, tags, status, is_active, price, deleted_at')
            .eq('id', productId)
            .maybeSingle();

        if (error) throw new Error(`Product search source lookup failed: ${error.message}`);
        if (!data) return this.markSearchDocumentDeleted(job, 'product', productId);

        const product = data as ProductSearchRow;
        const status = product.deleted_at || product.is_active === false || product.status === 'draft'
            ? 'hidden'
            : 'active';

        const { error: upsertError } = await this.db
            .from('search_documents')
            .upsert(
                {
                    site_id: product.store_id,
                    object_type: 'product',
                    object_id: product.id,
                    title: product.name || '',
                    subtitle: product.sku || product.category || null,
                    searchable_text: textParts(
                        product.name,
                        product.description,
                        product.sku,
                        product.category,
                        product.product_type,
                        product.vendor,
                        product.tags
                    ),
                    attributes: {
                        price: product.price,
                        category: product.category,
                        product_type: product.product_type,
                        vendor: product.vendor,
                        tags: product.tags || [],
                    },
                    source_event_id: job.event_id,
                    status,
                    indexed_at: new Date().toISOString(),
                    deleted_at: null,
                },
                { onConflict: 'site_id,object_type,object_id' }
            );

        if (upsertError) throw new Error(`Product search projection failed: ${upsertError.message}`);
        return true;
    }

    private async projectOrderSearchDocument(job: PlatformQueueJob, orderId: string): Promise<boolean> {
        const { data, error } = await this.db
            .from('orders')
            .select('id, store_id, order_number, customer_name, customer_email, status, total, deleted_at')
            .eq('id', orderId)
            .maybeSingle();

        if (error) throw new Error(`Order search source lookup failed: ${error.message}`);
        if (!data) return this.markSearchDocumentDeleted(job, 'order', orderId);

        const order = data as OrderSearchRow;
        const { error: upsertError } = await this.db
            .from('search_documents')
            .upsert(
                {
                    site_id: order.store_id,
                    object_type: 'order',
                    object_id: order.id,
                    title: order.order_number || order.id,
                    subtitle: order.customer_email || null,
                    searchable_text: textParts(
                        order.order_number,
                        order.customer_name,
                        order.customer_email,
                        order.status,
                        order.total
                    ),
                    attributes: {
                        status: order.status,
                        total: order.total,
                        customer_email: order.customer_email,
                    },
                    source_event_id: job.event_id,
                    status: order.deleted_at ? 'deleted' : 'active',
                    indexed_at: new Date().toISOString(),
                    deleted_at: order.deleted_at || null,
                },
                { onConflict: 'site_id,object_type,object_id' }
            );

        if (upsertError) throw new Error(`Order search projection failed: ${upsertError.message}`);
        return true;
    }

    private async markSearchDocumentDeleted(
        job: PlatformQueueJob,
        objectType: 'product' | 'order',
        objectId: string
    ): Promise<boolean> {
        if (!job.site_id) return false;

        const { error } = await this.db
            .from('search_documents')
            .upsert(
                {
                    site_id: job.site_id,
                    object_type: objectType,
                    object_id: objectId,
                    title: objectId,
                    searchable_text: objectId,
                    source_event_id: job.event_id,
                    status: 'deleted',
                    indexed_at: new Date().toISOString(),
                    deleted_at: new Date().toISOString(),
                },
                { onConflict: 'site_id,object_type,object_id' }
            );

        if (error) throw new Error(`Search deletion projection failed: ${error.message}`);
        return true;
    }

    private async incrementRollup(
        siteId: string,
        metricName: string,
        date: string,
        dimensions: JsonObject
    ): Promise<void> {
        const { error } = await this.db.rpc('increment_analytics_rollup', {
            p_site_id: siteId,
            p_metric_name: metricName,
            p_rollup_date: date,
            p_dimensions: dimensions,
            p_increment: 1,
        });

        if (error) throw new Error(`Analytics rollup increment failed: ${error.message}`);
    }

    private async completeJob(workerId: string, jobId: string, result: JsonObject): Promise<void> {
        const { error } = await this.db.rpc('complete_platform_queue_job', {
            p_job_id: jobId,
            p_worker_id: workerId,
            p_result: result,
        });

        if (error) throw new Error(`Queue job completion failed: ${error.message}`);
    }

    private async failJob(workerId: string, job: PlatformQueueJob, error: unknown): Promise<void> {
        const { error: failError } = await this.db.rpc('fail_platform_queue_job', {
            p_job_id: job.id,
            p_worker_id: workerId,
            p_error_message: error instanceof Error ? error.message : 'Queue job failed',
            p_retry_seconds: retryDelaySeconds(job.attempts),
            p_result: {},
        });

        if (failError) throw new Error(`Queue job failure recording failed: ${failError.message}`);
    }
}
