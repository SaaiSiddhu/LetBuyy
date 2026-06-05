import type {
  AdminAppBridgeSession,
  AppBridgeCapability,
  AppExtensionRegistration,
} from '@letbuyy/shared-types';

export const LETBUYY_EXTENSION_HOST_VERSION = '2026-06-05.ws13.x2' as const;

export const ADMIN_UI_EXTENSION_TARGETS = [
  'admin.dashboard.widget',
  'admin.settings.page',
  'admin.product.action',
  'admin.order.action',
] as const;

export const ADMIN_UI_EXTENSION_RENDERERS = ['iframe', 'web_component'] as const;
export const ADMIN_EXTENSION_IFRAME_SANDBOX = 'allow-forms allow-popups allow-same-origin allow-scripts' as const;
export const ADMIN_EXTENSION_IFRAME_ALLOW = 'clipboard-read; clipboard-write' as const;

export type AdminUiExtensionTarget = typeof ADMIN_UI_EXTENSION_TARGETS[number];
export type AdminUiExtensionRenderer = typeof ADMIN_UI_EXTENSION_RENDERERS[number];

export interface AdminUiExtensionHostRegistration {
  id: string;
  siteId: string;
  appId: string;
  installationId: string;
  handle: string;
  title: string;
  surface: 'admin.ui';
  target: AdminUiExtensionTarget;
  renderer: AdminUiExtensionRenderer;
  url: string;
  origin: string;
  scopes: string[];
  capabilities: AppBridgeCapability[];
  sortOrder: number;
}

export interface AdminUiExtensionFramePolicy {
  sandbox: typeof ADMIN_EXTENSION_IFRAME_SANDBOX;
  allow: typeof ADMIN_EXTENSION_IFRAME_ALLOW;
  referrerPolicy: 'no-referrer';
}

export interface AdminUiExtensionBridgeContext {
  store: string;
  store_id: string;
  installation_id: string;
  app_id: string;
  api_base_url: string;
  capabilities: AppBridgeCapability[];
  extension: {
    id: string;
    handle: string;
    target: AdminUiExtensionTarget;
    renderer: AdminUiExtensionRenderer;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeHttpsUrl(value: unknown): URL | null {
  const href = stringValue(value);
  if (!href) return null;

  try {
    const url = new URL(href);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function normalizeTarget(value: unknown): AdminUiExtensionTarget | null {
  const target = stringValue(value);
  if (!target) return null;
  return (ADMIN_UI_EXTENSION_TARGETS as readonly string[]).includes(target)
    ? target as AdminUiExtensionTarget
    : null;
}

function normalizeRenderer(value: unknown): AdminUiExtensionRenderer {
  return value === 'web_component' ? 'web_component' : 'iframe';
}

function normalizeCapabilities(values: unknown): AppBridgeCapability[] {
  const allowed = new Set<AppBridgeCapability>(['api.fetch', 'toast', 'resize', 'navigation.redirect']);
  const capabilities = Array.isArray(values)
    ? values.filter((capability): capability is AppBridgeCapability => allowed.has(capability as AppBridgeCapability))
    : [];
  return capabilities.length > 0 ? [...new Set(capabilities)] : ['api.fetch', 'toast', 'resize'];
}

function extensionTitle(registration: AppExtensionRegistration): string {
  const settings = isRecord(registration.settings) ? registration.settings : {};
  return stringValue(settings.title)
    || stringValue(settings.label)
    || stringValue(registration.extension_handle)
    || 'Admin extension';
}

export function normalizeAdminUiExtensionRegistration(
  registration: AppExtensionRegistration,
): AdminUiExtensionHostRegistration | null {
  if (registration.status !== 'enabled' || registration.surface !== 'admin.ui') return null;
  const target = normalizeTarget(registration.target);
  if (!target) return null;

  const url = safeHttpsUrl(registration.source_url);
  if (!url) return null;

  const renderer = normalizeRenderer(registration.renderer);
  return {
    id: registration.id,
    siteId: registration.site_id,
    appId: registration.app_id,
    installationId: registration.installation_id,
    handle: registration.extension_handle,
    title: extensionTitle(registration),
    surface: 'admin.ui',
    target,
    renderer,
    url: url.toString(),
    origin: url.origin,
    scopes: Array.isArray(registration.scopes) ? registration.scopes : [],
    capabilities: normalizeCapabilities(registration.capabilities),
    sortOrder: Number.isFinite(Number(registration.sort_order)) ? Number(registration.sort_order) : 0,
  };
}

export function listEnabledAdminUiExtensions(
  registrations: readonly AppExtensionRegistration[],
): AdminUiExtensionHostRegistration[] {
  return registrations
    .map((registration) => normalizeAdminUiExtensionRegistration(registration))
    .filter((registration): registration is AdminUiExtensionHostRegistration => registration !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

export function createAdminUiExtensionFramePolicy(): AdminUiExtensionFramePolicy {
  return {
    sandbox: ADMIN_EXTENSION_IFRAME_SANDBOX,
    allow: ADMIN_EXTENSION_IFRAME_ALLOW,
    referrerPolicy: 'no-referrer',
  };
}

export function createAdminUiExtensionBridgeContext(input: {
  session: AdminAppBridgeSession;
  extension: AdminUiExtensionHostRegistration;
  store: string;
}): AdminUiExtensionBridgeContext {
  return {
    store: input.store,
    store_id: input.session.bridge.store_id,
    installation_id: input.session.bridge.installation_id,
    app_id: input.session.bridge.app_id,
    api_base_url: input.session.bridge.api_base_url,
    capabilities: input.extension.capabilities,
    extension: {
      id: input.extension.id,
      handle: input.extension.handle,
      target: input.extension.target,
      renderer: input.extension.renderer,
    },
  };
}
