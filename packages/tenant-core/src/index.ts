import { z } from 'zod';
import { SeoSchema } from '@letbuyy/shared-types';
import type { StoreTemplateConfig } from '@letbuyy/theme-engine';

export type SiteType = 'store' | 'portfolio' | 'resume' | 'blog' | 'landing';
export type StoreStatus = 'draft' | 'published' | 'frozen' | 'suspended';
export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal';

export const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'auth', 'cdn', 'mail', 'ftp', 'app',
  'staging', 'dev', 'test', 'console', 'team', 'accounts',
  'status', 'help', 'docs', 'support', 'billing', 'store',
  'dashboard', 'login', 'signup', 'register', 'blog', 'shop',
] as const;

export const SiteTypeSchema = z.enum([
  'store', 'portfolio', 'resume', 'blog', 'landing',
]);

export const SubdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain cannot exceed 63 characters')
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    'Subdomain must be lowercase alphanumeric, may contain hyphens (not at start/end)',
  )
  .refine(
    (subdomain) => !RESERVED_SUBDOMAINS.includes(subdomain as typeof RESERVED_SUBDOMAINS[number]),
    'This subdomain is reserved',
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

export interface TenantContext {
  site_id: string;
  subdomain?: string;
  custom_domain?: string;
  actor_id?: string;
}

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type PaymentConfigInput = z.infer<typeof PaymentConfigSchema>;
