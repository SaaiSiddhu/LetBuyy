import { z } from 'zod';
import { UuidSchema } from '@letbuyy/shared-types';

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

export type GenerateContentInput = z.infer<typeof GenerateContentSchema>;
export type GenerateImageInput = z.infer<typeof GenerateImageSchema>;
export type AiChatInput = z.infer<typeof AiChatSchema>;
export type CheckCreditsInput = z.infer<typeof CheckCreditsSchema>;

export type AppEngineJsonRecord = Record<string, unknown>;

export interface AppDeveloperRegistrationInsert {
  user_id: string;
  company_name: string;
  slug: string;
  website_url: string | null;
  support_email: string;
  description: string | null;
  country: string;
  status: 'pending';
  verified: false;
}

export interface MarketplaceAppSubmissionInsert {
  developer_id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category_id: string;
  app_url: string;
  privacy_policy_url: string;
  pricing_model: string;
  price_inr: number;
  status: 'draft' | 'in_review';
  install_count: 0;
  rating_avg: 0;
  review_count: 0;
}

export type AppEnginePlanResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function appStoreSlugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isNonEmptyAppStoreString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function appStoreStringOrNull(value: unknown): string | null {
  return isNonEmptyAppStoreString(value) ? value.trim() : null;
}

export function appStoreStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function parseAppStoreJsonRecord(value: unknown): AppEngineJsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AppEngineJsonRecord;
}

export function isAppStoreUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

export function planAppDeveloperRegistration(
  body: AppEngineJsonRecord,
  userId: string,
): AppEnginePlanResult<AppDeveloperRegistrationInsert> {
  const companyName = appStoreStringOrNull(body.company_name);
  const supportEmail = appStoreStringOrNull(body.support_email || body.contact_email);

  if (!companyName || !supportEmail) {
    return { ok: false, message: 'company_name and support_email are required' };
  }

  const slug = appStoreSlugify(companyName);
  if (!slug) {
    return { ok: false, message: 'company_name must contain letters or numbers' };
  }

  return {
    ok: true,
    value: {
      user_id: userId,
      company_name: companyName,
      slug,
      website_url: appStoreStringOrNull(body.website_url || body.website),
      support_email: supportEmail,
      description: appStoreStringOrNull(body.description || body.bio),
      country: appStoreStringOrNull(body.country) || 'IN',
      status: 'pending',
      verified: false,
    },
  };
}

export function planMarketplaceAppSubmission(
  body: AppEngineJsonRecord,
  developerId: string,
): AppEnginePlanResult<MarketplaceAppSubmissionInsert> {
  const name = appStoreStringOrNull(body.name);
  const tagline = appStoreStringOrNull(body.tagline);
  const description = appStoreStringOrNull(body.description);
  const categoryId = appStoreStringOrNull(body.category_id);
  const appUrl = appStoreStringOrNull(body.app_url);
  const privacyUrl = appStoreStringOrNull(body.privacy_url || body.privacy_policy_url);

  if (!name || !tagline || !description || !categoryId || !appUrl || !privacyUrl) {
    return {
      ok: false,
      message: 'name, tagline, description, category_id, app_url, and privacy_url are required',
    };
  }

  const requestedSlug = appStoreStringOrNull(body.slug);
  const slug = appStoreSlugify(requestedSlug || name);
  if (!slug) {
    return { ok: false, message: 'slug must contain letters or numbers' };
  }

  const priceMonthly = Number(body.price_monthly || 0);
  const priceInr = Number.isFinite(priceMonthly) ? Math.max(Math.round(priceMonthly * 100) / 100, 0) : 0;

  return {
    ok: true,
    value: {
      developer_id: developerId,
      name,
      slug,
      tagline,
      description,
      category_id: categoryId,
      app_url: appUrl,
      privacy_policy_url: privacyUrl,
      pricing_model: appStoreStringOrNull(body.pricing_model) || 'free',
      price_inr: priceInr,
      status: body.save_as_draft ? 'draft' : 'in_review',
      install_count: 0,
      rating_avg: 0,
      review_count: 0,
    },
  };
}
