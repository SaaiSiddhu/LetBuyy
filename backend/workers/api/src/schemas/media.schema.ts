import { z } from 'zod';
import { UuidSchema, UrlSchema, PaginationQuery } from './common.schema';

export const UploadMediaSchema = z.object({
    store_id: UuidSchema,
    alt_text: z.string().max(500).optional(),
    folder: z.string().max(200).optional(),
    tags: z.array(z.string().max(50)).max(20).default([]),
});

export const UpdateMediaSchema = z.object({
    alt_text: z.string().max(500).optional(),
    folder: z.string().max(200).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
});

export const ListMediaQuery = PaginationQuery.extend({
    store_id: UuidSchema.optional(),
    folder: z.string().max(200).optional(),
    type: z.enum(['image', 'video', 'document', 'all']).default('all'),
    search: z.string().max(200).optional(),
});

export const BulkDeleteMediaSchema = z.object({
    ids: z.array(UuidSchema).min(1).max(100),
});
