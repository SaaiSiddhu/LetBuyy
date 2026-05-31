import { z } from 'zod';
import { SeoSchema, UuidSchema } from '@letbuyy/shared-types';
import type { StoreTemplateConfig } from '@letbuyy/theme-engine';

export type SiteType = 'store' | 'portfolio' | 'resume' | 'blog' | 'landing';
export type StoreStatus = 'draft' | 'published' | 'frozen' | 'suspended';
export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal';

export const RESERVED_SUBDOMAINS = [
  'accounts', 'admin', 'console', 'team', 'api', 'webhooks',
  'www', 'mail', 'ftp', 'localhost', 'letbuyy',
  'seller', 'buyer', 'customer', 'support', 'help', 'contact',
  'about', 'terms', 'privacy', 'policy', 'faq', 'blog', 'press',
  'careers', 'investors', 'partners', 'affiliates', 'legal',
  'store', 'stores', 'shop', 'app', 'dashboard', 'billing',
  'auth', 'login', 'signup', 'register', 'onboarding',
  'static', 'assets', 'cdn', 'media', 'images', 'files',
  'status', 'docs', 'dev',
  'null', 'undefined', 'test', 'demo', 'example', 'staging',
] as const;

export const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const SiteTypeSchema = z.enum([
  'store', 'portfolio', 'resume', 'blog', 'landing',
]);

export const SubdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain cannot exceed 63 characters')
  .regex(SUBDOMAIN_PATTERN, 'Subdomain must be lowercase alphanumeric, may contain hyphens (not at start/end)')
  .refine(
    (subdomain) => !RESERVED_SUBDOMAINS.includes(subdomain as typeof RESERVED_SUBDOMAINS[number]),
    'This subdomain is reserved',
  );

export type SubdomainValidationResult =
  | { valid: true }
  | { valid: false; reason: string; message: string };

export function validateSubdomainFormat(subdomain: string): SubdomainValidationResult {
  if (!subdomain) {
    return { valid: false, reason: 'missing', message: 'Subdomain is required' };
  }

  if (subdomain.length < 3) {
    return { valid: false, reason: 'too_short', message: 'Must be at least 3 characters' };
  }

  if (subdomain.length > 63) {
    return { valid: false, reason: 'too_long', message: 'Must be at most 63 characters' };
  }

  if (!SUBDOMAIN_PATTERN.test(subdomain)) {
    return {
      valid: false,
      reason: 'invalid_format',
      message: 'Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.',
    };
  }

  if (subdomain.includes('--')) {
    return { valid: false, reason: 'double_hyphen', message: 'Cannot contain consecutive hyphens' };
  }

  if (RESERVED_SUBDOMAINS.includes(subdomain as typeof RESERVED_SUBDOMAINS[number])) {
    return { valid: false, reason: 'reserved', message: 'This name is reserved' };
  }

  return { valid: true };
}

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

export const STEP_SCHEMAS: Record<number, z.ZodType> = {
  1: Step1Schema,
  2: Step2Schema,
  3: Step3Schema,
  4: Step4Schema,
  5: Step5Schema,
  6: Step6Schema,
};

export interface Store {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  custom_domain?: string;
  site_type: SiteType;
  status: StoreStatus;
  theme_id?: string;
  current_theme_release_id?: string;
  storefront_release_version?: number;
  theme_config: Record<string, unknown>;
  settings: Record<string, unknown>;
  meta_title?: string;
  meta_description?: string;
  favicon_url?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface CreateStoreRequest {
  name: string;
  subdomain: string;
  site_type: SiteType;
  template_id?: string;
}

export interface UpdateStoreRequest {
  name?: string;
  theme_config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  meta_title?: string;
  meta_description?: string;
}

export interface NavPage {
  id: string;
  label: string;
  href: string;
  isDefault: boolean;
  isVisible: boolean;
  openInNewTab?: boolean;
  children?: NavPage[];
  targetType?: string;
  targetResourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StoreNavigation {
  main?: NavPage[];
  footer?: NavPage[];
  policies?: NavPage[];
}

export const DEFAULT_NAV_PAGES: NavPage[] = [
  { id: 'home', label: 'Home', href: '/', isDefault: true, isVisible: true },
  { id: 'shop', label: 'Shop', href: '/shop', isDefault: true, isVisible: true },
  { id: 'privacy', label: 'Privacy', href: '/privacy', isDefault: true, isVisible: true },
  { id: 'terms', label: 'Terms', href: '/terms', isDefault: true, isVisible: true },
  { id: 'shipping', label: 'Shipping', href: '/shipping', isDefault: true, isVisible: true },
  { id: 'returns', label: 'Returns', href: '/returns', isDefault: true, isVisible: true },
];

export interface StoreModel {
  id: string;
  sellerId: string;
  name: string;
  tagline?: string;
  subdomain: string;
  storeUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeId?: string;
  currentThemeReleaseId?: string;
  storefrontReleaseVersion?: number;
  themeCustomization?: Record<string, unknown>;
  siteType: SiteType;
  selectedProductIds: string[];
  templateConfig: StoreTemplateConfig;
  status: 'draft' | 'published' | 'suspended';
  plan?: 'free' | 'premium';
  seoTitle?: string;
  seoDescription?: string;
  codEnabled?: boolean;
  onlinePaymentEnabled?: boolean;
  paymentGateways?: PaymentGateway[];
  navigation?: StoreNavigation;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface PublishedStoreRecord {
  id: string;
}

export interface StorefrontSiteRecord {
  id: string;
  user_id?: string | null;
  custom_user_id?: string | null;
  name?: string | null;
  store_name?: string | null;
  subdomain?: string | null;
  site_type?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  custom_domain?: string | null;
  currency?: string | null;
  settings?: Record<string, unknown> | null;
  theme_id?: string | null;
  template_config?: Record<string, unknown> | null;
  status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cod_enabled?: boolean | null;
  online_payment_enabled?: boolean | null;
  payment_settings?: Record<string, unknown> | null;
  current_theme_release_id?: string | null;
  storefront_release_version?: number | null;
}

export interface StorefrontThemeReleaseRecord {
  id: string;
  theme_id: string;
  theme_instance_id?: string | null;
  theme_package_version_id?: string | null;
  release_version: number;
  release_config: Record<string, unknown> | null;
  release_manifest?: Record<string, unknown> | null;
  template_snapshot?: Record<string, unknown> | null;
  settings_snapshot?: Record<string, unknown> | null;
  asset_manifest?: Record<string, unknown> | null;
  cache_manifest?: Record<string, unknown> | null;
  data_binding_manifest?: Record<string, unknown> | null;
  schema_manifest_version?: string | null;
  engine_version?: string | null;
  published_at: string | null;
}

export interface PublicStorefrontThemeRelease {
  id: string;
  theme_id: string;
  theme_instance_id: string | null;
  theme_package_version_id: string | null;
  release_version: number;
  release_config: Record<string, unknown>;
  release_manifest: Record<string, unknown>;
  template_snapshot: Record<string, unknown>;
  settings_snapshot: Record<string, unknown>;
  asset_manifest: Record<string, unknown>;
  cache_manifest: Record<string, unknown>;
  data_binding_manifest: Record<string, unknown>;
  schema_manifest_version: string;
  engine_version: string;
  published_at: string | null;
}

export type PublicStorefrontPayload = StorefrontSiteRecord & {
  name: string | null | undefined;
  subdomain: string | null | undefined;
  current_theme_release: PublicStorefrontThemeRelease | null;
};

export function normalizeStorefrontHandle(handle: string): string | null {
  const normalized = handle.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(normalized)) return null;
  return normalized;
}

export function mapPublicStorePayload(
  store: StorefrontSiteRecord,
  release?: StorefrontThemeReleaseRecord | null,
): PublicStorefrontPayload {
  return {
    ...store,
    name: store.name || store.store_name,
    subdomain: store.subdomain || store.store_name,
    current_theme_release: release
      ? {
          id: release.id,
          theme_id: release.theme_id,
          theme_instance_id: release.theme_instance_id || null,
          theme_package_version_id: release.theme_package_version_id || null,
          release_version: release.release_version,
          release_config: release.template_snapshot || release.release_config || {},
          release_manifest: release.release_manifest || {},
          template_snapshot: release.template_snapshot || release.release_config || {},
          settings_snapshot: release.settings_snapshot || {},
          asset_manifest: release.asset_manifest || {},
          cache_manifest: release.cache_manifest || {},
          data_binding_manifest: release.data_binding_manifest || {},
          schema_manifest_version: release.schema_manifest_version || '1.0.0',
          engine_version: release.engine_version || 'legacy',
          published_at: release.published_at,
        }
      : null,
  };
}

export interface TenantContext {
  site_id: string;
  subdomain?: string;
  custom_domain?: string;
  actor_id?: string;
}

export interface RuntimeTenantContext {
  siteId: string;
  userId: string | null;
  membershipId: string | null;
  roles: string[];
  permissions: string[];
  plan: string;
  entitlements: Record<string, unknown>;
  requestId: string;
}

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type PaymentConfigInput = z.infer<typeof PaymentConfigSchema>;
export type StartOnboardingInput = z.infer<typeof StartOnboardingSchema>;
export type Step1Input = z.infer<typeof Step1Schema>;
export type Step2Input = z.infer<typeof Step2Schema>;
export type Step3Input = z.infer<typeof Step3Schema>;
export type Step4Input = z.infer<typeof Step4Schema>;
export type Step5Input = z.infer<typeof Step5Schema>;
export type Step6Input = z.infer<typeof Step6Schema>;
export type CheckSubdomainInput = z.infer<typeof CheckSubdomainSchema>;
