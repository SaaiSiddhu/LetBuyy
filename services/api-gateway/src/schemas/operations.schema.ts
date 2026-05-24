import { z } from 'zod';

export const DispatchOutboxSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    webhook_limit: z.number().int().min(1).max(100).optional(),
});

export const DispatchWebhookDeliveriesSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
});

export const ConsumeQueueJobsSchema = z.object({
    queue_name: z.enum(['analytics-events', 'search-indexing']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
});

export const OperationsListQuerySchema = z.object({
    status: z.string().max(40).optional(),
    site_id: z.string().uuid().optional(),
    queue_name: z.string().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const CreateWebhookSubscriptionSchema = z.object({
    site_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    target_url: z.string().url().refine((value) => value.startsWith('https://'), {
        message: 'target_url must use HTTPS',
    }),
    event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).default(['*']),
    signing_secret: z.string().min(32).max(256),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateWebhookSubscriptionSchema = z.object({
    status: z.enum(['active', 'paused', 'disabled']).optional(),
    event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).optional(),
    target_url: z.string().url().refine((value) => value.startsWith('https://'), {
        message: 'target_url must use HTTPS',
    }).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const RecordUsageSchema = z.object({
    site_id: z.string().uuid(),
    meter_name: z.string().trim().min(1).max(120),
    amount: z.number().finite(),
    idempotency_key: z.string().trim().min(8).max(200),
    source: z.string().trim().min(1).max(80).optional(),
    resource_type: z.string().trim().min(1).max(80).optional(),
    resource_id: z.string().trim().min(1).max(200).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DispatchOutboxInput = z.infer<typeof DispatchOutboxSchema>;
export type DispatchWebhookDeliveriesInput = z.infer<typeof DispatchWebhookDeliveriesSchema>;
export type ConsumeQueueJobsInput = z.infer<typeof ConsumeQueueJobsSchema>;
export type OperationsListQuery = z.infer<typeof OperationsListQuerySchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageSchema>;
export type CreateWebhookSubscriptionInput = z.infer<typeof CreateWebhookSubscriptionSchema>;
export type UpdateWebhookSubscriptionInput = z.infer<typeof UpdateWebhookSubscriptionSchema>;
