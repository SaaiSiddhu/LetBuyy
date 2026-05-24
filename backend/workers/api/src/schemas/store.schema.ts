import { z } from 'zod';
import { SeoSchema } from './common.schema';

const RESERVED_SUBDOMAINS = [
    'www', 'api', 'admin', 'auth', 'cdn', 'mail', 'ftp', 'app',
    'staging', 'dev', 'test', 'console', 'team', 'accounts',
    'status', 'help', 'docs', 'support', 'billing', 'store',
    'dashboard', 'login', 'signup', 'register', 'blog', 'shop',
];

export const SiteTypeSchema = z.enum([
    'store', 'portfolio', 'resume', 'blog', 'landing',
]);

export const SubdomainSchema = z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain cannot exceed 63 characters')
    .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        'Subdomain must be lowercase alphanumeric, may contain hyphens (not at start/end)'
    )
    .refine(
        (s) => !RESERVED_SUBDOMAINS.includes(s),
        'This subdomain is reserved'
    );

export const CreateStoreSchema = z.object({
    name: z.string().min(1).max(100).trim(),
    subdomain: SubdomainSchema,
    site_type: SiteTypeSchema.default('store'),
    tagline: z.string().max(200).optional(),
    theme_id: z.string().max(50).default('modern'),
    template_config: z.record(z.string(), z.unknown()).default({}),
    ...SeoSchema.shape,
});

export const UpdateStoreSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(1000).optional(),
    tagline: z.string().max(200).optional(),
    status: z.enum(['draft', 'published', 'suspended']).optional(),
    theme_id: z.string().max(50).optional(),
    template_config: z.record(z.string(), z.unknown()).optional(),
    site_settings: z.record(z.string(), z.unknown()).optional(),
    logo_url: z.string().url().optional().nullable(),
    custom_domain: z.string().max(255).optional().nullable(),
    currency: z.string().length(3).optional(),
    refund_policy: z.string().max(20000).optional(),
    privacy_policy: z.string().max(20000).optional(),
    terms_of_service: z.string().max(20000).optional(),
    shipping_policy: z.string().max(20000).optional(),
    seo_title: z.string().max(70).optional(),
    seo_description: z.string().max(160).optional(),
    tax_inclusive: z.boolean().optional(),
    version: z.number().int().positive('Version is required for concurrent safety').optional(),
});

export const PaymentConfigSchema = z.object({
    key_id: z
        .string()
        .min(8)
        .max(128)
        .regex(/^rzp_(test|live)_/, 'Razorpay key id must start with rzp_test_ or rzp_live_'),
    key_secret: z.string().min(10).max(256),
    test_mode: z.boolean().default(false),
});
