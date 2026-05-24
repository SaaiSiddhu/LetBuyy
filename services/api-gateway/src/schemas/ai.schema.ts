import { z } from 'zod';
import { UuidSchema } from './common.schema';

export const GenerateContentSchema = z.object({
    store_id: UuidSchema,
    type: z.enum([
        'product_description',
        'seo_meta',
        'blog_post',
        'social_caption',
        'email_template',
        'ad_copy',
        'brand_tagline',
    ]),
    prompt: z.string().min(5).max(2000),
    context: z.object({
        product_name: z.string().max(256).optional(),
        category: z.string().max(100).optional(),
        keywords: z.array(z.string().max(50)).max(20).optional(),
        tone: z.enum(['professional', 'casual', 'luxury', 'playful', 'formal']).optional(),
        language: z.enum(['en', 'hi', 'ta', 'te', 'ml', 'kn', 'bn']).default('en'),
        max_length: z.number().int().min(50).max(5000).default(500),
    }).optional(),
});

export const GenerateImageSchema = z.object({
    store_id: UuidSchema,
    prompt: z.string().min(5).max(1000),
    style: z.enum(['product', 'banner', 'logo', 'social', 'custom']).default('product'),
    dimensions: z.object({
        width: z.number().int().min(256).max(2048).default(1024),
        height: z.number().int().min(256).max(2048).default(1024),
    }).optional(),
});

export const AiChatSchema = z.object({
    store_id: UuidSchema,
    message: z.string().min(1).max(2000),
    conversation_id: UuidSchema.optional(),
    context_type: z.enum(['general', 'analytics', 'marketing', 'support']).default('general'),
});

export const CheckCreditsSchema = z.object({
    store_id: UuidSchema,
    operation: z.enum(['text', 'image', 'chat']),
});
