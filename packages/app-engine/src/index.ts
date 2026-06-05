import { z } from 'zod';
import { UuidSchema, type AdminAppEmbedSurface, type AppBridgeCapability } from '@letbuyy/shared-types';

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

export const AppBlockRenderModeSchema = z.enum(['inline', 'iframe']);

export const AppBlockContentSchema = z.object({
  heading: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(500).optional(),
  cta_label: z.string().min(1).max(80).optional(),
  cta_href: z.string().min(1).max(500).optional(),
}).strict();

export const AppBlockInstanceSchema = z.object({
  id: z.string().min(1).max(120),
  app_id: z.string().min(1).max(120),
  extension_id: z.string().min(1).max(120),
  slot: z.string().min(1).max(160),
  title: z.string().min(1).max(120),
  render_mode: AppBlockRenderModeSchema.default('inline'),
  settings: z.record(z.string(), z.unknown()).default({}),
  content: AppBlockContentSchema.default({}),
  iframe_url: z.string().min(1).max(500).optional(),
}).strict();

export type AppBlockRenderMode = z.infer<typeof AppBlockRenderModeSchema>;
export type AppBlockContent = z.infer<typeof AppBlockContentSchema>;
export type AppBlockInstance = z.infer<typeof AppBlockInstanceSchema>;

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

export interface MarketplaceAppLifecycleRecord {
  id: string;
  name: string;
  api_scopes?: string[] | null;
}

export interface MarketplaceAppOAuthRecord extends MarketplaceAppLifecycleRecord {
  oauth_client_id?: string | null;
  oauth_redirect_uris?: unknown;
}

export interface AppWebhookDefinition {
  id?: string | null;
  event: string;
  url: string;
  secret?: string | null;
  is_active?: boolean | null;
}

export interface AppWebhookSubscriptionInsert {
  site_id: string;
  name: string;
  target_url: string;
  event_types: string[];
  signing_secret: string;
  status: 'active';
  metadata: Record<string, unknown>;
  created_by: string;
  updated_by: string;
}

export interface AppLifecycleEventPayload extends Record<string, unknown> {
  app_id: string;
  app_name: string;
  installation_id: string;
  store_id: string;
  installed_by: string;
  scopes: string[];
  occurred_at: string;
}

export const MANDATORY_COMPLIANCE_WEBHOOK_TOPICS = [
  'customers/data_request',
  'customers/redact',
  'shop/redact',
] as const;

export type MandatoryComplianceWebhookTopic = typeof MANDATORY_COMPLIANCE_WEBHOOK_TOPICS[number];

export interface AppAdminEmbedExtensionRecord extends AppEngineJsonRecord {
  id?: string | null;
  type?: string | null;
  target?: string | null;
  label?: string | null;
  config?: unknown;
  sort_order?: number | null;
}

export interface MarketplaceAppAdminEmbedRecord extends AppEngineJsonRecord {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  icon_url?: string | null;
  tagline?: string | null;
  app_url?: string | null;
  app_extensions?: unknown;
}

export interface AppAdminEmbedInstallationRecord extends AppEngineJsonRecord {
  id?: string | null;
  app_id?: string | null;
  store_id?: string | null;
  scopes_granted?: unknown;
  config?: unknown;
  marketplace_apps?: unknown;
}

export type AppEnginePlanResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export const LETBUYY_APP_MANIFEST_SCHEMA_VERSION = '2026-06-05.ws13' as const;

export const LETBUYY_APP_MANIFEST_EXTENSION_SURFACES = [
  'admin.ui',
  'checkout.ui',
  'theme.app_block',
] as const;

export const LETBUYY_APP_MANIFEST_ADMIN_TARGETS = [
  'admin.dashboard.widget',
  'admin.settings.page',
  'admin.product.action',
  'admin.order.action',
] as const;

export const LETBUYY_APP_MANIFEST_CHECKOUT_TARGETS = [
  'checkout.contact.render-after',
  'checkout.shipping-options.render-after',
  'checkout.payment-options.render-after',
  'checkout.order-summary.render-after',
  'checkout.thank-you.render-after',
] as const;

export const LETBUYY_APP_MANIFEST_THEME_TARGETS = [
  'storefront.home.after-hero',
  'storefront.product.after-form',
  'storefront.collection.after-grid',
  'storefront.footer.before',
] as const;

export const LETBUYY_APP_FUNCTION_HOOKS = [
  'cart.discount.calculate',
  'checkout.shipping.rate',
  'checkout.payment.customize',
  'checkout.validation.run',
] as const;

export const AppManifestExtensionSurfaceSchema = z.enum(LETBUYY_APP_MANIFEST_EXTENSION_SURFACES);
export const AppManifestAdminTargetSchema = z.enum(LETBUYY_APP_MANIFEST_ADMIN_TARGETS);
export const AppManifestCheckoutTargetSchema = z.enum(LETBUYY_APP_MANIFEST_CHECKOUT_TARGETS);
export const AppManifestThemeTargetSchema = z.enum(LETBUYY_APP_MANIFEST_THEME_TARGETS);
export const AppManifestExtensionRendererSchema = z.enum(['iframe', 'web_component', 'liquid_app_block']);
export const AppManifestFunctionHookSchema = z.enum(LETBUYY_APP_FUNCTION_HOOKS);

export const AppManifestExtensionSchema = z.object({
  handle: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  surface: AppManifestExtensionSurfaceSchema,
  target: z.union([
    AppManifestAdminTargetSchema,
    AppManifestCheckoutTargetSchema,
    AppManifestThemeTargetSchema,
  ]),
  renderer: AppManifestExtensionRendererSchema,
  source: z.object({
    url: z.string().url().optional(),
    entrypoint: z.string().min(1).max(200).optional(),
  }).default({}),
  scopes: z.array(z.string().min(1).max(80)).max(50).default([]),
  capabilities: z.array(z.enum(['api.fetch', 'toast', 'resize', 'navigation.redirect'])).max(10).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const AppManifestFunctionSchema = z.object({
  handle: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  hooks: z.array(AppManifestFunctionHookSchema).min(1).max(8),
  runtime: z.literal('wasm'),
  wasm: z.object({
    module_url: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    entrypoint: z.string().min(1).max(120).default('run'),
  }),
  timeout_ms: z.number().int().min(1).max(5).default(5),
  memory_limit_kb: z.number().int().min(64).max(1024).default(512),
  input_schema: z.record(z.string(), z.unknown()).default({}),
  output_schema: z.record(z.string(), z.unknown()).default({}),
  deterministic: z.literal(true).default(true),
}).strict();

export const LetbuyyAppManifestSchema = z.object({
  schema_version: z.literal(LETBUYY_APP_MANIFEST_SCHEMA_VERSION),
  app: z.object({
    slug: z.string().min(1).max(120),
    name: z.string().min(1).max(160),
    version: z.string().min(1).max(60),
  }).strict(),
  scopes: z.array(z.string().min(1).max(80)).min(1).max(80),
  extensions: z.array(AppManifestExtensionSchema).max(100).default([]),
  functions: z.array(AppManifestFunctionSchema).max(50).default([]),
}).strict();

export type LetbuyyAppManifestExtensionSurface = z.infer<typeof AppManifestExtensionSurfaceSchema>;
export type LetbuyyAppManifestExtensionRenderer = z.infer<typeof AppManifestExtensionRendererSchema>;
export type LetbuyyAppFunctionHook = z.infer<typeof AppManifestFunctionHookSchema>;
export type LetbuyyAppManifestExtension = z.infer<typeof AppManifestExtensionSchema>;
export type LetbuyyAppManifestFunction = z.infer<typeof AppManifestFunctionSchema>;
export type LetbuyyAppManifest = z.infer<typeof LetbuyyAppManifestSchema>;

export const AppFunctionCheckoutPaymentMethodSchema = z.enum(['razorpay', 'stripe', 'paypal', 'cashfree', 'cod']);
export const AppFunctionCheckoutShippingMethodSchema = z.enum(['standard', 'express']);

export const AppFunctionRuntimeInputSchema = z.object({
  hook: AppManifestFunctionHookSchema,
  site_id: z.string().min(1).max(120),
  cart: z.object({
    lines: z.array(z.object({
      product_id: z.string().min(1).max(120),
      variant_id: z.string().min(1).max(120).nullable().optional(),
      quantity: z.number().int().min(1).max(999),
    }).strict()).min(1).max(50),
    coupon_code: z.string().min(1).max(50).nullable().optional(),
    gift_card_code: z.string().min(1).max(100).nullable().optional(),
  }).strict(),
  checkout: z.object({
    payment_method: AppFunctionCheckoutPaymentMethodSchema,
    shipping_method: AppFunctionCheckoutShippingMethodSchema,
    customer: z.record(z.string(), z.unknown()).default({}),
    shipping_address: z.record(z.string(), z.unknown()).default({}),
  }).strict(),
  request: z.object({
    request_id: z.string().min(1).max(200),
    occurred_at: z.string().datetime(),
  }).strict(),
}).strict();

export const AppFunctionRuntimeOperationSchema = z.union([
  z.object({
    type: z.literal('apply_discount_code'),
    coupon_code: z.string().min(1).max(50),
  }).strict(),
  z.object({
    type: z.literal('select_shipping_method'),
    shipping_method: AppFunctionCheckoutShippingMethodSchema,
  }).strict(),
  z.object({
    type: z.literal('allow_payment_methods'),
    payment_methods: z.array(AppFunctionCheckoutPaymentMethodSchema).min(1).max(5),
  }).strict(),
  z.object({
    type: z.literal('validation_error'),
    message: z.string().min(1).max(240),
    field: z.string().min(1).max(120).optional(),
  }).strict(),
]);

export const AppFunctionRuntimeOutputSchema = z.object({
  operations: z.array(AppFunctionRuntimeOperationSchema).max(25).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export type AppFunctionCheckoutPaymentMethod = z.infer<typeof AppFunctionCheckoutPaymentMethodSchema>;
export type AppFunctionCheckoutShippingMethod = z.infer<typeof AppFunctionCheckoutShippingMethodSchema>;
export type AppFunctionRuntimeInput = z.infer<typeof AppFunctionRuntimeInputSchema>;
export type AppFunctionRuntimeOperation = z.infer<typeof AppFunctionRuntimeOperationSchema>;
export type AppFunctionRuntimeOutput = z.infer<typeof AppFunctionRuntimeOutputSchema>;

export interface AppFunctionCheckoutDecision {
  couponCode?: string;
  shippingMethod: AppFunctionCheckoutShippingMethod;
  paymentMethod: AppFunctionCheckoutPaymentMethod;
  validationErrors: Array<{ message: string; field?: string }>;
}

export function normalizeAppFunctionRuntimeOutput(input: unknown): AppEnginePlanResult<AppFunctionRuntimeOutput> {
  const parsed = AppFunctionRuntimeOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue: { message: string }) => issue.message).join('; ') || 'Invalid function output' };
  }

  return { ok: true, value: parsed.data };
}

export function createAppFunctionCheckoutDecision(input: {
  couponCode?: string | null;
  shippingMethod: AppFunctionCheckoutShippingMethod;
  paymentMethod: AppFunctionCheckoutPaymentMethod;
}): AppFunctionCheckoutDecision {
  return {
    couponCode: appStoreStringOrNull(input.couponCode || null) || undefined,
    shippingMethod: input.shippingMethod,
    paymentMethod: input.paymentMethod,
    validationErrors: [],
  };
}

export function applyAppFunctionRuntimeOutput(
  decision: AppFunctionCheckoutDecision,
  output: AppFunctionRuntimeOutput,
): AppFunctionCheckoutDecision {
  const next: AppFunctionCheckoutDecision = {
    ...decision,
    validationErrors: [...decision.validationErrors],
  };

  for (const operation of output.operations) {
    switch (operation.type) {
      case 'apply_discount_code':
        next.couponCode = operation.coupon_code.trim().toUpperCase();
        break;
      case 'select_shipping_method':
        next.shippingMethod = operation.shipping_method;
        break;
      case 'allow_payment_methods':
        if (!operation.payment_methods.includes(next.paymentMethod)) {
          next.validationErrors.push({
            field: 'payment_method',
            message: 'The selected payment method is not available for this checkout.',
          });
        }
        break;
      case 'validation_error':
        next.validationErrors.push({
          message: operation.message,
          ...(operation.field ? { field: operation.field } : {}),
        });
        break;
      default:
        break;
    }
  }

  return next;
}

export interface AppManifestExtensionRegistrationRecord {
  app_id: string;
  type: 'settings_page' | 'dashboard_widget' | 'product_action' | 'order_action' | 'checkout_extension' | 'storefront_block';
  target: string;
  label: string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface AppManifestFunctionRegistrationRecord {
  app_id: string;
  handle: string;
  name: string;
  hooks: LetbuyyAppFunctionHook[];
  wasm_module_url: string;
  wasm_sha256: string;
  timeout_ms: number;
  memory_limit_kb: number;
  config: Record<string, unknown>;
}

export interface AppManifestRegistrationPlan {
  manifest: LetbuyyAppManifest;
  extensionRecords: AppManifestExtensionRegistrationRecord[];
  functionRecords: AppManifestFunctionRegistrationRecord[];
}

export const LETBUYY_APP_EXTENSION_REGISTRY_STATUSES = ['enabled', 'disabled', 'revoked'] as const;

export type AppExtensionRegistryStatus = typeof LETBUYY_APP_EXTENSION_REGISTRY_STATUSES[number];

export interface AppExtensionRegistryRecord {
  site_id: string;
  installation_id: string;
  app_id: string;
  extension_handle: string;
  extension_type: AppManifestExtensionRegistrationRecord['type'];
  surface: LetbuyyAppManifestExtensionSurface;
  target: LetbuyyAppManifestExtension['target'];
  renderer: LetbuyyAppManifestExtensionRenderer;
  source_url: string | null;
  source_entrypoint: string | null;
  scopes: string[];
  capabilities: string[];
  settings: Record<string, unknown>;
  manifest_schema_version: string;
  app_version: string;
  status: AppExtensionRegistryStatus;
  enabled_at: string;
  disabled_at: string | null;
  revoked_at: string | null;
  sort_order: number;
  created_by: string;
  updated_by: string;
}

export interface AppFunctionRegistryRecord {
  site_id: string;
  installation_id: string;
  app_id: string;
  function_handle: string;
  name: string;
  hooks: LetbuyyAppFunctionHook[];
  runtime: 'wasm';
  wasm_module_url: string;
  wasm_sha256: string;
  wasm_entrypoint: string;
  timeout_ms: number;
  memory_limit_kb: number;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  config: Record<string, unknown>;
  manifest_schema_version: string;
  app_version: string;
  status: AppExtensionRegistryStatus;
  enabled_at: string;
  disabled_at: string | null;
  revoked_at: string | null;
  created_by: string;
  updated_by: string;
}

export interface AppExtensionRegistryInstallPlan {
  manifest: LetbuyyAppManifest;
  extensionRegistrations: AppExtensionRegistryRecord[];
  functionRegistrations: AppFunctionRegistryRecord[];
}

export const LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION = '2026-06-05.ws13.lifecycle' as const;

export const LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS = [
  'app_extension.lifecycle.status_changed',
  'app_extension.registry.snapshot',
  'app_function.execution.count',
  'app_function.execution.duration_ms',
  'app_function.execution.failed_securely',
] as const;

export const LETBUYY_APP_EXTENSION_LIFECYCLE_ROUTES = [
  'GET /v1/app-store/installations/:id/extensions',
  'PATCH /v1/app-store/installations/:id/extensions/:registrationId',
  'PATCH /v1/app-store/installations/:id/functions/:registrationId',
  'GET /v1/storefront/:subdomain/checkout/extensions',
  'POST /v1/storefront/:subdomain/orders',
] as const;

export type AppExtensionLifecycleSignal = typeof LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS[number];
export type AppExtensionLifecycleRoute = typeof LETBUYY_APP_EXTENSION_LIFECYCLE_ROUTES[number];

export interface AppExtensionLifecycleItem {
  kind: 'extension' | 'function';
  id: string;
  app_id: string;
  installation_id: string;
  handle: string;
  status: AppExtensionRegistryStatus;
  app_version: string | null;
  manifest_schema_version: string | null;
  surface?: LetbuyyAppManifestExtensionSurface;
  target?: string;
  hooks?: LetbuyyAppFunctionHook[];
  enabled_at: string | null;
  disabled_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
}

export interface AppExtensionLifecycleSnapshot {
  lifecycle_version: typeof LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION;
  observed_at: string;
  status_counts: Record<AppExtensionRegistryStatus, number>;
  extensions: AppExtensionLifecycleItem[];
  functions: AppExtensionLifecycleItem[];
  routes: AppExtensionLifecycleRoute[];
  observability: {
    signals: AppExtensionLifecycleSignal[];
    metric_dimensions: string[];
    log_correlation_keys: string[];
  };
  developer_handoff: AppExtensionDeveloperHandoff;
  review_checklist: AppExtensionReviewChecklistItem[];
}

export interface AppExtensionReviewChecklistItem {
  key: string;
  label: string;
  requirement: string;
  evidence: string;
}

export interface AppExtensionDeveloperHandoff {
  manifest_schema_version: typeof LETBUYY_APP_MANIFEST_SCHEMA_VERSION;
  lifecycle_version: typeof LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION;
  sdk_source_files: string[];
  supported_surfaces: LetbuyyAppManifestExtensionSurface[];
  supported_function_hooks: LetbuyyAppFunctionHook[];
  lifecycle_routes: AppExtensionLifecycleRoute[];
  observability_signals: AppExtensionLifecycleSignal[];
}

export const DEFAULT_APP_BRIDGE_CAPABILITIES: AppBridgeCapability[] = ['api.fetch', 'toast', 'resize'];

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

function parseAppStoreJsonRecordArray(value: unknown): AppEngineJsonRecord[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseAppStoreJsonRecord(item))
      .filter((item) => Object.keys(item).length > 0);
  }

  const record = parseAppStoreJsonRecord(value);
  return Object.keys(record).length > 0 ? [record] : [];
}

function firstRelatedAppRecord(value: unknown): MarketplaceAppAdminEmbedRecord {
  return parseAppStoreJsonRecordArray(value)[0] || parseAppStoreJsonRecord(value);
}

function uniqueManifestStrings(values: unknown, fallback: string[] = []): string[] {
  const normalized = appStoreStringArray(values)
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(normalized.length > 0 ? normalized : fallback)].sort();
}

function normalizeManifestSurface(value: unknown): LetbuyyAppManifestExtensionSurface | null {
  const surface = appStoreStringOrNull(value);
  switch (surface) {
    case 'admin.ui':
    case 'admin_ui':
    case 'settings_page':
    case 'dashboard_widget':
    case 'product_action':
    case 'order_action':
      return 'admin.ui';
    case 'checkout.ui':
    case 'checkout_ui':
    case 'checkout_extension':
      return 'checkout.ui';
    case 'theme.app_block':
    case 'theme_app_block':
    case 'storefront_block':
    case 'app-block':
    case 'app_block':
      return 'theme.app_block';
    default:
      return null;
  }
}

function manifestTargetSet(surface: LetbuyyAppManifestExtensionSurface): Set<string> {
  switch (surface) {
    case 'admin.ui':
      return new Set(LETBUYY_APP_MANIFEST_ADMIN_TARGETS);
    case 'checkout.ui':
      return new Set(LETBUYY_APP_MANIFEST_CHECKOUT_TARGETS);
    case 'theme.app_block':
      return new Set(LETBUYY_APP_MANIFEST_THEME_TARGETS);
    default:
      return new Set();
  }
}

function manifestDefaultTarget(surface: LetbuyyAppManifestExtensionSurface): string {
  switch (surface) {
    case 'admin.ui':
      return 'admin.settings.page';
    case 'checkout.ui':
      return 'checkout.order-summary.render-after';
    case 'theme.app_block':
      return 'storefront.home.after-hero';
    default:
      return 'admin.settings.page';
  }
}

function normalizeManifestRenderer(
  value: unknown,
  surface: LetbuyyAppManifestExtensionSurface,
): LetbuyyAppManifestExtensionRenderer {
  const renderer = appStoreStringOrNull(value);
  if (renderer === 'web_component') return 'web_component';
  if (renderer === 'liquid_app_block') return 'liquid_app_block';
  return surface === 'theme.app_block' ? 'liquid_app_block' : 'iframe';
}

function safeManifestHttpsUrl(value: unknown): string | null {
  const href = appStoreStringOrNull(value);
  if (!href) return null;

  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeManifestExtension(
  value: unknown,
  inheritedScopes: string[],
  index: number,
): AppEnginePlanResult<LetbuyyAppManifestExtension> {
  const raw = parseAppStoreJsonRecord(value);
  const surface = normalizeManifestSurface(raw.surface || raw.type);
  if (!surface) return { ok: false, message: `extensions[${index}].surface is unsupported` };

  const handle = appStoreSlugify(appStoreStringOrNull(raw.handle || raw.uid || raw.id) || '');
  if (!handle) return { ok: false, message: `extensions[${index}].handle is required` };

  const source = parseAppStoreJsonRecord(raw.source);
  const sourceUrl = safeManifestHttpsUrl(source.url || raw.url || raw.embed_url || raw.iframe_url || raw.target);
  const renderer = normalizeManifestRenderer(raw.renderer || raw.render_mode || raw.renderMode, surface);
  const requiresSourceUrl = surface !== 'theme.app_block' || renderer === 'iframe' || renderer === 'web_component';
  if (requiresSourceUrl && !sourceUrl) {
    return { ok: false, message: `extensions[${index}].source.url must be HTTPS` };
  }

  const rawTarget = appStoreStringOrNull(raw.target) || manifestDefaultTarget(surface);
  const target = manifestTargetSet(surface).has(rawTarget) ? rawTarget : manifestDefaultTarget(surface);
  const capabilities = normalizeAppBridgeCapabilities(raw.capabilities);

  return {
    ok: true,
    value: {
      handle,
      name: appStoreStringOrNull(raw.name || raw.label || raw.title) || handle,
      surface,
      target: target as LetbuyyAppManifestExtension['target'],
      renderer,
      source: {
        ...(sourceUrl ? { url: sourceUrl } : {}),
        ...(appStoreStringOrNull(source.entrypoint || raw.entrypoint) ? {
          entrypoint: appStoreStringOrNull(source.entrypoint || raw.entrypoint) || undefined,
        } : {}),
      },
      scopes: uniqueManifestStrings(raw.scopes, inheritedScopes),
      capabilities,
      settings: parseAppStoreJsonRecord(raw.settings || raw.config),
    },
  };
}

function normalizeFunctionHooks(value: unknown): LetbuyyAppFunctionHook[] {
  const rawHooks = Array.isArray(value) ? value : [value];
  const allowed = new Set<string>(LETBUYY_APP_FUNCTION_HOOKS);
  return [...new Set(rawHooks
    .map((hook) => appStoreStringOrNull(hook))
    .filter((hook): hook is string => typeof hook === 'string' && allowed.has(hook)))] as LetbuyyAppFunctionHook[];
}

function normalizeManifestFunction(
  value: unknown,
  index: number,
): AppEnginePlanResult<LetbuyyAppManifestFunction> {
  const raw = parseAppStoreJsonRecord(value);
  const wasm = parseAppStoreJsonRecord(raw.wasm || raw.module);
  const handle = appStoreSlugify(appStoreStringOrNull(raw.handle || raw.uid || raw.id) || '');
  if (!handle) return { ok: false, message: `functions[${index}].handle is required` };

  const hooks = normalizeFunctionHooks(raw.hooks || raw.hook);
  if (hooks.length === 0) return { ok: false, message: `functions[${index}].hooks must include a supported hook` };

  const moduleUrl = safeManifestHttpsUrl(wasm.module_url || wasm.moduleUrl || wasm.url || raw.module_url || raw.moduleUrl);
  if (!moduleUrl) return { ok: false, message: `functions[${index}].wasm.module_url must be HTTPS` };

  const sha256 = appStoreStringOrNull(wasm.sha256 || raw.sha256);
  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return { ok: false, message: `functions[${index}].wasm.sha256 must be a 64-character hex digest` };
  }

  const timeout = Math.trunc(Number(raw.timeout_ms || raw.timeoutMs || 5));
  const memory = Math.trunc(Number(raw.memory_limit_kb || raw.memoryLimitKb || 512));

  return {
    ok: true,
    value: {
      handle,
      name: appStoreStringOrNull(raw.name || raw.title) || handle,
      hooks,
      runtime: 'wasm',
      wasm: {
        module_url: moduleUrl,
        sha256: sha256.toLowerCase(),
        entrypoint: appStoreStringOrNull(wasm.entrypoint || raw.entrypoint) || 'run',
      },
      timeout_ms: Math.min(Math.max(Number.isFinite(timeout) ? timeout : 5, 1), 5),
      memory_limit_kb: Math.min(Math.max(Number.isFinite(memory) ? memory : 512, 64), 1024),
      input_schema: parseAppStoreJsonRecord(raw.input_schema || raw.inputSchema),
      output_schema: parseAppStoreJsonRecord(raw.output_schema || raw.outputSchema),
      deterministic: true,
    },
  };
}

export function normalizeLetbuyyAppManifest(input: unknown): AppEnginePlanResult<LetbuyyAppManifest> {
  const raw = parseAppStoreJsonRecord(input);
  const app = parseAppStoreJsonRecord(raw.app);
  const schemaVersion = appStoreStringOrNull(raw.schema_version || raw.schemaVersion);
  const errors: string[] = [];

  if (schemaVersion !== LETBUYY_APP_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${LETBUYY_APP_MANIFEST_SCHEMA_VERSION}`);
  }

  const slug = appStoreSlugify(appStoreStringOrNull(app.slug || raw.slug) || '');
  const name = appStoreStringOrNull(app.name || raw.name);
  const version = appStoreStringOrNull(app.version || raw.version);
  if (!slug) errors.push('app.slug is required');
  if (!name) errors.push('app.name is required');
  if (!version) errors.push('app.version is required');

  const scopes = uniqueManifestStrings(raw.scopes || app.scopes);
  if (scopes.length === 0) errors.push('scopes must declare at least one API scope');

  const extensionValues = Array.isArray(raw.extensions)
    ? raw.extensions
    : Object.values(parseAppStoreJsonRecord(raw.extensions));
  const extensions: LetbuyyAppManifestExtension[] = [];
  extensionValues.forEach((extension, index) => {
    const normalized = normalizeManifestExtension(extension, scopes, index);
    if (normalized.ok) extensions.push(normalized.value);
    else errors.push(normalized.message);
  });

  const functionValues = Array.isArray(raw.functions)
    ? raw.functions
    : Object.values(parseAppStoreJsonRecord(raw.functions));
  const functions: LetbuyyAppManifestFunction[] = [];
  functionValues.forEach((fn, index) => {
    const normalized = normalizeManifestFunction(fn, index);
    if (normalized.ok) functions.push(normalized.value);
    else errors.push(normalized.message);
  });

  if (extensions.length === 0 && functions.length === 0) {
    errors.push('manifest must declare at least one extension or function');
  }

  if (errors.length > 0) {
    return { ok: false, message: errors.join('; ') };
  }

  return {
    ok: true,
    value: {
      schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
      app: {
        slug,
        name: name || slug,
        version: version || '0.0.0',
      },
      scopes,
      extensions,
      functions,
    },
  };
}

function appExtensionTypeForManifestExtension(
  extension: LetbuyyAppManifestExtension,
): AppManifestExtensionRegistrationRecord['type'] {
  if (extension.surface === 'checkout.ui') return 'checkout_extension';
  if (extension.surface === 'theme.app_block') return 'storefront_block';

  switch (extension.target) {
    case 'admin.dashboard.widget':
      return 'dashboard_widget';
    case 'admin.product.action':
      return 'product_action';
    case 'admin.order.action':
      return 'order_action';
    case 'admin.settings.page':
    default:
      return 'settings_page';
  }
}

export function planAppManifestRegistration(
  appId: string,
  manifestInput: unknown,
): AppEnginePlanResult<AppManifestRegistrationPlan> {
  const manifest = normalizeLetbuyyAppManifest(manifestInput);
  if (!manifest.ok) return { ok: false, message: manifest.message };

  return {
    ok: true,
    value: {
      manifest: manifest.value,
      extensionRecords: manifest.value.extensions.map((extension: LetbuyyAppManifestExtension, index: number) => ({
        app_id: appId,
        type: appExtensionTypeForManifestExtension(extension),
        target: extension.source.url || extension.target,
        label: extension.name,
        sort_order: index,
        config: {
          manifest_schema_version: manifest.value.schema_version,
          manifest_app_slug: manifest.value.app.slug,
          handle: extension.handle,
          surface: extension.surface,
          target: extension.target,
          renderer: extension.renderer,
          source: extension.source,
          scopes: extension.scopes,
          capabilities: extension.capabilities,
          settings: extension.settings,
        },
      })),
      functionRecords: manifest.value.functions.map((fn: LetbuyyAppManifestFunction) => ({
        app_id: appId,
        handle: fn.handle,
        name: fn.name,
        hooks: fn.hooks,
        wasm_module_url: fn.wasm.module_url,
        wasm_sha256: fn.wasm.sha256,
        timeout_ms: fn.timeout_ms,
        memory_limit_kb: fn.memory_limit_kb,
        config: {
          manifest_schema_version: manifest.value.schema_version,
          manifest_app_slug: manifest.value.app.slug,
          runtime: fn.runtime,
          wasm: fn.wasm,
          input_schema: fn.input_schema,
          output_schema: fn.output_schema,
          deterministic: fn.deterministic,
        },
      })),
    },
  };
}

export function normalizeAppExtensionRegistryStatus(value: unknown): AppExtensionRegistryStatus | null {
  switch (appStoreStringOrNull(value)) {
    case 'enabled':
      return 'enabled';
    case 'disabled':
      return 'disabled';
    case 'revoked':
      return 'revoked';
    default:
      return null;
  }
}

export function planAppExtensionRegistryInstall(input: {
  appId: string;
  storeId: string;
  installationId: string;
  installedBy: string;
  manifestInput: unknown;
  registeredAt: string;
}): AppEnginePlanResult<AppExtensionRegistryInstallPlan> {
  const manifest = normalizeLetbuyyAppManifest(input.manifestInput);
  if (!manifest.ok) return { ok: false, message: manifest.message };

  return {
    ok: true,
    value: {
      manifest: manifest.value,
      extensionRegistrations: manifest.value.extensions.map((extension: LetbuyyAppManifestExtension, index: number) => ({
        site_id: input.storeId,
        installation_id: input.installationId,
        app_id: input.appId,
        extension_handle: extension.handle,
        extension_type: appExtensionTypeForManifestExtension(extension),
        surface: extension.surface,
        target: extension.target,
        renderer: extension.renderer,
        source_url: extension.source.url || null,
        source_entrypoint: extension.source.entrypoint || null,
        scopes: extension.scopes,
        capabilities: extension.capabilities,
        settings: extension.settings,
        manifest_schema_version: manifest.value.schema_version,
        app_version: manifest.value.app.version,
        status: 'enabled',
        enabled_at: input.registeredAt,
        disabled_at: null,
        revoked_at: null,
        sort_order: index,
        created_by: input.installedBy,
        updated_by: input.installedBy,
      })),
      functionRegistrations: manifest.value.functions.map((fn: LetbuyyAppManifestFunction) => ({
        site_id: input.storeId,
        installation_id: input.installationId,
        app_id: input.appId,
        function_handle: fn.handle,
        name: fn.name,
        hooks: fn.hooks,
        runtime: 'wasm',
        wasm_module_url: fn.wasm.module_url,
        wasm_sha256: fn.wasm.sha256,
        wasm_entrypoint: fn.wasm.entrypoint,
        timeout_ms: fn.timeout_ms,
        memory_limit_kb: fn.memory_limit_kb,
        input_schema: fn.input_schema,
        output_schema: fn.output_schema,
        config: {
          manifest_schema_version: manifest.value.schema_version,
          manifest_app_slug: manifest.value.app.slug,
          deterministic: fn.deterministic,
        },
        manifest_schema_version: manifest.value.schema_version,
        app_version: manifest.value.app.version,
        status: 'enabled',
        enabled_at: input.registeredAt,
        disabled_at: null,
        revoked_at: null,
        created_by: input.installedBy,
        updated_by: input.installedBy,
      })),
    },
  };
}

function lifecycleStatusCounts(items: AppExtensionLifecycleItem[]): Record<AppExtensionRegistryStatus, number> {
  return items.reduce<Record<AppExtensionRegistryStatus, number>>((counts, item) => {
    counts[item.status] += 1;
    return counts;
  }, { enabled: 0, disabled: 0, revoked: 0 });
}

function lifecycleTimestamp(value: unknown): string | null {
  return appStoreStringOrNull(value);
}

function lifecycleHooks(value: unknown): LetbuyyAppFunctionHook[] {
  const allowed = new Set<string>(LETBUYY_APP_FUNCTION_HOOKS);
  return appStoreStringArray(value).filter((hook): hook is LetbuyyAppFunctionHook => allowed.has(hook));
}

function lifecycleExtensionItem(row: AppEngineJsonRecord, index: number): AppExtensionLifecycleItem {
  const surface = normalizeManifestSurface(row.surface);
  return {
    kind: 'extension',
    id: appStoreStringOrNull(row.id) || `extension-${index}`,
    app_id: appStoreStringOrNull(row.app_id) || '',
    installation_id: appStoreStringOrNull(row.installation_id) || '',
    handle: appStoreStringOrNull(row.extension_handle || row.handle) || `extension-${index}`,
    status: normalizeAppExtensionRegistryStatus(row.status) || 'disabled',
    app_version: appStoreStringOrNull(row.app_version),
    manifest_schema_version: appStoreStringOrNull(row.manifest_schema_version),
    ...(surface ? { surface } : {}),
    ...(appStoreStringOrNull(row.target) ? { target: appStoreStringOrNull(row.target) || undefined } : {}),
    enabled_at: lifecycleTimestamp(row.enabled_at),
    disabled_at: lifecycleTimestamp(row.disabled_at),
    revoked_at: lifecycleTimestamp(row.revoked_at),
    updated_at: lifecycleTimestamp(row.updated_at),
  };
}

function lifecycleFunctionItem(row: AppEngineJsonRecord, index: number): AppExtensionLifecycleItem {
  return {
    kind: 'function',
    id: appStoreStringOrNull(row.id) || `function-${index}`,
    app_id: appStoreStringOrNull(row.app_id) || '',
    installation_id: appStoreStringOrNull(row.installation_id) || '',
    handle: appStoreStringOrNull(row.function_handle || row.handle) || `function-${index}`,
    status: normalizeAppExtensionRegistryStatus(row.status) || 'disabled',
    app_version: appStoreStringOrNull(row.app_version),
    manifest_schema_version: appStoreStringOrNull(row.manifest_schema_version),
    hooks: lifecycleHooks(row.hooks),
    enabled_at: lifecycleTimestamp(row.enabled_at),
    disabled_at: lifecycleTimestamp(row.disabled_at),
    revoked_at: lifecycleTimestamp(row.revoked_at),
    updated_at: lifecycleTimestamp(row.updated_at),
  };
}

export function createAppExtensionReviewChecklist(): AppExtensionReviewChecklistItem[] {
  return [
    {
      key: 'sandboxed_admin_ui',
      label: 'Admin UI extensions',
      requirement: 'Admin UI extensions must render inside the extension-host sandbox and use scoped App Bridge tokens.',
      evidence: 'packages/extension-host and /v1/app-store/installations/:id/extensions',
    },
    {
      key: 'sandboxed_checkout_ui',
      label: 'Checkout UI extensions',
      requirement: 'Checkout UI extensions must render from HTTPS origins inside the checkout sandbox without changing core checkout totals.',
      evidence: 'GET /v1/storefront/:subdomain/checkout/extensions',
    },
    {
      key: 'portable_theme_app_blocks',
      label: 'Theme app blocks',
      requirement: 'Theme app blocks must register as WS11 portable Liquid app blocks and install without storefront source changes.',
      evidence: 'theme.app_block registry rows injected into storefront app_blocks',
    },
    {
      key: 'deterministic_wasm_functions',
      label: 'Wasm Functions',
      requirement: 'Functions must be deterministic Wasm modules with SHA-256 verification, no imports, and 1-5ms execution budgets.',
      evidence: 'services/api-gateway/src/extensions/app-functions-runtime.ts',
    },
    {
      key: 'revocation_and_observability',
      label: 'Lifecycle and observability',
      requirement: 'Install, enable, disable, uninstall, and Function execution must expose status snapshots plus per-extension/function metrics.',
      evidence: LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS.join(', '),
    },
  ];
}

export function createAppExtensionDeveloperHandoff(): AppExtensionDeveloperHandoff {
  return {
    manifest_schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
    sdk_source_files: [
      'packages/app-engine/src/index.ts',
      'packages/extension-host/src/index.ts',
      'packages/typescript/api-client/src/index.ts',
      'apps/developer-portal/src/lib/reference.ts',
    ],
    supported_surfaces: [...LETBUYY_APP_MANIFEST_EXTENSION_SURFACES],
    supported_function_hooks: [...LETBUYY_APP_FUNCTION_HOOKS],
    lifecycle_routes: [...LETBUYY_APP_EXTENSION_LIFECYCLE_ROUTES],
    observability_signals: [...LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS],
  };
}

export function createAppExtensionLifecycleSnapshot(input: {
  extensions?: unknown;
  functions?: unknown;
  observedAt: string;
}): AppExtensionLifecycleSnapshot {
  const extensions = parseAppStoreJsonRecordArray(input.extensions).map(lifecycleExtensionItem);
  const functions = parseAppStoreJsonRecordArray(input.functions).map(lifecycleFunctionItem);
  const items = [...extensions, ...functions];

  return {
    lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
    observed_at: input.observedAt,
    status_counts: lifecycleStatusCounts(items),
    extensions,
    functions,
    routes: [...LETBUYY_APP_EXTENSION_LIFECYCLE_ROUTES],
    observability: {
      signals: [...LETBUYY_APP_EXTENSION_OBSERVABILITY_SIGNALS],
      metric_dimensions: ['site_id', 'installation_id', 'app_id', 'registration_id', 'surface', 'hook', 'status'],
      log_correlation_keys: ['request_id', 'trace_id', 'site_id', 'installation_id', 'app_id'],
    },
    developer_handoff: createAppExtensionDeveloperHandoff(),
    review_checklist: createAppExtensionReviewChecklist(),
  };
}

export function createExampleLetbuyyAppManifest(): LetbuyyAppManifest {
  return {
    schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    app: {
      slug: 'letbuyy-loyalty',
      name: 'LetBuyy Loyalty',
      version: '1.0.0',
    },
    scopes: ['read_products', 'read_orders', 'write_discounts'],
    extensions: [
      {
        handle: 'admin-rewards-panel',
        name: 'Rewards panel',
        surface: 'admin.ui',
        target: 'admin.dashboard.widget',
        renderer: 'iframe',
        source: { url: 'https://apps.example.com/letbuyy-loyalty/admin' },
        scopes: ['read_products', 'read_orders'],
        capabilities: ['api.fetch', 'toast', 'resize'],
        settings: {},
      },
      {
        handle: 'checkout-rewards-banner',
        name: 'Checkout rewards banner',
        surface: 'checkout.ui',
        target: 'checkout.order-summary.render-after',
        renderer: 'iframe',
        source: { url: 'https://apps.example.com/letbuyy-loyalty/checkout' },
        scopes: ['read_orders'],
        capabilities: ['api.fetch', 'resize'],
        settings: {},
      },
      {
        handle: 'loyalty-rewards-card',
        name: 'Loyalty rewards card',
        surface: 'theme.app_block',
        target: 'storefront.home.after-hero',
        renderer: 'liquid_app_block',
        source: { entrypoint: 'blocks/loyalty-rewards-card.liquid' },
        scopes: ['read_products'],
        capabilities: [],
        settings: {
          heading: 'Earn rewards on every order',
          body: 'Logged-in shoppers can see their points from the loyalty app block.',
        },
      },
    ],
    functions: [
      {
        handle: 'loyalty-discount',
        name: 'Loyalty discount',
        hooks: ['cart.discount.calculate'],
        runtime: 'wasm',
        wasm: {
          module_url: 'https://apps.example.com/letbuyy-loyalty/functions/discount.wasm',
          sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          entrypoint: 'run',
        },
        timeout_ms: 5,
        memory_limit_kb: 512,
        input_schema: { version: '2026-06-05.ws13.discount-input' },
        output_schema: { version: '2026-06-05.ws13.discount-output' },
        deterministic: true,
      },
    ],
  };
}

function safeAppAdminEmbedUrl(value: unknown): URL | null {
  const href = appStoreStringOrNull(value);
  if (!href) return null;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:') return parsed;
  } catch {
    return null;
  }

  return null;
}

function normalizeAppBridgeCapabilities(value: unknown): AppBridgeCapability[] {
  const allowed = new Set<AppBridgeCapability>(['api.fetch', 'toast', 'resize', 'navigation.redirect']);
  const capabilities = appStoreStringArray(value)
    .filter((capability): capability is AppBridgeCapability => allowed.has(capability as AppBridgeCapability));

  return capabilities.length > 0 ? [...new Set(capabilities)] : DEFAULT_APP_BRIDGE_CAPABILITIES;
}

function isAdminEmbedExtension(extension: AppEngineJsonRecord): boolean {
  const type = appStoreStringOrNull(extension.type);
  return type === 'settings_page' || type === 'dashboard_widget' || type === 'admin_link';
}

function sortAppExtensions(left: AppEngineJsonRecord, right: AppEngineJsonRecord): number {
  const leftSort = Number(left.sort_order ?? 0);
  const rightSort = Number(right.sort_order ?? 0);
  return (Number.isFinite(leftSort) ? leftSort : 0) - (Number.isFinite(rightSort) ? rightSort : 0);
}

export function normalizeAppAdminEmbedSurface(
  installation: AppAdminEmbedInstallationRecord,
): AdminAppEmbedSurface | null {
  const installConfig = parseAppStoreJsonRecord(installation.config);
  const configuredEmbed = parseAppStoreJsonRecord(installConfig.admin_embed || installConfig.adminEmbed);
  const app = firstRelatedAppRecord(installation.marketplace_apps);
  const extensions = parseAppStoreJsonRecordArray(app.app_extensions)
    .filter(isAdminEmbedExtension)
    .sort(sortAppExtensions);
  const extension = extensions[0] || {};
  const extensionConfig = parseAppStoreJsonRecord(extension.config);
  const url = safeAppAdminEmbedUrl(
    configuredEmbed.url
      || configuredEmbed.embed_url
      || configuredEmbed.embedUrl
      || installConfig.admin_embed_url
      || installConfig.adminEmbedUrl
      || extensionConfig.url
      || extensionConfig.embed_url
      || extensionConfig.embedUrl
      || extension.target
      || app.app_url,
  );

  if (!url) return null;

  const title = appStoreStringOrNull(configuredEmbed.title)
    || appStoreStringOrNull(extension.label)
    || appStoreStringOrNull(app.name)
    || 'Installed app';
  const label = appStoreStringOrNull(configuredEmbed.label)
    || appStoreStringOrNull(extension.label)
    || title;
  const capabilities = normalizeAppBridgeCapabilities(
    configuredEmbed.capabilities || extensionConfig.capabilities || installConfig.bridge_capabilities,
  );

  return {
    title,
    label,
    url: url.toString(),
    origin: url.origin,
    target: appStoreStringOrNull(configuredEmbed.target || extension.target) || 'embedded',
    icon_url: appStoreStringOrNull(configuredEmbed.icon_url || configuredEmbed.iconUrl || app.icon_url),
    capabilities,
  };
}

export function createExampleAdminAppInstallation(embedUrl: string): AppAdminEmbedInstallationRecord {
  return {
    id: 'example-installation',
    app_id: 'letbuyy-example-app',
    store_id: 'example-store',
    status: 'active',
    scopes_granted: ['read_products'],
    config: {},
    marketplace_apps: {
      id: 'letbuyy-example-app',
      name: 'Example App Bridge',
      slug: 'example-app-bridge',
      icon_url: null,
      tagline: 'Embedded app bridge example',
      app_url: embedUrl,
      app_extensions: [{
        id: 'example-admin-embed',
        type: 'settings_page',
        target: embedUrl,
        label: 'Example App',
        config: {
          capabilities: DEFAULT_APP_BRIDGE_CAPABILITIES,
        },
        sort_order: 0,
      }],
    },
  };
}

export function normalizeAppInstallScopes(
  requestedScopes: unknown,
  allowedScopes: unknown,
): AppEnginePlanResult<string[]> {
  const allowed = new Set(appStoreStringArray(allowedScopes).map((scope) => scope.trim()).filter(Boolean));
  const requested = appStoreStringArray(requestedScopes)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = requested.length > 0 ? requested : [...allowed];
  const unsupported = scopes.filter((scope) => !allowed.has(scope));

  if (unsupported.length > 0) {
    return { ok: false, message: `Unsupported app scopes requested: ${unsupported.join(', ')}` };
  }

  return { ok: true, value: [...new Set(scopes)].sort() };
}

export function appOAuthClientId(app: MarketplaceAppOAuthRecord): string {
  return appStoreStringOrNull(app.oauth_client_id) || app.id;
}

export function normalizeAppOAuthRedirectUri(
  requestedRedirectUri: unknown,
  allowedRedirectUris: unknown,
): AppEnginePlanResult<string> {
  const requested = appStoreStringOrNull(requestedRedirectUri);
  if (!requested) {
    return { ok: false, message: 'redirect_uri is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(requested);
  } catch {
    return { ok: false, message: 'redirect_uri must be a valid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, message: 'redirect_uri must use HTTPS' };
  }

  const allowed = new Set(appStoreStringArray(allowedRedirectUris));
  if (allowed.has(parsed.toString())) {
    return { ok: true, value: parsed.toString() };
  }

  return { ok: false, message: 'redirect_uri is not registered for this app' };
}

export function buildAppOAuthRedirectUrl(
  redirectUri: string,
  params: { code: string; state?: string | null },
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('code', params.code);
  if (params.state) url.searchParams.set('state', params.state);
  return url.toString();
}

export function isSafeAppWebhookTarget(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function normalizeAppWebhookDefinitions(
  value: unknown,
): AppWebhookDefinition[] {
  const values = Array.isArray(value) ? value : Object.values(parseAppStoreJsonRecord(value));
  const definitions: Array<AppWebhookDefinition | null> = values
    .map((item): AppWebhookDefinition | null => {
      const record = parseAppStoreJsonRecord(item);
      const event = appStoreStringOrNull(record.event || record.event_type);
      const url = appStoreStringOrNull(record.url || record.target_url || record.webhook_url);
      if (!event || !url || record.is_active === false || !isSafeAppWebhookTarget(url)) {
        return null;
      }

      return {
        id: appStoreStringOrNull(record.id),
        event,
        url,
        secret: appStoreStringOrNull(record.secret || record.signing_secret),
        is_active: true,
      };
    });

  return definitions.filter((definition): definition is AppWebhookDefinition => definition !== null);
}

export function planAppWebhookSubscriptions(input: {
  app: MarketplaceAppLifecycleRecord;
  storeId: string;
  installationId: string;
  installedBy: string;
  webhookDefinitions: AppWebhookDefinition[];
  defaultSigningSecret: string;
}): AppWebhookSubscriptionInsert[] {
  const mandatoryTopics = Array.from(MANDATORY_COMPLIANCE_WEBHOOK_TOPICS);

  return input.webhookDefinitions.map((webhook) => ({
    site_id: input.storeId,
    name: `${input.app.name} ${webhook.event}`,
    target_url: webhook.url,
    event_types: Array.from(new Set([webhook.event, ...mandatoryTopics])),
    signing_secret: webhook.secret || input.defaultSigningSecret,
    status: 'active',
    metadata: {
      source: 'app-platform',
      app_id: input.app.id,
      installation_id: input.installationId,
      app_webhook_id: webhook.id || null,
      mandatory_compliance_topics: mandatoryTopics,
    },
    created_by: input.installedBy,
    updated_by: input.installedBy,
  }));
}

export function buildAppLifecycleEventPayload(input: {
  app: MarketplaceAppLifecycleRecord;
  installationId: string;
  storeId: string;
  installedBy: string;
  scopes: string[];
  occurredAt: string;
}): AppLifecycleEventPayload {
  return {
    app_id: input.app.id,
    app_name: input.app.name,
    installation_id: input.installationId,
    store_id: input.storeId,
    installed_by: input.installedBy,
    scopes: [...new Set(input.scopes)].sort(),
    occurred_at: input.occurredAt,
  };
}

function appBlockString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function firstAppBlockString(record: AppEngineJsonRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = appBlockString(record[key]);
    if (value) return value;
  }
  return fallback;
}

function safeAppBlockHref(value: unknown): string | undefined {
  const href = appBlockString(value);
  if (!href) return undefined;

  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return href;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function safeAppBlockIframeUrl(value: unknown): string | undefined {
  const href = appBlockString(value);
  if (!href) return undefined;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function definedAppBlockContent(content: AppBlockContent): AppBlockContent {
  return Object.fromEntries(
    Object.entries(content).filter(([, value]) => typeof value === 'string' && value.length > 0),
  ) as AppBlockContent;
}

export function normalizeAppBlockInstance(
  value: unknown,
  fallback: Partial<AppBlockInstance> = {},
): AppBlockInstance | null {
  const rawRecord = parseAppStoreJsonRecord(value);
  const settings = parseAppStoreJsonRecord(rawRecord.settings);
  const contentRecord = parseAppStoreJsonRecord(rawRecord.content);
  const merged: AppEngineJsonRecord = {
    ...settings,
    ...rawRecord,
  };
  const content = definedAppBlockContent({
    heading: firstAppBlockString(contentRecord, ['heading'], firstAppBlockString(merged, ['heading', 'headline'])),
    body: firstAppBlockString(contentRecord, ['body'], firstAppBlockString(merged, ['body', 'description'])),
    cta_label: firstAppBlockString(contentRecord, ['cta_label', 'ctaLabel'], firstAppBlockString(merged, ['cta_label', 'ctaLabel'])),
    cta_href: safeAppBlockHref(
      contentRecord.cta_href || contentRecord.ctaHref || merged.cta_href || merged.ctaHref,
    ),
  });

  const renderMode = merged.render_mode === 'iframe' || merged.renderMode === 'iframe' ? 'iframe' : 'inline';
  const normalized = AppBlockInstanceSchema.safeParse({
    id: firstAppBlockString(merged, ['id'], fallback.id || 'app-block'),
    app_id: firstAppBlockString(merged, ['app_id', 'appId'], fallback.app_id || 'unknown-app'),
    extension_id: firstAppBlockString(merged, ['extension_id', 'extensionId'], fallback.extension_id || 'storefront-block'),
    slot: firstAppBlockString(merged, ['slot'], fallback.slot || 'storefront.home.after-hero'),
    title: firstAppBlockString(merged, ['title', 'name'], fallback.title || 'Installed app'),
    render_mode: renderMode,
    settings,
    content,
    iframe_url: safeAppBlockIframeUrl(merged.iframe_url || merged.iframeUrl),
  });

  return normalized.success ? normalized.data : null;
}

export function normalizeAppBlockInstances(blocks: unknown, slot?: string): AppBlockInstance[] {
  const values = Array.isArray(blocks)
    ? blocks
    : Object.entries(parseAppStoreJsonRecord(blocks)).map(([id, value]) => ({ id, ...parseAppStoreJsonRecord(value) }));

  return values
    .map((block, index) => normalizeAppBlockInstance(block, {
      id: `app-block-${index + 1}`,
      slot: slot || 'storefront.home.after-hero',
    }))
    .filter((block): block is AppBlockInstance => block !== null)
    .filter((block) => !slot || block.slot === slot);
}

export function createExampleAppBlockInstance(slot = 'storefront.home.after-hero'): AppBlockInstance {
  return AppBlockInstanceSchema.parse({
    id: 'example-loyalty-rewards',
    app_id: 'letbuyy-loyalty',
    extension_id: 'loyalty-rewards-card',
    slot,
    title: 'Loyalty Rewards',
    render_mode: 'inline',
    settings: {},
    content: {
      heading: 'Earn 2x rewards on this store',
      body: 'Installed app blocks can now render inside portable JSON-contract storefront themes.',
      cta_label: 'View rewards',
      cta_href: '/account/rewards',
    },
  });
}

export interface BuiltForLetBuyyQualityGateCheck {
  key: 'performance' | 'reviews' | 'installs' | 'app_blocks' | 'privacy';
  passed: boolean;
  message: string;
  value: number | string | boolean | null;
}

export interface BuiltForLetBuyyQualityGateResult {
  passed: boolean;
  score: number;
  checks: BuiltForLetBuyyQualityGateCheck[];
}

function qualityGateNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function qualityGateHttpsUrl(value: unknown): boolean {
  const href = appStoreStringOrNull(value);
  if (!href) return false;

  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasStorefrontAppBlock(value: unknown): boolean {
  const records = Array.isArray(value)
    ? value.map((item) => parseAppStoreJsonRecord(item))
    : Object.values(parseAppStoreJsonRecord(value)).map((item) => parseAppStoreJsonRecord(item));

  return records.some((record) => {
    const type = appStoreStringOrNull(record.type);
    return type === 'storefront_block' || type === 'app-block' || type === 'app_block';
  });
}

export function evaluateBuiltForLetBuyyQualityGate(input: AppEngineJsonRecord): BuiltForLetBuyyQualityGateResult {
  const performanceScore = qualityGateNumber(
    input.performance_score || input.performanceScore || input.lighthouse_performance,
  );
  const ratingAverage = qualityGateNumber(input.rating_avg || input.average_rating || input.avg_rating);
  const reviewCount = qualityGateNumber(input.review_count || input.reviews_count);
  const installCount = qualityGateNumber(input.install_count || input.installs);
  const hasAppBlock = hasStorefrontAppBlock(input.app_extensions || input.extensions || input.app_blocks);
  const privacyOk = qualityGateHttpsUrl(input.privacy_policy_url || input.privacy_url)
    && qualityGateHttpsUrl(input.app_url || input.embedded_url || input.website_url);

  const checks: BuiltForLetBuyyQualityGateCheck[] = [
    {
      key: 'performance',
      passed: performanceScore >= 70,
      message: 'Lighthouse performance score must be at least 70 before listing.',
      value: performanceScore,
    },
    {
      key: 'reviews',
      passed: reviewCount >= 1 && ratingAverage >= 4,
      message: 'Built-for-LetBuyy listing requires at least one qualifying review and a 4.0+ rating.',
      value: `${ratingAverage.toFixed(1)} (${reviewCount} reviews)`,
    },
    {
      key: 'installs',
      passed: installCount >= 1,
      message: 'Built-for-LetBuyy listing requires at least one successful install signal.',
      value: installCount,
    },
    {
      key: 'app_blocks',
      passed: hasAppBlock,
      message: 'App must expose at least one storefront app block extension.',
      value: hasAppBlock,
    },
    {
      key: 'privacy',
      passed: privacyOk,
      message: 'App and privacy URLs must use HTTPS.',
      value: privacyOk,
    },
  ];
  const passedCount = checks.filter((check) => check.passed).length;

  return {
    passed: passedCount === checks.length,
    score: Math.round((passedCount / checks.length) * 100),
    checks,
  };
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
  const qualityGateInput = parseAppStoreJsonRecord(body.quality_gate || body.built_for_letbuyy || body.builtForLetBuyy);
  if (Object.keys(qualityGateInput).length > 0 && body.save_as_draft !== true) {
    const gate = evaluateBuiltForLetBuyyQualityGate({
      ...qualityGateInput,
      app_url: appUrl,
      privacy_policy_url: privacyUrl,
      app_extensions: body.app_extensions || body.extensions || qualityGateInput.app_extensions || qualityGateInput.extensions,
      app_blocks: body.app_blocks || qualityGateInput.app_blocks,
    });

    if (!gate.passed) {
      const failed = gate.checks.filter((check) => !check.passed).map((check) => check.key).join(', ');
      return { ok: false, message: `Built-for-LetBuyy quality gate failed: ${failed}` };
    }
  }

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
