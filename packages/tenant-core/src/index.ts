import { z } from 'zod';
import {
  AddressSchema,
  BusinessProfileSchema,
  GstinSchema,
  IndianStateCodeSchema,
  DEFAULT_STOREFRONT_DOMAIN,
  DEFAULT_PLATFORM_DOMAIN,
  SeoSchema,
  StoreAccessModeSchema,
  UuidSchema,
} from '@letbuyy/shared-types';
import type { StoreTemplateConfig } from '@letbuyy/theme-engine';

export const ACTIVE_SITE_TYPES = ['store'] as const;
export const COMING_SOON_SITE_TYPES = ['blog', 'landing'] as const;
export const LEGACY_SITE_TYPES = ['portfolio', 'resume'] as const;
export const SITE_TYPES = ['store', 'portfolio', 'resume', 'blog', 'landing'] as const;

export type ActiveSiteType = typeof ACTIVE_SITE_TYPES[number];
export type ComingSoonSiteType = typeof COMING_SOON_SITE_TYPES[number];
export type LegacySiteType = typeof LEGACY_SITE_TYPES[number];
export type SiteType = typeof SITE_TYPES[number];
export type StoreStatus = 'draft' | 'published' | 'frozen' | 'suspended';
export type StoreAccessMode = z.infer<typeof StoreAccessModeSchema>;
export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal';

export const RESERVED_STOREFRONT_LABELS = [
  'www',
  'api',
  'admin',
  'accounts',
  'apps',
  'themes',
  'developer',
  'console',
  'team',
  'webhooks',
  'assets',
  'cdn',
  'static',
  'mail',
  'dcv',
  'connect',
  // T6 — checkout.letbuyy.com is a hosted, signed-handoff-only origin (see
  // services/api-gateway/src/routes/storefront/cart-routes.ts, CHECKOUT_ORIGIN in
  // wrangler.toml). A merchant-registered `checkout` subdomain would let a merchant control
  // the hostname the gateway signs cart handoffs to. checkout-staging is wrangler.toml's own
  // preview/staging CHECKOUT_ORIGIN host, reserved for the same reason.
  'checkout',
  'checkout-staging',
] as const;

export const RESERVED_SUBDOMAINS = [
  ...RESERVED_STOREFRONT_LABELS,
  'ftp', 'localhost', 'letbuyy',
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

export const SiteTypeSchema = z.enum(SITE_TYPES);
export const ActiveSiteTypeSchema = z.enum(ACTIVE_SITE_TYPES);
export const ComingSoonSiteTypeSchema = z.enum(COMING_SOON_SITE_TYPES);
export const LegacySiteTypeSchema = z.enum(LEGACY_SITE_TYPES);

export type StorefrontHostResolution =
  | { kind: 'subdomain'; subdomain: string; host: string; rootDomain: string }
  | { kind: 'custom_domain'; domain: string; host: string; rootDomain: string | null }
  | { kind: 'reserved' | 'root' | 'invalid'; host: string; rootDomain: string | null };

export function normalizeStoreRootDomain(rootDomain: string | null | undefined): string {
  // Storefront hosts have their own root; account/admin/API hosts remain platform-owned.
  return (rootDomain || DEFAULT_STOREFRONT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

export function normalizeRequestHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const firstHost = host.split(',')[0]?.trim().toLowerCase();
  if (!firstHost) return null;
  const withoutScheme = firstHost.replace(/^https?:\/\//, '');
  const withoutPath = withoutScheme.replace(/\/.*$/, '');
  const withoutPort = withoutPath.startsWith('[')
    ? withoutPath
    : withoutPath.replace(/:\d+$/, '');
  const normalized = withoutPort.replace(/^\.+|\.+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

/** Tenant links share one root/base contract across onboarding, Merchant and checkout. */
export function buildTenantStorefrontUrl(subdomain: string, options: {
  rootDomain?: string | null;
  baseUrl?: string | null;
} = {}): string {
  const root = normalizeStoreRootDomain(options.rootDomain);
  if (!validateSubdomainFormat(subdomain).valid) throw new Error('Invalid storefront subdomain');
  if (options.baseUrl?.trim()) {
    const base = new URL(options.baseUrl.trim());
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      throw new Error('Invalid storefront base URL');
    }
    if (base.hostname === root && base.pathname === '/' && root !== 'localhost') {
      base.hostname = `${subdomain}.${root}`;
      return base.origin;
    }
    return `${base.href.replace(/\/+$/, '')}/store/${encodeURIComponent(subdomain)}`;
  }
  return `https://${subdomain}.${root}`;
}

/** Hosted checkout belongs to the platform origin, independently of the tenant root. */
export function isHostedCheckoutHost(host: string | null | undefined, options: {
  checkoutOrigin?: string | null;
  storeRootDomain?: string | null;
} = {}): boolean {
  const normalized = normalizeRequestHost(host);
  if (!normalized) return false;
  if (options.checkoutOrigin?.trim()) {
    try {
      const origin = new URL(options.checkoutOrigin.trim());
      const local = origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost');
      if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
          || (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))) return false;
      return normalized === origin.hostname;
    } catch { return false; }
  }
  if (normalized === `checkout.${DEFAULT_PLATFORM_DOMAIN}`) return true;
  // Existing explicit local roots remain usable without inventing a production checkout host.
  return normalizeStoreRootDomain(options.storeRootDomain) === 'localhost'
    && ['checkout.localhost', 'checkout-staging.localhost'].includes(normalized);
}

export function isReservedStorefrontLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return RESERVED_STOREFRONT_LABELS.includes(label.toLowerCase() as typeof RESERVED_STOREFRONT_LABELS[number]);
}

export function isReservedSubdomain(label: string | null | undefined): boolean {
  if (!label) return false;
  return RESERVED_SUBDOMAINS.includes(label.toLowerCase() as typeof RESERVED_SUBDOMAINS[number]);
}

export function extractStorefrontSubdomain(
  host: string | null | undefined,
  rootDomain: string | null | undefined,
): string | null {
  const normalizedHost = normalizeRequestHost(host);
  const normalizedRoot = normalizeStoreRootDomain(rootDomain);
  if (!normalizedHost || normalizedHost === normalizedRoot) return null;
  const suffix = `.${normalizedRoot}`;
  if (!normalizedHost.endsWith(suffix)) return null;
  const label = normalizedHost.slice(0, -suffix.length);
  if (!label || label.includes('.') || isReservedStorefrontLabel(label)) return null;
  return label;
}

// Additional literal hostnames (no scheme/port) that should resolve as the platform root
// alongside `rootDomain` — e.g. a LAN IP so the marketplace root is reachable from another
// device in local dev. Never used for tenant/custom-domain matching, only for this equality
// check, so it cannot widen subdomain or custom-domain resolution.
function normalizeRootDomainAliases(aliases: readonly string[] | string | null | undefined): string[] {
  const list = Array.isArray(aliases) ? aliases : typeof aliases === 'string' ? aliases.split(',') : [];
  return list
    .map((alias) => normalizeRequestHost(alias))
    .filter((alias): alias is string => Boolean(alias));
}

export function resolveStorefrontHost(
  host: string | null | undefined,
  rootDomain: string | null | undefined,
  rootDomainAliases?: readonly string[] | string | null,
): StorefrontHostResolution {
  const normalizedHost = normalizeRequestHost(host);
  const normalizedRoot = normalizeStoreRootDomain(rootDomain);
  if (!normalizedHost) return { kind: 'invalid', host: '', rootDomain: normalizedRoot };
  if (normalizedHost === normalizedRoot || normalizeRootDomainAliases(rootDomainAliases).includes(normalizedHost)) {
    return { kind: 'root', host: normalizedHost, rootDomain: normalizedRoot };
  }

  const suffix = `.${normalizedRoot}`;
  if (!normalizedHost.endsWith(suffix)) {
    return { kind: 'custom_domain', domain: normalizedHost, host: normalizedHost, rootDomain: normalizedRoot };
  }

  const label = normalizedHost.slice(0, -suffix.length);
  if (!label || label.includes('.')) return { kind: 'invalid', host: normalizedHost, rootDomain: normalizedRoot };
  if (isReservedStorefrontLabel(label)) return { kind: 'reserved', host: normalizedHost, rootDomain: normalizedRoot };
  return { kind: 'subdomain', subdomain: label, host: normalizedHost, rootDomain: normalizedRoot };
}

export function isLegacySiteType(siteType: string | null | undefined): siteType is LegacySiteType {
  return LEGACY_SITE_TYPES.includes(siteType as LegacySiteType);
}

export function isActiveSiteType(siteType: string | null | undefined): siteType is ActiveSiteType {
  return ACTIVE_SITE_TYPES.includes(siteType as ActiveSiteType);
}

export function isComingSoonSiteType(siteType: string | null | undefined): siteType is ComingSoonSiteType {
  return COMING_SOON_SITE_TYPES.includes(siteType as ComingSoonSiteType);
}

export function legacySiteTypeCreationEnabled(flag: string | boolean | null | undefined): boolean {
  return flag === true || flag === 'true' || flag === '1';
}

export const SubdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain cannot exceed 63 characters')
  .regex(SUBDOMAIN_PATTERN, 'Subdomain must be lowercase alphanumeric, may contain hyphens (not at start/end)')
  .refine(
    (subdomain) => !isReservedSubdomain(subdomain),
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

  if (isReservedSubdomain(subdomain)) {
    return { valid: false, reason: 'reserved', message: 'This name is reserved' };
  }

  return { valid: true };
}

export const CreateStoreSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  subdomain: SubdomainSchema,
  site_type: SiteTypeSchema.default('store'),
  tagline: z.string().max(200).optional(),
  locale: z.string().min(2).max(16).default('en-IN'),
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
  custom_domain_status: z.enum(['none', 'pending', 'review', 'verifying', 'active', 'error']).optional(),
  access_mode: StoreAccessModeSchema.optional(),
  access_message: z.string().max(1000).optional().nullable(),
  published: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().min(2).max(16).optional(),
  timezone: z.string().min(1).max(80).optional(),
  refund_policy: z.string().max(20000).optional(),
  privacy_policy: z.string().max(20000).optional(),
  terms_of_service: z.string().max(20000).optional(),
  shipping_policy: z.string().max(20000).optional(),
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  tax_inclusive: z.boolean().optional(),
  legal_name: z.string().min(1).max(200).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
  gst_state_code: IndianStateCodeSchema.optional().nullable(),
  invoice_prefix: z.string().min(1).max(20).optional().nullable(),
  business_profile: BusinessProfileSchema.optional().nullable(),
  invoice_address: AddressSchema.partial().passthrough().optional().nullable(),
  invoice_footer: z.string().max(1000).optional().nullable(),
  invoice_number_next: z.number().int().positive().optional().nullable(),
  version: z.number().int().positive('Version is required for concurrent safety').optional(),
  cod_enabled: z.boolean().optional(),
  online_payment_enabled: z.boolean().optional(),
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
  custom_domain_status?: 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error';
  access_mode?: StoreAccessMode;
  access_message?: string | null;
  published?: boolean;
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
  customDomainStatus?: 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error';
  accessMode?: StoreAccessMode;
  accessMessage?: string;
  published?: boolean;
  plan?: 'free' | 'premium';
  seoTitle?: string;
  seoDescription?: string;
  locale?: string;
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
  custom_domain_status?: 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error' | null;
  currency?: string | null;
  locale?: string | null;
  access_mode?: StoreAccessMode | null;
  access_message?: string | null;
  published?: boolean | null;
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

/** Web render representation; the default public/mobile payload remains unchanged. */
export type PublicStorefrontRenderRelease = Pick<PublicStorefrontThemeRelease,
  'id' | 'theme_id' | 'theme_instance_id' | 'theme_package_version_id' | 'release_version'
  | 'release_manifest' | 'schema_manifest_version' | 'engine_version' | 'published_at'>;
export type PublicStorefrontRenderPayload = Omit<PublicStorefrontPayload, 'current_theme_release' | 'template_config'> & {
  projection: 'render-v1';
  template_config: Record<string, unknown>;
  current_theme_release: PublicStorefrontRenderRelease | null;
};

function publicThemeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// JSONB object key order is not meaningful. Arrays remain ordered. A conservative
// depth cap only declines deduplication; it never deletes an uncertain fallback.
function samePublicThemeJson(left: unknown, right: unknown, depth = 0): boolean {
  if (left === right) return true;
  if (depth > 64 || left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => samePublicThemeJson(value, right[index], depth + 1));
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key)
    && samePublicThemeJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], depth + 1));
}

export function mapPublicStoreRenderPayload(store: StorefrontSiteRecord, release?: StorefrontThemeReleaseRecord | null): PublicStorefrontRenderPayload {
  // Exactly the existing web mapper precedence, before its localization/defaults.
  const snapshot = publicThemeRecord(release?.template_snapshot || release?.release_config);
  const manifest = { ...publicThemeRecord(release?.release_manifest) };
  const manifestConfig = publicThemeRecord(manifest.templateConfig);
  const config = Object.keys(snapshot).length ? snapshot
    : Object.keys(manifestConfig).length ? manifestConfig : publicThemeRecord(store.template_config);
  if (samePublicThemeJson(manifest.templateConfig, config)) delete manifest.templateConfig;
  const earlierBundles: unknown[] = [];
  if (config.liquidBundle) earlierBundles.push(config.liquidBundle);
  for (const key of ['liquidBundle', 'themeBundle', 'bundle']) {
    const candidate = manifest[key];
    if (!candidate) continue;
    if (earlierBundles.some(earlier => samePublicThemeJson(earlier, candidate))) delete manifest[key];
    else earlierBundles.push(candidate);
  }
  return {
    ...store,
    name: store.name || store.store_name,
    subdomain: store.subdomain || store.store_name,
    projection: 'render-v1',
    template_config: config,
    current_theme_release: release ? {
      id: release.id,
      theme_id: release.theme_id,
      theme_instance_id: release.theme_instance_id || null,
      theme_package_version_id: release.theme_package_version_id || null,
      release_version: release.release_version,
      release_manifest: manifest,
      schema_manifest_version: release.schema_manifest_version || '1.0.0',
      engine_version: release.engine_version || 'legacy',
      published_at: release.published_at,
    } : null,
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

export const TENANT_SITE_GUC = 'app.site_id' as const;
export const TENANT_RLS_SITE_ID_PREDICATE = 'site_id = public.current_site_id()' as const;

const UUID_V4ISH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQL_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface TenantGucSetLocalStatement {
  sql: 'SELECT set_config($1, $2, true)';
  values: readonly [typeof TENANT_SITE_GUC, string];
}

export interface TenantScopedQueryRequirement {
  table: string;
  siteId?: string | null;
  predicates?: readonly string[];
}

export interface TenantRlsPolicyTemplate {
  table: string;
  enableSql: string;
  forceSql: string;
  policySql: string;
}

function assertSqlIdentifier(value: string, label: string): string {
  if (!SQL_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} must be a safe lowercase SQL identifier`);
  }
  return value;
}

export function assertTenantSiteId(siteId: string): string {
  if (!UUID_V4ISH_PATTERN.test(siteId)) {
    throw new Error('Tenant site_id must be a valid UUID');
  }
  return siteId;
}

export function tenantGucSetLocalStatement(siteId: string): TenantGucSetLocalStatement {
  return {
    sql: 'SELECT set_config($1, $2, true)',
    values: [TENANT_SITE_GUC, assertTenantSiteId(siteId)],
  };
}

export function requireSiteIdPredicate(requirement: TenantScopedQueryRequirement): void {
  assertSqlIdentifier(requirement.table, 'Tenant-scoped table');

  if (requirement.siteId) {
    assertTenantSiteId(requirement.siteId);
    return;
  }

  const hasSitePredicate = (requirement.predicates || []).some((predicate) => (
    /\bsite_id\b/.test(predicate) && /(=|IN\b|IS\s+NOT\s+NULL)/i.test(predicate)
  ));

  if (!hasSitePredicate) {
    throw new Error(`Tenant-scoped query for ${requirement.table} must include a site_id predicate`);
  }
}

export function tenantRlsPolicyTemplate(table: string): TenantRlsPolicyTemplate {
  const safeTable = assertSqlIdentifier(table, 'Tenant table');
  const policyName = `${safeTable}_tenant_site_guc`;

  return {
    table: safeTable,
    enableSql: `ALTER TABLE public.${safeTable} ENABLE ROW LEVEL SECURITY;`,
    forceSql: `ALTER TABLE public.${safeTable} FORCE ROW LEVEL SECURITY;`,
    policySql: [
      `CREATE POLICY ${policyName} ON public.${safeTable}`,
      'FOR ALL',
      `USING (${TENANT_RLS_SITE_ID_PREDICATE})`,
      `WITH CHECK (${TENANT_RLS_SITE_ID_PREDICATE});`,
    ].join(' '),
  };
}
