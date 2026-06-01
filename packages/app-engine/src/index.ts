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

function safeAppAdminEmbedUrl(value: unknown, allowLocalhost = false): URL | null {
  const href = appStoreStringOrNull(value);
  if (!href) return null;

  try {
    const parsed = new URL(href);
    const isLocalHttp = allowLocalhost
      && parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (parsed.protocol === 'https:' || isLocalHttp) return parsed;
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
  options: { allowLocalhost?: boolean } = {},
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
    options.allowLocalhost === true,
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

export function isSafeAppWebhookTarget(targetUrl: string, allowLocalhost = false): boolean {
  try {
    const url = new URL(targetUrl);
    const isLocalHttp = allowLocalhost
      && url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return (url.protocol === 'https:' || isLocalHttp) && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function normalizeAppWebhookDefinitions(
  value: unknown,
  options: { allowLocalhost?: boolean } = {},
): AppWebhookDefinition[] {
  const values = Array.isArray(value) ? value : Object.values(parseAppStoreJsonRecord(value));
  const definitions: Array<AppWebhookDefinition | null> = values
    .map((item): AppWebhookDefinition | null => {
      const record = parseAppStoreJsonRecord(item);
      const event = appStoreStringOrNull(record.event || record.event_type);
      const url = appStoreStringOrNull(record.url || record.target_url || record.webhook_url);
      if (!event || !url || record.is_active === false || !isSafeAppWebhookTarget(url, options.allowLocalhost === true)) {
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
    const isLocalHttp = parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (parsed.protocol === 'https:' || isLocalHttp) {
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
