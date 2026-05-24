import { z } from 'zod';
import { EmailSchema, PaginationQuery, UuidSchema } from './common.schema';

export const ReviewModerationStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const ListProductReviewsQuery = PaginationQuery.extend({
    store_id: UuidSchema,
    status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
});

export const UpdateProductReviewSchema = z.object({
    status: ReviewModerationStatusSchema,
});

export const StorefrontProductReviewsQuery = z.object({
    product_id: UuidSchema,
    store_id: UuidSchema,
});

export const CreateStorefrontProductReviewSchema = z.object({
    product_id: UuidSchema,
    store_id: UuidSchema,
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().nullable(),
    body: z.string().trim().max(2000).optional().nullable(),
    customer_name: z.string().trim().max(120).optional().nullable(),
    customer_email: EmailSchema.optional().nullable(),
    is_verified: z.boolean().default(false),
});

export type ReviewModerationStatus = z.infer<typeof ReviewModerationStatusSchema>;
export type StorefrontProductReviewsQueryInput = z.infer<typeof StorefrontProductReviewsQuery>;
export type CreateStorefrontProductReviewInput = z.infer<typeof CreateStorefrontProductReviewSchema>;
