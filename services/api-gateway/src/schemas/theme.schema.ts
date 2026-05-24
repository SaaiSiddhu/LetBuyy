import { z } from 'zod';
import { SlugSchema, UuidSchema } from './common.schema';

export const ThemeSlugParamSchema = z.object({
    slug: SlugSchema,
});

export const ThemeStoreQuerySchema = z.object({
    store_id: UuidSchema,
});

export const InstallThemeSchema = z.object({
    store_id: UuidSchema,
    config_overrides: z.record(z.string(), z.unknown()).default({}),
});

export const SaveThemeDraftSchema = z.object({
    store_id: UuidSchema,
    template_config: z.record(z.string(), z.unknown()),
    base_version: z.number().int().positive().optional(),
    client: z.enum(['admin-web', 'flutter-builder', 'api']).default('api'),
});

export const PublishThemeSchema = z.object({
    store_id: UuidSchema,
    base_version: z.number().int().positive().optional(),
    make_store_live: z.boolean().default(true),
    publish_message: z.string().max(500).optional(),
});

export const PreviewTokenSchema = z.object({
    store_id: UuidSchema,
    ttl_seconds: z.number().int().min(60).max(3600).default(900),
});

export const RollbackThemeReleaseSchema = z.object({
    store_id: UuidSchema,
    make_store_live: z.boolean().default(true),
    rollback_message: z.string().max(500).optional(),
});

export const ThemePurchaseOrderSchema = z.object({
    currency: z.enum(['INR']).default('INR'),
    idempotency_key: z.string().min(8).max(200).optional(),
});

export const ThemePurchaseVerifySchema = z.object({
    razorpay_order_id: z.string().min(1).max(200),
    razorpay_payment_id: z.string().min(1).max(200),
    razorpay_signature: z.string().min(1).max(500),
});

export type InstallThemeInput = z.infer<typeof InstallThemeSchema>;
export type SaveThemeDraftInput = z.infer<typeof SaveThemeDraftSchema>;
export type PublishThemeInput = z.infer<typeof PublishThemeSchema>;
export type PreviewTokenInput = z.infer<typeof PreviewTokenSchema>;
export type RollbackThemeReleaseInput = z.infer<typeof RollbackThemeReleaseSchema>;
export type ThemePurchaseOrderInput = z.infer<typeof ThemePurchaseOrderSchema>;
export type ThemePurchaseVerifyInput = z.infer<typeof ThemePurchaseVerifySchema>;
