export type CloudflareQueueTriggerBinding =
    | 'EVENT_QUEUE'
    | 'ANALYTICS_QUEUE'
    | 'SEARCH_QUEUE'
    | 'NOTIFICATION_QUEUE'
    | 'RUNTIME_QUEUE';

export type CloudflareQueueNameVar =
    | 'EVENT_QUEUE_NAME'
    | 'ANALYTICS_QUEUE_NAME'
    | 'SEARCH_QUEUE_NAME'
    | 'NOTIFICATION_QUEUE_NAME'
    | 'RUNTIME_QUEUE_NAME';

export interface CloudflareQueueTriggerPlan {
    binding: CloudflareQueueTriggerBinding;
    nameVar: CloudflareQueueNameVar;
    fallbackName: string;
    messageId: string;
    jobType: string;
    payload: Record<string, unknown>;
    correlationId: string;
}

export interface ScheduledDispatchQueueTriggerInput {
    status: 'completed' | 'failed';
    dispatcherId: string;
    workerId: string;
    eventId: string;
    environment?: string;
    deploymentEnv?: string;
    telemetryEnv?: string;
    outboxQueuedJobs?: number;
    queueClaimedJobs?: number;
    queueSucceededJobs?: number;
    webhookDeliveries?: number;
    error?: string;
}

const QUEUE_METADATA: Record<CloudflareQueueTriggerBinding, {
    nameVar: CloudflareQueueNameVar;
    fallbackName: string;
}> = {
    EVENT_QUEUE: {
        nameVar: 'EVENT_QUEUE_NAME',
        fallbackName: 'letbuyy-events',
    },
    ANALYTICS_QUEUE: {
        nameVar: 'ANALYTICS_QUEUE_NAME',
        fallbackName: 'letbuyy-analytics-queue',
    },
    SEARCH_QUEUE: {
        nameVar: 'SEARCH_QUEUE_NAME',
        fallbackName: 'letbuyy-search-queue',
    },
    NOTIFICATION_QUEUE: {
        nameVar: 'NOTIFICATION_QUEUE_NAME',
        fallbackName: 'letbuyy-notifications-queue',
    },
    RUNTIME_QUEUE: {
        nameVar: 'RUNTIME_QUEUE_NAME',
        fallbackName: 'letbuyy-runtime-queue',
    },
};

function queueTriggerPlan(
    binding: CloudflareQueueTriggerBinding,
    input: ScheduledDispatchQueueTriggerInput,
    suffix: string,
    jobType: string,
    payload: Record<string, unknown>,
): CloudflareQueueTriggerPlan {
    const metadata = QUEUE_METADATA[binding];

    return {
        binding,
        nameVar: metadata.nameVar,
        fallbackName: metadata.fallbackName,
        messageId: `${input.eventId}:${suffix}`,
        jobType,
        payload,
        correlationId: input.dispatcherId,
    };
}

export function scheduledDispatchHasPlatformQueueWork(input: ScheduledDispatchQueueTriggerInput): boolean {
    return Number(input.outboxQueuedJobs || 0) > 0
        || Number(input.queueClaimedJobs || 0) > 0
        || Number(input.queueSucceededJobs || 0) > 0;
}

export function planScheduledDispatchQueueTriggers(input: ScheduledDispatchQueueTriggerInput): CloudflareQueueTriggerPlan[] {
    const basePayload = {
        event_type: `runtime.scheduled_dispatch.${input.status}`,
        dispatcher_id: input.dispatcherId,
        worker_id: input.workerId,
        environment: input.environment,
        deployment_env: input.deploymentEnv || input.environment,
        telemetry_env: input.telemetryEnv || input.environment,
        outbox_queued_jobs: Number(input.outboxQueuedJobs || 0),
        queue_claimed_jobs: Number(input.queueClaimedJobs || 0),
        queue_succeeded_jobs: Number(input.queueSucceededJobs || 0),
        webhook_deliveries: Number(input.webhookDeliveries || 0),
        error: input.error,
    };

    const plans: CloudflareQueueTriggerPlan[] = [
        queueTriggerPlan('EVENT_QUEUE', input, input.status, basePayload.event_type, basePayload),
        queueTriggerPlan('RUNTIME_QUEUE', input, `runtime:${input.status}`, basePayload.event_type, basePayload),
    ];

    if (input.status === 'completed' && scheduledDispatchHasPlatformQueueWork(input)) {
        const drainPayload = {
            ...basePayload,
            event_type: 'platform.queue.drain.requested',
            queue_trigger: 'scheduled-dispatch',
        };

        plans.push(
            queueTriggerPlan('ANALYTICS_QUEUE', input, 'analytics-drain', 'platform.queue.drain', {
                ...drainPayload,
                platform_queue_name: 'analytics-events',
            }),
            queueTriggerPlan('SEARCH_QUEUE', input, 'search-drain', 'platform.queue.drain', {
                ...drainPayload,
                platform_queue_name: 'search-indexing',
            }),
            queueTriggerPlan('NOTIFICATION_QUEUE', input, 'notification-drain', 'platform.queue.drain', {
                ...drainPayload,
                platform_queue_name: 'analytics-events',
                notification_side_effects: true,
            }),
        );
    }

    return plans;
}
