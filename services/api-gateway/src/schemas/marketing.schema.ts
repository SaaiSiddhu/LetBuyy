import { z } from 'zod';
import {
    CustomerSegmentRulesSchema,
    MarketingEmailAudienceSchema,
    UuidSchema,
} from '@letbuyy/shared-types';

export const ListEmailCampaignsQuery = z.object({
    store_id: UuidSchema,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']).optional(),
});

export const GetEmailCampaignQuery = z.object({
    store_id: UuidSchema,
});

export const PreviewEmailCampaignAudienceSchema = z.object({
    store_id: UuidSchema,
    audience: MarketingEmailAudienceSchema.default({ type: 'all_marketing', recipients: [] }),
});

export const CreateEmailCampaignSchema = z.object({
    store_id: UuidSchema,
    name: z.string().min(1).max(160).trim(),
    subject: z.string().min(1).max(180).trim(),
    preview_text: z.string().max(240).trim().optional().nullable(),
    body_text: z.string().min(1).max(20000).trim(),
    body_html: z.string().max(50000).trim().optional().nullable(),
    audience: MarketingEmailAudienceSchema.default({ type: 'all_marketing', recipients: [] }),
    scheduled_at: z.string().datetime().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateEmailCampaignSchema = CreateEmailCampaignSchema.pick({
    name: true,
    subject: true,
    preview_text: true,
    body_text: true,
    body_html: true,
    scheduled_at: true,
    metadata: true,
}).partial().extend({
    audience: MarketingEmailAudienceSchema.optional(),
    status: z.enum(['draft', 'scheduled', 'cancelled']).optional(),
});

export const SendEmailCampaignSchema = z.object({
    store_id: UuidSchema,
    idempotency_key: z.string().min(8).max(200).trim(),
});

export type ListEmailCampaignsInput = z.infer<typeof ListEmailCampaignsQuery>;
export type GetEmailCampaignInput = z.infer<typeof GetEmailCampaignQuery>;
export type PreviewEmailCampaignAudienceInput = z.infer<typeof PreviewEmailCampaignAudienceSchema>;
export type CreateEmailCampaignInput = z.infer<typeof CreateEmailCampaignSchema>;
export type UpdateEmailCampaignInput = z.infer<typeof UpdateEmailCampaignSchema>;
export type SendEmailCampaignInput = z.infer<typeof SendEmailCampaignSchema>;

export { CustomerSegmentRulesSchema };
