import { z } from 'zod';
import { UuidSchema, SlugSchema, UrlSchema, SeoSchema, PaginationQuery } from './common.schema';

export const CreateBlogPostSchema = z.object({
    store_id: UuidSchema,
    title: z.string().min(1).max(300).trim(),
    slug: SlugSchema.optional(),
    excerpt: z.string().max(500).optional(),
    content: z.string().max(100000),
    content_html: z.string().max(150000).optional(),
    featured_image: UrlSchema.optional().nullable(),
    category_id: UuidSchema.optional().nullable(),
    tag_ids: z.array(UuidSchema).max(20).default([]),
    status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
    scheduled_at: z.coerce.date().optional().nullable(),
    allow_comments: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    is_pinned: z.boolean().default(false),
    reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
    ...SeoSchema.shape,
});

export const UpdateBlogPostSchema = z.object({
    title: z.string().min(1).max(300).trim().optional(),
    slug: SlugSchema.optional(),
    excerpt: z.string().max(500).optional(),
    content: z.string().max(100000).optional(),
    content_html: z.string().max(150000).optional(),
    featured_image: UrlSchema.optional().nullable(),
    category_id: UuidSchema.optional().nullable(),
    tag_ids: z.array(UuidSchema).max(20).optional(),
    status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
    scheduled_at: z.coerce.date().optional().nullable(),
    allow_comments: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
    reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
    version: z.number().int().positive('Version required').optional(),
    ...SeoSchema.shape,
});

export const CreateBlogCategorySchema = z.object({
    store_id: UuidSchema,
    name: z.string().min(1).max(100).trim(),
    slug: SlugSchema.optional(),
    description: z.string().max(500).optional(),
    parent_id: UuidSchema.optional().nullable(),
});

export const CreateBlogTagSchema = z.object({
    store_id: UuidSchema,
    name: z.string().min(1).max(50).trim(),
});

export const ListBlogPostsQuery = PaginationQuery.extend({
    store_id: UuidSchema.optional(),
    status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
    category_id: UuidSchema.optional(),
    search: z.string().max(200).optional(),
});

export const ListBlogCommentsQuery = PaginationQuery.extend({
    store_id: UuidSchema,
    status: z.enum(['all', 'pending', 'approved', 'spam', 'rejected']).default('all'),
});

export const UpdateBlogCommentSchema = z.object({
    status: z.enum(['pending', 'approved', 'spam', 'rejected']),
});
