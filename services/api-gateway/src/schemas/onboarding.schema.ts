import { z } from 'zod';
import { UuidSchema, EmailSchema } from './common.schema';
import { SiteTypeSchema, SubdomainSchema } from './store.schema';

export const StartOnboardingSchema = z.object({
    site_type: SiteTypeSchema,
});

export const Step1Schema = z.object({
    site_type: SiteTypeSchema,
});

export const Step2Schema = z.object({
    store_name: z.string().min(2).max(100).trim(),
    subdomain: SubdomainSchema,
});

export const Step3Schema = z.object({
    template_id: UuidSchema,
});

export const Step4Schema = z.object({
    industry: z.string().max(100).optional(),
    target_audience: z.enum(['B2C', 'B2B', 'Both']).optional(),
    business_goal: z.enum(['sell_products', 'showcase_work', 'build_brand', 'grow_audience', 'other']).optional(),
    brand_tone: z.enum(['professional', 'casual', 'luxury', 'playful', 'formal']).optional(),
    team_size: z.enum(['solo', '2-5', '6-20', '20+']).optional(),
    revenue_range: z.enum(['pre-revenue', '<1L', '1-10L', '10L+']).optional(),
});

export const Step5Schema = z.object({
    logo_url: z.string().url().optional(),
    brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    tagline: z.string().max(200).optional(),
});

export const Step6Schema = z.object({
    publish_immediately: z.boolean().default(false),
});

export const CheckSubdomainSchema = z.object({
    subdomain: SubdomainSchema,
});

// Map step numbers to their schemas
export const STEP_SCHEMAS: Record<number, z.ZodType> = {
    1: Step1Schema,
    2: Step2Schema,
    3: Step3Schema,
    4: Step4Schema,
    5: Step5Schema,
    6: Step6Schema,
};
